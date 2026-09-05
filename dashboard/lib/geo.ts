import * as THREE from 'three';

/* Physical HQ / primary-operations coordinates per topology node.
   Physical Reality Rule: pins sit where the fabs/offices actually are
   (e.g. Fabrinet manufactures in Bangkok despite its US listing). */
export const HQ_COORDS: Record<string, [number, number]> = {
  // [lat, lon]
  SNPS: [37.37, -122.03], // Sunnyvale
  CDNS: [37.33, -121.89], // San Jose
  ARM: [52.2, 0.12], // Cambridge, UK
  SHIN_ETSU: [35.68, 139.77], // Tokyo
  SUMCO: [35.66, 139.75],
  ASML: [51.42, 5.4], // Veldhoven
  AMAT: [37.35, -121.95], // Santa Clara
  LRCX: [37.55, -121.99], // Fremont
  TEL: [35.69, 139.76], // Tokyo
  TSMC: [24.81, 120.97], // Hsinchu
  DISCO: [35.65, 139.74],
  AJINOMOTO: [35.69, 139.79],
  SK_HYNIX: [37.28, 127.44], // Icheon
  MICRON: [43.62, -116.21], // Boise
  KLAC: [37.43, -121.9], // Milpitas
  TERADYNE: [42.58, -71.08], // North Reading
  ADVANTEST: [35.7, 139.71],
  NVIDIA: [37.37, -121.96], // Santa Clara
  BROADCOM: [37.38, -122.14], // Palo Alto
  FOXCONN: [25.06, 121.51], // New Taipei
  ARISTA: [37.36, -121.98],
  VERTIV: [39.96, -83.0], // Columbus
  EATON: [41.5, -81.7], // Cleveland (ops)
  CONSTELLATION: [39.29, -76.61], // Baltimore
  HOYA: [35.66, 139.73],
  TOK: [35.53, 139.7], // Kawasaki
  ENTEGRIS: [42.56, -71.27], // Billerica
  LINDE: [41.39, -73.45], // Danbury
  AIR_LIQUIDE: [48.86, 2.35], // Paris
  SCREEN: [35.01, 135.77], // Kyoto
  KOKUSAI: [35.68, 139.73],
  ASMI: [52.37, 5.22], // Almere
  LASERTEC: [35.44, 139.64], // Yokohama
  ONTO: [42.56, -71.17], // Wilmington MA
  SAMSUNG: [37.26, 127.03], // Suwon
  INTEL: [37.39, -121.96],
  AMD: [37.38, -121.97],
  QUALCOMM: [32.9, -117.19], // San Diego
  MARVELL: [37.36, -121.94],
  IBIDEN: [35.36, 136.61], // Ogaki
  UNIMICRON: [24.99, 121.3], // Taoyuan
  ASE: [22.61, 120.3], // Kaohsiung
  AMKOR: [33.43, -111.94], // Tempe
  QUANTA: [25.02, 121.37],
  WISTRON: [25.06, 121.54],
  SMCI: [37.24, -121.78],
  DELL: [30.51, -97.68], // Round Rock
  NVENT: [44.95, -93.35], // St Louis Park
  COHERENT: [40.75, -79.81], // Saxonburg
  LUMENTUM: [37.31, -121.92],
  FABRINET: [13.92, 100.6], // Bangkok — where the factories are
  CRDO: [37.24, -121.92],
  ASTERA: [37.35, -121.96],
  VISTRA: [32.86, -96.94], // Irving
  GEVERNOVA: [42.37, -71.08], // Cambridge MA
  SCHNEIDER: [48.88, 2.18], // Rueil-Malmaison
  BLOOM: [37.41, -121.94],
  ALIBABA: [30.19, 120.19], // Hangzhou
  TENCENT: [22.54, 114.06], // Shenzhen
  BAIDU: [39.99, 116.3], // Beijing
  BYTEDANCE: [39.98, 116.31], // Beijing
  DEEPSEEK: [30.27, 120.16], // Hangzhou
  HUAWEI: [22.65, 113.88], // Shenzhen
  SMIC: [31.18, 121.6], // Shanghai
  NEBIUS: [52.37, 4.9], // Amsterdam
  OPENAI: [37.76, -122.41], // San Francisco
  ANTHROPIC: [37.79, -122.4], // San Francisco
  XAI: [37.77, -122.39], // San Francisco (training ops Memphis)
  MISTRAL: [48.86, 2.34], // Paris
  COREWEAVE: [40.79, -74.31], // Livingston NJ
  ORACLE: [30.27, -97.74], // Austin
  TESLA: [30.22, -97.62], // Austin
  FANUC: [35.65, 138.57], // Yamanashi
  YASKAWA: [33.87, 130.88], // Kitakyushu
  FIGURE: [37.33, -121.89], // San Jose
  SOFTBANK: [35.67, 139.74], // Tokyo
  MICROSOFT: [47.64, -122.13], // Redmond
  GOOGLE: [37.42, -122.08], // Mountain View
  AMAZON: [47.61, -122.33], // Seattle
  META: [37.48, -122.15], // Menlo Park
};

export const GLOBE_R = 5;

export function latLonToVec3(lat: number, lon: number, r = GLOBE_R): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

/* Bay-Area / Tokyo pile-ups: fan same-city pins into a small spiral so
   every mark stays clickable. Call once over the full node list. */
export function spreadCoords(ids: string[]): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  const buckets = new Map<string, string[]>();
  for (const id of ids) {
    const c = HQ_COORDS[id];
    if (!c) continue;
    const key = `${Math.round(c[0])},${Math.round(c[1])}`;
    buckets.set(key, [...(buckets.get(key) ?? []), id]);
  }
  for (const members of buckets.values()) {
    members.forEach((id, i) => {
      const [lat, lon] = HQ_COORDS[id];
      if (members.length === 1 || i === 0) {
        out[id] = [lat, lon];
      } else {
        const ang = i * 2.4; // golden-angle spiral
        const rad = 0.55 * Math.sqrt(i);
        out[id] = [lat + rad * Math.cos(ang), lon + rad * Math.sin(ang)];
      }
    });
  }
  return out;
}

/* Great-circle-ish arc between two surface points, lifted by distance */
export function arcCurve(a: THREE.Vector3, b: THREE.Vector3): THREE.QuadraticBezierCurve3 {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dist = a.distanceTo(b);
  mid.normalize().multiplyScalar(GLOBE_R + 0.15 + dist * 0.28);
  return new THREE.QuadraticBezierCurve3(a, mid, b);
}
