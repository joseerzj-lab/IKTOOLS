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
  comunaDireccion: string
  comunaReal: string        // display name from RM_COMUNAS_DATA[kCoord].n || kCoord
  comunaRealKey: string     // normK key e.g. "NUNOA"
  status: 'pendiente' | 'alerta' | 'resuelto'
  _id: string
}

// ── Grupo de ISOs por vehículo + comuna ────────────────────────
export interface ComunaGroup {
  veh: string
  comuna: string
  isos: RouteRow[]
  key: string
}

// ── Entrada de análisis de riesgo por comuna ───────────────────
export interface RiskEntry {
  key: string
  comuna: string
  isos: RouteRow[]          // actual rows — needed for summary tab
  count: number
  lat: number | null
  lng: number | null
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high'
  clusterLabel: string
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
  status: 'pendiente' | 'alerta' | 'resuelto' | 'aprobado'
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
  | 'tab-resumen'
  | 'tab-export'