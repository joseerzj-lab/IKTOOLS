import { useEffect, useRef, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { RouteRow } from '../../types/auditoria'
import { EmptyState, FilterPills, Btn, C, T, R } from '../../ui/DS'

const ROUTE_COLORS = [
  '#4a9fd4','#a78bfa','#34d399','#fb923c','#f472b6',
  '#60a5fa','#fbbf24','#4ade80','#f87171','#818cf8',
  '#22d3ee','#e879f9','#a3e635','#fb7185','#38bdf8',
]

const TILE_DARK  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

interface Props {
  routeData:         RouteRow[]
  resolvedProyectos: Set<string>
  flaggedProyectos:  Set<string>
  onToggleResolve:   (iso: string) => void
  onToggleFlag:      (iso: string) => void
  onResolveAll:      (isos: string[]) => void
  onFlagAll:         (isos: string[]) => void
  hasData:           boolean
  isReady:           boolean
  excludedVehicles:  Set<string>
  isVisible?:        boolean
}

type StatusFilter = 'all' | 'pendiente' | 'alerta' | 'revisado'

const glass = {
  row: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.005) 100%)',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    borderLeft: '1px solid rgba(255,255,255,0.1)',
    borderRight: '1px solid rgba(255,255,255,0.02)',
    borderBottom: '1px solid rgba(255,255,255,0.02)',
    backdropFilter: 'blur(24px)',
  } as React.CSSProperties,
}

