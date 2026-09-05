'use client';

/* The Globe — real geography, real relationships.
   Country borders from world-atlas (110m), company marks at physical HQ /
   operations coordinates, supply relationships as lifted arcs. Depth
   engine per docs/design/depth-globe-map-patterns.md: target-ref zoom,
   per-frame lerp, zoom-floor handoff. One magenta focus: the selection
   (falling back to the Taiwan Strait ring when nothing is selected). */

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import * as topojson from 'topojson-client';
import type { Topology, Objects } from 'topojson-specification';
import worldData from 'world-atlas/countries-110m.json';
import seedData from '@/data/nodes_seed.json';
import exportControls from '@/data/export_controls.json';
import peopleData from '@/data/people_seed.json';
import { GLOBE_R, latLonToVec3, spreadCoords, arcCurve } from '@/lib/geo';

/* world-atlas numeric ids for the countries we shade */
type ArcsMode = 'supply' | 'money' | 'people';

type MoneyKind = 'investment' | 'vc' | 'services' | 'hardware';
function moneyKind(rel: string): MoneyKind | null {
  if (/TRAY|RACK/.test(rel)) return null;
  if (/CAPITAL_ROUND/.test(rel)) return 'vc';
  if (/CAPITAL|BACKSTOP|WARRANT/.test(rel)) return 'investment';
  if (/COMPUTE_CONTRACT|STARGATE|AZURE|TPU|TRAINIUM|GPU_CLOUD|COMPUTE_SUPPLY/.test(rel)) return 'services';
  if (/GPU_SUPPLY|DOJO|ROBOT_COMPUTE|ADVANCED_NODE/.test(rel)) return 'hardware';
  return null;
}

