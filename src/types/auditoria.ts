// ── Fila de datos del archivo cargado ──────────────────────────
export interface RouteRow {
  iso: string
  veh: string
  dir: string
  comuna: string
  provincia: string
  lat: number | null
  lng: number | null
  parada: number
}

// ── Conflicto geográfico ────────────────────────────────────────
export interface ComunaConflict {
  iso: string
  veh: string
  dir: string
  lat: number
  lng: number
  parada: number
  comunaDireccion: string   // comuna extraída de la dirección
  comunaReal: string        // comuna detectada por coordenadas
  comunaRealKey: string     // normK key de comunaReal
  status: 'pendiente' | 'alerta' | 'revisado'
  _id: string
}

// ── Grupo de ISOs por vehículo + comuna ────────────────────────
export interface ComunaGroup {
  veh: string
  comuna: string
  isos: RouteRow[]
  key: string               // `${veh}||${comuna}`
}

// ── Entrada de análisis de riesgo por comuna ───────────────────
export interface RiskEntry {
  key: string               // normK(comuna)
  comuna: string
  count: number
  lat: number | null
  lng: number | null
  riskScore: number         // 0-1
  riskLevel: 'low' | 'medium' | 'high'
  clusterLabel: string
  isos: RouteRow[]
}

// ── Resultado de análisis de riesgo por vehículo ───────────────
export interface RiskResult {
  veh: string
  results: RiskEntry[]
  maxRisk: number
}

// ── Fila de resumen consolidado (tab Summary) ─────────────────
export interface SummaryRow {
  iso: string
  veh: string
  dir: string
  obs: string
  detalle: string
  tipo: 'geo' | 'fuera' | 'ambos'
  status: 'pendiente' | 'alerta' | 'revisado' | 'aprobado'
  geoISO: string | null
  aKey: string | null
  riskLevel: 'low' | 'medium' | 'high' | null
}

// ── Item de revisión de ISO ────────────────────────────────────
export interface ISOReviewItem {
  iso: string
  veh: string
  dir: string
  comuna: string
  obs: string
  _id: string
}

// ── Modal data ─────────────────────────────────────────────────
export interface ModalItem {
  iso: string
  dir: string
  obs: string
  _id: string
}

// ── Tabs disponibles ───────────────────────────────────────────
export type TabId =
  | 'tab-vehiculos'
  | 'tab-mapa'
  | 'tab-geo'
  | 'tab-alertas'
  | 'tab-resumen'
  | 'tab-export'
  | 'tab-plan'