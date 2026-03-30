import { useEffect, useRef, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ComunaConflict, RouteRow } from '../../types/auditoria'
import {
  EmptyState, FilterPills, Btn,
  C, T, R
} from '../../ui/DS'

declare const RM_COMUNAS_DATA: Record<string, {
  c: [number, number]
  p: [number, number][]
  n?: string
}>

const ROUTE_COLORS = [
  '#4a9fd4','#a78bfa','#34d399','#fb923c','#f472b6',
  '#60a5fa','#fbbf24','#4ade80','#f87171','#818cf8',
  '#22d3ee','#e879f9','#a3e635','#fb7185','#38bdf8',
]

const TILE_DARK  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

interface Props {
  routeData:         RouteRow[]
  conflicts:         ComunaConflict[]
  resolvedConflicts: Set<string>
  flaggedConflicts:  Set<string>
  onToggleResolve:   (iso: string) => void
  onToggleFlag:      (iso: string) => void
  onResolveAll:      (isos: string[], aKeys: (string | null)[]) => void
  onFlagAll:         (isos: string[], aKeys: (string | null)[]) => void
  hasData:           boolean
  isReady:           boolean
  onRunAnalysis:     (e: React.MouseEvent) => void
  excludedVehicles:  Set<string>
  isVisible?:        boolean
}

type StatusFilter = 'all' | 'pendiente' | 'alerta' | 'revisado'

// ── Liquid Glass style tokens ────────────────────────────────
const glass = {
  card: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)',
    backdropFilter: 'blur(40px) saturate(120%)',
    WebkitBackdropFilter: 'blur(40px) saturate(120%)',
    borderTop: '1px solid rgba(255,255,255,0.2)',
    borderLeft: '1px solid rgba(255,255,255,0.15)',
    borderRight: '1px solid rgba(255,255,255,0.02)',
    borderBottom: '1px solid rgba(255,255,255,0.02)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 1px 1px 0 rgba(255,255,255,0.1)',
  } as React.CSSProperties,
  row: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.005) 100%)',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    borderLeft: '1px solid rgba(255,255,255,0.1)',
    borderRight: '1px solid rgba(255,255,255,0.02)',
    borderBottom: '1px solid rgba(255,255,255,0.02)',
    backdropFilter: 'blur(24px)',
  } as React.CSSProperties,
}

