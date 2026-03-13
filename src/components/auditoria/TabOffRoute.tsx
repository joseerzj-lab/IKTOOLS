import { useMemo, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { RiskResult, RouteRow } from '../../types/auditoria'
import { C, T, R, Btn, Badge } from '../../ui/DS'

interface Props {
  routeData:      RouteRow[]
  riskResults:    Record<string, RiskResult>
  resolvedRisk:   Set<string>
  flaggedRisk:    Set<string>
  onToggleResolve:(aKey: string) => void
  onToggleFlag:   (aKey: string) => void
  onResolveAll:   (isos: string[], aKeys: (string | null)[]) => void
  onOpenRouteMap: (veh: string) => void
  hasData:  boolean
  isReady:  boolean
}

// ── Liquid glass helpers ──────────────────────────────────────
function riskColor(rl: string) {
  if (rl === 'high')   return { bar: C.red,    bg: C.redBg,    border: C.redBorder,    glow: 'rgba(248,81,73,0.35)'   }
  if (rl === 'medium') return { bar: C.orange,  bg: C.orangeBg, border: C.orangeBorder, glow: 'rgba(240,136,62,0.28)'  }
  return                      { bar: C.green,   bg: C.greenBg,  border: C.greenBorder,  glow: 'rgba(63,185,80,0.2)'    }
}

// ── Per-ISO animated progress bar ────────────────────────────
function ISOBar({ pct, rl, delay = 0 }: { pct: number; rl: string; delay?: number }) {
  const rc = riskColor(rl)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <div style={{ width: 72, height: 4, borderRadius: 99, background: 'var(--ar-progress-bg)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.65, delay, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: 99, background: rc.bar, boxShadow: `0 0 8px ${rc.glow}` }}
        />
      </div>
      <span style={{ fontSize: 9, fontWeight: 800, color: rc.bar, fontFamily: T.fontMono, width: 28, textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  )
}

// ── ISO row — liquid glass, big, per-ISO bar & actions ────────
function ISORow({
  iso, dir, parada, pct, rl, isAlert,
  isResolved, isFlagged, onResolve, onFlag, index,
}: {
  iso: string; dir: string; parada: number
  pct: number; rl: string; isAlert: boolean
  isResolved: boolean; isFlagged: boolean
  onResolve: () => void; onFlag: () => void
  index: number
}) {
  const [copied, setCopied] = useState(false)
  const rc = riskColor(rl)

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, delay: index * 0.035, ease: [0.23, 1, 0.32, 1] }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 16px',
        margin: '0 10px 5px',
        borderRadius: R.lg,
        background: isFlagged
          ? 'rgba(248,81,73,0.07)'
          : 'var(--ar-bg-surface)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${isAlert ? rc.border : 'var(--ar-border)'}`,
        borderLeft: isAlert ? `3px solid ${rc.bar}` : `3px solid var(--ar-border-bar)`,
        boxShadow: isAlert
          ? `0 2px 14px ${rc.glow}, inset 0 1px 0 rgba(255,255,255,0.07)`
          : '0 1px 8px rgba(0,0,0,0.1)',
        opacity: isResolved ? 0.4 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {/* ISO chip — copy on click */}
      <button
        onClick={() => { navigator.clipboard.writeText(iso).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1200) }}
        style={{
          fontSize: T.sm, fontWeight: 800, padding: '4px 10px',
          borderRadius: R.md, cursor: 'pointer', fontFamily: T.fontMono, flexShrink: 0,
          background: copied ? C.greenBg : 'rgba(56,139,253,0.12)',
          color: copied ? C.green : C.blue,
          border: `1px solid ${copied ? C.greenBorder : 'rgba(56,139,253,0.28)'}`,
          transition: 'all 0.15s',
          boxShadow: copied ? `0 0 10px ${C.greenBg}` : 'none',
        }}
      >{copied ? '✓' : iso}</button>

      {/* Direction */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: T.md, color: C.textSub, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {dir || <span style={{ color: C.textFaint, fontStyle: 'italic' }}>Sin dirección</span>}
        </div>
        {parada > 0 && (
          <div style={{ fontSize: 9, color: C.textFaint, fontFamily: T.fontMono, marginTop: 2 }}>parada #{parada}</div>
        )}
      </div>

      {/* Per-ISO progress bar */}
      <ISOBar pct={pct} rl={rl} delay={index * 0.04} />

      {/* Status badge */}
      {isResolved && (
        <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: R.pill, background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}`, fontWeight: 700, flexShrink: 0 }}>
          ✓
        </span>
      )}
      {isFlagged && !isResolved && (
        <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: R.pill, background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, fontWeight: 700, flexShrink: 0 }}>
          ⚠
        </span>
      )}

      {/* Actions */}
      {isAlert && (
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <motion.button whileTap={{ scale: 0.9 }}
            onClick={onResolve}
            style={{
              fontSize: 10, padding: '4px 10px', borderRadius: R.md, cursor: 'pointer', fontWeight: 700,
              background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}`,
              backdropFilter: 'blur(8px)',
            }}
          >{isResolved ? '↩' : '✓ Revisar'}</motion.button>

          <motion.button whileTap={{ scale: 0.9 }}
            onClick={onFlag}
            style={{
              fontSize: 10, padding: '4px 10px', borderRadius: R.md, cursor: 'pointer', fontWeight: 800,
              background: isFlagged ? 'rgba(248,81,73,0.2)' : 'rgba(248,81,73,0.08)',
              color: C.red,
              border: `1px solid ${isFlagged ? C.redBorder : 'rgba(248,81,73,0.2)'}`,
              backdropFilter: 'blur(8px)',
            }}
          >{isFlagged ? '✕' : '⚠'}</motion.button>
        </div>
      )}
    </motion.div>
  )
}

