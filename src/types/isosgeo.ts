export interface GeoRow {
  ISO: string
  PATENTE: string
  ESTADO: string
  VEHICULO: string
  ANALISIS: string
  _dup: boolean
}

export interface BaseStats {
  total: number
  ikea: number
}

export interface ResStats {
  total: number
  dups: number
}

export type ISOGeoTabId = 'tab-cargar' | 'tab-resultados'
