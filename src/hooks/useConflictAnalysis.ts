import { useCallback } from 'react'
import { RouteRow, ComunaConflict } from '../types/auditoria'
import { normK, comunaFromCoords, getCoords, haversine } from '../lib/geoUtils'

declare const RM_COMUNAS_DATA: Record<string, { c: [number, number]; p: [number, number][]; n?: string }>

const ALIASES: Record<string, string> = {
  'NUNA':'NUNOA','NUNOA':'NUNOA','TILTIL':'TILTIL','TIL TIL':'TILTIL',
  'NUNO':'NUNOA','MAIPU':'MAIPU',
  'ÑUÑOA':'NUNOA','PENALOLEN':'PENALOLEN',
  'PENAFLOR':'PENAFLOR','CONCHALI':'CONCHALI',
  'SAN RAMON':'SAN RAMON',
  'SAN JOAQUIN':'SAN JOAQUIN',
  'LA CISTERNA':'LA CISTERNA','LO ESPEJO':'LO ESPEJO',
  'PEDRO AGUIRRE CERDA':'PEDRO AGUIRRE CERDA','PAC':'PEDRO AGUIRRE CERDA',
  'EST CENTRAL':'ESTACION CENTRAL','ESTACION CENTRAL':'ESTACION CENTRAL',
  'QUINTA NORMAL':'QUINTA NORMAL','QTA NORMAL':'QUINTA NORMAL',
  'LO BARNECHEA':'LO BARNECHEA','BARNECHEA':'LO BARNECHEA',
  'CALERA DE TANGO':'CALERA DE TANGO','CAL DE TANGO':'CALERA DE TANGO',
}

export function useConflictAnalysis() {
  const runAnalysis = useCallback((routeData: RouteRow[]): ComunaConflict[] => {
    const pts = routeData.filter(r => r.lat !== null && r.lng !== null)
    const conflicts: ComunaConflict[] = []

    for (const r of pts) {
      const kDir = normK(r.comuna)
      if (!kDir) continue

      const kCoord = comunaFromCoords(r.lat!, r.lng!)
      if (!kCoord) continue

      const a = ALIASES[kDir] || kDir
      const b = ALIASES[kCoord] || kCoord
      if (a === b) continue
      if (a.includes(b) || b.includes(a)) continue

      const aa = a.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const bb = b.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (aa === bb) continue

      const stCoords = getCoords(r.comuna)
      const dist = stCoords ? haversine([r.lat!, r.lng!], stCoords) : 0
      if (dist < 0.5) continue

      conflicts.push({
        iso: r.iso,
        veh: r.veh,
        dir: r.dir,
        comunaDireccion: r.comuna,
        comunaReal: (RM_COMUNAS_DATA[kCoord]?.n) || kCoord,
        comunaRealKey: kCoord,
        lat: r.lat!,
        lng: r.lng!,
        parada: r.parada,
        status: 'pendiente',
        _id: Math.random().toString(36).substr(2, 9),
      })
    }

    return conflicts
  }, [])

  return { runAnalysis }
}