export default function TabProyectos({
  routeData, resolvedProyectos, flaggedProyectos,
  onToggleResolve, onToggleFlag, onResolveAll, onFlagAll, hasData, isReady,
  excludedVehicles, isVisible = true,
}: Props) {
  const mapDivRef    = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)
  const markersRef   = useRef<any[]>([])
  const polylinesRef = useRef<any[]>([])
  const tileRef      = useRef<any>(null)
  const mapInitRef   = useRef(false)

  const [focusedIso,   setFocusedIso]   = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search,       setSearch]       = useState('')
  const [lightMap,     setLightMap]     = useState(false)
  const [copiedId,     setCopiedId]     = useState<string | null>(null)

  const zoomOnFocusRef = useRef(true)

  const vehs = useMemo(() => [...new Set(routeData.map(r => r.veh))].sort(), [routeData])
  const vehColors = useMemo(() => {
    const m: Record<string, string> = {}
    vehs.forEach((v, i) => { m[v] = ROUTE_COLORS[i % ROUTE_COLORS.length] })
    return m
  }, [vehs])

  const copyText = (txt: string, id: string) => {
    navigator.clipboard.writeText(txt).catch(() => {})
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  function initMap() {
    if (!mapDivRef.current || mapInitRef.current) return
    const L = (window as any).L
    if (!L) return
    mapInitRef.current = true
    const map = L.map(mapDivRef.current, { center: [-33.47, -70.65], zoom: 11, zoomControl: false })
    mapRef.current = map
    const tile = L.tileLayer(TILE_DARK, { attribution: '&copy; CARTO', subdomains: 'abcd', maxZoom: 19 })
    tile.addTo(map)
    tileRef.current = tile
  }

  useEffect(() => {
    const att = () => {
      if (mapInitRef.current) return
      if (mapDivRef.current && mapDivRef.current.offsetWidth > 0) initMap()
      else if (isVisible) setTimeout(att, 200)
    }
    if (isVisible && !mapInitRef.current) att()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        mapInitRef.current = false
      }
    }
  }, [isVisible])

  useEffect(() => {
    if (isVisible && mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 300)
  }, [isVisible])

  useEffect(() => {
    const L = (window as any).L; if (!L || !mapRef.current) return
    if (tileRef.current) mapRef.current.removeLayer(tileRef.current)
    tileRef.current = L.tileLayer(lightMap ? TILE_LIGHT : TILE_DARK, { attribution: '&copy; CARTO', maxZoom: 19 }).addTo(mapRef.current)
  }, [lightMap])

  useEffect(() => {
    const L = (window as any).L; if (!L || !mapRef.current) return
    const map = mapRef.current
    markersRef.current.forEach(m => map.removeLayer(m))
    polylinesRef.current.forEach(p => map.removeLayer(p))
    markersRef.current = []; polylinesRef.current = []

    const active = routeData.filter(r => r.lat !== null && r.lng !== null)
    const focusedVeh = focusedIso ? routeData.find(c => c.iso === focusedIso)?.veh : null

    // Polylines
    const vPts: Record<string, [number, number][]> = {}
    active.forEach(r => { if (!vPts[r.veh]) vPts[r.veh] = []; vPts[r.veh].push([r.lat!, r.lng!]) })
    Object.entries(vPts).forEach(([v, p]) => {
      if (p.length < 2) return
      const isF = focusedVeh ? v === focusedVeh : true
      const line = L.polyline(p, { color: vehColors[v] || '#4a9fd4', weight: isF ? 3 : 1.5, opacity: focusedVeh ? (isF ? 0.9 : 0.1) : 0.5 }).addTo(map)
      polylinesRef.current.push(line)
    })

    // Markers
    active.forEach(r => {
      const isF = r.iso === focusedIso
      const isRes = resolvedProyectos.has(r.iso)
      const isFlg = flaggedProyectos.has(r.iso)
      const isVehF = focusedVeh ? r.veh === focusedVeh : true
      if (focusedVeh && !isVehF) return

      const col = isF ? '#ffda1a' : (isRes ? '#4ade80' : (isFlg ? '#f87171' : (vehColors[r.veh] || '#4a9fd4')))
      const sz = isF ? 28 : (isRes ? 10 : 20)
      const cls = isF ? 'marker-focus' : (!isRes ? 'marker-conflict' : '')
      
      const icon = L.divIcon({
        className: '',
        html: `<div class="${cls}" style="width:${sz}px;height:${sz}px;border-radius:50%;background:${col};border:1.5px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:900;box-shadow:0 2px 8px rgba(0,0,0,0.4)">${isRes ? '✓' : '!'}</div>`,
        iconSize: [sz, sz], iconAnchor: [sz/2, sz/2], popupAnchor: [0, -sz/2]
      })

      const mk = L.marker([r.lat!, r.lng!], { icon, zIndexOffset: isF ? 1000 : (!isRes ? 500 : 0) })
      
      mk.bindPopup(`<div style="font-family:'Inter',sans-serif;font-size:12px;padding:4px;min-width:260px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                <div style="font-weight:900;font-size:16px;letter-spacing:-0.02em;color:#fff">${r.iso}</div>
                <div style="background:rgba(255,255,255,0.1);padding:3px 6px;border-radius:4px;font-size:10px;color:rgba(255,255,255,0.8);font-family:monospace">${r.lat!.toFixed(5)}, ${r.lng!.toFixed(5)}</div>
              </div>
              <div style="color:rgba(255,255,255,0.5);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">${r.veh}</div>
              <div style="color:rgba(255,255,255,0.85);font-size:12px;margin-bottom:12px;line-height:1.4;max-width:280px">${r.dir}</div>
              <div style="display:flex;gap:8;margin-top:14px">
                <button style="background:linear-gradient(135deg, #10b981, #059669);color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;flex:1;font-weight:800;font-size:12px;box-shadow:0 2px 8px rgba(16,185,129,0.3)" onclick="window.dispatchEvent(new CustomEvent('map-resolve-proyecto', {detail:'${r.iso}'}))">${isRes ? '↩ Reabrir' : '✓ Resolver'}</button>
                <button style="background:linear-gradient(135deg, #ef4444, #dc2626);color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;flex:1;font-weight:800;font-size:12px;box-shadow:0 2px 8px rgba(239,68,68,0.3)" onclick="window.dispatchEvent(new CustomEvent('map-flag-proyecto', {detail:'${r.iso}'}))">${isFlg ? '✕ Quitar Alerta' : '⚠ Alertar'}</button>
              </div>
            </div>`, { className: 'premium-popup', autoPan: false })
      
      mk.on('click', () => { 
        zoomOnFocusRef.current = false
        setFocusedIso(r.iso) 
      })
      mk.addTo(map)
      markersRef.current.push(mk)

      if (isF) {
        setTimeout(() => {
          if (mapRef.current) mk.openPopup()
        }, 50)
      }
    })
  }, [routeData, resolvedProyectos, flaggedProyectos, vehColors, focusedIso])

  useEffect(() => {
    const resCb = (e: any) => onToggleResolve(e.detail)
    const flgCb = (e: any) => onToggleFlag(e.detail)
    window.addEventListener('map-resolve-proyecto', resCb)
    window.addEventListener('map-flag-proyecto', flgCb)
    return () => {
      window.removeEventListener('map-resolve-proyecto', resCb)
      window.removeEventListener('map-flag-proyecto', flgCb)
    }
  }, [onToggleResolve, onToggleFlag])

  // Center route on ISO select
  useEffect(() => {
    const map = mapRef.current
    if (!map || !routeData.length) return
    const L = (window as any).L
    if (!L) return

    if (!focusedIso) {
      const pts = routeData.filter(r => r.lat !== null && r.lng !== null)
      if (pts.length > 0) {
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
        for (let i = 0; i < pts.length; i++) {
          const pLat = pts[i].lat!
          const pLng = pts[i].lng!
          if (pLat < minLat) minLat = pLat
          if (pLat > maxLat) maxLat = pLat
          if (pLng < minLng) minLng = pLng
          if (pLng > maxLng) maxLng = pLng
        }
        map.flyToBounds([
          [minLat, minLng],
          [maxLat, maxLng]
        ], { padding: [40, 40], duration: 0.8, maxZoom: 11 })
      }
      return
    }

    const routePt = routeData.find(r => r.iso === focusedIso)
    if (routePt && routePt.lat !== null && routePt.lng !== null) {
      if (zoomOnFocusRef.current) {
        const targetPt = map.project([routePt.lat, routePt.lng], 15)
        targetPt.y -= 50
        const shiftedLatLng = map.unproject(targetPt, 15)
        map.flyTo(shiftedLatLng, 15, { duration: 0.6 })
      }
    }
  }, [focusedIso, routeData])

  const visible = useMemo(() => routeData.filter(c => {
    if (excludedVehicles.has(c.veh)) return false
    const res = resolvedProyectos.has(c.iso); const flg = flaggedProyectos.has(c.iso)
    const st = res ? 'resuelto' : (flg ? 'alerta' : 'pendiente')
    if (statusFilter !== 'all' && st !== statusFilter) return false
    if (search) {
      const lo = search.toLowerCase()
      return c.iso.toLowerCase().includes(lo) || c.veh.toLowerCase().includes(lo) || c.dir.toLowerCase().includes(lo)
    }
    return true
  }), [routeData, resolvedProyectos, flaggedProyectos, statusFilter, search, excludedVehicles])

  const exportVisible = () => {
    const W = (window as any).XLSX; if (!W) return alert('XLSX no disponible')
    const wb = W.utils.book_new()
    const wsData = [['ISO', 'Vehículo', 'Dirección', 'Estado']]
    for (const c of visible) {
      const res = resolvedProyectos.has(c.iso); const flg = flaggedProyectos.has(c.iso)
      const st = res ? 'Resuelto' : (flg ? 'Alerta' : 'Pendiente')
      wsData.push([c.iso, c.veh, c.dir, st])
    }
    const ws = W.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{wch:14},{wch:20},{wch:45},{wch:12}]
    W.utils.book_append_sheet(wb, ws, 'Proyectos')
    
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const ts = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`
    W.writeFile(wb, `proyectos_filtrados_${ts}.xlsx`)
  }

  if (!hasData) return <EmptyState icon="📍" message="Carga un plan primero" />
  if (!isReady) return <EmptyState icon="⚙️" message="Cargando datos..." />

  return (
    <div style={{ display:'grid', gridTemplateColumns:'380px 1fr', height:'100%', overflow:'hidden', background: C.bg }}>
      <div style={{ borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column', background:'var(--ar-bg-sidebar)', backdropFilter:'blur(20px)' }}>
        <div style={{ padding:'16px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:10, background:'var(--ar-bg-header)' }}>
          <div style={{ flex:1 }}><span style={{ fontSize:22, fontWeight:950, color:'#b19cd9', letterSpacing:'-0.02em' }}>{routeData.length}</span> <span style={{ fontSize:10, fontWeight:800, color:C.textMuted, textTransform:'uppercase' }}>Proyectos</span></div>
          <div style={{ display:'flex', gap:6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Btn variant="secondary" size="xs" onClick={exportVisible}>⬇ Exportar</Btn>
            <Btn variant="success" size="xs" onClick={() => onResolveAll(routeData.filter(c=>!excludedVehicles.has(c.veh)).map(c=>c.iso))}>Todo ✓</Btn>
            <Btn variant="danger" size="xs" onClick={() => onFlagAll(routeData.filter(c=>!excludedVehicles.has(c.veh)).map(c=>c.iso))}>Todo ✕</Btn>
          </div>
        </div>
        <div style={{ padding:'12px', display:'flex', flexDirection:'column', gap:10, background:'rgba(255,255,255,0.02)' }}>
          <input 
            value={search} 
            onChange={e=>setSearch(e.target.value)} 
            placeholder="Buscar ISO, veh o dirección..." 
            style={{ 
              padding:'8px 14px', 
              background:'var(--ar-bg-hover)', 
              border:`1px solid ${C.border}`, 
              color:C.text, 
              borderRadius:R.lg, 
              outline:'none',
              fontSize: T.base,
              fontWeight: 600,
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
            }} 
          />
          <FilterPills<StatusFilter> 
            value={statusFilter} 
            onChange={setStatusFilter} 
            options={[
              {key:'all',label:'Todos'},
              {key:'pendiente',label:'⏳ Pendiente'},
              {key:'alerta',label:'✕ Alerta'},
              {key:'revisado',label:'✓ Resuelto'}
            ]} 
          />
        </div>
        <div 
          style={{ flex:1, overflowY:'scroll', padding:'8px' }} 
          className="custom-scrollbar"
        >
          {visible.map((c, idx) => {
            const isF = focusedIso === c.iso
            const isRes = resolvedProyectos.has(c.iso)
            const isFlg = flaggedProyectos.has(c.iso)
            const isCopied = copiedId === c.iso
            const isCopiedDir = copiedId === c.iso + '_dir'
            const isCopiedCoord = copiedId === c.iso + '_coord'
            
            return (
              <motion.div 
                key={c.iso}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.02 }}
                onClick={() => {
                  zoomOnFocusRef.current = true
                  setFocusedIso(c.iso === focusedIso ? null : c.iso)
                }} 
                style={{ 
                  padding:'14px', 
                  borderRadius: R.xl,
                  marginBottom: 8,
                  cursor:'pointer', 
                  ...glass.row,
                  background: isF ? 'rgba(56,139,253,0.12)' : (isFlg ? 'rgba(248,81,73,0.08)' : 'rgba(255,255,255,0.02)'), 
                  border: `1px solid ${isF ? C.blue : (isFlg ? C.red : 'rgba(255,255,255,0.06)')}`, 
                  borderLeft: `4px solid ${isF ? C.blue : (isRes ? C.green : (isFlg ? C.red : 'rgba(255,255,255,0.1)'))}`,
                  opacity: isRes ? 0.5 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isF ? `0 8px 20px rgba(56,139,253,0.15)` : '0 2px 8px rgba(0,0,0,0.2)'
                }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontWeight:900, fontSize:13, color:'#b19cd9', fontFamily:T.fontMono }}>{c.iso}</span>
                      {isRes && <span style={{ color:C.green, fontSize:10 }}>✓</span>}
                    </div>
                    <div style={{ fontSize:10, color:C.textMuted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginTop:2 }}>{c.veh}</div>
                  </div>
                  
                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                    <Btn 
                      variant={isRes ? 'success' : 'secondary'} 
                      size="xs" 
                      onClick={() => onToggleResolve(c.iso)}
                      style={{ padding:'4px 8px' }}
                    >
                      {isRes ? '↩' : '✓'}
                    </Btn>
                    <Btn 
                      variant={isFlg ? 'danger' : 'secondary'} 
                      size="xs" 
                      onClick={() => onToggleFlag(c.iso)}
                      style={{ padding:'4px 8px' }}
                    >
                      {isFlg ? '✕' : '⚠'}
                    </Btn>
                  </div>
                </div>

                {/* Information Area */}
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                   <div style={{ 
                      fontSize: 11, color: C.textSub, lineHeight: 1.4, 
                      background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: R.md,
                      border: '1px solid rgba(255,255,255,0.05)',
                      position: 'relative',
                   }}>
                      <div style={{ overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                        {c.dir}
                      </div>
                      <div style={{ display:'flex', gap:6, marginTop:6 }}>
                         <button 
                            onClick={(e) => { e.stopPropagation(); copyText(c.iso, c.iso) }}
                            style={{ 
                              background:'rgba(56,139,253,0.1)', color:C.blue, border:'none', 
                              fontSize:9, fontWeight:800, padding:'3px 8px', borderRadius:R.sm, cursor:'pointer' 
                            }}>
                            {isCopied ? '✓ ISO' : '📋 ISO'}
                         </button>
                         <button 
                            onClick={(e) => { e.stopPropagation(); copyText(c.dir, c.iso + '_dir') }}
                            style={{ 
                              background:'rgba(255,255,255,0.05)', color:C.textMuted, border:'none', 
                              fontSize:9, fontWeight:800, padding:'3px 8px', borderRadius:R.sm, cursor:'pointer' 
                            }}>
                            {isCopiedDir ? '✓ DIR' : '📋 DIRECCIÓN'}
                         </button>
                         <button 
                            onClick={(e) => { e.stopPropagation(); copyText(`${c.lat}, ${c.lng}`, c.iso + '_coord') }}
                            style={{ 
                              background:'rgba(46,160,67,0.1)', color:C.green, border:'none', 
                              fontSize:9, fontWeight:800, padding:'3px 8px', borderRadius:R.sm, cursor:'pointer' 
                            }}>
                            {isCopiedCoord ? '✓ COORD' : '📍 COORD'}
                         </button>
                      </div>
                   </div>

                   {/* Coordinate display right below */}
                   {c.lat !== null && c.lng !== null && (
                     <div style={{ display:'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 2 }}>
                       <span style={{ fontSize:10, color:C.textMuted, fontFamily: 'monospace' }}>{c.lat.toFixed(4)}, {c.lng.toFixed(4)}</span>
                     </div>
                   )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
      <div style={{ position:'relative' }}>
        <div ref={mapDivRef} style={{ width:'100%', height:'100%' }} />
        <div style={{ position:'absolute', top:16, right:16, zIndex:1000, display:'flex', flexDirection:'column', gap:8 }}>
          <button 
            onClick={() => setLightMap(!lightMap)} 
            style={{ 
              width:40, height:40, borderRadius:12, background:'rgba(22,27,34,0.85)', color:'#fff', 
              border:'1px solid rgba(255,255,255,0.15)', cursor:'pointer', backdropFilter:'blur(10px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontSize:18
            }}>{lightMap ? '🌙' : '☀️'}</button>
          {focusedIso && (
            <button 
              onClick={() => setFocusedIso(null)} 
              style={{ 
                width:40, height:40, borderRadius:12, background:C.red, color:'#fff', 
                border:'none', cursor:'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
                fontSize: 16, fontWeight: 800
              }}>✕</button>
          )}
        </div>
        
        <AnimatePresence>
          {focusedIso && (
             <motion.div 
               initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:20 }}
               style={{ 
                  position:'absolute', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:1000,
                  background:'rgba(22,27,33,0.9)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.1)',
                  padding:'10px 20px', borderRadius:R.xl, display:'flex', alignItems:'center', gap:12,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
               }}>
                <div style={{ width:12, height:12, borderRadius:'50%', background: vehColors[routeData.find(c=>c.iso===focusedIso)?.veh || ''] || C.blue }}></div>
                <div style={{ display:'flex', flexDirection:'column' }}>
                   <span style={{ fontSize:10, color:C.textMuted, fontWeight:700, textTransform:'uppercase' }}>En ruta de vehiculo</span>
                   <span style={{ fontSize:14, fontWeight:900, color:'#fff' }}>{routeData.find(c=>c.iso===focusedIso)?.veh}</span>
                </div>
                <Btn variant="secondary" size="xs" onClick={()=>setFocusedIso(null)}>Limpiar Seleccion</Btn>
             </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
