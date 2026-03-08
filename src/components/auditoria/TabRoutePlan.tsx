import { useState, useMemo } from 'react'
import { RouteRow, RiskResult } from '../../types/auditoria'
import { normK } from '../../lib/geoUtils'

interface Props {
  routeData: RouteRow[]
  riskResults: Record<string, RiskResult>
  resolvedRisk: Set<string>
  onResolveRisk: (aKey: string, resolve: boolean) => void
  onOpenRouteMap: (veh: string) => void
}

function escHtml(s: string) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default function TabRoutePlan({
  routeData,
  riskResults,
  resolvedRisk,
  onResolveRisk,
  onOpenRouteMap,
}: Props) {
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const vehMap = useMemo(() => {
    const m: Record<string, Record<string, RouteRow[]>> = {}
    for (const r of routeData) {
      const v = r.veh || 'Sin vehiculo'
      const c = r.comuna || 'Sin comuna'
      if (!m[v]) m[v] = {}
      if (!m[v][c]) m[v][c] = []
      m[v][c].push(r)
    }
    return m
  }, [routeData])

  const totalComunas = useMemo(() => new Set(routeData.map(r => r.comuna)).size, [routeData])
  const soloUna = useMemo(() =>
    Object.values(vehMap).flatMap(cs => Object.values(cs)).filter(a => a.length === 1).length,
    [vehMap]
  )

  const entries = useMemo(() =>
    Object.entries(vehMap)
      .sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .filter(([v]) => !search || v.toLowerCase().includes(search.toLowerCase())),
    [vehMap, search]
  )

  function toggleCollapse(veh: string) {
    setCollapsed(prev => {
      const n = new Set(prev)
      n.has(veh) ? n.delete(veh) : n.add(veh)
      return n
    })
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  if (!routeData.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
        <div className="text-4xl">📂</div>
        <div className="text-sm font-semibold">Carga un archivo para comenzar</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 py-2 flex-shrink-0 border-b border-white/5">
        {[
          { label: 'ISOs', val: routeData.length, color: '#7bb8ff' },
          { label: 'Vehículos', val: Object.keys(vehMap).length, color: '#a371f7' },
          { label: 'Comunas', val: totalComunas, color: '#34d399' },
          { label: 'Solo 1 ISO', val: soloUna, color: soloUna ? '#f0883e' : '#8b949e' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="text-base font-bold font-mono" style={{ color: s.color }}>{s.val}</span>
            <span className="text-[10px] text-gray-500">{s.label}</span>
          </div>
        ))}

        <div className="ml-auto">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar vehículo…"
            className="bg-white/5 border border-white/10 rounded-md px-3 py-1 text-xs text-gray-200
                       placeholder-gray-600 focus:outline-none focus:border-blue-500/50 w-44"
          />
        </div>
      </div>

      {/* Vehicle list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {entries.map(([veh, comunas]) => {
          const totalIsos = Object.values(comunas).reduce((s, a) => s + a.length, 0)
          const soloUnaCount = Object.values(comunas).filter(a => a.length === 1).length
          const isOpen = !collapsed.has(veh)
          const vehRisk = riskResults[veh]
          const hasAlert = vehRisk?.results.some(r => r.riskLevel === 'high')
          const hasMed = vehRisk?.results.some(r => r.riskLevel === 'medium')
          const hasGeo = routeData.some(r => r.veh === veh && r.lat !== null)

          return (
            <div
              key={veh}
              className="rounded-lg border overflow-hidden"
              style={{ background: 'rgba(22,27,34,0.7)', borderColor: 'rgba(255,255,255,0.07)' }}
            >
              {/* Header */}
              <button
                onClick={() => toggleCollapse(veh)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/3 transition-colors"
              >
                <span className="text-lg">🚛</span>
                <span className="text-sm font-semibold text-gray-100 flex-1 truncate">{veh}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 font-bold">{totalIsos} ISOs</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400">{Object.keys(comunas).length} comunas</span>
                  {soloUnaCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 font-bold">! {soloUnaCount}</span>
                  )}
                  {hasAlert && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 font-bold">⚠ Alerta</span>}
                  {!hasAlert && hasMed && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 font-bold">· Moderado</span>}
                  {hasGeo && (hasAlert || hasMed) && (
                    <button
                      onClick={e => { e.stopPropagation(); onOpenRouteMap(veh) }}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                    >🗺 Ver mapa</button>
                  )}
                </div>
                <span className="text-gray-600 text-xs ml-1">{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* Body */}
              {isOpen && (
                <div className="border-t border-white/5">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">Comuna</th>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium hidden sm:table-cell">Provincia</th>
                        <th className="text-right px-4 py-2 text-gray-500 font-medium">ISOs</th>
                        <th className="px-3 py-2 w-24"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(comunas)
                        .sort((a, b) => b[1].length - a[1].length)
                        .map(([comuna, isos]) => {
                          const aKey = `${veh}|${normK(comuna)}`
                          const isApproved = resolvedRisk.has(aKey)
                          const riskEntry = vehRisk?.results.find(r => normK(r.comuna) === normK(comuna))
                          const provSet = new Set(isos.map(r => r.provincia).filter(Boolean))
                          const pct = riskEntry ? Math.round(riskEntry.riskScore * 100) : 0
                          const rl = riskEntry?.riskLevel

                          return (
                            <tr key={comuna} className="border-b border-white/3 hover:bg-white/2">
                              <td className="px-4 py-2 text-gray-200">
                                <div className="flex items-center gap-2">
                                  <span>{comuna}</span>
                                  {rl && rl !== 'low' && (
                                    <button
                                      onClick={() => onOpenRouteMap(veh)}
                                      className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                                      style={{
                                        background: rl === 'high' ? 'rgba(248,81,73,.15)' : 'rgba(240,136,62,.15)',
                                        color: rl === 'high' ? '#ff7b72' : '#f0883e',
                                        border: `1px solid ${rl === 'high' ? 'rgba(248,81,73,.3)' : 'rgba(240,136,62,.3)'}`,
                                      }}
                                    >{pct}% 🗺</button>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2 text-gray-500 font-mono hidden sm:table-cell">
                                {[...provSet].join(' / ') || '—'}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <button
                                  onClick={() => {
                                    copyText(isos.map(r => r.iso).join('\n'))
                                  }}
                                  className="font-bold font-mono text-blue-300 hover:text-blue-100 transition-colors"
                                  title="Copiar ISOs de esta comuna"
                                >
                                  {isos.length}
                                </button>
                              </td>
                              <td className="px-3 py-2 text-center">
                                {isApproved ? (
                                  <span className="text-[9px] text-green-400 font-bold">✓ Aprobado</span>
                                ) : (
                                  <button
                                    onClick={() => onResolveRisk(aKey, true)}
                                    className="text-[9px] px-2 py-0.5 rounded bg-white/5 text-gray-400
                                               hover:bg-green-500/10 hover:text-green-300 transition-colors border border-white/10"
                                  >Aprobar</button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
        {entries.length === 0 && (
          <div className="text-center text-gray-500 py-10 text-sm">Sin vehículos para "{search}"</div>
        )}
      </div>
    </div>
  )
}
