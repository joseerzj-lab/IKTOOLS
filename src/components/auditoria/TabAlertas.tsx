import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { RouteRow, RiskResult, ComunaConflict } from '../../types/auditoria'
import { C, T, R, SP, Badge, Btn, EmptyState, SearchInput, FilterPills } from '../../ui/DS'

// ── Helpers ──────────────────────────────────────────────────────────────────
const riskBg = (l: string) => {
  if (l === 'high') return { bar: C.red, bg: C.redBg, text: C.red }
  if (l === 'medium') return { bar: C.orange, bg: C.orangeBg, text: C.orange }
  return { bar: C.green, bg: C.greenBg, text: C.green }
}
interface Props {
  routeData: RouteRow[]
  riskResults: Record<string, RiskResult>
  conflicts: ComunaConflict[]

  // Risk states
  resolvedRisk: Set<string>
  flaggedRisk:  Set<string>

  // Conflict states
  resolvedConflicts: Set<string>
  flaggedConflicts:  Set<string>

  // Handlers
  onToggleResolveRisk:     (k: string) => void
  onToggleFlagRisk:        (k: string) => void
  onToggleResolveConflict: (iso: string) => void
  onToggleFlagConflict:    (iso: string) => void

  hasData: boolean
  isReady: boolean
  onRunGeoAnalysis: () => void
  onOpenRouteMap: (veh: string) => void
}

type StatusFilter = 'all' | 'pendiente' | 'alerta' | 'resuelto'

// A single row that represents an ISO that has EITHER:
//  - out of route (high/medium risk)
//  - wrong commune (conflict)
//  - or both
type UnifiedRow = {
  iso: string
  veh: string
  dir: string
  // from risk
  aKey: string | null
  riskLevel: 'high' | 'medium' | 'low' | null
  riskScore: number
  comuna: string
  // from conflict
  conflict: ComunaConflict | null
  // overall type
  tipo: 'fuera' | 'geo' | 'ambos'
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildUnifiedRows(
  riskResults: Record<string, RiskResult>,
  conflicts: ComunaConflict[]
): UnifiedRow[] {
  // Map ISO -> risk
  const riskByISO = new Map<string, any>()
  for (const [, vdata] of Object.entries(riskResults)) {
    for (const res of vdata.results) {
      if (!res.isos) continue
      for (const rx of res.isos as RouteRow[]) {
        riskByISO.set(rx.iso, {
          veh: rx.veh, dir: rx.dir,
          aKey: `${rx.veh}|${res.key}|${rx.iso}`,
          rl: res.riskLevel,
          score: res.riskScore,
          comuna: res.comuna,
        })
      }
    }
  }

  // Map ISO → conflict
  const conflictByISO = new Map<string, ComunaConflict>()
  for (const c of conflicts) conflictByISO.set(c.iso, c)

  // Merge all ISOs
  const allISOs = new Set<string>([...riskByISO.keys(), ...conflictByISO.keys()])
  const rows: UnifiedRow[] = []

  for (const iso of allISOs) {
    const rf = riskByISO.get(iso)
    const cf = conflictByISO.get(iso)
    
    // Un conflicto es "fuera de ruta" solo si el score es >= 50 (medium o high)
    const hasOutRoute = rf && (rf.rl === 'high' || rf.rl === 'medium')
    const hasWrongCommune = !!cf
    
    if (!hasOutRoute && !hasWrongCommune) continue

    const tipo: UnifiedRow['tipo'] = (hasOutRoute && hasWrongCommune) 
        ? 'ambos' 
        : hasOutRoute ? 'fuera' : 'geo'

    rows.push({
      iso,
      veh:       rf?.veh  ?? cf?.veh  ?? '',
      dir:       rf?.dir  ?? cf?.dir  ?? '',
      aKey:      rf?.aKey ?? null,
      riskLevel: rf?.rl   ?? null,
      riskScore: rf?.score ?? 0,
      comuna:    rf?.comuna ?? '',
      conflict:  cf ?? null,
      tipo,
    })
  }

  // Sort: ambos first, then by risk score desc
  const tipoOrder = { ambos: 0, fuera: 1, geo: 2 }
  rows.sort((a, b) => {
    const td = tipoOrder[a.tipo] - tipoOrder[b.tipo]
    if (td !== 0) return td
    return b.riskScore - a.riskScore
  })

  return rows
}

// ── TipoBadge ────────────────────────────────────────────────────────────────
function TipoBadge({ tipo }: { tipo: UnifiedRow['tipo'] }) {
  if (tipo === 'ambos') return (
    <span style={{
      fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: R.pill,
      background: 'rgba(14,165,233,0.15)', color: '#0ea5e9',
      border: `1px solid rgba(14,165,233,0.35)`, whiteSpace: 'nowrap',
    }}>Fuera de Ruta + Comuna Incorrecta</span>
  )
  if (tipo === 'fuera') return (
    <span style={{
      fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: R.pill,
      background: 'rgba(240,136,62,0.15)', color: C.orange,
      border: `1px solid rgba(240,136,62,0.3)`, whiteSpace: 'nowrap',
    }}>Fuera de Ruta</span>
  )
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: R.pill,
      background: 'rgba(248,81,73,0.12)', color: C.red,
      border: `1px solid rgba(248,81,73,0.28)`, whiteSpace: 'nowrap',
    }}>Comuna Incorrecta</span>
  )
}