// ── Commune accordion ─────────────────────────────────────────
function CommuneAccordion({
  veh, r, resolvedRisk, flaggedRisk,
  onToggleResolve, onToggleFlag, vIndex, cIndex,
}: {
  veh: string
  r: any
  resolvedRisk: Set<string>
  flaggedRisk: Set<string>
  onToggleResolve: (k: string) => void
  onToggleFlag: (k: string) => void
  vIndex: number
  cIndex: number
}) {
  const [open, setOpen] = useState(false)
  const communeKey = `${veh}|${r.key}`
  const pct  = Math.round(r.riskScore * 100)
  const rl   = r.riskLevel as string
  const isH  = rl === 'high'
  const isM  = rl === 'medium'
  const isAlert = isH || isM
  const rc   = riskColor(rl)
  const isos: RouteRow[] = r.isos ?? []

  const isCommuneResolved = resolvedRisk.has(communeKey)
  const isCommuneFlagged  = flaggedRisk.has(communeKey)

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: vIndex * 0.04 + cIndex * 0.025 }}
      style={{
        margin: '4px 10px',
        borderRadius: R.lg,
        background: 'var(--ar-bg-surface)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${isAlert ? rc.border : 'var(--ar-border)'}`,
        overflow: 'hidden',
        boxShadow: isAlert ? `0 2px 16px ${rc.glow}` : '0 1px 4px rgba(0,0,0,0.1)',
        opacity: isCommuneResolved ? 0.45 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Header */}
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

        {/* Colored strip */}
        <div style={{ width: 3, height: 16, borderRadius: 99, background: rc.bar, flexShrink: 0, boxShadow: `0 0 6px ${rc.bar}` }} />

        <span style={{ fontSize: T.md, fontWeight: 700, color: C.textSub, flex: 1 }}>{r.comuna}</span>

        {r.clusterLabel && (
          <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: R.pill, background: C.tealBg, color: C.teal, border: `1px solid ${C.tealBorder}`, fontWeight: 700 }}>
            ⬡ cluster
          </span>
        )}

        {/* Score bar inline in header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 52, height: 4, borderRadius: 99, background: 'var(--ar-progress-bg)', overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
              transition={{ duration: 0.65, delay: vIndex * 0.04 + cIndex * 0.03, ease: 'easeOut' }}
              style={{ height: '100%', borderRadius: 99, background: rc.bar, boxShadow: `0 0 6px ${rc.glow}` }}
            />
          </div>
          <span style={{ fontSize: 9, fontWeight: 800, color: rc.bar, fontFamily: T.fontMono, width: 26, textAlign: 'right' }}>{pct}%</span>
        </div>

        <span style={{
          fontSize: 9, padding: '2px 7px', borderRadius: R.pill, fontWeight: 700,
          background: isos.length === 1 ? C.redBg : 'rgba(255,255,255,0.07)',
          color: isos.length === 1 ? C.red : C.textFaint,
          border: `1px solid ${isos.length === 1 ? C.redBorder : 'rgba(255,255,255,0.08)'}`,
        }}>{isos.length} ISO{isos.length !== 1 ? 's' : ''}</span>

        {/* Commune-level actions */}
        {isAlert && (
          <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => onToggleResolve(communeKey)}
              style={{ fontSize: 9, padding: '3px 9px', borderRadius: R.pill, cursor: 'pointer', fontWeight: 700, background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}` }}
            >{isCommuneResolved ? '↩' : '✓ Todo Revisado'}</motion.button>
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => onToggleFlag(communeKey)}
              style={{ fontSize: 9, padding: '3px 9px', borderRadius: R.pill, cursor: 'pointer', fontWeight: 700,
                background: isCommuneFlagged ? 'rgba(248,81,73,0.2)' : 'rgba(248,81,73,0.08)',
                color: C.red, border: `1px solid ${isCommuneFlagged ? C.redBorder : 'rgba(248,81,73,0.2)'}` }}
            >{isCommuneFlagged ? '✕' : '⚠'}</motion.button>
          </div>
        )}
      </button>

      {/* ISO rows */}
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
            {/* Score detail header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 16px',
              background: 'var(--ar-bg-detail)',
              borderBottom: '1px solid var(--ar-border-soft)',
            }}>
              <span style={{ fontSize: 9, color: C.textFaint }}>
                {rl === 'high' ? '⚠ Alerta alta' : rl === 'medium' ? '· Moderado' : '✓ Normal'}
                {r.clusterLabel ? ' · cluster' : ''}
              </span>
              <span style={{ fontSize: 9, color: C.textFaint, marginLeft: 'auto' }}>
                {isos.length} dirección{isos.length !== 1 ? 'es' : ''}
              </span>
            </div>
            <div style={{ padding: '6px 0 8px' }}>
              {isos.map((isoRow: RouteRow, idx: number) => {
                const isoKey = `${communeKey}|${isoRow.iso}`
                const isIsoResolved = resolvedRisk.has(isoKey) || isCommuneResolved
                const isIsoFlagged  = flaggedRisk.has(isoKey)  || isCommuneFlagged
                return (
                  <ISORow
                    key={isoRow.iso + idx}
                    iso={isoRow.iso}
                    dir={isoRow.dir}
                    parada={isoRow.parada}
                    pct={pct}
                    rl={rl}
                    isAlert={isAlert}
                    isResolved={isIsoResolved}
                    isFlagged={isIsoFlagged}
                    onResolve={() => onToggleResolve(isoKey)}
                    onFlag={() => onToggleFlag(isoKey)}
                    index={idx}
                  />
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Vehicle section ───────────────────────────────────────────
function VehicleSection({
  veh, vdata, resolvedRisk, flaggedRisk,
  onToggleResolve, onToggleFlag, onOpenRouteMap, hasGeo, index,
}: {
  veh: string; vdata: RiskResult
  resolvedRisk: Set<string>; flaggedRisk: Set<string>
  onToggleResolve: (k: string) => void
  onToggleFlag: (k: string) => void
  onOpenRouteMap: (v: string) => void
  hasGeo: boolean; index: number
}) {
  const [open, setOpen] = useState(false)
  const hasAlert = vdata.results.some(r => r.riskLevel === 'high')
  const hasMed   = vdata.results.some(r => r.riskLevel === 'medium')
  const glowColor = hasAlert ? 'rgba(248,81,73,0.22)' : hasMed ? 'rgba(240,136,62,0.18)' : 'rgba(255,255,255,0.03)'
  const accentColor = hasAlert ? C.red : hasMed ? C.orange : C.green
  const totalISOs = vdata.results.reduce((s, r) => s + (r.isos?.length ?? 0), 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.06, ease: [0.23, 1, 0.32, 1] }}
      style={{
        borderRadius: 14,
        border: `1px solid ${hasAlert ? 'rgba(248,81,73,0.28)' : hasMed ? 'rgba(240,136,62,0.22)' : 'var(--ar-border)'}`,
        background: 'var(--ar-bg-surface)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        boxShadow: `0 4px 32px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.06)`,
        overflow: 'hidden',
      }}
    >
      {/* Vehicle header */}
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

        {/* Glow accent bar */}
        <div style={{
          width: 3, height: 22, borderRadius: 99, flexShrink: 0,
          background: accentColor, boxShadow: `0 0 10px ${accentColor}`,
        }} />

        <span style={{ fontSize: 17, flexShrink: 0 }}>🚛</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
          {veh}
        </span>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: R.pill, background: 'rgba(56,139,253,0.12)', color: C.blue, border: 'rgba(56,139,253,0.25)', fontWeight: 700 }}>
            {totalISOs} ISOs
          </span>
          {hasAlert
            ? <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: R.pill, background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, fontWeight: 700 }}>⚠ Alerta</span>
            : hasMed
              ? <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: R.pill, background: C.orangeBg, color: C.orange, border: `1px solid ${C.orangeBorder}`, fontWeight: 700 }}>· Moderado</span>
              : <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: R.pill, background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}`, fontWeight: 700 }}>✓ Normal</span>
          }
          {hasGeo && (hasAlert || hasMed) && (
            <button onClick={e => { e.stopPropagation(); onOpenRouteMap(veh) }}
              style={{ fontSize: 9, padding: '3px 9px', borderRadius: R.pill, cursor: 'pointer', fontWeight: 700, background: 'rgba(56,139,253,0.15)', color: C.blue, border: '1px solid rgba(56,139,253,0.3)' }}
            >🗺 Ver mapa</button>
          )}
        </div>
      </button>

      {/* Commune accordions */}
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
              {vdata.results.map((r, ci) => (
                <CommuneAccordion
                  key={r.key}
                  veh={veh}
                  r={r}
                  resolvedRisk={resolvedRisk}
                  flaggedRisk={flaggedRisk}
                  onToggleResolve={onToggleResolve}
                  onToggleFlag={onToggleFlag}
                  vIndex={index}
                  cIndex={ci}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Main ─────────────────────────────────────────────────────
export default function TabOffRoute({
  routeData, riskResults, resolvedRisk, flaggedRisk,
  onToggleResolve, onToggleFlag, onResolveAll, onOpenRouteMap, hasData, isReady,
}: Props) {
  const [search, setSearch] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const vehsWithGeo = useMemo(() => {
    const s = new Set<string>()
    for (const r of routeData) if (r.lat !== null && r.lng !== null) s.add(r.veh)
    return s
  }, [routeData])

  const sortedVehs = useMemo(() =>
    Object.entries(riskResults).sort((a, b) => b[1].maxRisk - a[1].maxRisk),
    [riskResults])

  const allResults = useMemo(() => sortedVehs.flatMap(([, v]) => v.results), [sortedVehs])
  const nHigh = allResults.filter(r => r.riskLevel === 'high').length
  const nMed  = allResults.filter(r => r.riskLevel === 'medium').length
  const nLow  = allResults.filter(r => r.riskLevel === 'low').length

  if (!hasData) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, background: C.bg }}>
      <motion.span initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring' }} style={{ fontSize: 52 }}>📊</motion.span>
      <span style={{ fontSize: 14, fontWeight: 600, color: C.textFaint }}>Ve a "Cargar Plan" para cargar un archivo</span>
    </div>
  )
  if (!isReady) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: C.bg }}>
      <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }} style={{ fontSize: 28 }}>⚙️</motion.span>
    </div>
  )
  if (!sortedVehs.length) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, background: C.bg }}>
      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }} style={{ fontSize: 52 }}>✅</motion.span>
      <span style={{ fontSize: 14, fontWeight: 600, color: C.textFaint }}>Sin alertas — todas las rutas son compactas</span>
    </div>
  )

  const lo = search.toLowerCase()

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.bg }}>

      {/* Stats */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20,
        padding: '8px 20px', borderBottom: '1px solid var(--ar-border)',
        flexShrink: 0, background: 'var(--ar-bg-header)', backdropFilter: 'blur(12px)',
      }}>
        {[
          { label: 'alertas', value: nHigh, color: C.red    },
          { label: 'moderadas', value: nMed,  color: C.orange },
          { label: 'normal',   value: nLow,  color: C.green  },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: T.fontMono, lineHeight: 1 }}>{s.value}</span>
            <span style={{ fontSize: 10, color: C.text, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</span>
          </motion.div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <Btn variant="success" size="sm" onClick={() => {
            const isos = sortedVehs.flatMap(([, v]) => v.results.flatMap(r => r.isos?.map(i => i.iso) ?? []))
            const aKeys = sortedVehs.flatMap(([, v]) => v.results.map(r => `${v.veh}|${r.key}`))
            onResolveAll(isos, aKeys)
          }}>Revisar todo</Btn>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar ISO o comuna…"
            style={{
              background: 'var(--ar-bg-hover)', border: '1px solid var(--ar-border)',
              borderRadius: R.lg, padding: '5px 12px', fontSize: T.base,
              color: C.text, fontWeight: 600, outline: 'none', width: 200, fontFamily: T.fontFamily,
            }}
          />
        </div>
      </div>

      {/* Scrollable list */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'scroll',
          overflowX: 'hidden',
          padding: '12px 14px 28px',
          minHeight: 0,
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.18) transparent',
        }}
      >
        {sortedVehs
          .filter(([veh, vdata]) => {
            if (!lo) return true
            return veh.toLowerCase().includes(lo) ||
              vdata.results.some(r =>
                r.comuna.toLowerCase().includes(lo) ||
                (r.isos ?? []).some((iso: RouteRow) => iso.iso.toLowerCase().includes(lo) || iso.dir.toLowerCase().includes(lo))
              )
          })
          .map(([veh, vdata], i) => (
            <div key={veh} style={{ marginBottom: 8 }}>
              <VehicleSection
                veh={veh}
                vdata={vdata}
                resolvedRisk={resolvedRisk}
                flaggedRisk={flaggedRisk}
                onToggleResolve={onToggleResolve}
                onToggleFlag={onToggleFlag}
                onOpenRouteMap={onOpenRouteMap}
                hasGeo={vehsWithGeo.has(veh)}
                index={i}
              />
            </div>
          ))}
      </div>
    </div>
  )
}