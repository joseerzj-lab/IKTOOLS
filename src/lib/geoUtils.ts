// ── Tipos del mapa de comunas ──────────────────────────────────
// RM_COMUNAS_DATA se carga desde public/data/comunas_data.js
// Estructura: { [normKey]: { c: [lat, lng], p: [lat, lng][] } }
declare const RM_COMUNAS_DATA: Record<string, { c: [number, number]; p: [number, number][] }>

// ── Normalización de nombre de comuna ─────────────────────────
export function normK(s: string): string {
  return (s || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, '')
    .trim()
}

// ── Busca datos de una comuna por nombre ──────────────────────
export function getComunaData(nombre: string): { c: [number, number]; p: [number, number][] } | null {
  const k = normK(nombre)
  if (RM_COMUNAS_DATA[k]) return RM_COMUNAS_DATA[k]
  // fuzzy match
  const keys = Object.keys(RM_COMUNAS_DATA)
  for (const key of keys) {
    if (k.includes(key) || key.includes(k)) return RM_COMUNAS_DATA[key]
  }
  return null
}

// ── Retorna coordenadas centroide de una comuna ───────────────
export function getCoords(nombre: string): [number, number] | null {
  const d = getComunaData(nombre)
  return d ? d.c : null
}

// ── Centroide más cercano a un punto ─────────────────────────
export function nearestCentroid(lat: number, lng: number): string | null {
  let best: string | null = null
  let md = 1e9
  for (const k of Object.keys(RM_COMUNAS_DATA)) {
    const c = RM_COMUNAS_DATA[k].c
    const d = (lat - c[0]) ** 2 + (lng - c[1]) ** 2
    if (d < md) { md = d; best = k }
  }
  return best
}

// ── Point in polygon (ray casting) ───────────────────────────
export function pointInPolygon(lat: number, lng: number, poly: [number, number][]): boolean {
  let inside = false
  const n = poly.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if ((yi > lng) !== (yj > lng) && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

// ── Detecta en qué comuna caen unas coordenadas ───────────────
export function comunaFromCoords(lat: number, lng: number): string | null {
  for (const key of Object.keys(RM_COMUNAS_DATA)) {
    if (pointInPolygon(lat, lng, RM_COMUNAS_DATA[key].p)) return key
  }
  return nearestCentroid(lat, lng)
}

// ── Distancia mínima de un punto al borde de un polígono (grados) ──
export function distToPolyBorderDeg(lat: number, lng: number, poly: [number, number][]): number {
  let minD = Infinity
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const [ax, ay] = poly[i]
    const [bx, by] = poly[j]
    const dx = bx - ax, dy = by - ay
    const t = dx * dx + dy * dy
    if (t === 0) {
      const d = Math.sqrt((lat - ax) ** 2 + (lng - ay) ** 2)
      if (d < minD) minD = d
      continue
    }
    const tc = Math.max(0, Math.min(1, ((lat - ax) * dx + (lng - ay) * dy) / t))
    const d2 = (lat - (ax + tc * dx)) ** 2 + (lng - (ay + tc * dy)) ** 2
    if (d2 < minD) minD = d2
  }
  return Math.sqrt(minD)
}

// ── Distancia de un punto al borde de su comuna en km ─────────
export function distToCommuneBorderKm(lat: number, lng: number, communeKey: string): number {
  const d = RM_COMUNAS_DATA[communeKey]
  if (!d) return 0
  return distToPolyBorderDeg(lat, lng, d.p) * 111.0
}

// ── Distancia borde a borde entre dos comunas en km ──────────
export function borderToBorderDistKm(keyA: string, keyB: string): number {
  const da = RM_COMUNAS_DATA[keyA]
  const db = RM_COMUNAS_DATA[keyB]
  if (!da || !db) return haversine(da ? da.c : [0, 0], db ? db.c : [0, 0])
  let minD = Infinity
  const pa = da.p, pb = db.p
  const step = Math.max(1, Math.floor(Math.min(pa.length, pb.length) / 20))
  for (let i = 0; i < pa.length; i += step) {
    for (let j = 0; j < pb.length; j += step) {
      const d = (pa[i][0] - pb[j][0]) ** 2 + (pa[i][1] - pb[j][1]) ** 2
      if (d < minD) minD = d
    }
  }
  return Math.sqrt(minD) * 111.0
}

// ── Haversine distance entre dos centroides ───────────────────
export function haversine(c1: [number, number], c2: [number, number]): number {
  const R = 6371
  const dLat = (c2[0] - c1[0]) * Math.PI / 180
  const dLon = (c2[1] - c1[1]) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(c1[0] * Math.PI / 180) *
    Math.cos(c2[0] * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Verifica si dos polígonos son adyacentes (comparten borde) ─
export function polygonsAdjacent(keyA: string, keyB: string): boolean {
  return borderToBorderDistKm(keyA, keyB) < 0.5
}

// ── Construye mapa de adyacencia entre todas las comunas ──────
export function buildAdjacencyMap(): Record<string, Set<string>> {
  const adj: Record<string, Set<string>> = {}
  const keys = Object.keys(RM_COMUNAS_DATA)
  for (const k of keys) adj[k] = new Set()
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (polygonsAdjacent(keys[i], keys[j])) {
        adj[keys[i]].add(keys[j])
        adj[keys[j]].add(keys[i])
      }
    }
  }
  return adj
}