const COUNTRY_IDS: Record<string, string> = {
  US: '840', JP: '392', TW: '158', KR: '410', NL: '528',
  FR: '250', GB: '826', TH: '764', CN: '156',
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const CAM_MIN = 6.4;
const CAM_MAX = 22;
const CAM_DEFAULT = 13.5;

interface GeoNode {
  id: string;
  ticker: string;
  name: string;
  basket: string;
  country?: string;
  chokepoint_rating: number;
  market_data?: { market_cap_usd?: number | null };
  [key: string]: unknown;
}

interface GlobeViewProps {
  nodes: GeoNode[];
  activeTicker: string;
  onSelect: (node: GeoNode) => void;
  onZoomFloor?: () => void;
}

/* palette resolved once from tokens — three.js can't parse CSS vars */
function usePalette() {
  return useMemo(() => {
    const s = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const t = (name: string, fb: string) => s?.getPropertyValue(name).trim() || fb;
    return {
      ink: t('--ink', '#1A1418'),
      cream: t('--cream', '#F2F0EC'),
      plum: t('--plum', '#4A3848'),
      magenta: t('--magenta', '#F0257E'),
      gold: t('--gold', '#9A7B2F'),
      goldMatte: t('--gold-matte', '#B5A06A'),
      neon: t('--neon', '#C9F227'),
      terracotta: t('--terracotta', '#E8783A'),
      roles: {
        BK_CHOKE: t('--gold', '#9A7B2F'),
        BK_FRONT: t('--neon', '#C9F227'),
        BK_BACK: t('--spectrum-violet', '#8B5CF6'),
        BK_FABLESS: t('--spectrum-orange', '#FF8A2A'),
        BK_INFRA: t('--spectrum-coral', '#FF5A3C'),
      } as Record<string, string>,
    };
  }, []);
}

function CountryBorders({ color }: { color: string }) {
  const geometry = useMemo(() => {
    const topo = worldData as unknown as Topology<Objects>;
    const mesh = topojson.mesh(topo, topo.objects.countries);
    const positions: number[] = [];
    for (const line of mesh.coordinates as [number, number][][]) {
      for (let i = 0; i < line.length - 1; i++) {
        const a = latLonToVec3(line[i][1], line[i][0], GLOBE_R * 1.001);
        const b = latLonToVec3(line[i + 1][1], line[i + 1][0], GLOBE_R * 1.001);
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, []);
  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 }),
    [color]
  );
  return <primitive object={useMemo(() => new THREE.LineSegments(geometry, material), [geometry, material])} />;
}

/* ── dot-matrix country shading (heat dots per VISUAL-DATA-SYSTEM §6) ── */

function pointInRings(lon: number, lat: number, polygons: [number, number][][][]): boolean {
  const inRing = (ring: [number, number][]) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  for (const poly of polygons) {
    if (!inRing(poly[0])) continue;
    if (poly.slice(1).some(inRing)) continue; // inside a hole
    return true;
  }
  return false;
}

function useCountryDotClouds() {
  return useMemo(() => {
    const topo = worldData as unknown as Topology<Objects>;
    const fc = topojson.feature(topo, topo.objects.countries) as unknown as {
      features: { id: string; geometry: { type: string; coordinates: unknown } }[];
    };
    const clouds: Record<string, THREE.Vector3[]> = {};
    for (const [code, id] of Object.entries(COUNTRY_IDS)) {
      const f = fc.features.find((x) => String(x.id) === id);
      if (!f) continue;
      const polys = (
        f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
      ) as [number, number][][][];
      let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
      for (const poly of polys)
        for (const [lon, lat] of poly[0]) {
          minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
          minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
        }
      const span = (maxLon - minLon) * (maxLat - minLat);
      const step = span > 800 ? 1.5 : span > 60 ? 1.0 : 0.55;
      const pts: THREE.Vector3[] = [];
      for (let lat = minLat + step / 2; lat < maxLat; lat += step)
        for (let lon = minLon + step / 2; lon < maxLon; lon += step)
          if (pointInRings(lon, lat, polys)) pts.push(latLonToVec3(lat, lon, GLOBE_R * 1.003));
      clouds[code] = pts;
    }
    return clouds;
  }, []);
}

function DotCloud({ points, color, opacity, size }: { points: THREE.Vector3[]; color: string; opacity: number; size: number }) {
  const object = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(points);
    const m = new THREE.PointsMaterial({ color, size, transparent: true, opacity, sizeAttenuation: true });
    return new THREE.Points(g, m);
  }, [points, color, opacity, size]);
  return <primitive object={object} />;
}

function CountryShading({
  mode,
  densities,
  palette,
}: {
  mode: 'density' | 'controls';
  densities: Record<string, number>;
  palette: ReturnType<typeof usePalette>;
}) {
  const clouds = useCountryDotClouds();
  const maxD = Math.max(0.001, ...Object.values(densities));
  const regimeRole: Record<string, string> = {};
  for (const r of exportControls.regimes) regimeRole[r.country] = r.role;

  return (
    <group>
      {Object.entries(clouds).map(([code, pts]) => {
        if (mode === 'density') {
          const d = densities[code] ?? 0;
          if (d === 0) return <DotCloud key={code} points={pts} color={palette.plum} opacity={0.25} size={0.045} />;
          return (
            <DotCloud
              key={code}
              points={pts}
              color={palette.gold}
              opacity={0.2 + 0.6 * (d / maxD)}
              size={0.05 + 0.03 * (d / maxD)}
            />
          );
        }
        const role = regimeRole[code];
        const color =
          role === 'controller' ? palette.gold
          : role === 'aligned' ? palette.goldMatte
          : role === 'counter-controller' ? palette.terracotta
          : palette.plum;
        const opacity = role ? (role === 'aligned' ? 0.45 : 0.7) : 0.18;
        return <DotCloud key={code} points={pts} color={color} opacity={opacity} size={role ? 0.06 : 0.045} />;
      })}
    </group>
  );
}

/* ── pulse rings on live telemetry events (interaction spec §5) ── */

const MAX_TRANSIENTS = 14;
const PULSE_DUR = 2200;

interface Pulse { pos: THREE.Vector3; born: number; color: string }

