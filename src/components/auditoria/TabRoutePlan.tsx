import { useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { RouteRow, RiskResult } from '../../types/auditoria'
import { normK } from '../../lib/geoUtils'
import { C, T, R, Btn } from '../../ui/DS'

interface Props {
  routeData:     RouteRow[]
  riskResults:   Record<string, RiskResult>
  resolvedRisk:  Set<string>
  onResolveRisk: (aKey: string, resolve: boolean) => void
  onOpenRouteMap:(veh: string) => void
  excludedVehicles: Set<string>
  onToggleExclude: (veh: string) => void
}

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
  header: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
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

function riskColor(rl: string) {
  if (rl === 'high')   return { bar: C.red,    glow: 'rgba(248,81,73,0.3)',   border: C.redBorder    }
  if (rl === 'medium') return { bar: C.orange,  glow: 'rgba(240,136,62,0.25)', border: C.orangeBorder }
  return                      { bar: C.green,   glow: 'rgba(63,185,80,0.15)',  border: C.greenBorder  }
}

// ── Mini horizontal progress bar per ISO ─────────────────────
function ISOProgressBar({ pct, rl, width = 80 }: { pct: number; rl: string; width?: number }) {
  const rc = riskColor(rl)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        width, height: 4, borderRadius: 99,
        background: 'rgba(255,255,255,0.07)',
        overflow: 'hidden',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.05 }}
          style={{ height: '100%', borderRadius: 99, background: rc.bar, boxShadow: `0 0 6px ${rc.glow}` }}
        />
      </div>
      <span style={{ fontSize: 9, fontWeight: 800, color: rc.bar, fontFamily: T.fontMono, minWidth: 28, textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  )
}