function ISOChip({ iso, highlight }: { iso: string; highlight?: boolean }) {
  return (
    <span style={{
      fontFamily: T.fontMono, fontSize: T.xs, fontWeight: 700,
      background: highlight ? 'rgba(248,81,73,0.1)' : 'rgba(255,255,255,0.06)',
      color: highlight ? C.red : C.text,
      border: `1px solid ${highlight ? 'rgba(248,81,73,0.2)' : 'rgba(255,255,255,0.1)'}`,
      padding: '2px 6px', borderRadius: R.sm,
      boxShadow: highlight ? 'inset 0 0 0 1px rgba(248,81,73,0.1)' : 'none',
      flexShrink: 0,
    }}>
      {iso}
    </span>
  )
}

function ScoreBar({ pct, level, width = 50 }: { pct: number, level: 'high'|'medium', width?: number }) {
  const rc = riskBg(level)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
      {/* progress bg */}
      <div style={{ width, height: 4, borderRadius: 99, background: 'var(--ar-progress-bg)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6 }}
          style={{ height: '100%', borderRadius: 99, background: rc.bar, boxShadow: `0 0 6px ${rc.bg}` }}
        />
      </div>
      <span style={{ fontSize: 9, fontWeight: 800, color: rc.text, fontFamily: T.fontMono, width: 26, textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  )
}

// ── AlertRow ─────────────────────────────────────────────────────────────────
function AlertRow({
  row, index, resolvedRisk, flaggedRisk, resolvedConflicts, flaggedConflicts,
  onToggleResolveRisk, onToggleFlagRisk, onToggleResolveConflict, onToggleFlagConflict,
  onOpenRouteMap,
}: {
  row: UnifiedRow
  index: number
  resolvedRisk: Set<string>
  flaggedRisk:  Set<string>
  resolvedConflicts: Set<string>
  flaggedConflicts:  Set<string>
  onToggleResolveRisk:    (k: string) => void
  onToggleFlagRisk:       (k: string) => void
  onToggleResolveConflict:(iso: string) => void
  onToggleFlagConflict:   (iso: string) => void
  onOpenRouteMap:         (veh: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  // Compute statuses
  const riskResolved = row.aKey ? resolvedRisk.has(row.aKey) : false
  const riskFlagged  = row.aKey ? flaggedRisk.has(row.aKey)  : false
  const geoResolved  = resolvedConflicts.has(row.iso)
  const geoFlagged   = flaggedConflicts.has(row.iso)

  const fullyResolved = (row.tipo === 'ambos')
    ? riskResolved && geoResolved
    : row.tipo === 'fuera' ? riskResolved : geoResolved

  const anyFlagged = riskFlagged || geoFlagged

  const rl = row.riskLevel ?? 'low'
  const rc = riskBg(rl)
  const pct = Math.round(row.riskScore * 100)

  // border-left color: ambos=cyan, fuera=orange/red, geo=red
  const accentColor =
    row.tipo === 'ambos' ? '#0ea5e9' :
    row.tipo === 'fuera' ? (rl === 'high' ? C.red : C.orange) :
    C.red

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.025, ease: [0.23, 1, 0.32, 1] }}
      style={{
        borderRadius: R.lg,
        background: 'rgba(255,255,255,0.025)', // More transparent, glass effect
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        border: `1px solid ${anyFlagged ? 'rgba(248,81,73,0.3)' : 'rgba(255,255,255,0.08)'}`,
        borderLeft: `3px solid ${accentColor}`,
        boxShadow: anyFlagged
          ? '0 4px 24px rgba(248,81,73,0.15), inset 0 1px 0 rgba(255,255,255,0.06)'
          : '0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
        opacity: fullyResolved ? 0.38 : 1,
        overflow: 'hidden',
        transition: 'opacity 0.2s',
      }}
    >
      {/* Main row */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', textAlign: 'left', border: 'none',
          background: 'transparent', cursor: 'pointer',
          padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          transition: 'background 0.12s',
        }}
      >
        <motion.span
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.14 }}
          style={{ fontSize: 8, color: C.textFaint, flexShrink: 0, display: 'inline-block' }}
        >▶</motion.span>

        {/* ISO chip */}
        <div onClick={e => e.stopPropagation()}>
          <ISOChip iso={row.iso} highlight={anyFlagged} />
        </div>

        {/* Vehicle - REMOVED inside VehicleSection because redundant, keeping it empty so layout aligns but not showing text */}
        <span style={{ display: 'none' }} />

        {/* Dir */}
        <span style={{
          fontSize: T.base, color: C.textSub, flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {row.dir || <span style={{ color: C.textFaint, fontStyle: 'italic' }}>Sin dirección</span>}
        </span>

        {/* Score bar (only for off-route) */}
        {row.riskLevel && row.riskLevel !== 'low' && (
          <ScoreBar pct={pct} level={rl as any} width={52} />
        )}

        {/* Tipo badge */}
        <TipoBadge tipo={row.tipo} />

        {/* Status indicators */}
        {fullyResolved && <Badge variant="low">✓</Badge>}
        {anyFlagged && !fullyResolved && <Badge variant="high">⚠</Badge>}
      </button>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden', borderTop: `1px solid var(--ar-border-soft)` }}
          >
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 8,
              padding: '10px 16px 12px',
              background: 'rgba(0,0,0,0.25)', // Dark transparent
            }}>
              {/* Context Summary for the Alert */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                padding: '8px 12px', borderRadius: R.md,
                background: anyFlagged ? 'rgba(248,81,73,0.05)' : 'rgba(255,255,255,0.02)', 
              }}>

                {/* Info about the alert */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 4 }}>
                  {row.aKey && row.riskLevel !== 'low' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: T.sm, fontWeight: 700, color: rc.text }}>🛣️ Fuera de Ruta:</span>
                      <span style={{ fontSize: T.xs, color: C.textFaint }}>{row.comuna} · {pct}% riesgo</span>
                    </div>
                  )}
                  {row.conflict && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: T.sm, fontWeight: 700, color: C.red }}>📍 Comuna Incorrecta:</span>
                      <span style={{ fontSize: T.xs, padding: '2px 6px', borderRadius: R.sm, background: 'rgba(248,81,73,0.15)', color: C.red, border: `1px solid ${C.redBorder}`, fontWeight: 700 }}>{row.conflict.comunaDireccion}</span>
                      <span style={{ fontSize: T.xs, color: C.textFaint }}>→</span>
                      <span style={{ fontSize: T.xs, padding: '2px 6px', borderRadius: R.sm, background: 'rgba(56,139,253,0.12)', color: C.blue, border: `1px solid rgba(56,139,253,0.3)`, fontWeight: 700 }}>{row.conflict.comunaReal}</span>
                    </div>
                  )}
                </div>
                {/* Unified Action Buttons */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start' }}>
                  <Btn variant="blue" size="xs" onClick={() => onOpenRouteMap(row.veh)}>
                    🗺 Ver mapa
                  </Btn>
                  
                  <Btn variant="success" size="xs" onClick={() => {
                    if (row.aKey) onToggleResolveRisk(row.aKey)
                    if (row.iso) onToggleResolveConflict(row.iso)
                  }}>
                    {fullyResolved ? '↩' : '✓ Resolver'}
                  </Btn>
                  
                  <Btn variant={anyFlagged ? 'danger' : 'ghost'} size="xs"
                    style={{ color: C.red, border: `1px solid ${anyFlagged ? C.redBorder : C.border}` }}
                    onClick={() => {
                      if (row.aKey) onToggleFlagRisk(row.aKey)
                      if (row.iso) onToggleFlagConflict(row.iso)
                    }}
                  >
                    {anyFlagged ? '✕ Quitar Alerta' : '⚠ Alertar'}
                  </Btn>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Hierarchical Components ────────────────────────────────────────────────────

function CommuneAccordion({
  comuna, rows,
  resolvedRisk, flaggedRisk, resolvedConflicts, flaggedConflicts,
  onToggleResolveRisk, onToggleFlagRisk, onToggleResolveConflict, onToggleFlagConflict,
  onOpenRouteMap, vIndex, cIndex
}: {
  veh: string; comuna: string; rows: UnifiedRow[]
  resolvedRisk: Set<string>; flaggedRisk: Set<string>
  resolvedConflicts: Set<string>; flaggedConflicts: Set<string>
  onToggleResolveRisk: (k: string) => void; onToggleFlagRisk: (k: string) => void
  onToggleResolveConflict: (iso: string) => void; onToggleFlagConflict: (iso: string) => void
  onOpenRouteMap: (veh: string) => void
  vIndex: number; cIndex: number
}) {
  const [open, setOpen] = useState(false)
  
  const isCommuneResolved = rows.every(r => {
    const riskR = r.aKey ? resolvedRisk.has(r.aKey) : false
    const geoR  = resolvedConflicts.has(r.iso)
    if (r.tipo === 'ambos') return riskR && geoR
    return r.tipo === 'fuera' ? riskR : geoR
  })

  const isCommuneFlagged = rows.some(r => {
    const riskF = r.aKey ? flaggedRisk.has(r.aKey) : false
    const geoF  = flaggedConflicts.has(r.iso)
    return riskF || geoF
  })

  // Find max risk level for styling the commune header
  const maxRiskScore = Math.max(...rows.map(r => r.riskScore))
  const maxRiskLevel = rows.some(r => r.riskLevel === 'high') ? 'high' 
                     : rows.some(r => r.riskLevel === 'medium') ? 'medium' 
                     : 'low'

  const pct = Math.round(maxRiskScore * 100)
  const isAlert = maxRiskLevel === 'high' || maxRiskLevel === 'medium' || rows.some(r => !!r.conflict)
  const rc = riskBg(maxRiskLevel)
  const accentColor = isAlert ? (maxRiskLevel === 'high' ? C.red : C.orange) : C.green

  const handleResolveAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    rows.forEach(r => {
      if (r.aKey && !resolvedRisk.has(r.aKey)) onToggleResolveRisk(r.aKey)
      if (r.iso && !resolvedConflicts.has(r.iso)) onToggleResolveConflict(r.iso)
    })
  }

  const handleFlagAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    rows.forEach(r => {
      if (r.aKey && !flaggedRisk.has(r.aKey)) onToggleFlagRisk(r.aKey)
      if (r.iso && !flaggedConflicts.has(r.iso)) onToggleFlagConflict(r.iso)
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: vIndex * 0.04 + cIndex * 0.025 }}
      style={{
        margin: '4px 10px',
        borderRadius: R.lg,
        background: 'rgba(255,255,255,0.015)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${isAlert ? (maxRiskLevel === 'high' ? 'rgba(248,81,73,0.3)' : 'rgba(240,136,62,0.3)') : 'var(--ar-border)'}`,
        overflow: 'hidden',
        boxShadow: isAlert ? (maxRiskLevel === 'high' ? '0 2px 16px rgba(248,81,73,0.15)' : '0 2px 16px rgba(240,136,62,0.15)') : '0 1px 4px rgba(0,0,0,0.1)',
        opacity: isCommuneResolved ? 0.45 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
          background: 'transparent', padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 9,
          transition: 'background 0.12s',
        }}
      >
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }}
          style={{ fontSize: 9, color: C.textFaint, flexShrink: 0, display: 'inline-block' }}>▶</motion.span>

        <div style={{ width: 3, height: 16, borderRadius: 99, background: accentColor, flexShrink: 0, boxShadow: `0 0 6px ${accentColor}` }} />
        <span style={{ fontSize: T.md, fontWeight: 700, color: C.textSub, flex: 1 }}>{comuna || 'Sin Comuna'}</span>

        {maxRiskScore > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 52, height: 4, borderRadius: 99, background: 'var(--ar-progress-bg)', overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                transition={{ duration: 0.65, delay: vIndex * 0.04 + cIndex * 0.03, ease: 'easeOut' }}
                style={{ height: '100%', borderRadius: 99, background: rc.bar, boxShadow: `0 0 6px ${rc.bar}` }}
              />
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, color: rc.text, fontFamily: T.fontMono, width: 26, textAlign: 'right' }}>{pct}%</span>
          </div>
        )}

        <span style={{
          fontSize: 9, padding: '2px 7px', borderRadius: R.pill, fontWeight: 700,
          background: rows.length === 1 ? C.redBg : 'rgba(255,255,255,0.07)',
          color: rows.length === 1 ? C.red : C.textFaint,
          border: `1px solid ${rows.length === 1 ? C.redBorder : 'rgba(255,255,255,0.08)'}`,
        }}>{rows.length} Alerta{rows.length !== 1 ? 's' : ''}</span>

        {isAlert && (
          <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
            <motion.button whileTap={{ scale: 0.9 }} onClick={handleResolveAll}
              style={{ fontSize: 9, padding: '3px 9px', borderRadius: R.pill, cursor: 'pointer', fontWeight: 700, background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}` }}
            >{isCommuneResolved ? '↩' : '✓ Todas'}</motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={handleFlagAll}
              style={{ fontSize: 9, padding: '3px 9px', borderRadius: R.pill, cursor: 'pointer', fontWeight: 700, background: isCommuneFlagged ? 'rgba(248,81,73,0.2)' : 'rgba(248,81,73,0.08)', color: C.red, border: `1px solid ${isCommuneFlagged ? C.redBorder : 'rgba(248,81,73,0.2)'}` }}
            >{isCommuneFlagged ? '✕' : '⚠'}</motion.button>
          </div>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="isos"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden', borderTop: '1px solid var(--ar-border-bar)' }}
          >
            <div style={{ padding: '6px 0 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rows.map((row, i) => (
                <div key={row.iso} style={{ padding: '0 8px' }}>
                  <AlertRow
                    row={row} index={i}
                    resolvedRisk={resolvedRisk} flaggedRisk={flaggedRisk}
                    resolvedConflicts={resolvedConflicts} flaggedConflicts={flaggedConflicts}
                    onToggleResolveRisk={onToggleResolveRisk} onToggleFlagRisk={onToggleFlagRisk}
                    onToggleResolveConflict={onToggleResolveConflict} onToggleFlagConflict={onToggleFlagConflict}
                    onOpenRouteMap={onOpenRouteMap}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function VehicleSection({
  veh, rows,
  resolvedRisk, flaggedRisk, resolvedConflicts, flaggedConflicts,
  onToggleResolveRisk, onToggleFlagRisk, onToggleResolveConflict, onToggleFlagConflict,
  onOpenRouteMap, hasGeo, index,
}: {
  veh: string; rows: UnifiedRow[]
  resolvedRisk: Set<string>; flaggedRisk: Set<string>
  resolvedConflicts: Set<string>; flaggedConflicts: Set<string>
  onToggleResolveRisk: (k: string) => void; onToggleFlagRisk: (k: string) => void
  onToggleResolveConflict: (iso: string) => void; onToggleFlagConflict: (iso: string) => void
  onOpenRouteMap: (veh: string) => void
  hasGeo: boolean; index: number
}) {
  const [open, setOpen] = useState(false)
  
  const hasAlert = rows.some(r => r.riskLevel === 'high' || r.conflict)
  const hasMed   = rows.some(r => r.riskLevel === 'medium')
  const glowColor = hasAlert ? 'rgba(248,81,73,0.22)' : hasMed ? 'rgba(240,136,62,0.18)' : 'rgba(255,255,255,0.03)'
  const accentColor = hasAlert ? C.red : hasMed ? C.orange : C.green

  // Group rows by commune inside this vehicle
  const rowsByCommune = useMemo(() => {
    const map = new Map<string, UnifiedRow[]>()
    for (const r of rows) {
      const c = r.comuna || (r.conflict ? r.conflict.comunaDireccion : 'Desconocida')
      if (!map.has(c)) map.set(c, [])
      map.get(c)!.push(r)
    }
    return Array.from(map.entries()).sort((a,b) => b[1].length - a[1].length)
  }, [rows])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.06, ease: [0.23, 1, 0.32, 1] }}
      style={{
        borderRadius: 14,
        border: `1px solid ${hasAlert ? 'rgba(248,81,73,0.28)' : hasMed ? 'rgba(240,136,62,0.22)' : 'var(--ar-border)'}`,
        background: 'rgba(255,255,255,0.02)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        boxShadow: `0 4px 32px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.06)`,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
          background: open ? 'rgba(255,255,255,0.04)' : 'transparent',
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          transition: 'background 0.15s',
        }}
      >
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          style={{ fontSize: 10, color: C.textFaint, flexShrink: 0, display: 'inline-block' }}>▶</motion.span>

        <div style={{ width: 3, height: 22, borderRadius: 99, flexShrink: 0, background: accentColor, boxShadow: `0 0 10px ${accentColor}` }} />

        <span style={{ fontSize: 17, flexShrink: 0 }}>🚛</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
          {veh}
        </span>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: R.pill, background: 'rgba(56,139,253,0.12)', color: C.blue, border: 'rgba(56,139,253,0.25)', fontWeight: 700 }}>
            {rows.length} Alertas
          </span>
          {hasAlert
            ? <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: R.pill, background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, fontWeight: 700 }}>⚠ Crítico</span>
            : hasMed
              ? <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: R.pill, background: C.orangeBg, color: C.orange, border: `1px solid ${C.orangeBorder}`, fontWeight: 700 }}>· Moderado</span>
              : <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: R.pill, background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}`, fontWeight: 700 }}>✓ Menor</span>
          }
          {hasGeo && (hasAlert || hasMed) && (
            <button onClick={e => { e.stopPropagation(); onOpenRouteMap(veh) }}
              style={{ fontSize: 9, padding: '3px 9px', borderRadius: R.pill, cursor: 'pointer', fontWeight: 700, background: 'rgba(56,139,253,0.15)', color: C.blue, border: '1px solid rgba(56,139,253,0.3)' }}
            >🗺 Ver mapa</button>
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="communes"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden', borderTop: '1px solid var(--ar-border-bar)' }}
          >
            <div style={{ padding: '8px 0 10px' }}>
              {rowsByCommune.map(([comuna, communeRows], ci) => (
                <CommuneAccordion
                  key={comuna}
                  veh={veh}
                  comuna={comuna}
                  rows={communeRows}
                  resolvedRisk={resolvedRisk} flaggedRisk={flaggedRisk}
                  resolvedConflicts={resolvedConflicts} flaggedConflicts={flaggedConflicts}
                  onToggleResolveRisk={onToggleResolveRisk} onToggleFlagRisk={onToggleFlagRisk}
                  onToggleResolveConflict={onToggleResolveConflict} onToggleFlagConflict={onToggleFlagConflict}
                  onOpenRouteMap={onOpenRouteMap}
                  vIndex={index} cIndex={ci}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}


export default function TabAlertas({
  routeData, riskResults, conflicts,
  resolvedRisk, flaggedRisk, resolvedConflicts, flaggedConflicts,
  onToggleResolveRisk, onToggleFlagRisk, onToggleResolveConflict, onToggleFlagConflict,
  hasData, isReady, onRunGeoAnalysis, onOpenRouteMap,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search,       setSearch]       = useState('')

  const hasGeoData = routeData.some(r => r.lat !== null)

  // Build unified rows
  const allRows = useMemo(
    () => buildUnifiedRows(riskResults, conflicts),
    [riskResults, conflicts],
  )

  // Only include row if it is actually an alert (high/medium risk or CI)
  const alertRows = useMemo(() => allRows.filter(r => r.tipo === 'geo' || r.tipo === 'ambos' || (r.riskLevel === 'high' || r.riskLevel === 'medium')), [allRows])
    
  // Filter by status and search
  const visibleRows = useMemo(() => {
    const lo = search.toLowerCase()

    return alertRows.filter(row => {
      // Status filter
      if (statusFilter !== 'all') {
        const riskResolved = row.aKey ? resolvedRisk.has(row.aKey) : false
        const riskFlagged  = row.aKey ? flaggedRisk.has(row.aKey)  : false
        const geoResolved  = resolvedConflicts.has(row.iso)
        const geoFlagged   = flaggedConflicts.has(row.iso)
        
        // Unificar estados
        // Si tiene ambos, se considera resuelto solo si ambos lo están
        const isResolved = row.tipo === 'ambos' 
            ? (riskResolved && geoResolved) 
            : row.tipo === 'fuera' ? riskResolved : geoResolved
        
        const isFlagged = riskFlagged || geoFlagged
        const status = isResolved ? 'resuelto' : isFlagged ? 'alerta' : 'pendiente'
        
        if (status !== statusFilter) return false
      }

      // Search filter
      if (lo) {
        return (
          row.iso.toLowerCase().includes(lo) ||
          row.veh.toLowerCase().includes(lo) ||
          row.dir.toLowerCase().includes(lo) ||
          row.comuna.toLowerCase().includes(lo) ||
          (row.conflict?.comunaDireccion.toLowerCase().includes(lo) ?? false) ||
          (row.conflict?.comunaReal.toLowerCase().includes(lo) ?? false)
        )
      }

      return true
    })
  }, [alertRows, statusFilter, search, resolvedRisk, flaggedRisk, resolvedConflicts, flaggedConflicts])

  // Group visibleRows by vehicle
  const groupedVehicles = useMemo(() => {
    const map = new Map<string, UnifiedRow[]>()
    for (const r of visibleRows) {
      if (!map.has(r.veh)) map.set(r.veh, [])
      map.get(r.veh)!.push(r)
    }
    // Sort vehicles by max risk or alert type
    return Array.from(map.entries()).sort((a,b) => {
      const aMax = Math.max(...a[1].map(r => r.riskScore * (r.conflict ? 1.5 : 1)))
      const bMax = Math.max(...b[1].map(r => r.riskScore * (r.conflict ? 1.5 : 1)))
      return bMax - aMax
    })
  }, [visibleRows])

  // ── Early returns ──────────────────────────────────────────────────────────
  if (!hasData)    return <EmptyState icon="📊" message='Ve a "Cargar Plan" para cargar un archivo' />
  if (!isReady)    return <EmptyState icon="⚙️" message="Cargando datos geográficos…" />

  const needsGeoBtn = !hasGeoData
    ? null
    : conflicts.length === 0

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden', background: C.bg,
    }}>

      {/* ── Header stats bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        padding: `${SP[2]}px ${SP[4]}px`,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
        background: 'var(--ar-bg-header)',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 24, fontWeight: 900, lineHeight: 1, color: C.text, fontFamily: T.fontMono }}>
            {alertRows.length}
          </span>
          <span style={{ fontSize: T.sm, color: C.textFaint, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Alertas Totales
          </span>
        </div>

        {/* Geo analysis button */}
        {hasGeoData && (
          <Btn variant="blue" size="xs" onClick={onRunGeoAnalysis} style={{ marginLeft: 4 }}>
            {conflicts.length ? '↺ Re-analizar CI' : '▶ Analizar CI'}
          </Btn>
        )}

        {/* Search — pushed to right */}
        <div style={{ marginLeft: 'auto' }}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar ISO, veh, comuna…"
            width={200}
          />
        </div>
      </div>

      {/* ── Sub-filter toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: `7px ${SP[4]}px`,
        borderBottom: `1px solid ${C.borderSoft}`,
        flexShrink: 0,
        background: 'rgba(0,0,0,0.1)',
      }}>
        {/* Status filter */}
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

        {/* Results count */}
        <span style={{ marginLeft: 'auto', fontSize: T.xs, color: C.textFaint }}>
          {visibleRows.length} resultado{visibleRows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── List ── */}
      <div style={{
        flex: 1,
        overflowY: 'scroll',
        overflowX: 'hidden',
        padding: '12px 14px 28px',
        minHeight: 0,
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.18) transparent',
      }}>

        {/* No data for this view mode */}
        {allRows.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 14, flex: 1, color: C.textFaint,
          }}>
            <motion.span
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
              style={{ fontSize: 48 }}
            >✅</motion.span>
            <span style={{ fontSize: T.lg, fontWeight: 600 }}>
              Sin alertas detectadas
            </span>
            {needsGeoBtn && (
              <Btn variant="blue" size="sm" onClick={onRunGeoAnalysis}>
                ▶ Analizar Comunas Incorrectas
              </Btn>
            )}
          </div>
        )}

        {visibleRows.length === 0 && allRows.length > 0 && (
          <div style={{
            textAlign: 'center', color: C.textFaint,
            padding: '32px 16px', fontSize: T.base,
          }}>
            Sin resultados para este filtro
          </div>
        )}

        {/* Unified Hierarchical View */}
        {groupedVehicles.map(([veh, vehRows], i) => (
          <div key={veh} style={{ marginBottom: 8 }}>
            <VehicleSection
              veh={veh}
              rows={vehRows}
              resolvedRisk={resolvedRisk}
              flaggedRisk={flaggedRisk}
              resolvedConflicts={resolvedConflicts}
              flaggedConflicts={flaggedConflicts}
              onToggleResolveRisk={onToggleResolveRisk}
              onToggleFlagRisk={onToggleFlagRisk}
              onToggleResolveConflict={onToggleResolveConflict}
              onToggleFlagConflict={onToggleFlagConflict}
              onOpenRouteMap={onOpenRouteMap}
              hasGeo={hasGeoData}
              index={i}
            />
          </div>
        ))}

      </div>
    </div>
  )
}
