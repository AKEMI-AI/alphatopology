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
import { GLOBE_R, latLonToVec3, spreadCoords, arcCurve } from '@/lib/geo';

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

function Arcs({
  edges,
  positions,
  focusId,
  palette,
}: {
  edges: { source: string; target: string; criticality: string }[];
  positions: Record<string, THREE.Vector3>;
  focusId: string | null;
  palette: ReturnType<typeof usePalette>;
}) {
  const lines = useMemo(() => {
    return edges
      .map((e) => {
        const a = positions[e.source];
        const b = positions[e.target];
        if (!a || !b) return null;
        const touching = focusId && (e.source === focusId || e.target === focusId);
        const faded = focusId && !touching;
        const pts = arcCurve(a, b).getPoints(40);
        const g = new THREE.BufferGeometry().setFromPoints(pts);
        const m = new THREE.LineBasicMaterial({
          color: touching ? palette.gold : e.criticality === 'CRITICAL' ? palette.goldMatte : palette.plum,
          transparent: true,
          opacity: faded ? 0.05 : touching ? 0.95 : e.criticality === 'CRITICAL' ? 0.55 : 0.35,
        });
        return new THREE.Line(g, m);
      })
      .filter(Boolean) as THREE.Line[];
  }, [edges, positions, focusId, palette]);
  return (
    <group>
      {lines.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
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

function Scene({ nodes, activeTicker, onSelect, onZoomFloor }: GlobeViewProps) {
  const palette = usePalette();
  const [hovered, setHovered] = useState<string | null>(null);

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

  const edges = seedData.edges as { source: string; target: string; criticality: string }[];
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

  return (
    <>
      <ambientLight intensity={1.4} />
      <mesh>
        <sphereGeometry args={[GLOBE_R, 48, 48]} />
        <meshBasicMaterial color={new THREE.Color(palette.ink).offsetHSL(0, 0, 0.03)} />
      </mesh>
      <CountryBorders color={palette.cream} />
      <StraitRing color={focusId ? palette.gold : palette.magenta} />
      <Arcs edges={edges} positions={positions} focusId={focusId} palette={palette} />

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

export default function GlobeView(props: GlobeViewProps) {
  return (
    <div className="relative w-full h-full" style={{ background: 'var(--ink)' }}>
      <Canvas
        camera={{ position: [7, 5.4, -10.5], fov: 42 }}
        dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene {...props} />
      </Canvas>

      <div className="absolute top-4 left-6 z-10 pointer-events-none">
        <div className="descent-eyebrow on-noir">Geography / the physical board</div>
      </div>
      <div className="absolute left-6 bottom-6 z-10 pointer-events-none max-w-[260px]">
        <div className="text-[13px]" style={{ color: 'color-mix(in oklab, var(--cream) 50%, transparent)' }}>
          Drag to rotate. Scroll to descend — fully in falls through to the ledger. Mark size =
          live market cap; wire ring = chokepoint authority; the dashed ring is the Taiwan
          Strait.
        </div>
      </div>
    </div>
  );
}
