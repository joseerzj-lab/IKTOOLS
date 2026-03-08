import { useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { RouteRow, RiskResult, ComunaConflict } from '../../types/auditoria'
import { normK } from '../../lib/geoUtils'

interface Props {
  veh: string | null
  routeData: RouteRow[]
  riskResults: Record<string, RiskResult>
  conflicts: ComunaConflict[]
  onClose: () => void
}

// Handles invalidateSize + fitBounds after modal animation settles
function MapInit({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    // First invalidate to correct size (modal may still be animating)
    const t1 = setTimeout(() => map.invalidateSize({ animate: false }), 50)
    const t2 = setTimeout(() => {
      map.invalidateSize({ animate: false })
      if (!points.length) return
      const lats = points.map(p => p[0]), lngs = points.map(p => p[1])
      map.fitBounds([
        [Math.min(...lats) - 0.01, Math.min(...lngs) - 0.01],
        [Math.max(...lats) + 0.01, Math.max(...lngs) + 0.01],
      ], { padding: [30, 30] })
    }, 250)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

export default function RouteMapModal({ veh, routeData, riskResults, conflicts, onClose }: Props) {
  if (!veh) return null

  const pts = routeData
    .filter(r => r.veh === veh && r.lat !== null && r.lng !== null)
    .sort((a, b) => (a.parada || 0) - (b.parada || 0))

  const vehRisk = riskResults[veh]
  const riskByKey: Record<string, { riskLevel: string; pct: number }> = {}
  if (vehRisk) {
    for (const r of vehRisk.results) {
      riskByKey[r.key] = { riskLevel: r.riskLevel, pct: Math.round(r.riskScore * 100) }
    }
  }

  const conflictSet = new Set(conflicts.map(c => c.iso))
  const points: [number, number][] = pts.map(r => [r.lat!, r.lng!])

  const nHigh = pts.filter(r => riskByKey[normK(r.comuna)]?.riskLevel === 'high').length
  const nMed  = pts.filter(r => riskByKey[normK(r.comuna)]?.riskLevel === 'medium').length

  const comunaMap: Record<string, { name: string; isos: string[]; pct: number; rl: string }> = {}
  for (const r of pts) {
    const k = normK(r.comuna)
    if (!comunaMap[k]) comunaMap[k] = { name: r.comuna, isos: [], pct: riskByKey[k]?.pct || 0, rl: riskByKey[k]?.riskLevel || 'low' }
    comunaMap[k].isos.push(r.iso)
  }
  const comunaArr = Object.values(comunaMap).sort((a, b) => b.pct - a.pct)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="flex rounded-xl overflow-hidden border"
        style={{
          width: '90vw', maxWidth: 1100,
          height: '85vh',
          background: 'rgb(13,17,23)',
          borderColor: 'rgba(255,255,255,0.10)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* Sidebar */}
        <div
          className="flex flex-col w-64 flex-shrink-0 border-r overflow-hidden"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <div className="px-4 py-3 border-b flex flex-col gap-1 flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-100 flex-1 truncate">🗺 {veh}</span>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-200 transition-colors text-lg leading-none"
              >✕</button>
            </div>
            <div className="text-[10px] text-gray-500">
              {pts.length} puntos{nHigh ? ` · ${nHigh} alerta${nHigh !== 1 ? 's' : ''}` : ''}
              {nMed ? ` · ${nMed} moderada${nMed !== 1 ? 's' : ''}` : ''}
              {!nHigh && !nMed ? ' · Sin alertas' : ''}
            </div>
          </div>
          <div className="px-3 py-2 border-b text-[10px] text-gray-500 font-medium flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {comunaArr.length} comunas · {pts.length} puntos
          </div>
          <div className="flex-1 overflow-y-auto">
            {comunaArr.map(c => {
              const isH = c.rl === 'high', isM = c.rl === 'medium'
              const color = isH ? '#ff7b72' : isM ? '#f0883e' : '#8b949e'
              return (
                <div key={c.name} className="px-3 py-2.5 border-b text-xs" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-2">
                    <span style={{ color, fontWeight: 600 }}>{c.name}</span>
                    {c.pct > 0 && <span className="text-[9px] font-mono font-bold" style={{ color }}>{c.pct}%</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-gray-600">{c.isos.length} ISO{c.isos.length !== 1 ? 's' : ''}</span>
                    {(isH || isM) && <span className="text-[9px] font-bold" style={{ color }}>{isH ? '⚠ Alerta' : '· Moderada'}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Map — explicit height via CSS so Leaflet always gets real dimensions */}
        <div style={{ position: "relative", flex: 1, minWidth: 0, height: "85vh" }}>
          <MapContainer
            center={[-33.47, -70.65]}
            zoom={11}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#0d1117' }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap &copy; CARTO'
              subdomains="abcd"
              maxZoom={19}
            />
            <MapInit points={points} />
            {points.length >= 2 && (
              <Polyline positions={points} pathOptions={{ color: '#4a9fd4', weight: 2.5, opacity: 0.65 }} />
            )}
            {pts.map((r, si) => {
              const k = normK(r.comuna)
              const risk = riskByKey[k] || { riskLevel: 'low', pct: 0 }
              const rl = risk.riskLevel
              const dotColor = rl === 'high' ? '#e04040' : rl === 'medium' ? '#f0883e' : '#4a9fd4'
              const glowStyle = rl !== 'low' ? `box-shadow:0 0 8px 3px ${dotColor}55;` : ''
              const sz = rl === 'high' ? 20 : rl === 'medium' ? 17 : 14
              const stopNum = r.parada || (si + 1)
              const icon = L.divIcon({
                className: '',
                html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${dotColor};
                        border:1.5px solid rgba(255,255,255,.85);display:flex;align-items:center;
                        justify-content:center;font-size:7px;font-weight:700;color:rgba(255,255,255,.95);
                        font-family:monospace;cursor:pointer;box-sizing:border-box;${glowStyle}">${stopNum}</div>`,
                iconSize: [sz, sz],
                iconAnchor: [sz / 2, sz / 2],
              })
              const conf = conflicts.find(c => c.iso === r.iso)

              return (
                <Marker key={`${r.iso}-${si}`} position={[r.lat!, r.lng!]} icon={icon} zIndexOffset={rl === 'high' ? 200 : rl === 'medium' ? 100 : 0}>
                  <Popup>
                    <div style={{ minWidth: 180, fontFamily: 'system-ui', fontSize: 12 }}>
                      <div style={{ fontWeight: 700, color: '#e6edf3', marginBottom: 3 }}>{r.iso} <span style={{ fontSize: 10, color: '#8b949e' }}>#{stopNum}</span></div>
                      <div style={{ color: '#aaa', fontSize: 11 }}>{r.dir}</div>
                      {rl !== 'low' && (
                        <div style={{ marginTop: 5, fontSize: 10, color: dotColor, fontWeight: 700 }}>
                          {rl === 'high' ? '⚠ Alerta' : '· Moderada'} — {risk.pct}%
                        </div>
                      )}
                      {conf && (
                        <div style={{ marginTop: 5, fontSize: 10, color: '#ff7b72' }}>
                          ⚠ Conflicto: {conf.comunaDireccion} → {conf.comunaReal}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  )
}