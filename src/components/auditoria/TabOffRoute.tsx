import { useMemo, useState } from 'react'
import type { RiskResult, RouteRow } from '../../types/auditoria'

interface Props {
  routeData: RouteRow[]   // <-- added so we can check real GPS coords per veh
  riskResults: Record<string, RiskResult>
  resolvedRisk: Set<string>
  flaggedRisk: Set<string>
  onToggleResolve: (aKey: string) => void
  onToggleFlag: (aKey: string) => void
  onOpenRouteMap: (veh: string) => void
  hasData: boolean
  isReady: boolean
}

export default function TabOffRoute({
  routeData,
  riskResults,
  resolvedRisk,
  flaggedRisk,
  onToggleResolve,
  onToggleFlag,
  onOpenRouteMap,
  hasData,
  isReady,
}: Props) {
  const [isoSearch, setIsoSearch] = useState('')

  // Build a set of vehicles that have at least one real GPS point
  const vehsWithGeo = useMemo(() => {
    const s = new Set<string>()
    for (const r of routeData) {
      if (r.lat !== null && r.lng !== null) s.add(r.veh)
    }
    return s
  }, [routeData])

  const sortedVehs = useMemo(() =>
    Object.entries(riskResults)
      .sort((a, b) => b[1].maxRisk - a[1].maxRisk),
    [riskResults]
  )

  const allResults = useMemo(() =>
    sortedVehs.flatMap(([, v]) => v.results),
    [sortedVehs]
  )

  const nHigh = allResults.filter(r => r.riskLevel === 'high').length
  const nMed  = allResults.filter(r => r.riskLevel === 'medium').length
  const nLow  = allResults.filter(r => r.riskLevel === 'low').length
  const totalAlertas = allResults.filter(r => r.riskLevel === 'high').reduce((s, r) => s + r.count, 0)

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
        <div className="text-4xl">🔍</div>
        <div className="text-sm font-semibold">Carga un archivo para analizar anomalías</div>
      </div>
    )
  }

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
        <div className="text-2xl animate-spin">⚙️</div>
        <div className="text-sm">Cargando datos geográficos…</div>
      </div>
    )
  }

  if (!sortedVehs.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="text-4xl">✅</div>
        <div className="text-sm font-semibold text-green-400">Sin alertas — todas las rutas son compactas</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary bar */}
      <div className="flex items-center gap-4 px-4 py-2 flex-shrink-0 border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-red-400">{nHigh}</span>
          <span className="text-[10px] text-gray-500">alertas</span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-orange-400">{nMed}</span>
          <span className="text-[10px] text-gray-500">moderadas</span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-green-400">{nLow}</span>
          <span className="text-[10px] text-gray-500">normal</span>
        </div>
        {totalAlertas > 0 && (
          <div className="ml-auto text-[10px] text-red-400 font-bold">
            ⚠ {totalAlertas} ISOs en alerta alta
          </div>
        )}
        <input
          value={isoSearch}
          onChange={e => setIsoSearch(e.target.value)}
          placeholder="Buscar ISO…"
          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-gray-200
                     placeholder-gray-600 focus:outline-none focus:border-blue-500/50 w-32"
        />
      </div>

      {/* Vehicle sections */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {sortedVehs.map(([veh, vdata]) => {
          const hasAlert = vdata.results.some(r => r.riskLevel === 'high')
          const hasMed   = vdata.results.some(r => r.riskLevel === 'medium')
          // Use real GPS data from routeData instead of risk centroids
          const hasGeo   = vehsWithGeo.has(veh)

          const visible = isoSearch
            ? vdata.results.filter(r => r.comuna.toLowerCase().includes(isoSearch.toLowerCase()))
            : vdata.results

          if (isoSearch && !visible.length) return null

          return (
            <div
              key={veh}
              className="rounded-lg border overflow-hidden"
              style={{ background: 'rgba(22,27,34,0.7)', borderColor: 'rgba(255,255,255,0.07)' }}
            >
              {/* Veh header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
                <span className="text-base">🚛</span>
                <span className="text-sm font-semibold text-gray-100 flex-1 truncate">{veh}</span>
                {hasAlert
                  ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 font-bold">⚠ Alerta</span>
                  : hasMed
                    ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 font-bold">· Moderado</span>
                    : <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-bold">✓ Normal</span>
                }
                {hasGeo && (hasAlert || hasMed) && (
                  <button
                    onClick={() => onOpenRouteMap(veh)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300
                               border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                  >🗺 Ver mapa ruta</button>
                )}
              </div>

              {/* Risk rows */}
              {visible.map(r => {
                const aKey = `${veh}|${r.key}`
                const isResolved = resolvedRisk.has(aKey)
                const isFlagged  = flaggedRisk.has(aKey)
                const pct = Math.round(r.riskScore * 100)
                const isH = r.riskLevel === 'high'
                const isM = r.riskLevel === 'medium'
                const barColor  = isH ? '#f85149' : isM ? '#f0883e' : '#3fb950'
                const textColor = isH ? '#ff7b72' : isM ? '#f0883e' : '#3fb950'

                return (
                  <div
                    key={r.key}
                    className={`flex items-center gap-3 px-4 py-2.5 border-b border-white/3 transition-opacity
                                ${isResolved ? 'opacity-40' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-200 font-medium truncate">{r.comuna}</span>
                        {r.clusterLabel && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">⬡ cluster</span>
                        )}
                        <span className="text-[9px] font-mono font-bold" style={{ color: r.count === 1 ? '#ff7b72' : r.count <= 2 ? '#f0883e' : '#8b949e' }}>
                          {r.count} ISO{r.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-16 h-1.5 rounded-full bg-white/10">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                      <span className="text-[10px] font-bold font-mono w-8 text-right" style={{ color: textColor }}>{pct}%</span>
                    </div>

                    {(isH || isM) && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => onToggleResolve(aKey)}
                          className="text-[9px] px-2 py-1 rounded bg-green-500/10 text-green-400
                                     border border-green-500/20 hover:bg-green-500/20 transition-colors"
                        >{isResolved ? '↩' : '✓'}</button>
                        <button
                          onClick={() => onToggleFlag(aKey)}
                          className="text-[9px] px-2 py-1 rounded transition-colors"
                          style={{
                            background: isFlagged ? 'rgba(248,81,73,.25)' : 'rgba(248,81,73,.08)',
                            color: '#ff7b72',
                            border: `1px solid ${isFlagged ? 'rgba(248,81,73,.55)' : 'rgba(248,81,73,.22)'}`,
                          }}
                        >{isFlagged ? '✕' : '⚠'}</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}