// This file is pure token/style definitions — no JSX, no React components.
// For React components, see DS.tsx
import type React from 'react'

// ─────────────────────────────────────────────────────────────
//  DESIGN SYSTEM — AuditoríaRutas
//  Single source of truth para tokens, colores, tipografía y
//  estilos base. Importar desde cualquier componente.
// ─────────────────────────────────────────────────────────────

// ── Color tokens ─────────────────────────────────────────────
export const C = {
  // Backgrounds — use CSS vars so theme switching is automatic
  bg:       'var(--ar-bg)',
  bgCard:   'var(--ar-bg-card)',
  bgCardAlt:'var(--ar-bg-card-alt)',
  bgHover:  'var(--ar-bg-hover)',
  bgActive: 'var(--ar-bg-active)',

  // Borders
  border:     'var(--ar-border)',
  borderSoft: 'var(--ar-border-soft)',
  borderFocus:'rgba(56,139,253,0.5)',

  // Text
  text:        'var(--ar-text)',
  textSub:     'var(--ar-text-sub)',
  textMuted:   'var(--ar-text-muted)',
  textFaint:   'var(--ar-text-faint)',
  textDisabled:'var(--ar-text-disabled)',

  // Brand blue
  blue:        '#7bb8ff',
  blueLight:   'rgba(56,139,253,0.15)',
  blueBorder:  'rgba(56,139,253,0.3)',
  bluePrimary: '#0051BA',

  // Status
  green:       '#3fb950',
  greenBg:     'rgba(63,185,80,0.12)',
  greenBorder: 'rgba(63,185,80,0.3)',

  orange:      '#f0883e',
  orangeBg:    'rgba(240,136,62,0.14)',
  orangeBorder:'rgba(240,136,62,0.35)',

  red:         '#ff7b72',
  redBg:       'rgba(248,81,73,0.12)',
  redBorder:   'rgba(248,81,73,0.25)',

  purple:      '#b19cd9',     /* Updated to Premium Lilac */
  purpleBg:    'rgba(177,156,217,0.12)',
  purpleBorder:'rgba(177,156,217,0.25)',

  teal:        '#2dd4bf',
  tealBg:      'rgba(45,212,191,0.1)',
  tealBorder:  'rgba(45,212,191,0.25)',
} as const

// ── Typography ────────────────────────────────────────────────
export const T = {
  fontFamily:  '"Inter", system-ui, -apple-system, sans-serif',
  fontMono:    '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',

  // Sizes
  xs:    9,
  sm:    10,
  base:  11,
  md:    12,
  lg:    13,
  xl:    15,
  '2xl': 18,
  '3xl': 22,
} as const

// ── Spacing ───────────────────────────────────────────────────
export const SP = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
} as const

// ── Radius ────────────────────────────────────────────────────
export const R = {
  sm:   4,
  md:   8,
  lg:   10,
  xl:   12,
  pill: 20,
  full: 9999,
} as const

// ── Shadows ───────────────────────────────────────────────────
export const SH = {
  card:   '0 2px 16px rgba(0,0,0,0.35)',
  modal:  '0 8px 40px rgba(0,0,0,0.6)',
  btn:    '0 2px 8px rgba(0,81,186,0.25)',
  glow:   (color: string) => `0 0 12px ${color}`,
} as const

// ── Risk level helpers ────────────────────────────────────────
export type RiskLevel = 'high' | 'medium' | 'low'

export const RISK = {
  high:   { color: C.red,    bg: C.redBg,    border: C.redBorder,    label: '⚠ Alerta',   pct_min: 60 },
  medium: { color: C.orange, bg: C.orangeBg, border: C.orangeBorder, label: '· Moderado', pct_min: 35 },
  low:    { color: C.green,  bg: C.greenBg,  border: C.greenBorder,  label: '✓ Normal',   pct_min: 0  },
} as const

// ── Common style helpers ──────────────────────────────────────