function PulseRings({ pulses }: { pulses: React.MutableRefObject<Pulse[]> }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const { camera } = useThree();
  useFrame(() => {
    const now = performance.now();
    pulses.current = pulses.current.filter((p) => now - p.born < PULSE_DUR);
    for (let i = 0; i < MAX_TRANSIENTS; i++) {
      const mesh = meshes.current[i];
      if (!mesh) continue;
      const p = pulses.current[i];
      if (!p) {
        mesh.visible = false;
        continue;
      }
      const tt = (now - p.born) / PULSE_DUR;
      const eased = 1 - Math.pow(1 - tt, 2.4);
      mesh.visible = true;
      mesh.position.copy(p.pos);
      mesh.quaternion.copy(camera.quaternion);
      const s = 0.15 + eased * 1.1;
      mesh.scale.setScalar(s);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - tt) * 0.7;
      mat.color.set(p.color);
    }
  });
  return (
    <group>
      {Array.from({ length: MAX_TRANSIENTS }).map((_, i) => (
        <mesh key={i} ref={(m) => { meshes.current[i] = m; }} visible={false}>
          <ringGeometry args={[0.9, 1, 40]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function Arcs({
  edges,
  positions,
  focusId,
  palette,
  mode,
}: {
  edges: { source: string; target: string; criticality: string; relationship: string; amount_usd_b?: number }[];
  positions: Record<string, THREE.Vector3>;
  focusId: string | null;
  palette: ReturnType<typeof usePalette>;
  mode: ArcsMode;
}) {
  const lines = useMemo(() => {
    if (mode === 'people') return [];
    const kindColor: Record<MoneyKind, string> = {
      hardware: palette.roles.BK_FABLESS,
      investment: palette.neon,
      services: palette.roles.BK_BACK,
      vc: palette.goldMatte,
    };
    return edges
      .map((e) => {
        const a = positions[e.source];
        const b = positions[e.target];
        if (!a || !b) return null;
        const kind = moneyKind(e.relationship);
        if (mode === 'money') {
          if (!kind) return null;
        } else if (e.amount_usd_b != null) {
          return null; // capital flows live in the Money lens
        }
        const touching = focusId && (e.source === focusId || e.target === focusId);
        const faded = focusId && !touching;
        const pts = arcCurve(a, b).getPoints(40);
        const g = new THREE.BufferGeometry().setFromPoints(pts);
        if (mode === 'money' && kind) {
          const m = new THREE.LineDashedMaterial({
            color: kindColor[kind],
            transparent: true,
            opacity: faded ? 0.05 : touching ? 0.95 : 0.7,
            dashSize: 0.14,
            gapSize: 0.08,
            linewidth: 1,
          });
          const line = new THREE.Line(g, m);
          line.computeLineDistances();
          return line;
        }
        const m = new THREE.LineBasicMaterial({
          color: touching ? palette.gold : e.criticality === 'CRITICAL' ? palette.goldMatte : palette.plum,
          transparent: true,
          opacity: faded ? 0.05 : touching ? 0.95 : e.criticality === 'CRITICAL' ? 0.55 : 0.35,
        });
        return new THREE.Line(g, m);
      })
      .filter(Boolean) as THREE.Line[];
  }, [edges, positions, focusId, palette, mode]);
  return (
    <group>
      {lines.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
    </group>
  );
}

/* People lens: 51 humans pinned at their primary org's HQ, diaspora as arcs */
interface PersonRec {
  id: string;
  name: string;
  roles: { org: string; relationship: string }[];
  lineage?: { from_org: string; note: string }[];
}

function PeopleLayer({
  positions,
  palette,
  focusId,
}: {
  positions: Record<string, THREE.Vector3>;
  palette: ReturnType<typeof usePalette>;
  focusId: string | null;
}) {
  const [hoveredP, setHoveredP] = useState<string | null>(null);
  const people = peopleData.people as PersonRec[];

  const marks = useMemo(() => {
    const byOrg = new Map<string, number>();
    return people
      .map((p) => {
        const org = p.roles[0]?.org ?? p.lineage?.[0]?.from_org;
        if (!org || !positions[org]) return null;
        const i = byOrg.get(org) ?? 0;
        byOrg.set(org, i + 1);
        const base = positions[org];
        const n = base.clone().normalize();
        const tangent = new THREE.Vector3(0, 1, 0).cross(n).normalize();
        const bitangent = n.clone().cross(tangent);
        const ang = i * 2.4;
        const rad = 0.09 + 0.05 * Math.sqrt(i);
        const pos = base
          .clone()
          .add(tangent.clone().multiplyScalar(Math.cos(ang) * rad))
          .add(bitangent.clone().multiplyScalar(Math.sin(ang) * rad))
          .normalize()
          .multiplyScalar(GLOBE_R * 1.03);
        return { p, org, pos };
      })
      .filter(Boolean) as { p: PersonRec; org: string; pos: THREE.Vector3 }[];
  }, [people, positions]);

  const lineageLines = useMemo(() => {
    const lines: THREE.Line[] = [];
    for (const m of marks) {
      for (const l of m.p.lineage ?? []) {
        const from = positions[l.from_org];
        if (!from) continue;
        const pts = arcCurve(from.clone().normalize().multiplyScalar(GLOBE_R * 1.02), m.pos).getPoints(32);
        const g = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineDashedMaterial({
          color: palette.goldMatte, transparent: true, opacity: 0.5, dashSize: 0.1, gapSize: 0.07,
        });
        const line = new THREE.Line(g, mat);
        line.computeLineDistances();
        lines.push(line);
      }
    }
    return lines;
  }, [marks, positions, palette]);

  return (
    <group>
      {lineageLines.map((l, i) => (
        <primitive key={`lin-${i}`} object={l} />
      ))}
      {marks.map(({ p, org, pos }) => {
        const lit = !focusId || org === focusId || (p.lineage ?? []).some((l) => l.from_org === focusId);
        const showLabel = hoveredP === p.id || (focusId != null && org === focusId);
        return (
          <group key={p.id} position={pos}>
            <mesh
              onPointerOver={(e) => { e.stopPropagation(); setHoveredP(p.id); document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { setHoveredP(null); document.body.style.cursor = 'auto'; }}
            >
              <sphereGeometry args={[0.055, 10, 10]} />
              <meshBasicMaterial color={palette.cream} transparent opacity={lit ? 0.95 : 0.25} />
            </mesh>
            {showLabel && (
              <Html center distanceFactor={11} style={{ pointerEvents: 'none' }}>
                <div className="mono" style={{
                  fontSize: 11, letterSpacing: '0.08em', whiteSpace: 'nowrap',
                  color: palette.cream, textShadow: `0 0 4px ${palette.ink}, 0 0 8px ${palette.ink}`,
                  transform: 'translateY(-14px)',
                }}>
                  {p.name}
                  <span style={{ color: palette.goldMatte, marginLeft: 6 }}>
                    {p.roles[0]?.relationship.replace(/_/g, ' ').toLowerCase() ?? 'alumni'}
                  </span>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

/* dashed magenta attention ring around the Taiwan Strait */
function StraitRing({ color }: { color: string }) {
  const object = useMemo(() => {
    const center = latLonToVec3(24.5, 120.5, GLOBE_R * 1.004);
    const n = center.clone().normalize();
    const tangent = new THREE.Vector3(0, 1, 0).cross(n).normalize();
    const bitangent = n.clone().cross(tangent);
    const pts: THREE.Vector3[] = [];
    const R = 0.55;
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push(
        center
          .clone()
          .add(tangent.clone().multiplyScalar(Math.cos(a) * R))
          .add(bitangent.clone().multiplyScalar(Math.sin(a) * R))
          .normalize()
          .multiplyScalar(GLOBE_R * 1.01)
      );
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const m = new THREE.LineDashedMaterial({ color, dashSize: 0.08, gapSize: 0.06, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(g, m);
    line.computeLineDistances();
    return line;
  }, [color]);
  return <primitive object={object} />;
}

function ZoomRig({ onZoomFloor }: { onZoomFloor?: () => void }) {
  const { gl, camera } = useThree();
  const target = useRef(CAM_DEFAULT);
  const floorFired = useRef(false);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      target.current = clamp(target.current + dy * (e.ctrlKey ? 0.06 : 0.012), CAM_MIN, CAM_MAX);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [gl]);

  useFrame((state) => {
    const cur = tmp.copy(state.camera.position);
    const len = Math.max(cur.length(), 1e-4);
    const next = THREE.MathUtils.lerp(len, target.current, 0.08);
    state.camera.position.copy(cur.divideScalar(len)).multiplyScalar(next);

    if (!floorFired.current && target.current <= CAM_MIN + 0.05 && next <= CAM_MIN + 0.3) {
      floorFired.current = true;
      onZoomFloor?.();
    } else if (target.current > CAM_MIN + 1.5) {
      floorFired.current = false;
    }
  });

  void camera;
  return null;
}

function Scene({
  nodes,
  activeTicker,
  onSelect,
  onZoomFloor,
  shadeMode,
  arcsMode,
}: GlobeViewProps & { shadeMode: 'density' | 'controls'; arcsMode: ArcsMode }) {
  const palette = usePalette();
  const [hovered, setHovered] = useState<string | null>(null);
  const pulses = useRef<Pulse[]>([]);
  const prevPrices = useRef<Map<string, number>>(new Map());

  const coords = useMemo(() => spreadCoords(nodes.map((n) => n.id)), [nodes]);
  const positions = useMemo(() => {
    const out: Record<string, THREE.Vector3> = {};
    for (const n of nodes) {
      const c = coords[n.id];
      if (c) out[n.id] = latLonToVec3(c[0], c[1], GLOBE_R * 1.015);
    }
    return out;
  }, [nodes, coords]);

  const maxCap = Math.max(1, ...nodes.map((n) => n.market_data?.market_cap_usd ?? 0));
  const sizeOf = (n: GeoNode) => {
    const cap = n.market_data?.market_cap_usd ?? 0;
    return 0.07 + Math.sqrt(cap / maxCap) * 0.3; // compressive curve
  };

  const active = nodes.find((n) => n.ticker === activeTicker);
  const focusId = active?.id ?? null;

  const edges = seedData.edges as { source: string; target: string; criticality: string; relationship: string; amount_usd_b?: number }[];
  const neighborIds = useMemo(() => {
    const s = new Set<string>();
    if (!focusId) return s;
    s.add(focusId);
    for (const e of edges) {
      if (e.source === focusId) s.add(e.target);
      if (e.target === focusId) s.add(e.source);
    }
    return s;
  }, [edges, focusId]);

  // labels: top movers by cap + the focus + hover (screen declutter, cheap form)
  const labeled = useMemo(() => {
    const top = [...nodes]
      .sort((a, b) => (b.market_data?.market_cap_usd ?? 0) - (a.market_data?.market_cap_usd ?? 0))
      .slice(0, 8)
      .map((n) => n.id);
    const s = new Set(top);
    if (focusId) s.add(focusId);
    if (hovered) s.add(hovered);
    return s;
  }, [nodes, focusId, hovered]);

  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* chokepoint density per country (authority-weighted) */
  const densities = useMemo(() => {
    const d: Record<string, number> = {};
    for (const n of nodes) {
      if (!n.country) continue;
      const w = n.chokepoint_rating >= 0.9 ? n.chokepoint_rating : n.chokepoint_rating * 0.15;
      d[n.country] = (d[n.country] ?? 0) + w;
    }
    return d;
  }, [nodes]);

  /* live-data pulses: a refreshed price lands as a ring at the HQ */
  useEffect(() => {
    if (reduced) return;
    const now = performance.now();
    for (const n of nodes) {
      const price = (n.market_data as { price?: number | null } | undefined)?.price;
      if (price == null) continue;
      const prev = prevPrices.current.get(n.id);
      prevPrices.current.set(n.id, price);
      if (prev == null || prev === price) continue;
      const pos = positions[n.id];
      if (!pos) continue;
      if (pulses.current.length >= MAX_TRANSIENTS) pulses.current.shift();
      pulses.current.push({
        pos: pos.clone().normalize().multiplyScalar(GLOBE_R * 1.02),
        born: now,
        color: price >= prev ? palette.neon : palette.terracotta,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  return (
    <>
      <ambientLight intensity={1.4} />
      <mesh>
        <sphereGeometry args={[GLOBE_R, 48, 48]} />
        <meshBasicMaterial color={new THREE.Color(palette.ink).offsetHSL(0, 0, 0.03)} />
      </mesh>
      <CountryBorders color={palette.cream} />
      <CountryShading mode={shadeMode} densities={densities} palette={palette} />
      <PulseRings pulses={pulses} />
      <StraitRing color={focusId ? palette.gold : palette.magenta} />
      <Arcs edges={edges} positions={positions} focusId={focusId} palette={palette} mode={arcsMode} />
      {arcsMode === 'people' && <PeopleLayer positions={positions} palette={palette} focusId={focusId} />}

      {nodes.map((n) => {
        const pos = positions[n.id];
        if (!pos) return null;
        const r = sizeOf(n);
        const isFocus = n.id === focusId;
        const isAuthority = n.chokepoint_rating >= 0.9;
        const dimmed = focusId && !neighborIds.has(n.id) && n.id !== hovered;
        const color = isFocus ? palette.magenta : palette.roles[n.basket] ?? palette.plum;
        return (
          <group key={n.id} position={pos}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                onSelect(n);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHovered(n.id);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHovered(null);
                document.body.style.cursor = 'auto';
              }}
            >
              <sphereGeometry args={[r, 16, 16]} />
              <meshBasicMaterial color={color} transparent opacity={dimmed ? 0.25 : 1} />
            </mesh>
            {isAuthority && (
              <mesh>
                <sphereGeometry args={[r + 0.05, 12, 12]} />
                <meshBasicMaterial color={palette.gold} wireframe transparent opacity={dimmed ? 0.1 : 0.35} />
              </mesh>
            )}
            {labeled.has(n.id) && !dimmed && (
              <Html center distanceFactor={12} style={{ pointerEvents: 'none' }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    color: isFocus ? palette.magenta : palette.cream,
                    textShadow: `0 0 4px ${palette.ink}, 0 0 8px ${palette.ink}`,
                    transform: 'translateY(-16px)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {n.ticker}
                </div>
              </Html>
            )}
          </group>
        );
      })}

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        rotateSpeed={0.55}
        autoRotate={!reduced && !focusId}
        autoRotateSpeed={0.35}
      />
      <ZoomRig onZoomFloor={onZoomFloor} />
    </>
  );
}

const dimc = (pct: number) => `color-mix(in oklab, var(--cream) ${pct}%, transparent)`;

export default function GlobeView(props: GlobeViewProps) {
  const [shadeMode, setShadeMode] = useState<'density' | 'controls'>('density');
  const [arcsMode, setArcsMode] = useState<ArcsMode>('supply');

  return (
    <div className="relative w-full h-full select-none" style={{ background: 'var(--ink)' }}>
      <Canvas
        camera={{ position: [7, 5.4, -10.5], fov: 42 }}
        dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene {...props} shadeMode={shadeMode} arcsMode={arcsMode} />
      </Canvas>

      <div className="absolute top-4 left-6 z-10 pointer-events-none">
        <div className="descent-eyebrow on-noir">Geography / the physical board</div>
      </div>

      {/* arc lens: what the arcs mean */}
      <div className="absolute top-16 left-6 z-10 flex items-center gap-1.5">
        {(['supply', 'money', 'people'] as const).map((m) => {
          const on = arcsMode === m;
          return (
            <button
              key={m}
              onClick={() => setArcsMode(m)}
              className="mono px-2.5 py-1 text-[11px] rounded-full cursor-pointer capitalize"
              style={{
                color: on ? 'var(--ink)' : dimc(65),
                background: on ? 'var(--cream)' : 'color-mix(in oklab, var(--ink) 70%, transparent)',
                border: `1px solid ${on ? 'var(--cream)' : dimc(14)}`,
              }}
            >
              {m}
            </button>
          );
        })}
      </div>

      {/* shading mode toggle */}
      <div
        className="absolute top-16 right-6 z-10 flex items-center gap-1 p-0.5 rounded-full"
        style={{
          border: '1px solid color-mix(in oklab, var(--cream) 14%, transparent)',
          background: 'color-mix(in oklab, var(--ink) 70%, transparent)',
        }}
      >
        {(['density', 'controls'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setShadeMode(m)}
            className="mono px-3 py-1 text-[11px] rounded-full transition-colors cursor-pointer capitalize"
            style={{
              color: shadeMode === m ? 'var(--ink)' : dimc(70),
              background: shadeMode === m ? 'var(--cream)' : 'transparent',
            }}
          >
            {m === 'density' ? 'Chokepoints' : 'Export controls'}
          </button>
        ))}
      </div>

      {/* export-control regime panel */}
      {shadeMode === 'controls' && (
        <aside className="glass-electric absolute top-28 right-3 md:right-6 z-10 w-[min(330px,calc(100vw-1.5rem))] max-h-[55%] overflow-y-auto p-4">
          <div className="descent-eyebrow on-noir mb-3">The control map</div>
          <div className="space-y-3.5">
            {exportControls.regimes.map((r) => (
              <div key={r.country}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px]" style={{ color: 'var(--cream)', fontWeight: 500 }}>
                    {r.country} · {r.authority}
                  </span>
                  <span
                    className="mono text-[11px] shrink-0"
                    style={{
                      color:
                        r.role === 'controller' ? 'var(--gold)'
                        : r.role === 'aligned' ? 'var(--gold-matte)'
                        : 'var(--terracotta)',
                    }}
                  >
                    {r.role.replace('-', ' ')}
                  </span>
                </div>
                {r.instruments.map((ins) => (
                  <div key={ins.date} className="mt-1.5 pl-2" style={{ borderLeft: `1px solid ${dimc(15)}` }}>
                    <div className="mono text-[11px]" style={{ color: dimc(55) }}>
                      {ins.date} — {ins.name}
                    </div>
                    <div className="text-[13px] mt-0.5" style={{ color: dimc(78) }}>
                      {ins.summary}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="mono text-[11px] mt-3.5 pt-2" style={{ color: dimc(40), borderTop: `1px solid ${dimc(10)}` }}>
            Compiled from public policy · verify dates before citing
          </div>
        </aside>
      )}

      <div className="absolute left-6 bottom-6 z-10 pointer-events-none max-w-[270px] hidden sm:block">
        <div className="text-[13px]" style={{ color: dimc(50) }}>
          Drag to rotate. Scroll to descend — fully in falls through to the ledger.{' '}
          {arcsMode === 'supply' && 'Solid arcs = physical supply; gold = critical.'}
          {arcsMode === 'money' && 'Dashed arcs = capital & compute flows, colored by deal kind (lime invest, violet compute, orange chips, gold rounds).'}
          {arcsMode === 'people' && 'Cream marks = key people at their primary affiliation; dashed gold = career lineage (the diaspora). Hover a mark for the name.'}{' '}
          {shadeMode === 'density'
            ? 'Country dots glow gold with chokepoint density.'
            : 'Gold = control regimes, matte = aligned, terracotta = counter-controls.'}{' '}
          Rings pulse when live quotes move.
        </div>
      </div>
    </div>
  );
}
