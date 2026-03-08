import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { ComunaConflict, RouteRow } from '../../types/auditoria'

const ROUTE_COLORS = ['#4a9fd4','#a78bfa','#34d399','#fb923c','#f472b6','#60a5fa',
  '#fbbf24','#4ade80','#f87171','#818cf8','#22d3ee','#e879f9','#a3e635','#fb7185','#38bdf8']

interface Props {
  routeData: RouteRow[]
  conflicts: ComunaConflict[]
  resolvedConflicts: Set<string>
  flaggedConflicts: Set<string>
  onToggleResolve: (iso: string) => void
  onToggleFlag: (iso: string) => void
  hasData: boolean
  isReady: boolean
  onRunAnalysis: () => void
}

function MapReady({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize({ animate: false })
      if (!points.length) return
      const lats = points.map(p => p[0]), lngs = points.map(p => p[1])
      map.fitBounds([
        [Math.min(...lats) - 0.02, Math.min(...lngs) - 0.02],
        [Math.max(...lats) + 0.02, Math.max(...lngs) + 0.02],
      ], { padding: [30, 30] })
    }, 120)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length])
  return null
}

function makeDotIcon(color: string, border: string, size: number, label: string, glow = false) {
  const glowStyle = glow ? `box-shadow:0 0 8px 3px ${color}55;` : ''
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};
            border:1.5px solid ${border};display:flex;align-items:center;justify-content:center;
            font-size:${size > 15 ? 8 : 7}px;font-weight:700;color:rgba(255,255,255,.95);
            font-family:monospace;cursor:pointer;box-sizing:border-box;${glowStyle}">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

