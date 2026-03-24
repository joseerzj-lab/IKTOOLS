import { useEffect, useRef } from 'react'
import type { RouteRow, RiskResult, ComunaConflict } from '../../types/auditoria'
import { normK } from '../../lib/geoUtils'

// Uses window.L (Leaflet loaded via CDN in index.html) — no react-leaflet needed
// This avoids all the MapContainer/invalidateSize/resize bugs

interface Props {
  veh: string | null
  routeData: RouteRow[]
  riskResults: Record<string, RiskResult>
  conflicts: ComunaConflict[]
  onClose: () => void
}

declare const RM_COMUNAS_DATA: Record<string, { c: [number, number]; p: [number, number][]; n?: string }>

export default function RouteMapModal({ veh, routeData, riskResults, conflicts, onClose }: Props) {
  const mapRef = useRef<any>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!veh || !mapDivRef.current) return
    const L = (window as any).L
    if (!L) return

    const style = document.createElement('style')
    style.innerHTML = `"nnnnnnnmnm,
      @keyframes pulse-error {
        0% { box-shadow: 0 0 0 0 rgba(255, 75, 75, 0.7); }
        70% { box-shadow: 0 0 0 12px rgba(255, 75, 75, 0); }
        100% { box-shadow: 0 0 0 0 rgba(255, 75, 75, 0); }
      }
      @keyframes pulse-warn {
        0% { box-shadow: 0 0 0 0 rgba(240, 136, 62, 0.7); }
        70% { box-shadow: 0 0 0 10px rgba(240, 136, 62, 0); }
        100% { box-shadow: 0 0 0 0 rgba(240, 136, 62, 0); }
      }
      .pulse-error { animation: pulse-error 2.5s infinite; }
      .pulse-warn { animation: pulse-warn 2.5s infinite; }
      .commune-label-modal { background: rgba(0,0,0,0.8); border: none; color: #fff; font-weight: 800; font-size: 9px; padding: 2px 6px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.6); pointer-events: none; }
    `
    document.head.appendChild(style)

    const pts = routeData
      .filter(r => r.veh === veh && r.lat !== null && r.lng !== null)
      .sort((a, b) => (a.parada || 0) - (b.parada || 0))

    if (!pts.length) return

    // Destroy previous map if any
    if (mapRef.current) { try { mapRef.current.remove() } catch(e) {} mapRef.current = null }

    const map = L.map(mapDivRef.current, { center: [-33.47, -70.65], zoom: 11 })
    mapRef.current = map

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 19
    }).addTo(map)

    // Draw commune borders
    if (typeof RM_COMUNAS_DATA !== 'undefined') {
      Object.keys(RM_COMUNAS_DATA).forEach(key => {
        const cd = RM_COMUNAS_DATA[key]
        if (!cd?.p) return
        L.polygon(cd.p, { color: 'rgba(140,190,255,0.9)', weight: 1.8, fillColor: 'transparent', fillOpacity: 0, interactive: false }).addTo(map)
        if (cd.c) {
          const lbl = (cd.n || key).replace('Estación Central','Est.Central').replace('Pedro Aguirre Cerda','P.A.Cerda').replace('Calera de Tango','Cal.Tango').replace('Padre Hurtado','P.Hurtado')
          L.marker([cd.c[0], cd.c[1]], {
            icon: L.divIcon({ className: '', html: `<div style="font-size:9px;font-weight:700;color:rgba(255,255,255,.95);white-space:nowrap;pointer-events:none;text-shadow:0 0 4px #000,0 1px 3px #000">${lbl}</div>`, iconAnchor: [20, 6] }),
            interactive: false, zIndexOffset: -200
          }).addTo(map)
        }
      })
    }

    // Risk lookup
    const vr = riskResults[veh]
    const riskByKey: Record<string, { riskLevel: string; pct: number }> = {}
    if (vr) {
      for (const r of vr.results) riskByKey[r.key] = { riskLevel: r.riskLevel, pct: Math.round(r.riskScore * 100) }
    }

    // Polyline
    const latlngs = pts.map(r => [r.lat, r.lng])
    L.polyline(latlngs, { color: '#4a9fd4', weight: 2.5, opacity: 0.65, lineJoin: 'round' }).addTo(map)

    // Markers
    pts.forEach((r, si) => {
      const conf = conflicts.find(c => c.iso === r.iso)
      const k = normK(r.comuna)
      const risk = riskByKey[k] || { riskLevel: 'low', pct: 0 }
      const rl = risk.riskLevel
      const isRed = rl === 'high' || !!conf
      const dotColor = isRed ? '#ff4b4b' : rl === 'medium' ? '#f0883e' : '#4a9fd4'
      const sz = isRed ? 24 : rl === 'medium' ? 20 : 16
      const stopNum = r.parada || (si + 1)
      
      const pulseClass = isRed ? 'pulse-error' : (rl === 'medium' ? 'pulse-warn' : '')
      
      const icon = L.divIcon({
        className: '',
        html: `
          <div class="${pulseClass}" style="
            width:${sz}px; height:${sz}px; border-radius:50%;
            background:${dotColor}; border:2px solid #fff;
            display:flex; align-items:center; justify-content:center;
            font-size:9px; font-weight:900; color:#fff;
            box-shadow: 0 2px 10px rgba(0,0,0,0.4);
            cursor:pointer;
          ">${stopNum}</div>
        `,
        iconSize: [sz, sz], iconAnchor: [sz/2, sz/2]
      })

      const riskHtml = rl !== 'low' ? `<div style="margin-top:5px;font-size:10px;color:${rl === 'high' ? '#e04040' : '#f0883e'};font-weight:700">${rl === 'high' ? 'Alerta' : '· Moderada'} — ${risk.pct}%</div>` : ''
      const confHtml = conf ? `<div style="margin-top:6px;padding:5px 8px;background:rgba(248,81,73,.1);border:1px solid rgba(248,81,73,.3);border-radius:4px;font-size:10px;color:#ff7b72;">Alerta geo: dice <strong>${conf.comunaDireccion}</strong> → <strong>${conf.comunaReal}</strong></div>` : ''

      const popupHtml = `<div style="min-width:180px;font-family:system-ui;font-size:12px;background:rgb(22,27,34);color:#e6edf3;border-radius:8px;padding:10px 12px;">
        <div style="font-weight:700;margin-bottom:3px">${r.iso} <span style="font-size:10px;color:#8b949e">#${stopNum}</span></div>
        <div style="color:#8b949e;font-size:11px;margin-bottom:2px">${r.veh}</div>
        <div style="color:#aaa;font-size:11px">${r.dir}</div>
        ${riskHtml}${confHtml}
        <div style="margin-top:8px"><button onclick="navigator.clipboard.writeText('${r.iso.replace(/'/g, "\\'")}').catch(()=>{})" style="font-size:10px;padding:3px 8px;border-radius:4px;background:rgba(56,139,253,.15);color:#7bb8ff;border:1px solid rgba(56,139,253,.25);cursor:pointer;">Copiar ISO</button></div>
      </div>`

      const mk = L.marker([r.lat, r.lng], { icon, zIndexOffset: isRed ? 200 : rl === 'medium' ? 100 : 0 })
      
      // Add commune name as permanent label if it's a conflict or high risk
      if (isRed) {
        mk.bindTooltip(conf ? conf.comunaReal : r.comuna, { permanent: true, direction: 'top', offset: [0, -10], className: 'commune-label-modal' })
      }

      mk.bindPopup(popupHtml, { maxWidth: 300, className: '' })
      mk.addTo(map)
    })

    // Fit bounds
    const lats = pts.map(r => r.lat!), lngs = pts.map(r => r.lng!)
    map.fitBounds([
      [Math.min(...lats) - 0.01, Math.min(...lngs) - 0.01],
      [Math.max(...lats) + 0.01, Math.max(...lngs) + 0.01]
    ], { padding: [30, 30] })

    return () => {
      if (mapRef.current) { try { mapRef.current.remove() } catch(e) {} mapRef.current = null }
    }
  }, [veh]) // eslint-disable-line

  if (!veh) return null

  const pts = routeData.filter(r => r.veh === veh && r.lat !== null && r.lng !== null)
  const vr = riskResults[veh]
  const riskByKey: Record<string, { riskLevel: string; pct: number }> = {}
  if (vr) for (const r of vr.results) riskByKey[r.key] = { riskLevel: r.riskLevel, pct: Math.round(r.riskScore * 100) }

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
      style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.75)', backdropFilter:'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ display:'flex', borderRadius:12, overflow:'hidden', border:'1px solid rgba(255,255,255,.1)', boxShadow:'0 25px 60px rgba(0,0,0,.6)', width:'90vw', maxWidth:1100, height:'85vh', background:'rgb(13,17,23)' }}>

        {/* Sidebar */}
        <div style={{ width:240, flexShrink:0, display:'flex', flexDirection:'column', borderRight:'1px solid rgba(255,255,255,.07)', overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,.07)', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:13, fontWeight:700, color:'#e6edf3', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>🗺 {veh}</span>
              <button onClick={onClose} style={{ background:'none', border:'none', color:'#6e7681', cursor:'pointer', fontSize:16, lineHeight:1, padding:'0 2px' }}>✕</button>
            </div>
            <div style={{ fontSize:10, color:'#8b949e', marginTop:4 }}>
              {pts.length} puntos{nHigh ? ` · ${nHigh} alerta${nHigh !== 1 ? 's' : ''}` : ''}{nMed ? ` · ${nMed} moderada${nMed !== 1 ? 's' : ''}` : ''}{!nHigh && !nMed ? ' · Sin alertas' : ''}
            </div>
          </div>
          <div style={{ padding:'6px 14px 4px', fontSize:10, color:'#6e7681', fontWeight:600, borderBottom:'1px solid rgba(255,255,255,.05)', flexShrink:0 }}>
            {comunaArr.length} comunas · {pts.length} puntos
          </div>
          <div style={{ flex:1, overflowY:'auto' }}>
            {comunaArr.map(c => {
              const isH = c.rl === 'high', isM = c.rl === 'medium'
              const color = isH ? '#ff7b72' : isM ? '#f0883e' : '#8b949e'
              return (
                <div key={c.name} style={{ padding:'8px 14px', borderBottom:'1px solid rgba(255,255,255,.04)', fontSize:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ color, fontWeight:600 }}>{c.name}</span>
                    {c.pct > 0 && <span style={{ fontSize:9, fontFamily:'monospace', fontWeight:700, color }}>{c.pct}%</span>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                    <span style={{ fontSize:10, color:'#6e7681' }}>{c.isos.length} ISO{c.isos.length !== 1 ? 's' : ''}</span>
                    {(isH || isM) && <span style={{ fontSize:9, fontWeight:700, color }}>{isH ? '⚠ Alerta' : '· Moderada'}</span>}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ padding:'10px 14px', borderTop:'1px solid rgba(255,255,255,.06)', flexShrink:0, display:'flex', flexDirection:'column', gap:5 }}>
            {[['#e04040','Alerta / CI'],['#f0883e','Moderada'],['#4a9fd4','Normal / cluster']].map(([c, l]) => (
              <div key={l} style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, color:'#8b949e' }}>
                <div style={{ width:9, height:9, borderRadius:'50%', background:c, border:'1.5px solid rgba(255,255,255,.6)', flexShrink:0 }} />
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* Map container — plain div, Leaflet controls it directly */}
        <div ref={mapDivRef} style={{ flex:1, minWidth:0, height:'100%' }} />
      </div>
    </div>
  )
}