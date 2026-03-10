// ─────────────────────────────────────────────────────────────
//  DS.tsx — Design System React Components
//  Componentes base reutilizables en toda la app.
//  Importar: import { Btn, Badge, Accordion, Card, ScoreBar } from '../ui/DS'
// ─────────────────────────────────────────────────────────────
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { C, T, R, SP, BTN, BTN_SIZE, cardStyle, pillStyle, inputStyle, accordionBtnStyle, RISK } from './design-system'
import type { RiskLevel } from './design-system'

// ── Re-export tokens so consumers only need one import ────────
export { C, T, R, SP, BTN, BTN_SIZE, RISK, pillStyle, cardStyle, inputStyle, accordionBtnStyle }
export type { RiskLevel }

// ─────────────────────────────────────────────────────────────
//  Btn — Button
// ─────────────────────────────────────────────────────────────
type BtnVariant = keyof typeof BTN
type BtnSize    = keyof typeof BTN_SIZE

interface BtnProps {
  children: React.ReactNode
  variant?:  BtnVariant
  size?:     BtnSize
  disabled?: boolean
  onClick?:  (e: React.MouseEvent) => void
  title?:    string
  style?:    React.CSSProperties
  type?:     'button' | 'submit' | 'reset'
}

export function Btn({ children, variant = 'secondary', size = 'md', disabled, onClick, title, style, type = 'button' }: BtnProps) {
  const [active, setActive] = useState(false)
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      title={title}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      onMouseLeave={() => setActive(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        fontFamily: T.fontFamily, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'filter 0.12s, transform 0.08s',
        transform: active && !disabled ? 'scale(0.95)' : 'scale(1)',
        filter: !active && !disabled ? undefined : undefined,
        whiteSpace: 'nowrap',
        ...BTN[variant],
        ...BTN_SIZE[size],
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
//  Badge — status pill / tag
// ─────────────────────────────────────────────────────────────
type BadgeVariant = 'high' | 'medium' | 'low' | 'blue' | 'purple' | 'teal' | 'muted'

export function Badge({ children, variant = 'muted', style }: {
  children: React.ReactNode
  variant?: BadgeVariant
  style?: React.CSSProperties
}) {
  return <span style={pillStyle(variant, style)}>{children}</span>
}

// ─────────────────────────────────────────────────────────────
//  ScoreBar — risk percentage bar
// ─────────────────────────────────────────────────────────────
export function ScoreBar({ pct, level, width = 60 }: { pct: number; level: RiskLevel; width?: number }) {
  const color = RISK[level].color
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <div style={{ width, height: 5, borderRadius: R.full, background: 'rgba(255,255,255,0.08)' }}>
        <div style={{ height: '100%', borderRadius: R.full, width: `${pct}%`, background: color, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: T.sm, fontWeight: 700, fontFamily: T.fontMono, width: 32, textAlign: 'right', color }}>{pct}%</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Accordion — collapsible section
// ─────────────────────────────────────────────────────────────
interface AccordionProps {
  header: React.ReactNode    // always-visible trigger content
  children: React.ReactNode  // collapsible body
  defaultOpen?: boolean
  indent?: number            // left indent in px for nested usage
  borderLeft?: string        // optional colored left border when open
  headerStyle?: React.CSSProperties
  bodyStyle?: React.CSSProperties
}

export function Accordion({ header, children, defaultOpen = false, indent = 0, borderLeft, headerStyle, bodyStyle }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ ...accordionBtnStyle(open, indent), ...headerStyle, borderLeft: open && borderLeft ? borderLeft : 'none' }}
      >
        {/* Chevron */}
        <span style={{
          fontSize: 9, color: C.textFaint, flexShrink: 0, lineHeight: 1,
          display: 'inline-block', transition: 'transform 0.15s',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>▶</span>
        {header}
      </button>

      {/* Body — animated */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ background: 'rgba(0,0,0,0.2)', borderTop: `1px solid ${C.borderSoft}`, ...bodyStyle }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Card — surface container
// ─────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={cardStyle(style)}>{children}</div>
}

// ─────────────────────────────────────────────────────────────
//  SearchInput
// ─────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder, width = 160 }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  width?: number
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? 'Buscar…'}
      style={inputStyle({ width })}
    />
  )
}

// ─────────────────────────────────────────────────────────────
//  StatBar — horizontal key-value metrics strip
// ─────────────────────────────────────────────────────────────
export function StatBar({ stats }: {
  stats: { label: string; value: number | string; color?: string }[]
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: `${SP[2]}px ${SP[4]}px`,
      borderBottom: `1px solid ${C.border}`,
      flexShrink: 0, flexWrap: 'wrap',
    }}>
      {stats.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontWeight: 800, fontFamily: T.fontMono, color: s.color ?? C.blue, fontSize: T.xl }}>{s.value}</span>
          <span style={{ fontSize: T.sm, color: C.textFaint }}>{s.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Toolbar — top bar with filters + right slot
// ─────────────────────────────────────────────────────────────
export function Toolbar({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      padding: `7px ${SP[3]}px`,
      borderBottom: `1px solid ${C.border}`,
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>{left}</div>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{right}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  FilterPills — tab-style filter group
// ─────────────────────────────────────────────────────────────
export function FilterPills<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          style={{
            fontSize: T.xs, padding: '2px 9px', borderRadius: R.pill, cursor: 'pointer',
            fontWeight: 600,
            background: value === o.key ? C.blueLight : 'transparent',
            color: value === o.key ? C.blue : C.textFaint,
            border: `1px solid ${value === o.key ? C.blueBorder : C.border}`,
            transition: 'all 0.12s',
          }}
        >{o.label}</button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  CopyBtn — small icon copy button with flash feedback
// ─────────────────────────────────────────────────────────────
export function CopyBtn({ text, label, style }: { text: string; label?: string; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false)
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      if (t.current) clearTimeout(t.current)
      t.current = setTimeout(() => setCopied(false), 1400)
    }).catch(() => {})
  }

  return (
    <button onClick={handleCopy}
      style={{
        fontSize: T.xs, fontWeight: 700, padding: '2px 7px', borderRadius: R.sm,
        cursor: 'pointer', transition: 'all 0.12s', fontFamily: T.fontMono,
        background: copied ? C.greenBg : C.blueLight,
        color: copied ? C.green : C.blue,
        border: `1px solid ${copied ? C.greenBorder : C.blueBorder}`,
        ...style,
      }}
      title={`Copiar${label ? ` ${label}` : ''}`}
    >
      {copied ? '✓' : (label ?? '📋')}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
//  EmptyState — centered placeholder
// ─────────────────────────────────────────────────────────────
export function EmptyState({ icon = '📂', message }: { icon?: string; message: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', gap: 12, color: C.textFaint,
      background: C.bg,
    }}>
      <span style={{ fontSize: 40 }}>{icon}</span>
      <span style={{ fontSize: T.lg, fontWeight: 600 }}>{message}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Divider — 1px separator
// ─────────────────────────────────────────────────────────────
export function Divider({ vertical = false }: { vertical?: boolean }) {
  return vertical
    ? <div style={{ width: 1, height: 14, background: C.border, flexShrink: 0 }} />
    : <div style={{ height: 1, background: C.border }} />
}

// ─────────────────────────────────────────────────────────────
//  ISOChip — clickable ISO badge that copies on click
// ─────────────────────────────────────────────────────────────
export function ISOChip({ iso, highlight }: { iso: string; highlight?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => navigator.clipboard.writeText(iso).then(() => {
        setCopied(true); setTimeout(() => setCopied(false), 1200)
      }).catch(() => {})}
      style={{
        fontSize: T.xs, padding: '2px 6px', borderRadius: R.sm,
        background: copied ? C.greenBg : highlight ? 'rgba(248,81,73,0.15)' : C.blueLight,
        color: copied ? C.green : highlight ? C.red : C.blue,
        border: `1px solid ${copied ? C.greenBorder : highlight ? C.redBorder : C.blueBorder}`,
        cursor: 'pointer', fontFamily: T.fontMono, fontWeight: 700,
        transition: 'all 0.15s',
      }}
      title="Copiar ISO"
    >
      {copied ? '✓' : iso}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
//  PageShell — wrapper for full-height tab content
// ─────────────────────────────────────────────────────────────
export function PageShell({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
      background: C.bg, color: C.text,
      fontFamily: T.fontFamily,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  ScrollArea — flex-1 scrollable container
// ─────────────────────────────────────────────────────────────
export function ScrollArea({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', ...style }}>
      {children}
    </div>
  )
}