// ── Left panel: conflict list + vehicle toggles ───────────────
function LeftPanel({
  conflicts, resolvedConflicts, flaggedConflicts,
  vehs, vehColors, hiddenVehs, setHiddenVehs,
  onToggleResolve, onToggleFlag, onRunAnalysis,
}: {
  conflicts: ComunaConflict[]
  resolvedConflicts: Set<string>
  flaggedConflicts: Set<string>
  vehs: string[]
  vehColors: Record<string, string>
  hiddenVehs: Set<string>
  setHiddenVehs: (fn: (prev: Set<string>) => Set<string>) => void
  onToggleResolve: (iso: string) => void
  onToggleFlag: (iso: string) => void
  onRunAnalysis: () => void
}) {
  return (
    // Fixed 288px width, full height, flex column, no absolute positioning
    <div
      style={{
        width: 288,
        minWidth: 288,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        background: 'rgb(13,17,23)',
        overflow: 'hidden',
        // Critical: own stacking context so Leaflet z-indexes don't bleed in
        isolation: 'isolate',
        position: 'relative',
        zIndex: 2,
      }}
    >
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#c9d1d9', flex: 1 }}>Conflictos Geo</span>
        <span style={{
          fontSize: 10, padding: '1px 8px', borderRadius: 20, fontWeight: 700,
          background: 'rgba(248,81,73,.15)', color: '#ff7b72',
        }}>
          {conflicts.filter(c => !resolvedConflicts.has(c.iso)).length}
        </span>
        <button
          onClick={onRunAnalysis}
          style={{
            fontSize: 10, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
            background: 'rgba(56,139,253,.15)', color: '#7bb8ff',
            border: '1px solid rgba(56,139,253,.25)',
          }}
        >Analizar</button>
      </div>

      {/* Vehicle toggles */}
      {vehs.length > 0 && (
        <div style={{
          padding: '6px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0,
        }}>
          {vehs.map(v => (
            <button
              key={v}
              onClick={() => setHiddenVehs(prev => {
                const n = new Set(prev)
                n.has(v) ? n.delete(v) : n.add(v)
                return n
              })}
              style={{
                fontSize: 9, padding: '2px 6px', borderRadius: 20,
                border: `1px solid ${hiddenVehs.has(v) ? 'rgba(255,255,255,0.08)' : `${vehColors[v]}55`}`,
                background: hiddenVehs.has(v) ? 'transparent' : `${vehColors[v]}18`,
                color: hiddenVehs.has(v) ? '#445' : vehColors[v],
                cursor: 'pointer',
              }}
            >{v.replace('VEH-', '')}</button>
          ))}
        </div>
      )}

      {/* Conflict list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!conflicts.length ? (
          <div style={{ textAlign: 'center', color: '#6e7681', padding: '32px 16px', fontSize: 11 }}>
            Presiona "Analizar" para detectar conflictos de comuna
          </div>
        ) : (
          conflicts.map(c => {
            const isResolved = resolvedConflicts.has(c.iso)
            const isFlagged  = flaggedConflicts.has(c.iso)
            return (
              <div
                key={c._id}
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  opacity: isResolved ? 0.4 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 11, color: '#e6edf3' }}>{c.iso}</div>
                    <div style={{ fontSize: 10, color: '#6e7681', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.veh}</div>
                    <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'rgba(248,81,73,.1)', color: '#ff7b72', border: '1px solid rgba(248,81,73,.25)' }}>
                        {c.comunaDireccion}
                      </span>
                      <span style={{ fontSize: 9, color: '#6e7681' }}>→</span>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'rgba(56,139,253,.12)', color: '#7bb8ff', border: '1px solid rgba(56,139,253,.25)' }}>
                        {c.comunaReal}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => onToggleResolve(c.iso)}
                      style={{ fontSize: 9, padding: '4px 6px', borderRadius: 4, cursor: 'pointer', background: 'rgba(63,185,80,.1)', color: '#3fb950', border: '1px solid rgba(63,185,80,.2)' }}
                    >{isResolved ? '↩' : '✓'}</button>
                    <button
                      onClick={() => onToggleFlag(c.iso)}
                      style={{
                        fontSize: 9, padding: '4px 6px', borderRadius: 4, cursor: 'pointer',
                        background: isFlagged ? 'rgba(248,81,73,.25)' : 'rgba(248,81,73,.08)',
                        color: '#ff7b72',
                        border: `1px solid ${isFlagged ? 'rgba(248,81,73,.55)' : 'rgba(248,81,73,.22)'}`,
                      }}
                    >{isFlagged ? '✕' : '⚠'}</button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export default function TabWrongCommune({
  routeData, conflicts, resolvedConflicts, flaggedConflicts,
  onToggleResolve, onToggleFlag, hasData, isReady, onRunAnalysis
}: Props) {
  const [hiddenVehs, setHiddenVehs] = useState<Set<string>>(new Set())

  const conflictSet = useMemo(() => new Set(conflicts.map(c => c.iso)), [conflicts])

  const vehs = useMemo(() => [...new Set(routeData.map(r => r.veh))].sort(), [routeData])

  const vehColors = useMemo(() => {
    const m: Record<string, string> = {}
    vehs.forEach((v, i) => { m[v] = ROUTE_COLORS[i % ROUTE_COLORS.length] })
    return m
  }, [vehs])

  const activeData = useMemo(() =>
    routeData.filter(r => r.lat !== null && r.lng !== null && !hiddenVehs.has(r.veh)),
    [routeData, hiddenVehs]
  )

  const polylines = useMemo(() => {
    const m: Record<string, [number, number][]> = {}
    for (const r of activeData) {
      if (!m[r.veh]) m[r.veh] = []
      m[r.veh].push([r.lat!, r.lng!])
    }
    return m
  }, [activeData])

  const allPoints: [number, number][] = useMemo(() =>
    activeData.map(r => [r.lat!, r.lng!]),
    [activeData]
  )

  const hasGeoData = routeData.some(r => r.lat !== null)

  if (!hasData) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: '#6e7681' }}>
      <div style={{ fontSize: 40 }}>📍</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>Carga un archivo con coordenadas</div>
    </div>
  )

  if (!hasGeoData) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: '#6e7681' }}>
      <div style={{ fontSize: 40 }}>🗺</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>El archivo no tiene columnas de coordenadas</div>
    </div>
  )

  if (!isReady) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: '#6e7681' }}>
      <div style={{ fontSize: 24 }}>⚙️</div>
      <div style={{ fontSize: 13 }}>Cargando datos geográficos…</div>
    </div>
  )

  return (
    // Two-column layout: left panel (fixed px) + right map (fills rest)
    // Using CSS grid so columns are truly independent — no overlap possible
    <div style={{
      display: 'grid',
      gridTemplateColumns: '288px 1fr',
      height: '100%',
      overflow: 'hidden',
      background: 'rgb(13,17,23)',
    }}>

      {/* LEFT: dashboard panel */}
      <LeftPanel
        conflicts={conflicts}
        resolvedConflicts={resolvedConflicts}
        flaggedConflicts={flaggedConflicts}
        vehs={vehs}
        vehColors={vehColors}
        hiddenVehs={hiddenVehs}
        setHiddenVehs={setHiddenVehs}
        onToggleResolve={onToggleResolve}
        onToggleFlag={onToggleFlag}
        onRunAnalysis={onRunAnalysis}
      />

      {/* RIGHT: map — sits in its own grid cell, can never overflow into left */}
      <div style={{ position: 'relative', overflow: 'hidden', height: '100%' }}>
        <MapContainer
          center={[-33.47, -70.65]}
          zoom={11}
          style={{ width: '100%', height: '100%', background: '#0d1117' }}
          zoomControl
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap &copy; CARTO'
            subdomains="abcd"
            maxZoom={19}
          />
          <MapReady points={allPoints} />

          {Object.entries(polylines).map(([veh, pts]) =>
            pts.length >= 2 ? (
              <Polyline
                key={veh}
                positions={pts}
                pathOptions={{ color: vehColors[veh] || '#4a9fd4', weight: 2.5, opacity: 0.72 }}
              />
            ) : null
          )}

          {activeData.map((r, i) => {
            const isConflict = conflictSet.has(r.iso)
            const isResolved = resolvedConflicts.has(r.iso)
            const dotColor   = isResolved ? '#555' : isConflict ? '#e04040' : (vehColors[r.veh] || '#4a9fd4')
            const border     = isResolved ? 'rgba(136,136,136,.6)' : isConflict ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.7)'
            const sz         = isConflict ? 18 : 14
            const icon       = makeDotIcon(dotColor, border, sz, r.parada ? String(r.parada) : '', isConflict && !isResolved)
            const conf       = conflicts.find(c => c.iso === r.iso)

            return (
              <Marker key={`${r.iso}-${i}`} position={[r.lat!, r.lng!]} icon={icon}>
                <Popup>
                  <div style={{ minWidth: 190, fontFamily: 'system-ui', fontSize: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, color: '#e6edf3' }}>{r.iso}</div>
                    <div style={{ color: '#8b949e', fontSize: 11, marginBottom: 2 }}>{r.veh}</div>
                    <div style={{ color: '#aaa', fontSize: 11 }}>{r.dir}</div>
                    {conf && (
                      <div style={{ marginTop: 8, padding: '5px 8px', background: 'rgba(248,81,73,.1)', borderRadius: 4, fontSize: 11, color: '#ff7b72', border: '1px solid rgba(248,81,73,.3)' }}>
                        ⚠ Dice <strong>{conf.comunaDireccion}</strong> → <strong>{conf.comunaReal}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button
                        onClick={() => navigator.clipboard.writeText(r.iso)}
                        style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'rgba(56,139,253,.15)', color: '#7bb8ff', border: '1px solid rgba(56,139,253,.25)', cursor: 'pointer' }}
                      >Copiar ISO</button>
                      {conf && (
                        <button
                          onClick={() => onToggleResolve(r.iso)}
                          style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'rgba(63,185,80,.1)', color: '#3fb950', border: '1px solid rgba(63,185,80,.25)', cursor: 'pointer' }}
                        >{resolvedConflicts.has(r.iso) ? '↩ Reabrir' : '✓ Resolver'}</button>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}