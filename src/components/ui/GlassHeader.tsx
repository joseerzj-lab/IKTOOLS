import { motion, AnimatePresence } from 'framer-motion'
import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { C, T, R } from '../../ui/DS'
import { useTheme, getThemeColors } from '../../context/ThemeContext'

export interface GlassHeaderTab {
  id:          string
  label:       string
  icon:        ReactNode
  badgeVariant?: 'blue' | 'orange' | 'red' | 'green' | 'purple'
}

export interface GlassHeaderProps {
  appName:      string
  appDesc:      string
  icon:         ReactNode
  tabs:         GlassHeaderTab[]
  activeTab:    string
  onTabChange:  (tabId: string) => void
  badges?:      Record<string, number>
  severities?:  Record<string, 'high' | 'medium' | 'none'>
}

// Badge color map — pulled from DS tokens
const BADGE: Record<string, { bg: string; color: string }> = {
  blue:   { bg: 'rgba(56,139,253,0.18)',  color: C.blue   },
  orange: { bg: 'rgba(240,136,62,0.18)',  color: C.orange },
  red:    { bg: 'rgba(248,81,73,0.18)',   color: C.red    },
  green:  { bg: 'rgba(63,185,80,0.18)',   color: C.green  },
  purple: { bg: 'rgba(167,139,250,0.18)', color: C.purple },
}

export default function GlassHeader({ 
  appName, 
  appDesc, 
  icon, 
  tabs, 
  activeTab, 
  onTabChange, 
  badges = {}, 
  severities = {} 
}: GlassHeaderProps) {
  const { theme, toggle, isDark } = useTheme()
  const TC = getThemeColors(theme)

  // Severity → pill visual
  const SEVERITY_PILL: Record<string, { bg: string; border: string; glow: string }> = {
    high:   { bg: 'rgba(248,81,73,0.22)',    border: 'rgba(248,81,73,0.5)',    glow: '0 0 16px rgba(248,81,73,0.3)' },
    medium: { bg: 'rgba(240,136,62,0.22)',   border: 'rgba(240,136,62,0.5)',   glow: '0 0 16px rgba(240,136,62,0.25)' },
    none:   { bg: 'rgba(0,81,186,0.22)',     border: 'rgba(0,81,186,0.45)',    glow: '0 0 14px rgba(0,81,186,0.28)' },
  }

  return (
    <div style={{
      background: TC.headerBg,
      borderBottom: `1px solid ${TC.border}`,
      flexShrink: 0,
      userSelect: 'none',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      position: 'relative',
      zIndex: 10
    }}>
      {/* ── Brand row ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 18px 0',
      }}>
        {/* Home / Back link */}
        <Link to="/" style={{ color: TC.text, display: 'flex', alignItems: 'center', marginRight: 4 }} title="Volver al menú">
          <ArrowLeft size={18} className="hover:opacity-70 transition-opacity" />
        </Link>

        {/* Logo mark */}
        <div style={{
          width: 24, height: 24, borderRadius: R.md,
          background: 'linear-gradient(135deg,#003A8C 0%,#0051BA 55%,#1a6dd4 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0,81,186,0.45)',
          color: 'white'
        }}>
          {icon}
        </div>

        {/* App name */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: TC.text,
            fontFamily: T.fontFamily,
          }}>
            {appName}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 600,
            letterSpacing: '0.05em',
            color: TC.textDisabled,
            textTransform: 'uppercase',
            fontFamily: T.fontFamily,
          }}>
            {appDesc}
          </span>
        </div>

        {/* Theme toggle — top right */}
        <motion.button
          onClick={toggle}
          whileTap={{ scale: 0.88 }}
          whileHover={{ scale: 1.1 }}
          title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          style={{
            marginLeft: 'auto',
            background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
            border: `1px solid ${TC.border}`,
            borderRadius: R.md,
            width: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 13,
            flexShrink: 0,
            transition: 'background 0.2s',
            color: TC.text
          }}
        >
          {isDark ? '☀️' : '🌙'}
        </motion.button>
      </div>

      {/* ── Tab pill nav ── */}
      {tabs && tabs.length > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'center',
          padding: '6px 18px 9px',
        }}>
          {/* Pill track */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 1,
            padding: '3px',
            borderRadius: R.full,
            background: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.04)',
            border: `1px solid ${TC.border}`,
            boxShadow: isDark
              ? '0 4px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)'
              : '0 2px 12px rgba(0,0,0,0.08)',
          }}>
            {tabs.map(tab => {
              const isActive = activeTab === tab.id
              const badge    = badges[tab.id]
              const bc       = BADGE[tab.badgeVariant ?? 'blue']

              return (
                <motion.button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  whileTap={{ scale: 0.96 }}
                  style={{
                    position: 'relative',
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 13px',
                    borderRadius: R.full,
                    border: 'none', cursor: 'pointer',
                    background: 'transparent',
                    color: isActive ? TC.text : TC.textFaint,
                    fontSize: T.base,
                    fontWeight: isActive ? 600 : 400,
                    fontFamily: T.fontFamily,
                    whiteSpace: 'nowrap',
                    outline: 'none',
                    transition: 'color 0.15s',
                  }}
                >
                  {/* Active pill — slides between tabs, colored by severity */}
                  <AnimatePresence>
                    {isActive && (() => {
                      const sev = severities[tab.id] ?? 'none'
                      const sp  = SEVERITY_PILL[sev] ?? SEVERITY_PILL.none
                      return (
                        <motion.span
                          layoutId="nav-pill"
                          initial={false}
                          transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                          style={{
                            position: 'absolute', inset: 0,
                            borderRadius: R.full,
                            background: sp.bg,
                            border: `1px solid ${sp.border}`,
                            boxShadow: [
                              sp.glow,
                              'inset 0 1px 0 rgba(255,255,255,0.09)',
                            ].join(', '),
                            zIndex: 0,
                          }}
                        />
                      )
                    })()}
                  </AnimatePresence>

                  {/* Icon */}
                  <span style={{ position: 'relative', zIndex: 1, fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                    {tab.icon}
                  </span>

                  {/* Label */}
                  <span style={{ position: 'relative', zIndex: 1 }}>
                    {tab.label}
                  </span>

                  {/* Badge count */}
                  {badge != null && badge > 0 && (
                    <span style={{
                      position: 'relative', zIndex: 1,
                      fontSize: 9, fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: R.full,
                      minWidth: 16, textAlign: 'center',
                      background: bc.bg, color: bc.color,
                      lineHeight: 1.6,
                    }}>
                      {badge > 999 ? '999+' : badge}
                    </span>
                  )}
                </motion.button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

