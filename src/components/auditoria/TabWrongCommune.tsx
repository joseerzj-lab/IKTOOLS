import { useEffect, useRef, useMemo, useState } from 'react'
import type { ComunaConflict, RouteRow } from '../../types/auditoria'
import {
  EmptyState, FilterPills, Btn, Badge,
  C, T, R, SP
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
  hasData:           boolean
  isReady:           boolean
  onRunAnalysis:     (e: React.MouseEvent) => void
  isVisible?:        boolean
}

type StatusFilter = 'all' | 'pendiente' | 'alerta' | 'revisado'

export default function TabWrongCommune({
  routeData, conflicts, resolvedConflicts, flaggedConflicts,
  onToggleResolve, onToggleFlag, onResolveAll, hasData, isReady, onRunAnalysis,
  isVisible = true,
}: Props) {
  const mapDivRef    = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)
  const markersRef   = useRef<any[]>([])
  const polylinesRef = useRef<any[]>([])
  const tileRef      = useRef<any>(null)
  const mapInitRef   = useRef(false)

  const [hiddenVehs,   setHiddenVehs]   = useState<Set<string>>(new Set())
  const [selected,     setSelected]     = useState<string | null>(null)
  const [focusedIso,   setFocusedIso]   = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search,       setSearch]       = useState('')
  const [lightMap,     setLightMap]     = useState(false)

  const vehs = useMemo(() => [...new Set(routeData.map(r => r.veh))].sort(), [routeData])
  const vehColors = useMemo(() => {
    const m: Record<string, string> = {}
    vehs.forEach((v, i) => { m[v] = ROUTE_COLORS[i % ROUTE_COLORS.length] })
    return m
  }, [vehs])

  const hasGeoData  = routeData.some(r => r.lat !== null)
  const conflictSet = useMemo(() => new Set(conflicts.map(c => c.iso)), [conflicts])

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
      `
      document.head.appendChild(style)
    }

    const cmData = (window as any).RM_COMUNAS_DATA
    if (cmData) {
      Object.keys(cmData).forEach(k => {
        const d = cmData[k]; if (!d?.p) return
        L.polygon(d.p, { color: '#5b8fd6', weight: 1.5, opacity: 0.4, fillColor: '#1e3a6e', fillOpacity: 0.05, interactive: false }).addTo(map)
      })
    }
  }

  useEffect(() => {
    let t = 0
    const att = () => {
      t++
      if (mapInitRef.current) return
      if (mapDivRef.current?.offsetWidth! > 0) initMap()
      else if (t < 50) setTimeout(att, 100)
    }
    att()
  }, [])

  useEffect(() => {
    if (isVisible && mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 100)
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

    const active = routeData.filter(r => r.lat !== null && r.lng !== null && !hiddenVehs.has(r.veh))
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
      const isVehF = focusedVeh ? r.veh === focusedVeh : true
      if (focusedVeh && !isVehF) return

      const col = isF ? '#ffda1a' : (isConf ? (isRes ? '#4ade80' : '#f87171') : (vehColors[r.veh] || '#4a9fd4'))
      const sz = isF ? 28 : (isConf ? 20 : 10)
      const cls = isF ? 'marker-focus' : (isConf && !isRes ? 'marker-conflict' : '')
      
      const icon = L.divIcon({
        className: '',
        html: `<div class="${cls}" style="width:${sz}px;height:${sz}px;border-radius:50%;background:${col};border:1.5px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:900;box-shadow:0 2px 8px rgba(0,0,0,0.4)">${isConf ? (isRes ? '✓' : '!') : ''}</div>`,
        iconSize: [sz, sz], iconAnchor: [sz/2, sz/2]
      })

      const mk = L.marker([r.lat!, r.lng!], { icon, zIndexOffset: isF ? 1000 : (isConf ? 500 : 0) })
      if (isConf) {
        const c = conflicts.find(x => x.iso === r.iso)
        if (c) mk.bindPopup(`<div style="font-family:sans-serif;font-size:12px;padding:8px;min-width:180px">
          <div style="font-weight:700">${r.iso}</div>
          <div style="color:var(--ar-text-muted);font-size:10px">${r.veh}</div>
          <div style="margin:5px 0;color:#f87171;font-weight:700">${c.comunaDireccion} → ${c.comunaReal}</div>
          <button style="background:var(--ar-blue);color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer" onclick="window.dispatchEvent(new CustomEvent('map-resolve', {detail:'${r.iso}'}))">Marcar como revisado</button>
        </div>`)
      }
      mk.on('click', () => { setFocusedIso(r.iso); setSelected(r.iso) })
      mk.addTo(map)
      markersRef.current.push(mk)
    })
  }, [routeData, conflicts, resolvedConflicts, hiddenVehs, vehColors, conflictSet, focusedIso])

  useEffect(() => {
    const cb = (e: any) => onToggleResolve(e.detail)
    window.addEventListener('map-resolve', cb); return () => window.removeEventListener('map-resolve', cb)
  }, [onToggleResolve])

  const visible = useMemo(() => conflicts.filter(c => {
    const res = resolvedConflicts.has(c.iso); const flg = flaggedConflicts.has(c.iso)
    const st = res ? 'revisado' : (flg ? 'alerta' : 'pendiente')
    if (statusFilter !== 'all' && st !== statusFilter) return false
    if (search) {
      const lo = search.toLowerCase()
      return c.iso.toLowerCase().includes(lo) || c.veh.toLowerCase().includes(lo) || c.comunaDireccion.toLowerCase().includes(lo)
    }
    return true
  }), [conflicts, resolvedConflicts, flaggedConflicts, statusFilter, search])

  if (!hasData) return <EmptyState icon="📍" message="Carga un plan primero" />
  if (!isReady) return <EmptyState icon="⚙️" message="Cargando datos..." />

  return (
    <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', height:'100%', overflow:'hidden' }}>
      <div style={{ borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column', background:'var(--ar-bg-sidebar)' }}>
        <div style={{ padding:'12px 14px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:10, background:'var(--ar-bg-header)' }}>
          <div style={{ flex:1 }}><span style={{ fontSize:20, fontWeight:900, color:C.red }}>{conflicts.length}</span> <span style={{ fontSize:10, fontWeight:800, color:C.text }}>Conflictos</span></div>
          <Btn variant="blue" size="xs" onClick={onRunAnalysis}>Analizar</Btn>
          <Btn variant="success" size="xs" onClick={() => onResolveAll(conflicts.map(c=>c.iso), [])}>Revisar todo</Btn>
        </div>
        <div style={{ padding:'8px 10px', display:'flex', flexDirection:'column', gap:8 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar ISO..." style={{ padding:'7px 12px', background:'var(--ar-bg-hover)', border:`1px solid ${C.border}`, color:C.text, borderRadius:R.md, outline:'none' }} />
          <FilterPills<StatusFilter> value={statusFilter} onChange={setStatusFilter} options={[{key:'all',label:'Todos'},{key:'pendiente',label:'Pendiente'},{key:'alerta',label:'Alerta'},{key:'revisado',label:'Revisado'}]} />
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {visible.map(c => {
            const isF = focusedIso === c.iso; const isRes = resolvedConflicts.has(c.iso)
            return (
              <div key={c.iso} onClick={() => setFocusedIso(c.iso === focusedIso ? null : c.iso)} style={{ padding:'10px 14px', borderBottom:`1px solid ${C.borderSoft}`, cursor:'pointer', background: isF ? 'rgba(56,139,253,0.1)' : 'transparent', borderLeft: `3px solid ${isF ? C.blue : 'transparent'}`, opacity: isRes ? 0.4 : 1 }}>
                <div style={{ fontWeight:700, fontSize:T.base, color:C.text }}>{c.iso}</div>
                <div style={{ fontSize:T.xs, color:C.textMuted }}>{c.veh}</div>
                <div style={{ display:'flex', gap:6, marginTop:4, fontSize:11, fontWeight:700 }}>
                  <span style={{ color:C.red }}>{c.comunaDireccion}</span> → <span style={{ color:C.blue }}>{c.comunaReal}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ position:'relative' }}>
        <div ref={mapDivRef} style={{ width:'100%', height:'100%' }} />
        <div style={{ position:'absolute', top:10, right:10, zIndex:1000, display:'flex', flexDirection:'column', gap:5 }}>
          <button onClick={() => setLightMap(!lightMap)} style={{ width:34, height:34, borderRadius:8, background:'rgba(22,27,34,.8)', color:'#fff', border:'1px solid rgba(255,255,255,.2)', cursor:'pointer' }}>{lightMap ? '🌙' : '☀️'}</button>
          {focusedIso && <button onClick={() => setFocusedIso(null)} style={{ width:34, height:34, borderRadius:8, background:C.orange, color:'#fff', border:'none', cursor:'pointer' }}>✕</button>}
        </div>
      </div>
    </div>
  )
}