// ── ISO card row — glass, big, readable ───────────────────────
function ISOCard({ iso, dir, parada, pct, rl, idx }: {
  iso: string; dir: string; parada: number
  pct: number; rl: string; idx: number
}) {
  const [copied, setCopied]   = useState(false)
  const [copied2, setCopied2] = useState(false)
  const rc = riskColor(rl)
  const isRisky = rl === 'high' || rl === 'medium'

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ x: 3, scale: 1.005, boxShadow: isRisky ? `0 4px 16px ${rc.glow}, inset 1px 1px 0 rgba(255,255,255,0.15)` : '0 4px 16px rgba(0,0,0,0.3), inset 1px 1px 0 rgba(255,255,255,0.06)' }}
      transition={{ duration: 0.25, delay: idx * 0.03, type: "spring", stiffness: 400, damping: 30 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px',
        margin: '0 8px 4px',
        borderRadius: R.lg,
        borderLeft: isRisky ? `2px solid ${rc.bar}` : `2px solid rgba(255,255,255,0.06)`,
        ...glass.row,
        boxShadow: isRisky
          ? `0 2px 12px ${rc.glow}, inset 1px 1px 0 rgba(255,255,255,0.06)`
          : '0 2px 8px rgba(0,0,0,0.25)',
      }}
    >
      {/* ISO chip (copy ISO) */}
      <button
        title="Copiar ISO"
        onClick={() => {
          navigator.clipboard.writeText(iso).catch(() => {})
          setCopied(true); setTimeout(() => setCopied(false), 1300)
        }}
        style={{
          fontSize: T.sm, fontWeight: 800, padding: '4px 10px',
          borderRadius: R.md, cursor: 'pointer', fontFamily: T.fontMono,
          background: copied ? C.greenBg : 'rgba(56,139,253,0.12)',
          color: copied ? C.green : C.blue,
          border: `1px solid ${copied ? C.greenBorder : 'rgba(56,139,253,0.3)'}`,
          transition: 'all 0.15s', flexShrink: 0,
          boxShadow: copied ? `0 0 8px ${C.greenBg}` : 'none',
        }}
      >{copied ? '✓ ISO' : iso}</button>

      {/* Copy ISO+dir button */}
      {dir && (
        <button
          title="Copiar ISO + Dirección"
          onClick={() => {
            navigator.clipboard.writeText(`${iso} — ${dir}`).catch(() => {})
            setCopied2(true); setTimeout(() => setCopied2(false), 1300)
          }}
          style={{
            fontSize: 9, fontWeight: 700, padding: '3px 7px',
            borderRadius: R.md, cursor: 'pointer',
            background: copied2 ? C.greenBg : 'var(--ar-bg-hover)',
            color: copied2 ? C.green : C.textFaint,
            border: `1px solid ${copied2 ? C.greenBorder : 'var(--ar-border)'}`,
            transition: 'all 0.15s', flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >{copied2 ? '✓' : '📋+dir'}</button>
      )}

      {/* Direction */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: T.md, color: C.textSub, fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{dir || <span style={{ color: C.textFaint, fontStyle: 'italic' }}>Sin dirección</span>}</div>
      </div>

      {/* Progress bar */}
      {isRisky && <ISOProgressBar pct={pct} rl={rl} width={70} />}

      {/* Stop number */}
      {parada > 0 && (
        <span style={{
          fontSize: 9, color: C.textDisabled, fontFamily: T.fontMono,
          background: 'rgba(255,255,255,0.05)', padding: '2px 6px',
          borderRadius: R.sm, border: `1px solid rgba(255,255,255,0.06)`,
          flexShrink: 0,
        }}>#{parada}</span>
      )}
    </motion.div>
  )
}

// ── Commune section ───────────────────────────────────────────
function CommuneSection({ comuna, isos, pct, rl, isApproved, onResolve, vindex, cindex }: {
  comuna: string; isos: RouteRow[]
  pct: number; rl: string
  isApproved: boolean
  onResolve: () => void
  vindex: number; cindex: number
}) {
  const [open, setOpen] = useState(false)
  const rc = riskColor(rl)
  const isRisky = rl === 'high' || rl === 'medium'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: vindex * 0.04 + cindex * 0.02 }}
      style={{ margin: '4px 8px', borderRadius: R.lg, overflow: 'hidden', ...glass.row }}
    >
      {/* Commune header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
          background: open ? 'rgba(255,255,255,0.04)' : 'transparent',
          padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          transition: 'background 0.12s',
        }}
      >
        {/* Chevron */}
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.15 }}
          style={{ fontSize: 9, color: C.textFaint, flexShrink: 0, display: 'inline-block' }}
        >▶</motion.span>

        {/* Risk strip */}
        {isRisky && (
          <div style={{ width: 3, height: 18, borderRadius: 99, background: rc.bar, flexShrink: 0, boxShadow: `0 0 6px ${rc.bar}` }} />
        )}

        {/* Name */}
        <span style={{ fontSize: T.md, fontWeight: 700, color: C.textSub, flex: 1 }}>{comuna}</span>

        {/* Bar */}
        {isRisky && <ISOProgressBar pct={pct} rl={rl} width={60} />}

        {/* ISO count badge */}
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: R.pill,
          background: isos.length === 1 ? C.orangeBg : 'rgba(255,255,255,0.07)',
          color: isos.length === 1 ? C.orange : C.textFaint,
          border: `1px solid ${isos.length === 1 ? C.orangeBorder : 'rgba(255,255,255,0.08)'}`,
        }}>{isos.length} ISO{isos.length !== 1 ? 's' : ''}</span>

        {/* Approve */}
        <div onClick={e => e.stopPropagation()}>
          {isApproved ? (
            <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: R.pill, background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}`, fontWeight: 700 }}>
              ✓ Resuelto
            </span>
          ) : isRisky ? (
            <button onClick={onResolve} style={{
              fontSize: 9, padding: '3px 9px', borderRadius: R.pill, cursor: 'pointer', fontWeight: 700,
              background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}`,
            }}>Resuelto</button>
          ) : null}
        </div>
      </button>

      {/* ISO list */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden', borderTop: `1px solid rgba(255,255,255,0.06)` }}
          >
            <div style={{ padding: '6px 0 8px' }}>
              {isos.map((iso, idx) => (
                <ISOCard
                  key={iso.iso + idx}
                  iso={iso.iso}
                  dir={iso.dir}
                  parada={iso.parada}
                  pct={pct}
                  rl={rl}
                  idx={idx}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Vehicle card ──────────────────────────────────────────────
function VehicleCard({ veh, comunas, riskResult, resolvedRisk, onResolveRisk, onOpenRouteMap, hasGeo, index, isExcluded, onToggleExclude, isExpanded, onToggleExpand }: {
  veh: string
  comunas: Record<string, RouteRow[]>
  riskResult: RiskResult | undefined
  resolvedRisk: Set<string>
  onResolveRisk: (aKey: string, resolve: boolean) => void
  onOpenRouteMap: (veh: string) => void
  hasGeo: boolean
  index: number
  isExcluded: boolean
  onToggleExclude: (veh: string) => void
  isExpanded: boolean
  onToggleExpand: () => void
}) {
  const totalIsos = Object.values(comunas).reduce((s, a) => s + a.length, 0)
  const soloUna   = Object.values(comunas).filter(a => a.length === 1).length
  const hasAlert  = riskResult?.results.some(r => r.riskLevel === 'high')  ?? false
  const hasMed    = riskResult?.results.some(r => r.riskLevel === 'medium') ?? false

  const glowColor = hasAlert ? 'rgba(248,81,73,0.15)' : hasMed ? 'rgba(240,136,62,0.12)' : 'rgba(0,0,0,0.3)'
  const accentColor = hasAlert ? C.red : hasMed ? C.orange : C.green

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.005, transition: { duration: 0.2, ease: "easeOut" } }}
      transition={{ duration: 0.35, delay: index * 0.05, type: "spring", stiffness: 350, damping: 25 }}
      style={{
        borderRadius: 16,
        borderTop: `1px solid ${hasAlert ? 'rgba(248,81,73,0.3)' : hasMed ? 'rgba(240,136,62,0.22)' : 'rgba(255,255,255,0.2)'}`,
        borderLeft: `1px solid ${hasAlert ? 'rgba(248,81,73,0.2)' : hasMed ? 'rgba(240,136,62,0.15)' : 'rgba(255,255,255,0.15)'}`,
        borderRight: '1px solid rgba(255,255,255,0.02)',
        borderBottom: '1px solid rgba(255,255,255,0.02)',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)',
        backdropFilter: 'blur(40px) saturate(120%)',
        WebkitBackdropFilter: 'blur(40px) saturate(120%)',
        boxShadow: `0 8px 32px ${glowColor}, inset 1px 1px 0 rgba(255,255,255,0.1)`,
        overflow: 'hidden',
        opacity: isExcluded ? 0.45 : 1,
        filter: isExcluded ? 'grayscale(0.6)' : 'none',
        transition: 'all 0.3s'
      }}
    >
      {/* Vehicle header button */}
      <button
        onClick={onToggleExpand}
        style={{
          width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
          background: isExpanded ? 'rgba(255,255,255,0.04)' : 'transparent',
          padding: '13px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          transition: 'background 0.15s',
        }}
      >
        {/* Chevron */}
        <motion.span
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          style={{ fontSize: 10, color: C.textFaint, flexShrink: 0, display: 'inline-block' }}
        >▶</motion.span>

        {/* Accent left bar */}
        <div style={{
          width: 3, height: 22, borderRadius: 99, flexShrink: 0,
          background: accentColor,
          boxShadow: `0 0 8px ${accentColor}`,
        }} />

        {/* Truck icon + name */}
        <span style={{ fontSize: 17, flexShrink: 0 }}>🚛</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
          {veh}
        </span>

        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: R.pill, background: 'rgba(56,139,253,0.12)', color: C.blue, border: `1px solid rgba(56,139,253,0.25)`, fontWeight: 700 }}>
            {totalIsos} ISOs
          </span>
          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: R.pill, background: 'rgba(255,255,255,0.06)', color: C.textFaint, border: `1px solid rgba(255,255,255,0.08)`, fontWeight: 700 }}>
            {Object.keys(comunas).length} com.
          </span>
          {soloUna > 0 && (
            <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: R.pill, background: C.orangeBg, color: C.orange, border: `1px solid ${C.orangeBorder}`, fontWeight: 700 }}>
              ! {soloUna}
            </span>
          )}
          {hasAlert && (
            <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: R.pill, background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, fontWeight: 700 }}>
              ⚠ Alerta
            </span>
          )}
          {!hasAlert && hasMed && (
            <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: R.pill, background: C.orangeBg, color: C.orange, border: `1px solid ${C.orangeBorder}`, fontWeight: 700 }}>
              · Moderado
            </span>
          )}
          {!hasAlert && !hasMed && (
            <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: R.pill, background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}`, fontWeight: 700 }}>
              ✓ Normal
            </span>
          )}
          {hasGeo && (hasAlert || hasMed) && (
            <button
              onClick={e => { e.stopPropagation(); onOpenRouteMap(veh) }}
              style={{
                fontSize: 9, padding: '3px 9px', borderRadius: R.pill, cursor: 'pointer', fontWeight: 700,
                background: 'rgba(56,139,253,0.15)', color: C.blue, border: `1px solid rgba(56,139,253,0.3)`,
              }}
            >🗺 Ver mapa</button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onToggleExclude(veh) }}
            style={{
              fontSize: 9, padding: '3px 9px', borderRadius: R.pill, cursor: 'pointer', fontWeight: 700,
              background: isExcluded ? 'rgba(255,255,255,0.15)' : 'rgba(248,81,73,0.1)',
              color: isExcluded ? '#fff' : C.red,
              border: `1px solid ${isExcluded ? 'rgba(255,255,255,0.2)' : 'rgba(248,81,73,0.2)'}`,
              transition: 'all 0.15s'
            }}
          >
            {isExcluded ? 'Incluir' : 'Excluir'}
          </button>
        </div>
      </button>

      {/* Communes */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="communes"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden', borderTop: `1px solid rgba(255,255,255,0.06)` }}
          >
            <div style={{ padding: '8px 0 10px' }}>
              {Object.entries(comunas)
                .sort((a, b) => b[1].length - a[1].length)
                .map(([comuna, isos], ci) => {
                  const aKey      = `${veh}|${normK(comuna)}`
                  const isApproved = resolvedRisk.has(aKey)
                  const re         = riskResult?.results.find(r => normK(r.comuna) === normK(comuna))
                  const pct        = re ? Math.round(re.riskScore * 100) : 0
                  const rl         = (re?.riskLevel ?? 'low') as string

                  return (
                    <CommuneSection
                      key={aKey}
                      comuna={comuna}
                      isos={isos}
                      pct={pct}
                      rl={rl}
                      isApproved={isApproved}
                      onResolve={() => onResolveRisk(aKey, true)}
                      vindex={index}
                      cindex={ci}
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

// ── Main component ────────────────────────────────────────────
export default function TabRoutePlan({ routeData, riskResults, resolvedRisk, onResolveRisk, onOpenRouteMap, excludedVehicles, onToggleExclude }: Props) {
  const [search, setSearch] = useState('')
  const [expandedVehicles, setExpandedVehicles] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ container: scrollRef })
  const scrollShadow  = useTransform(scrollYProgress, [0, 0.05], ['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)'])

  const toggleExpand = (veh: string) => {
    setExpandedVehicles(prev => {
      const next = new Set(prev)
      if (next.has(veh)) next.delete(veh); else next.add(veh)
      return next
    })
  }

  const expandAll = () => setExpandedVehicles(new Set(entries.map(e => e[0])))
  const collapseAll = () => setExpandedVehicles(new Set())

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

  const totalComunas  = useMemo(() => new Set(routeData.map(r => r.comuna)).size, [routeData])
  const soloUnaGlobal = useMemo(() =>
    Object.values(vehMap).flatMap(cs => Object.values(cs)).filter(a => a.length === 1).length, [vehMap])

  const entries = useMemo(() =>
    Object.entries(vehMap)
      .sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .filter(([v]) => !search || v.toLowerCase().includes(search.toLowerCase())),
    [vehMap, search])

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 100, // Reduced base estimate for better stability
    overscan: 10,
    measureElement: (el) => el.getBoundingClientRect().height,
  })

  if (!routeData.length) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, background: C.bg }}>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
        <span style={{ fontSize: 52 }}>📂</span>
      </motion.div>
      <span style={{ fontSize: 14, fontWeight: 600, color: C.textFaint }}>Ve a "Cargar Plan" para cargar un archivo</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: C.bg }}>

      {/* ── Stats bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20,
        padding: '8px 20px',
        borderBottom: '1px solid var(--ar-border)',
        flexShrink: 0,
        background: 'var(--ar-bg-header)',
        backdropFilter: 'blur(12px)',
      }}>
        {[
          { label: 'ISOs',      value: routeData.length,           color: C.blue   },
          { label: 'Vehículos', value: Object.keys(vehMap).length, color: '#a78bfa'},
          { label: 'Comunas',   value: totalComunas,               color: C.green  },
          { label: 'Solo 1 ISO',value: soloUnaGlobal, color: soloUnaGlobal ? C.orange : C.textFaint },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 19, fontWeight: 900, color: s.color, fontFamily: T.fontMono, lineHeight: 1 }}>{s.value}</span>
            <span style={{ fontSize: 9, color: C.textFaint, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</span>
          </motion.div>
        ))}

        <div style={{ display: 'flex', gap: 6 }}>
           <Btn variant="secondary" size="xs" onClick={expandAll}>Expandir Todo</Btn>
           <Btn variant="secondary" size="xs" onClick={collapseAll}>Colapsar Todo</Btn>
        </div>

        {/* Search */}
        <div style={{ marginLeft: 'auto' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar vehículo…"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
              borderTop: '1px solid rgba(255,255,255,0.2)',
              borderLeft: '1px solid rgba(255,255,255,0.1)',
              borderRight: '1px solid rgba(255,255,255,0.02)',
              borderBottom: '1px solid rgba(255,255,255,0.02)',
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.2)',
              backdropFilter: 'blur(12px)',
              borderRadius: R.lg,
              padding: '6px 14px', fontSize: T.base,
              color: '#fff', outline: 'none',
              width: 190, fontFamily: T.fontFamily,
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
        </div>
      </div>

      {/* ── Scroll shadow indicator ── */}
      <motion.div style={{
        height: 1, background: scrollShadow, flexShrink: 0,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }} />

      {/* ── Scrollable list ── */}
      <div
        ref={scrollRef}
        className="custom-scrollbar"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'scroll',
          overflowX: 'hidden',
          padding: '12px 14px 24px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.18) transparent',
        }}
      >
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const [veh, comunas] = entries[virtualRow.index]
            return (
                <div 
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{ 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: 16 // More spacing
                  }}
                >
                  <VehicleCard
                    veh={veh}
                    comunas={comunas}
                    riskResult={riskResults[veh]}
                    resolvedRisk={resolvedRisk}
                    onResolveRisk={onResolveRisk}
                    onOpenRouteMap={onOpenRouteMap}
                    hasGeo={routeData.some(r => r.veh === veh && r.lat !== null)}
                    index={virtualRow.index}
                    isExcluded={excludedVehicles.has(veh)}
                    onToggleExclude={onToggleExclude}
                    isExpanded={expandedVehicles.has(veh)}
                    onToggleExpand={() => toggleExpand(veh)}
                  />
                </div>
            )
          })}
        </div>
        {entries.length === 0 && search && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ textAlign: 'center', color: C.textFaint, padding: '40px 0', fontSize: T.md }}>
            Sin vehículos para "{search}"
          </motion.div>
        )}
      </div>
    </div>
  )
}