export default function TabWrongCommune({
  routeData, conflicts, resolvedConflicts, flaggedConflicts,
  onToggleResolve, onToggleFlag, onResolveAll, onFlagAll, hasData, isReady, onRunAnalysis,
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

  const conflictSet = useMemo(() => new Set(conflicts.map(c => c.iso)), [conflicts])

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

    // Global style for markers
    if (!document.getElementById('map-styles')) {
      const style = document.createElement('style')
      style.id = 'map-styles'
      style.innerHTML = `
        @keyframes pulse-red { 0% { box-shadow:0 0 0 0 rgba(248,81,73,0.7); } 70% { box-shadow:0 0 0 10px rgba(248,81,73,0); } 100% { box-shadow:0 0 0 0 rgba(248,81,73,0); } }
        @keyframes pulse-yellow { 0% { box-shadow:0 0 0 0 rgba(255,218,26,0.7); } 70% { box-shadow:0 0 0 12px rgba(255,218,26,0); } 100% { box-shadow:0 0 0 0 rgba(255,218,26,0); } }
        .marker-conflict { animation: pulse-red 2s infinite; border: 2px solid #fff; }
        .marker-focus { animation: pulse-yellow 2s infinite; border: 3px solid #fff; z-index: 1000 !important; }
        .commune-background-label { pointer-events: none !important; display: flex; align-items: center; justify-content: center; }
        .commune-background-label div { font-size: var(--commune-lbl-sz, 16px); font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; text-shadow: 2px 2px 6px rgba(0,0,0,0.9), -1px -1px 4px rgba(0,0,0,0.9); }
        .premium-popup .leaflet-popup-content-wrapper { background: rgba(22,27,33,0.9); backdrop-filter: blur(10px); color: #fff; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); }
        .premium-popup .leaflet-popup-tip { background: rgba(22,27,33,0.9); }
      `
      document.head.appendChild(style)
    }

    const cmData = (window as any).RM_COMUNAS_DATA
    if (cmData) {
      Object.keys(cmData).forEach(k => {
        const d = cmData[k]; if (!d?.p) return
        L.polygon(d.p, { color: '#5b8fd6', weight: 1.5, opacity: 0.4, fillColor: '#1e3a6e', fillOpacity: 0.05, interactive: false }).addTo(map)
        
        if (d.c) {
          const name = d.n || k
          const icon = L.divIcon({
            className: 'commune-background-label',
            html: `<div>${name}</div>`,
            iconSize: [200, 30],
            iconAnchor: [100, 15]
          })
          L.marker(d.c, { icon, interactive: false, zIndexOffset: -100 }).addTo(map)
        }
      })
    }

    const updateLabelSize = () => {
      const z = map.getZoom()
      const scale = Math.pow(2, z - 13)
      const px = Math.max(Math.min(22 * scale, 120), 4)
      document.documentElement.style.setProperty('--commune-lbl-sz', px + 'px')
    }
    map.on('zoom', updateLabelSize)
    updateLabelSize()
  }

  useEffect(() => {
    const att = () => {
      if (mapInitRef.current) return
      if (mapDivRef.current && mapDivRef.current.offsetWidth > 0) initMap()
      // If we are visible but offsetWidth is 0, keep trying slightly longer
      else if (isVisible) setTimeout(att, 200)
    }
    if (isVisible && !mapInitRef.current) att()
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
    const focusedVeh = focusedIso ? conflicts.find(c => c.iso === focusedIso)?.veh : null

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
      const isConf = conflictSet.has(r.iso)
      const isF = r.iso === focusedIso
      const isRes = resolvedConflicts.has(r.iso)
      const isFlg = flaggedConflicts.has(r.iso)
      const isVehF = focusedVeh ? r.veh === focusedVeh : true
      if (focusedVeh && !isVehF) return

      const col = isF ? '#ffda1a' : (isConf ? (isRes ? '#4ade80' : '#f87171') : (vehColors[r.veh] || '#4a9fd4'))
      const sz = isF ? 28 : (isConf ? 20 : 10)
      const cls = isF ? 'marker-focus' : (isConf && !isRes ? 'marker-conflict' : '')
      
      const icon = L.divIcon({
        className: '',
        html: `<div class="${cls}" style="width:${sz}px;height:${sz}px;border-radius:50%;background:${col};border:1.5px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:900;box-shadow:0 2px 8px rgba(0,0,0,0.4)">${isConf ? (isRes ? '✓' : '!') : ''}</div>`,
        iconSize: [sz, sz], iconAnchor: [sz/2, sz/2], popupAnchor: [0, -sz/2]
      })

      const mk = L.marker([r.lat!, r.lng!], { icon, zIndexOffset: isF ? 1000 : (isConf ? 500 : 0) })
      
      if (isConf) {
        const c = conflicts.find(x => x.iso === r.iso)
        if (c) {
          mk.bindPopup(`<div style="font-family:sans-serif;font-size:12px;padding:12px;min-width:200px">
              <div style="font-weight:800;font-size:14px;margin-bottom:4px;color:#fff">${r.iso}</div>
              <div style="color:rgba(255,255,255,0.6);font-size:10px;margin-bottom:4px">${r.veh}</div>
              <div style="color:rgba(255,255,255,0.8);font-size:11px;margin-bottom:8px;line-height:1.3;max-width:260px">${c.dir}</div>
              <div style="margin:8px 0;color:#f87171;font-weight:700;background:rgba(248,81,73,0.1);padding:6px;border-radius:6px;border:1px solid rgba(248,81,73,0.2)">
                <div style="font-size:9px;text-transform:uppercase;opacity:0.7">Discrepancia</div>
                ${c.comunaDireccion} → ${c.comunaReal}
              </div>
              <div style="display:flex;gap:6;margin-top:10px">
                <button style="background:#238636;color:#fff;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;flex:1;font-weight:800;font-size:11px" onclick="window.dispatchEvent(new CustomEvent('map-resolve', {detail:'${r.iso}'}))">${isRes ? '↩ Reabrir' : '✓ Resolver'}</button>
                <button style="background:#f87171;color:#fff;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;flex:1;font-weight:800;font-size:11px" onclick="window.dispatchEvent(new CustomEvent('map-flag', {detail:'${r.iso}'}))">${isFlg ? '✕ Quitar Alerta' : '⚠ Alertar'}</button>
              </div>
            </div>`, { className: 'premium-popup', autoPan: false })
        }
      }
      
      mk.on('click', () => { 
        zoomOnFocusRef.current = false
        setFocusedIso(r.iso) 
      })
      mk.addTo(map)
      markersRef.current.push(mk)

      // Cuando recreamos los marcadores (por cambio de focusedIso), forzamos
      // a que el marcador actualmente enfocado despliegue su mini card (popup)
      if (isF && isConf) {
        setTimeout(() => {
          if (mapRef.current) mk.openPopup()
        }, 50)
      }
    })
  }, [routeData, conflicts, resolvedConflicts, vehColors, conflictSet, focusedIso])

  useEffect(() => {
    const resCb = (e: any) => onToggleResolve(e.detail)
    const flgCb = (e: any) => onToggleFlag(e.detail)
    window.addEventListener('map-resolve', resCb)
    window.addEventListener('map-flag', flgCb)
    return () => {
      window.removeEventListener('map-resolve', resCb)
      window.removeEventListener('map-flag', flgCb)
    }
  }, [onToggleResolve, onToggleFlag])

  // Center route on ISO select
  useEffect(() => {
    const map = mapRef.current
    if (!map || !routeData.length) return
    const L = (window as any).L
    if (!L) return

    if (!focusedIso) {
      // Return to full RM panorama
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
      } else {
        map.flyTo([-33.45, -70.65], 11, { duration: 0.8 })
      }
      return
    }

    const routePt = routeData.find(r => r.iso === focusedIso)
    if (routePt && routePt.lat !== null && routePt.lng !== null) {
      if (zoomOnFocusRef.current) {
        const targetPt = map.project([routePt.lat, routePt.lng], 15)
        targetPt.y -= 140
        const shiftedLatLng = map.unproject(targetPt, 15)
        map.flyTo(shiftedLatLng, 15, { duration: 0.6 })
      }
    }
  }, [focusedIso, routeData])

  const visible = useMemo(() => conflicts.filter(c => {
    if (excludedVehicles.has(c.veh)) return false
    const res = resolvedConflicts.has(c.iso); const flg = flaggedConflicts.has(c.iso)
    const st = res ? 'resuelto' : (flg ? 'alerta' : 'pendiente')
    if (statusFilter !== 'all' && st !== statusFilter) return false
    if (search) {
      const lo = search.toLowerCase()
      return c.iso.toLowerCase().includes(lo) || c.veh.toLowerCase().includes(lo) || c.comunaDireccion.toLowerCase().includes(lo)
    }
    return true
  }), [conflicts, resolvedConflicts, flaggedConflicts, statusFilter, search, excludedVehicles])

  const exportVisible = () => {
    const W = (window as any).XLSX; if (!W) return alert('XLSX no disponible')
    const wb = W.utils.book_new()
    const wsData = [['ISO', 'Vehículo', 'Dirección', 'Comuna Dirección', 'Comuna Real', 'Estado']]
    for (const c of visible) {
      const res = resolvedConflicts.has(c.iso); const flg = flaggedConflicts.has(c.iso)
      const st = res ? 'Resuelto' : (flg ? 'Alerta' : 'Pendiente')
      wsData.push([c.iso, c.veh, c.dir, c.comunaDireccion, c.comunaReal, st])
    }
    const ws = W.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{wch:14},{wch:20},{wch:45},{wch:22},{wch:22},{wch:12}]
    W.utils.book_append_sheet(wb, ws, 'Conflictos Filtrados')
    
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const ts = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`
    W.writeFile(wb, `conflictos_filtrados_${ts}.xlsx`)
  }

  if (!hasData) return <EmptyState icon="📍" message="Carga un plan primero" />
  if (!isReady) return <EmptyState icon="⚙️" message="Cargando datos..." />

  return (
    <div style={{ display:'grid', gridTemplateColumns:'380px 1fr', height:'100%', overflow:'hidden', background: C.bg }}>
      <div style={{ borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column', background:'var(--ar-bg-sidebar)', backdropFilter:'blur(20px)' }}>
        <div style={{ padding:'16px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:10, background:'var(--ar-bg-header)' }}>
          <div style={{ flex:1 }}><span style={{ fontSize:22, fontWeight:950, color:C.red, letterSpacing:'-0.02em' }}>{conflicts.length}</span> <span style={{ fontSize:10, fontWeight:800, color:C.textMuted, textTransform:'uppercase' }}>Conflictos</span></div>
          <div style={{ display:'flex', gap:6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Btn variant="secondary" size="xs" onClick={exportVisible}>⬇ Exportar</Btn>
            <Btn variant="blue" size="xs" onClick={onRunAnalysis}>Analizar</Btn>
            <Btn variant="success" size="xs" onClick={() => onResolveAll(conflicts.filter(c=>!excludedVehicles.has(c.veh)).map(c=>c.iso), [])}>Todo ✓</Btn>
            <Btn variant="danger" size="xs" onClick={() => onFlagAll(conflicts.filter(c=>!excludedVehicles.has(c.veh)).map(c=>c.iso), [])}>Todo ✕</Btn>
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
            const isRes = resolvedConflicts.has(c.iso)
            const isFlg = flaggedConflicts.has(c.iso)
            const isCopied = copiedId === c.iso
            const isCopiedDir = copiedId === c.iso + '_dir'
            
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
                      <span style={{ fontWeight:900, fontSize:13, color:C.blue, fontFamily:T.fontMono }}>{c.iso}</span>
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
                   {/* Address displaying & copy */}
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
                              fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:R.sm, cursor:'pointer' 
                            }}>
                            {isCopied ? '✓ ISO' : '📋 ISO'}
                         </button>
                         <button 
                            onClick={(e) => { e.stopPropagation(); copyText(c.dir, c.iso + '_dir') }}
                            style={{ 
                              background:'rgba(255,255,255,0.05)', color:C.textMuted, border:'none', 
                              fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:R.sm, cursor:'pointer' 
                            }}>
                            {isCopiedDir ? '✓ DIR' : '📋 DIRECCIÓN'}
                         </button>
                      </div>
                   </div>

                   {/* Commune Conflict */}
                   <div style={{ display:'flex', gap:6, alignItems:'center', background:'rgba(248,81,73,0.1)', padding:'5px 10px', borderRadius:R.md, border:'1px solid rgba(248,81,73,0.1)' }}>
                      <span style={{ fontSize:10, fontWeight:800, color:C.red }}>{c.comunaDireccion}</span>
                      <span style={{ fontSize:9, color:C.textFaint }}>→</span>
                      <span style={{ fontSize:10, fontWeight:800, color:C.blue }}>{c.comunaReal}</span>
                   </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
      <div style={{ position:'relative' }}>
        <div ref={mapDivRef} style={{ width:'100%', height:'100%' }} />
        {/* Map controls */}
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
        
        {/* Floating vehicle legend if focused */}
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
                <div style={{ width:12, height:12, borderRadius:'50%', background: vehColors[conflicts.find(c=>c.iso===focusedIso)?.veh || ''] || C.blue }}></div>
                <div style={{ display:'flex', flexDirection:'column' }}>
                   <span style={{ fontSize:10, color:C.textMuted, fontWeight:700, textTransform:'uppercase' }}>En ruta de vehiculo</span>
                   <span style={{ fontSize:14, fontWeight:900, color:'#fff' }}>{conflicts.find(c=>c.iso===focusedIso)?.veh}</span>
                </div>
                <Btn variant="secondary" size="xs" onClick={()=>setFocusedIso(null)}>Limpiar Seleccion</Btn>
             </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}