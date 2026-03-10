import { useCallback } from 'react'
import type { RouteRow, ComunaConflict } from '../types/auditoria'
import { normK, comunaFromCoords, getCoords, haversine } from '../lib/geoUtils'

declare const RM_COMUNAS_DATA: Record<string, { c: [number, number]; p: [number, number][]; n?: string }>

// Devuelve el nombre legible de una comuna (con tildes y Ñ)
// Prioriza el campo n de RM_COMUNAS_DATA, si no existe usa Title Case del normKey
function getDisplayName(normKey: string): string {
  const data = (typeof window !== 'undefined' ? window : globalThis) as any
  const rm = data.RM_COMUNAS_DATA as typeof RM_COMUNAS_DATA | undefined
  if (rm?.[normKey]?.n) return rm[normKey].n!
  // Fallback: Title Case (e.g. NUNOA → Nunoa — mejor que nada)
  return normKey.charAt(0) + normKey.slice(1).toLowerCase()
}

export function useConflictAnalysis() {
  const runAnalysis = useCallback((routeData: RouteRow[]): ComunaConflict[] => {
    const pts = routeData.filter(r => r.lat !== null && r.lng !== null)
    const conflicts: ComunaConflict[] = []

    for (const r of pts) {
      const kDir   = normK(r.comuna)   // key normalizado de la comuna en la dirección
      const kCoord = comunaFromCoords(r.lat!, r.lng!)  // key normalizado de la comuna real
      if (!kDir || !kCoord) continue
      if (kDir === kCoord) continue

      // Ignorar si uno contiene al otro (ej. "SANTIAGO" vs "SANTIAGO CENTRO")
      if (kDir.includes(kCoord) || kCoord.includes(kDir)) continue

      // Ignorar si el punto está muy cerca del centroide de la comuna de la dirección
      const stCoords = getCoords(r.comuna)
      const dist = stCoords ? haversine([r.lat!, r.lng!], stCoords) : 999
      if (dist < 0.5) continue

      conflicts.push({
        iso:            r.iso,
        veh:            r.veh,
        dir:            r.dir,
        comunaDireccion: r.comuna,                    // nombre original del archivo
        comunaReal:     getDisplayName(kCoord),       // nombre legible con tildes
        comunaRealKey:  kCoord,                       // normK key para comparaciones
        lat:            r.lat!,
        lng:            r.lng!,
        parada:         r.parada,
        status:         'pendiente',
        _id:            Math.random().toString(36).substr(2, 9),
      })
    }

    return conflicts
  }, [])

  return { runAnalysis }
}