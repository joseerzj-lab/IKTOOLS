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
  hasData:           boolean
  isReady:           boolean
  onRunAnalysis:     () => void
  isVisible?:        boolean
}

type StatusFilter = 'all' | 'pendiente' | 'alerta' | 'resuelto'

export default function TabWrongCommune({
  routeData, conflicts, resolvedConflicts, flaggedConflicts,
  onToggleResolve, onToggleFlag, hasData, isReady, onRunAnalysis,
  isVisible = true,
}: Props) {
  const mapDivRef    = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)
  const markersRef   = useRef<any[]>([])
  const polylinesRef = useRef<any[]>([])
  const tileRef      = useRef<any>(null)          // current tile layer
  const mapInitRef   = useRef(false)

  const [hiddenVehs,   setHiddenVehs]   = useState<Set<string>>(new Set())
  const [selected,     setSelected]     = useState<string | null>(null)
  const [focusedIso,   setFocusedIso]   = useState<string | null>(null)  // ISO in focus-zoom mode
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

  // ── Init map ───────────────────────────────────────────────
  function initMap() {
    if (!mapDivRef.current || mapInitRef.current) return
    const L = (window as any).L
    if (!L) return
    const rect = mapDivRef.current.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    mapInitRef.current = true
    const map = L.map(mapDivRef.current, {
      center: [-33.47, -70.65], zoom: 11,
      zoomControl: false,
    })
    mapRef.current = map

    const tile = L.tileLayer(TILE_DARK, {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd', maxZoom: 19,
    })
    tile.addTo(map)
    tileRef.current = tile

    // Commune polygons
    const comunasData: typeof RM_COMUNAS_DATA =
      (typeof RM_COMUNAS_DATA !== 'undefined' ? RM_COMUNAS_DATA : null) ??
      (window as any).RM_COMUNAS_DATA

    if (comunasData) {
      Object.keys(comunasData).forEach(key => {
        const cd = comunasData[key]
        if (!cd?.p?.length) return

        L.polygon(cd.p, {
          color:       '#5b8fd6',
          weight:      2.2,
          opacity:     1,
          fillColor:   '#1e3a6e',
          fillOpacity: 0.15,
          interactive: false,
        }).addTo(map)

        if (cd.c) {
          const name = (cd.n || key)
            .replace('Estación Central','Est. Central')
            .replace('Pedro Aguirre Cerda','P.A. Cerda')
            .replace('Calera de Tango','Cal. Tango')
            .replace('Padre Hurtado','P. Hurtado')

          L.marker([cd.c[0], cd.c[1]], {
            icon: L.divIcon({
              className: '',
              html: `<div style="
                font-size:8px;font-weight:800;
                color:rgba(160,205,255,0.9);
                white-space:nowrap;pointer-events:none;
                letter-spacing:0.04em;
                text-shadow:0 0 6px #000,0 0 12px #000,0 1px 3px #000;
              ">${name}</div>`,
              iconAnchor: [20, 6],
            }),
            interactive: false,
            zIndexOffset: -200,
          }).addTo(map)
        }
      })
    }
  }

  // ── Mount: retry until visible ─────────────────────────────
  useEffect(() => {
    let tries = 0
    const attempt = () => {
      tries++
      if (mapInitRef.current) return
      const L = (window as any).L
      const div = mapDivRef.current
      if (L && div) {
        const rect = div.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) { initMap(); return }
      }
      if (tries < 40) setTimeout(attempt, 100)
    }
    attempt()
    return () => {}
  }, [])

  // ── Tab visibility → invalidateSize ───────────────────────
  useEffect(() => {
    if (!isVisible) return
    const map = mapRef.current
    if (map) { setTimeout(() => map.invalidateSize(), 50); return }
    setTimeout(initMap, 60)
  }, [isVisible])

  // ── Swap tile layer when lightMap toggles ─────────────────
  useEffect(() => {
    const L   = (window as any).L
    const map = mapRef.current
    if (!L || !map) return
    if (tileRef.current) {
      map.removeLayer(tileRef.current)
    }
    const newTile = L.tileLayer(lightMap ? TILE_LIGHT : TILE_DARK, {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd', maxZoom: 19,
    })
    newTile.addTo(map)
    tileRef.current = newTile
  }, [lightMap])

  // ── Redraw markers + polylines ────────────────────────────
  useEffect(() => {
    const L   = (window as any).L
    const map = mapRef.current
    if (!L || !map) return

    markersRef.current.forEach(m => map.removeLayer(m))
    polylinesRef.current.forEach(p => map.removeLayer(p))
    markersRef.current   = []
    polylinesRef.current = []

    const activeData = routeData.filter(r =>
      r.lat !== null && r.lng !== null && !hiddenVehs.has(r.veh)
    )
    if (!activeData.length) return

    // Determine which ISOs belong to the focused conflict
    const focusedConf = focusedIso
      ? conflicts.find(c => c.iso === focusedIso)
      : null
    const focusedVeh = focusedConf?.veh ?? null

    // Polylines
    const vehPts: Record<string, [number, number][]> = {}
    for (const r of activeData) {
      if (!vehPts[r.veh]) vehPts[r.veh] = []
      vehPts[r.veh].push([r.lat!, r.lng!])
    }
    Object.entries(vehPts).forEach(([veh, pts]) => {
      if (pts.length < 2) return
      if (focusedVeh && veh !== focusedVeh) return // Solo renderiza la ruta enfocada
      
      const isFocusedVeh = focusedVeh ? veh === focusedVeh : true
      const line = L.polyline(pts, {
        color:   vehColors[veh] || '#4a9fd4',
        weight:  isFocusedVeh ? 3 : 2,
        opacity: focusedVeh ? (isFocusedVeh ? 0.85 : 0.12) : 0.6,
        lineJoin: 'round',
      }).addTo(map)
      polylinesRef.current.push(line)
    })

    // Markers
    activeData.forEach(r => {
      const isConflict    = conflictSet.has(r.iso)
      const isResolved    = resolvedConflicts.has(r.iso)
      const isFocusedStop = focusedIso ? r.iso === focusedIso : true
      const isFocusedVehStop = focusedVeh ? r.veh === focusedVeh : true

      if (focusedVeh && !isFocusedVehStop) return // Solo renderiza la ruta enfocada

      // Dim everything not related when focusing
      const dimmed = focusedVeh && !isFocusedVehStop

      const dotColor = isResolved ? '#444' : isConflict ? '#e04040' : (vehColors[r.veh] || '#4a9fd4')
      const border   = isResolved ? 'rgba(136,136,136,.4)' : isConflict ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.5)'
      const sz       = isConflict && isFocusedStop ? 20 : isConflict ? 18 : 12
      const glow     = isConflict && !isResolved && isFocusedStop
        ? 'box-shadow:0 0 14px 6px rgba(224,64,64,.7);'
        : isConflict && !isResolved
          ? 'box-shadow:0 0 10px 4px rgba(224,64,64,.55);' : ''
      const stopLabel = r.parada ? String(r.parada) : ''

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:${sz}px;height:${sz}px;border-radius:50%;
          background:${dotColor};
          border:${isConflict ? '2px' : '1.5px'} solid ${border};
          display:flex;align-items:center;justify-content:center;
          font-size:7px;font-weight:700;color:rgba(255,255,255,.9);
          font-family:monospace;cursor:${isConflict && !isResolved ? 'pointer' : 'default'};
          box-sizing:border-box;${glow}
          opacity:${dimmed ? 0.1 : 1};
          transition:opacity 0.25s;
        ">${stopLabel}</div>`,
        iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
      })

      const conf = conflicts.find(c => c.iso === r.iso)
      const mk   = L.marker([r.lat, r.lng], { icon, interactive: isConflict && !isResolved })

      if (isConflict && !isResolved && conf) {
        const safeId = r.iso.replace(/[^a-zA-Z0-9]/g, '_')
        const isRes  = resolvedConflicts.has(r.iso)
        const isFlg  = flaggedConflicts.has(r.iso)

        mk.bindPopup(`
          <div style="min-width:230px;font-family:system-ui,sans-serif;font-size:12px;
            background:rgb(22,27,34);color:#e6edf3;border-radius:10px;padding:12px 14px;
            border:1px solid rgba(255,255,255,.1);">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <span style="font-weight:700;font-size:13px;font-family:monospace">${r.iso}</span>
              <span style="font-size:10px;color:#6e7681;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.veh}</span>
            </div>
            <div style="font-size:10px;color:#8b949e;margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.dir}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
              <span style="font-size:10px;padding:2px 7px;border-radius:4px;
                background:rgba(248,81,73,.12);color:#ff7b72;border:1px solid rgba(248,81,73,.3);font-weight:700">
                ${conf.comunaDireccion}</span>
              <span style="color:#6e7681">→</span>
              <span style="font-size:10px;padding:2px 7px;border-radius:4px;
                background:rgba(56,139,253,.12);color:#7bb8ff;border:1px solid rgba(56,139,253,.3);font-weight:700">
                ${conf.comunaReal}</span>
            </div>
            <div style="display:flex;gap:6px;">
              <button id="btn-res-${safeId}" style="font-size:10px;padding:4px 10px;border-radius:6px;cursor:pointer;font-weight:700;
                background:rgba(63,185,80,.12);color:#3fb950;border:1px solid rgba(63,185,80,.3);">
                ${isRes ? '↩ Reabrir' : '✓ Resolver'}</button>
              <button id="btn-flg-${safeId}" style="font-size:10px;padding:4px 10px;border-radius:6px;cursor:pointer;font-weight:700;
                background:${isFlg ? 'rgba(248,81,73,.25)' : 'rgba(248,81,73,.08)'};color:#ff7b72;
                border:1px solid ${isFlg ? 'rgba(248,81,73,.55)' : 'rgba(248,81,73,.25)'};">
                ${isFlg ? '✕ Quitar' : '⚠ Alerta'}</button>
              <button onclick="navigator.clipboard.writeText('${r.iso.replace(/'/g,"\\'")}').catch(()=>{})"
                style="font-size:10px;padding:4px 10px;border-radius:6px;cursor:pointer;
                background:rgba(56,139,253,.1);color:#7bb8ff;border:1px solid rgba(56,139,253,.2);">📋</button>
            </div>
          </div>`, { maxWidth: 310, className: '' })

        mk.on('popupopen', () => {
          setTimeout(() => {
            const rb = document.getElementById(`btn-res-${safeId}`)
            const fb = document.getElementById(`btn-flg-${safeId}`)
            if (rb) rb.addEventListener('click', () => { mk.closePopup(); onToggleResolve(r.iso) })
            if (fb) fb.addEventListener('click', () => { mk.closePopup(); onToggleFlag(r.iso) })
          }, 60)
        })
      }

      mk.addTo(map)
      markersRef.current.push(mk)
    })
  }, [routeData, conflicts, resolvedConflicts, flaggedConflicts, hiddenVehs, vehColors, conflictSet, onToggleResolve, onToggleFlag, focusedIso])

  // ── Focus zoom: when focusedIso changes, fit the route ────
  useEffect(() => {
    const L   = (window as any).L
    const map = mapRef.current
    if (!L || !map || !focusedIso) return

    const focusedConf = conflicts.find(c => c.iso === focusedIso)
    if (!focusedConf) return

    // Gather all lat/lng for this conflict's ISO (by veh)
    const pts = routeData
      .filter(r => r.veh === focusedConf.veh && r.lat !== null && r.lng !== null)
      .map(r => [r.lat!, r.lng!] as [number, number])

    if (pts.length > 0) {
      const bounds = L.latLngBounds(pts)
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true })
    } else if (focusedConf.lat && focusedConf.lng) {
      map.setView([focusedConf.lat, focusedConf.lng], 15, { animate: true })
    }
  }, [focusedIso, routeData, conflicts])

  // ── Filtered conflict list ─────────────────────────────────
  const visibleConflicts = useMemo(() =>
    conflicts.filter(c => {
      const isRes = resolvedConflicts.has(c.iso)
      const isFlg = flaggedConflicts.has(c.iso)
      const status = isRes ? 'resuelto' : isFlg ? 'alerta' : 'pendiente'
      if (statusFilter !== 'all' && status !== statusFilter) return false
      if (search) {
        const lo = search.toLowerCase()
        return c.iso.toLowerCase().includes(lo) || c.veh.toLowerCase().includes(lo) ||
          c.comunaDireccion.toLowerCase().includes(lo) || c.comunaReal.toLowerCase().includes(lo)
      }
      return true
    }), [conflicts, resolvedConflicts, flaggedConflicts, statusFilter, search])

  // Early returns
  if (!hasData)    return <EmptyState icon="📍" message='Ve a "Cargar Plan" para cargar un archivo' />
  if (!hasGeoData) return <EmptyState icon="🗺"  message="El archivo no tiene columnas de coordenadas" />
  if (!isReady)    return <EmptyState icon="⚙️"  message="Cargando datos geográficos…" />

  const nPend = conflicts.filter(c => !resolvedConflicts.has(c.iso) && !flaggedConflicts.has(c.iso)).length
  const nFlag = conflicts.filter(c => flaggedConflicts.has(c.iso)).length
  const nRes  = conflicts.filter(c => resolvedConflicts.has(c.iso)).length

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '300px 1fr',
      height: '100%', overflow: 'hidden', background: C.bg,
    }}>

      {/* ── LEFT PANEL ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        borderRight: `1px solid ${C.border}`,
        overflow: 'hidden', background: C.bg,
      }}>
        {/* Header */}
        <div style={{
          padding: `${SP[2]}px ${SP[3]}px`,
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          background: 'rgba(22,27,34,.8)',
        }}>
          <span style={{ fontSize: T.md, fontWeight: 600, color: C.textSub, flex: 1 }}>
            Conflictos {nPend > 0 && <span style={{ color: C.orange }}>· {nPend} pend.</span>}
          </span>
          {conflicts.length > 0 && (
            <Badge variant="high">{nPend}</Badge>
          )}
          <Btn variant="blue" size="xs" onClick={onRunAnalysis}>
            {conflicts.length ? '↺ Re-analizar' : '▶ Analizar'}
          </Btn>
        </div>

        {/* Mini stats */}
        {conflicts.length > 0 && (
          <div style={{
            padding: `5px ${SP[3]}px`,
            borderBottom: `1px solid ${C.borderSoft}`,
            display: 'flex', gap: 12, fontSize: T.xs, flexShrink: 0,
            background: 'rgba(16,20,26,.6)',
          }}>
            <span style={{ color: C.red, fontWeight: 700 }}>⚠ {nFlag}</span>
            <span style={{ color: C.green, fontWeight: 700 }}>✓ {nRes}</span>
            <span style={{ color: C.blue, fontWeight: 700 }}>{conflicts.length} total</span>
          </div>
        )}

        {/* Vehicle toggles */}
        {vehs.length > 0 && (
          <div className="custom-scrollbar" style={{
            padding: `5px ${SP[2]}px`,
            borderBottom: `1px solid ${C.borderSoft}`,
            display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0,
            maxHeight: 120, overflowY: 'auto',
          }}>
            {vehs.map(v => {
              const hidden = hiddenVehs.has(v)
              const col = vehColors[v]
              return (
                <button key={v}
                  onClick={() => setHiddenVehs(p => { const n = new Set(p); n.has(v) ? n.delete(v) : n.add(v); return n })}
                  style={{
                    fontSize: T.xs, padding: '2px 7px', borderRadius: R.pill, cursor: 'pointer',
                    border: `1px solid ${hidden ? C.border : col + '55'}`,
                    background: hidden ? 'transparent' : col + '18',
                    color: hidden ? C.textFaint : col,
                    textDecoration: hidden ? 'line-through' : 'none',
                    opacity: hidden ? 0.5 : 1,
                  }}
                >{v}</button>
              )
            })}
          </div>
        )}

        {/* Search + filter */}
        {conflicts.length > 0 && (
          <div style={{
            padding: `8px ${SP[3]}px`,
            borderBottom: `1px solid ${C.borderSoft}`,
            display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
          }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Buscar ISO, vehículo, comuna…"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                borderTop: '1px solid rgba(255,255,255,0.2)',
                borderLeft: '1px solid rgba(255,255,255,0.1)',
                borderRight: '1px solid rgba(255,255,255,0.02)',
                borderBottom: '1px solid rgba(255,255,255,0.02)',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.2)',
                backdropFilter: 'blur(12px)',
                borderRadius: R.lg,
                padding: '8px 14px', fontSize: T.sm,
                color: '#fff', outline: 'none',
                width: '100%', fontFamily: T.fontFamily,
                transition: 'all 0.2s',
              }}
              onFocus={(e) => {
                e.target.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)'
                e.target.style.boxShadow = '0 0 12px rgba(255,255,255,0.1), inset 0 2px 6px rgba(0,0,0,0.1)'
              }}
              onBlur={(e) => {
                e.target.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)'
                e.target.style.boxShadow = 'inset 0 2px 6px rgba(0,0,0,0.2)'
              }}
            />
            <FilterPills<StatusFilter>
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { key: 'all',       label: 'Todos' },
                { key: 'pendiente', label: 'Pendiente' },
                { key: 'alerta',    label: '⚠ Alerta' },
                { key: 'resuelto',  label: '✓ Resuelto' },
              ]}
            />
          </div>
        )}

        {/* Conflict list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!conflicts.length ? (
            <div style={{ textAlign: 'center', color: C.textFaint, padding: '32px 16px', fontSize: T.base, lineHeight: 1.7 }}>
              Presiona <strong style={{ color: C.blue }}>▶ Analizar</strong><br/>para detectar conflictos de comuna
            </div>
          ) : visibleConflicts.length === 0 ? (
            <div style={{ textAlign: 'center', color: C.textFaint, padding: '24px', fontSize: T.base }}>Sin resultados</div>
          ) : visibleConflicts.map(c => {
            const isResolved = resolvedConflicts.has(c.iso)
            const isFlagged  = flaggedConflicts.has(c.iso)
            const isSelected = selected === c.iso
            const isFocused  = focusedIso === c.iso

            return (
              <div key={c._id}
                onClick={() => {
                  if (focusedIso === c.iso) {
                    setFocusedIso(null)
                    setSelected(null)
                  } else {
                    setFocusedIso(c.iso)
                    setSelected(c.iso)
                  }
                }}
                style={{
                  padding: `${SP[2]}px ${SP[3]}px`,
                  borderBottom: `1px solid ${C.borderSoft}`,
                  borderLeft: `3px solid ${isFocused ? C.orange : isSelected ? C.blue : 'transparent'}`,
                  opacity: isResolved ? 0.38 : 1,
                  cursor: 'pointer',
                  background: isFocused
                    ? 'rgba(251,146,60,.07)'
                    : isSelected
                      ? 'rgba(56,139,253,.06)'
                      : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: T.base, color: C.text, fontFamily: T.fontMono }}>{c.iso}</span>
                      {isFlagged  && <Badge variant="high">⚠</Badge>}
                      {isResolved && <Badge variant="low">✓</Badge>}
                    </div>
                    <div style={{ fontSize: T.xs, color: C.textFaint, marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.veh}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: T.xs, padding: '2px 7px', borderRadius: R.sm, background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, fontWeight: 700 }}>
                        {c.comunaDireccion}
                      </span>
                      <span style={{ fontSize: T.xs, color: C.textFaint }}>→</span>
                      <span style={{ fontSize: T.xs, padding: '2px 7px', borderRadius: R.sm, background: C.blueLight, color: C.blue, border: `1px solid ${C.blueBorder}`, fontWeight: 700 }}>
                        {c.comunaReal}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                    <Btn variant="success" size="xs"
                      onClick={e => { e.stopPropagation(); onToggleResolve(c.iso) }}
                    >{isResolved ? '↩' : '✓'}</Btn>
                    <Btn
                      variant={isFlagged ? 'danger' : 'ghost'} size="xs"
                      style={{ color: C.red, border: `1px solid ${isFlagged ? C.redBorder : C.border}` }}
                      onClick={e => { e.stopPropagation(); onToggleFlag(c.iso) }}
                    >{isFlagged ? '✕' : '⚠'}</Btn>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT: Leaflet map ──────────────────────────────── */}
      <div style={{ position: 'relative', overflow: 'hidden', height: '100%' }}>
        <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />

        {/* Map overlay controls */}
        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 1000,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {/* Light / Dark toggle */}
          <button
            onClick={() => setLightMap(v => !v)}
            title={lightMap ? 'Cambiar a mapa oscuro' : 'Cambiar a mapa claro'}
            style={{
              width: 34, height: 34, borderRadius: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700,
              background: lightMap ? 'rgba(255,255,255,.9)' : 'rgba(22,27,34,.85)',
              border: `1.5px solid ${lightMap ? '#c8d0db' : 'rgba(255,255,255,.15)'}`,
              color: lightMap ? '#374151' : '#e6edf3',
              boxShadow: '0 2px 8px rgba(0,0,0,.35)',
              backdropFilter: 'blur(4px)',
              transition: 'all 0.2s',
            }}
          >
            {lightMap ? '🌙' : '☀️'}
          </button>

          {/* Exit focus button (visible only when focusing) */}
          {focusedIso && (
            <button
              onClick={() => { setFocusedIso(null); setSelected(null) }}
              title="Ver todas las rutas"
              style={{
                width: 34, height: 34, borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14,
                background: 'rgba(251,146,60,.15)',
                border: '1.5px solid rgba(251,146,60,.45)',
                color: C.orange,
                boxShadow: '0 2px 8px rgba(0,0,0,.35)',
                backdropFilter: 'blur(4px)',
                transition: 'all 0.2s',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Focus mode banner */}
        {focusedIso && (
          <div style={{
            position: 'absolute', bottom: 12, left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'rgba(22,27,34,.9)',
            border: '1px solid rgba(251,146,60,.4)',
            borderRadius: 10,
            padding: '6px 14px',
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: T.xs, color: C.orange, fontWeight: 600,
            backdropFilter: 'blur(6px)',
            boxShadow: '0 4px 16px rgba(0,0,0,.4)',
            pointerEvents: 'none',
          }}>
            🔍 Enfocando <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{focusedIso}</span>
            &nbsp;— click en el pin o en ✕ para salir
          </div>
        )}
      </div>
    </div>
  )
}