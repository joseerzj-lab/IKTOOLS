import { useCallback } from 'react'
import { RouteRow, RiskResult, RiskEntry } from '../types/auditoria'
import { normK, borderToBorderDistKm, haversine } from '../lib/geoUtils'

declare const RM_COMUNAS_DATA: Record<string, { c: [number, number]; p: [number, number][] }>

const BORDER_ADJ_KM    = 1.5
const MAX_DIST_RISK_KM = 30
const ALERT_THRESHOLD  = 0.60
const CLUSTER_ISO_SHARE = 0.55
const EXTRAURBAN_COMUNAS = new Set([
  'COLINA','LAMPA','TILTIL','PIRQUE','SAN JOSE DE MAIPO','BUIN','PAINE',
  'ISLA DE MAIPO','EL MONTE','PADRE HURTADO','PENAFLOR','TALAGANTE',
  'CALERA DE TANGO','CURACAVI','MARIA PINTO','MELIPILLA','SAN PEDRO',
  'ALHUE','SAN BERNARDO'
])

function detectCluster(
  comunaMap: Record<string, RouteRow[]>,
  adjMap: Record<string, Set<string>>
) {
  let totalIsos = 0
  const entries: { key: string; raw: string; cnt: number; lat: number | null; lng: number | null; known: boolean }[] = []

  for (const rawName of Object.keys(comunaMap)) {
    const key = normK(rawName)
    const cd = RM_COMUNAS_DATA[key]
    const cnt = comunaMap[rawName].length
    totalIsos += cnt
    entries.push({ key, raw: rawName, cnt, lat: cd ? cd.c[0] : null, lng: cd ? cd.c[1] : null, known: !!cd })
  }

  entries.sort((a, b) => b.cnt - a.cnt)

  const clusterSet = new Set<string>()
  let clusterIsos = 0

  for (const e of entries) {
    if (!e.known) continue
    if (clusterSet.size === 0) { clusterSet.add(e.key); clusterIsos += e.cnt; continue }
    let adj = false
    for (const ck of clusterSet) {
      if (adjMap[ck]?.has(e.key)) { adj = true; break }
      if (borderToBorderDistKm(ck, e.key) <= BORDER_ADJ_KM * 2) { adj = true; break }
    }
    if (adj && clusterIsos / totalIsos < CLUSTER_ISO_SHARE) {
      clusterSet.add(e.key); clusterIsos += e.cnt
    }
  }

  if (clusterIsos / totalIsos < CLUSTER_ISO_SHARE) {
    for (const e of entries) {
      if (!e.known || clusterSet.has(e.key)) continue
      if (clusterIsos / totalIsos < CLUSTER_ISO_SHARE) { clusterSet.add(e.key); clusterIsos += e.cnt }
    }
  }

  let wLat = 0, wLng = 0, wTotal = 0
  for (const e of entries) {
    if (!clusterSet.has(e.key) || e.lat === null || e.lng === null) continue
    wLat += e.lat * e.cnt; wLng += e.lng * e.cnt; wTotal += e.cnt
  }

  return {
    members: clusterSet,
    centroidLat: wTotal ? wLat / wTotal : null,
    centroidLng: wTotal ? wLng / wTotal : null,
    clusterIsos,
    totalIsos,
  }
}

function scoreCommune(
  entry: { key: string; cnt: number },
  cluster: ReturnType<typeof detectCluster>,
  adjMap: Record<string, Set<string>>,
  totalComunas: number
) {
  const { key } = entry
  const cd = RM_COMUNAS_DATA[key]
  if (!cd) return { riskScore: 0, riskLevel: 'low' as const, distKm: 0, inCluster: false, adj: false }

  const inCluster = cluster.members.has(key)

  let distKm = 0
  if (cluster.centroidLat !== null && cluster.centroidLng !== null) {
    distKm = haversine([cd.c[0], cd.c[1]], [cluster.centroidLat, cluster.centroidLng])
  }

  const avgIsos = cluster.totalIsos / totalComunas
  let propScore = Math.max(0, Math.min(1, 1 - entry.cnt / avgIsos))
  if (entry.cnt === 1) propScore = Math.max(propScore, 0.85)

  let adj = false
  for (const ck of cluster.members) {
    if (adjMap[ck]?.has(key)) { adj = true; break }
    if (borderToBorderDistKm(ck, key) <= BORDER_ADJ_KM) { adj = true; break }
  }
  const adjScore = adj ? 0 : 1
  const distScore = Math.min(1, distKm / MAX_DIST_RISK_KM)

  let riskScore: number
  if (inCluster) {
    riskScore = (0.20 * distScore + 0.20 * adjScore + 0.60 * propScore) * 0.5
  } else {
    riskScore = 0.40 * distScore + 0.25 * adjScore + 0.35 * propScore
  }

  const riskLevel: RiskEntry['riskLevel'] =
    riskScore >= ALERT_THRESHOLD ? 'high' : riskScore >= 0.35 ? 'medium' : 'low'

  return { riskScore, riskLevel, distKm: Math.round(distKm * 10) / 10, inCluster, adj }
}

export function useRiskAnalysis() {
  const runAnalysis = useCallback(
    (
      routeData: RouteRow[],
      excludedVehicles: Set<string>,
      adjMap: Record<string, Set<string>>
    ): Record<string, RiskResult> => {
      const activeData = excludedVehicles.size
        ? routeData.filter(r => !excludedVehicles.has(r.veh))
        : routeData

      const vehMap: Record<string, Record<string, RouteRow[]>> = {}
      for (const r of activeData) {
        const v = r.veh || 'Sin vehiculo'
        const c = r.comuna || 'Sin comuna'
        if (!vehMap[v]) vehMap[v] = {}
        if (!vehMap[v][c]) vehMap[v][c] = []
        vehMap[v][c].push(r)
      }

      const byVeh: Record<string, RiskResult> = {}

      for (const [veh, comunaMap] of Object.entries(vehMap)) {
        const comunaList = Object.keys(comunaMap)
        if (comunaList.length < 2) continue
        const hasKnown = comunaList.some(c => !!RM_COMUNAS_DATA[normK(c)])
        if (!hasKnown) continue

        const cluster = detectCluster(comunaMap, adjMap)
        const totalComunas = comunaList.length
        const allExtra = comunaList.every(c => EXTRAURBAN_COMUNAS.has(normK(c)))

        const results: RiskEntry[] = comunaList.map(rawName => {
          const key = normK(rawName)
          const isos = comunaMap[rawName]
          const s = scoreCommune({ key, cnt: isos.length }, cluster, adjMap, totalComunas)
          let { riskScore, riskLevel } = s
          if (allExtra) {
            riskScore = riskScore * 0.70
            riskLevel = riskScore >= ALERT_THRESHOLD ? 'high' : riskScore >= 0.35 ? 'medium' : 'low'
          }
          return {
            key,
            comuna: rawName,
            isos,           // store actual RouteRow[] — critical for buildSummaryRows
            count: isos.length,
            lat: RM_COMUNAS_DATA[key]?.c[0] ?? null,
            lng: RM_COMUNAS_DATA[key]?.c[1] ?? null,
            riskScore,
            riskLevel,
            clusterLabel: cluster.members.has(key) ? 'cluster' : '',
          }
        })

        results.sort((a, b) => b.riskScore - a.riskScore)
        byVeh[veh] = {
          veh,
          results,
          maxRisk: results[0]?.riskScore ?? 0,
        }
      }

      return byVeh
    },
    []
  )

  return { runAnalysis }
}