import { motion, AnimatePresence } from 'framer-motion'
import { C, T, R } from '../../ui/DS'
import { useTheme, getThemeColors } from '../../context/ThemeContext'

type ISOTabId = 'tab-cargar' | 'tab-consultar' | 'tab-resultados'

interface Tab {
  id:    ISOTabId
  label: string
  icon:  string
  badgeVariant?: 'blue' | 'green' | 'orange'
}

interface Props {
  activeTab:   ISOTabId
  onTabChange: (tab: ISOTabId) => void
  badges:      Partial<Record<ISOTabId, number>>
}

const TABS: Tab[] = [
  { id: 'tab-cargar',     label: 'Cargar',     icon: '📥', badgeVariant: 'green'  },
  { id: 'tab-consultar',  label: 'Consultar',  icon: '🔎', badgeVariant: 'blue'   },
  { id: 'tab-resultados', label: 'Resultados', icon: '📊', badgeVariant: 'orange' },
]

const BADGE: Record<string, { bg: string; color: string }> = {
  blue:   { bg: 'rgba(56,139,253,0.18)',  color: C.blue   },
  orange: { bg: 'rgba(240,136,62,0.18)',  color: C.orange },
  green:  { bg: 'rgba(63,185,80,0.18)',   color: C.green  },
}

const PILL_STYLE = {
  bg:     'rgba(0,81,186,0.22)',
  border: 'rgba(0,81,186,0.45)',
  glow:   '0 0 14px rgba(0,81,186,0.28)',
}

export type { ISOTabId }

export default function ISOHeader({ activeTab, onTabChange, badges }: Props) {
  const { toggle, isDark } = useTheme()
  const { theme } = useTheme()
  const TC = getThemeColors(theme)

  return (
    <div style={{
      background: TC.headerBg,
      borderBottom: `1px solid ${TC.border}`,
      flexShrink: 0,
      userSelect: 'none',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }}>
      {/* ── Brand row ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 18px 0',
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: R.md,
          background: 'linear-gradient(135deg,#003A8C 0%,#0051BA 55%,#1a6dd4 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0,81,186,0.45)',
        }}>
          🔍
        </div>

        <span style={{
          fontSize: 9, fontWeight: 800,
          letterSpacing: '0.18em',
          color: TC.textDisabled,
          textTransform: 'uppercase',
          fontFamily: T.fontFamily,
        }}>
          ISO Inspector
        </span>

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
          }}
        >
          {isDark ? '☀️' : '🌙'}
        </motion.button>
      </div>

      {/* ── Tab pill nav ── */}
      <div style={{
        display: 'flex', justifyContent: 'center',
        padding: '6px 18px 9px',
      }}>
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
          {TABS.map(tab => {
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
                {/* Active pill */}
                <AnimatePresence>
                  {isActive && (
                    <motion.span
                      layoutId="iso-nav-pill"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                      style={{
                        position: 'absolute', inset: 0,
                        borderRadius: R.full,
                        background: PILL_STYLE.bg,
                        border: `1px solid ${PILL_STYLE.border}`,
                        boxShadow: [
                          PILL_STYLE.glow,
                          'inset 0 1px 0 rgba(255,255,255,0.09)',
                        ].join(', '),
                        zIndex: 0,
                      }}
                    />
                  )}
                </AnimatePresence>

                <span style={{ position: 'relative', zIndex: 1, fontSize: 13, lineHeight: 1 }}>
                  {tab.icon}
                </span>

                <span style={{ position: 'relative', zIndex: 1 }}>
                  {tab.label}
                </span>

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
    </div>
  )
}