/** Pill / badge */
export function pillStyle(
  level: 'high' | 'medium' | 'low' | 'blue' | 'purple' | 'teal' | 'muted',
  extra?: React.CSSProperties
): React.CSSProperties {
  const map = {
    high:   { bg: C.redBg,    color: C.red,    border: C.redBorder    },
    medium: { bg: C.orangeBg, color: C.orange, border: C.orangeBorder },
    low:    { bg: C.greenBg,  color: C.green,  border: C.greenBorder  },
    blue:   { bg: C.blueLight,color: C.blue,   border: C.blueBorder   },
    purple: { bg: C.purpleBg, color: C.purple, border: 'rgba(167,139,250,0.3)' },
    teal:   { bg: C.tealBg,   color: C.teal,   border: C.tealBorder   },
    muted:  { bg: 'rgba(255,255,255,0.06)', color: C.textFaint, border: C.border },
  }
  const m = map[level]
  return {
    display: 'inline-flex', alignItems: 'center',
    fontSize: T.xs, fontWeight: 700,
    padding: '2px 8px', borderRadius: R.pill,
    background: m.bg, color: m.color, border: `1px solid ${m.border}`,
    whiteSpace: 'nowrap', lineHeight: 1.5,
    ...extra,
  }
}

/** Card container */
export function cardStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    borderRadius: R.lg,
    border: `1px solid ${C.border}`,
    background: C.bgCard,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
    overflow: 'hidden',
    ...extra,
  }
}

/** Accordion header button */
export function accordionBtnStyle(isOpen: boolean, indent = 0): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: `9px ${SP[2]}px 9px ${SP[2] + indent}px`,
    cursor: 'pointer', width: '100%', textAlign: 'left', border: 'none',
    background: isOpen ? C.bgActive : 'transparent',
    color: C.text,
    transition: 'background 0.12s',
  }
}

/** Score bar: use the ScoreBar component from DS.tsx instead */

/** Table cell default */
export const tdBase: React.CSSProperties = {
  padding: '6px 12px', fontSize: T.base,
  borderBottom: `1px solid ${C.borderSoft}`,
}

/** Input field */
export function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: C.bgHover,
    border: `1px solid ${C.border}`,
    borderRadius: R.md,
    padding: '5px 10px',
    fontSize: T.base,
    color: C.textSub,
    outline: 'none',
    fontFamily: T.fontFamily,
    ...extra,
  }
}

// ── Button variants ───────────────────────────────────────────
export const BTN = {
  primary: {
    background: 'linear-gradient(135deg,#0051BA,#1a6dd4)',
    color: '#fff',
    border: `1px solid rgba(56,139,253,0.4)`,
    boxShadow: '0 4px 12px rgba(0,81,186,0.3)',
  },
  secondary: {
    background: 'rgba(255,255,255,0.03)',
    color: C.textSub,
    border: `1px solid ${C.border}`,
  },
  ghost: {
    background: 'transparent',
    color: C.textFaint,
    border: `1px solid transparent`,
  },
  danger: {
    background: C.redBg,
    color: C.red,
    border: `1px solid ${C.redBorder}`,
  },
  success: {
    background: C.greenBg,
    color: C.green,
    border: `1px solid ${C.greenBorder}`,
  },
  warning: {
    background: C.orangeBg,
    color: C.orange,
    border: `1px solid ${C.orangeBorder}`,
  },
  blue: {
    background: C.blueLight,
    color: C.blue,
    border: `1px solid ${C.blueBorder}`,
  },
} as const

export const BTN_SIZE = {
  xs: { fontSize: T.xs,   padding: '2px 7px',   borderRadius: R.sm,  height: 22 },
  sm: { fontSize: T.sm,   padding: '3px 9px',   borderRadius: R.md,  height: 26 },
  md: { fontSize: T.base, padding: '5px 12px',  borderRadius: R.md,  height: 30 },
  lg: { fontSize: T.md,   padding: '7px 16px',  borderRadius: R.lg,  height: 36 },
  xl: { fontSize: T.lg,   padding: '10px 22px', borderRadius: R.xl,  height: 44 },
} as const