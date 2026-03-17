import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useRef } from 'react'
import type { TabKey } from './types'
import { C, T, R } from '../../ui/DS'
import { useTheme, getThemeColors } from '../../context/ThemeContext'

interface Tab {
  id: TabKey
  label: string
  icon: string
  badgeVariant?: 'blue' | 'orange' | 'red' | 'green' | 'purple'
}

interface Props {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  badges: Partial<Record<TabKey, number>>
  severities?: Partial<Record<TabKey, 'high' | 'medium' | 'none'>>
}

const TABS: Tab[] = [
  { id: 'load',      label: 'Cargar Datos',  icon: '📥', badgeVariant: 'green'  },
  { id: 'dashboard', label: 'Dashboard',     icon: '📊', badgeVariant: 'blue'   },
  { id: 'duplicates',label: 'Duplicados',    icon: '🔍', badgeVariant: 'red'    },
  { id: 'projects',  label: 'Proyectos',     icon: '🏗️', badgeVariant: 'blue'   },
  { id: 'export',    label: 'Exportar',      icon: '📋', badgeVariant: 'orange' },
  { id: 'templates', label: 'Plantillas',    icon: '✉️', badgeVariant: 'purple' },
]

const BADGE: Record<string, { bg: string; color: string }> = {
  blue:   { bg: 'rgba(56,139,253,0.18)',  color: C.blue   },
  orange: { bg: 'rgba(240,136,62,0.18)',  color: C.orange },
  red:    { bg: 'rgba(248,81,73,0.18)',   color: C.red    },
  green:  { bg: 'rgba(63,185,80,0.18)',   color: C.green  },
  purple: { bg: 'rgba(167,139,250,0.18)', color: C.purple },
}

export default function GlassHeader({ activeTab, onTabChange, badges, severities = {} }: Props) {
  const { theme, setTheme, toggle, isDark } = useTheme()
  const TC = getThemeColors(theme)

  const logoClickCount = useRef(0)
  const logoClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleLogoClick = () => {
    if (theme === 'landscape') {
      setTheme('dark')
      return
    }

    logoClickCount.current += 1
    
    if (logoClickTimer.current) clearTimeout(logoClickTimer.current)
    
    logoClickTimer.current = setTimeout(() => {
      logoClickCount.current = 0
    }, 500)

    if (logoClickCount.current === 3) {
      setTheme('landscape')
      logoClickCount.current = 0
      if (logoClickTimer.current) clearTimeout(logoClickTimer.current)
    }
  }

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
    }}>
      {/* ── Brand row ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '7px 18px 0',
      }}>
        <Link to="/" style={{ color: TC.text, display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={18} className="hover:opacity-70 transition-opacity" />
        </Link>
        <motion.div 
          onClick={handleLogoClick}
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          style={{
            flexShrink: 0,
            cursor: 'pointer',
          }}
        >
          {theme === 'landscape' ? (
            <div 
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 15px rgba(255, 255, 255, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                backdropFilter: 'blur(5px)'
              }}
            >
              <span style={{ fontSize: 18 }}>🏔️</span>
            </div>
          ) : (
            <img 
              src={`${import.meta.env.BASE_URL}logo_ikea.png`}
              alt="IKEA"
              style={{
                height: 22, 
                width: 'auto'
              }}
            />
          )}
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{
            fontSize: 11, fontWeight: 800,
            letterSpacing: '0.1em',
            color: TC.text,
            fontFamily: T.fontFamily,
          }}>
            RUTEOS PM
          </span>
        </div>

        {/* Theme toggle — top right */}
        <motion.button
          onClick={() => theme === 'landscape' ? setTheme('dark') : toggle()}
          whileTap={{ scale: 0.88 }}
          whileHover={{ scale: 1.1 }}
          title={theme === 'landscape' ? 'Salir del modo secreto' : (isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro')}
          style={{
            marginLeft: 'auto',
            background: theme === 'landscape' ? 'rgba(255,255,255,0.15)' : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'),
            border: `1px solid ${theme === 'landscape' ? 'rgba(255,255,255,0.4)' : TC.border}`,
            borderRadius: R.md,
            width: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 13,
            flexShrink: 0,
            transition: 'background 0.2s',
            color: TC.text,
            boxShadow: theme === 'landscape' ? '0 0 10px rgba(255,255,255,0.2)' : 'none'
          }}
        >
          {theme === 'landscape' ? '🏔️' : (isDark ? '☀️' : '🌙')}
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
                whileHover={{ y: -1 }}
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
                <AnimatePresence>
                  {isActive && (() => {
                    const sev = severities[tab.id] ?? 'none'
                    const sp  = SEVERITY_PILL[sev] ?? SEVERITY_PILL.none
                    return (
                      <motion.span
                        layoutId="ruteo-pill"
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

                <span style={{ position: 'relative', zIndex: 1, fontSize: 13, lineHeight: 1 }}>
                  {tab.icon}
                </span>

                <span style={{ position: 'relative', zIndex: 1 }}>
                  {tab.label}
                </span>

                {badge != null && badge > 0 && (
                  <motion.span 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ 
                      scale: 1, 
                      opacity: 1,
                      boxShadow: isActive ? [`0 0 0px ${bc.color}`, `0 0 8px ${bc.color}`, `0 0 0px ${bc.color}`] : 'none'
                    }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity,
                      opacity: { duration: 0.2 } 
                    }}
                    style={{
                      position: 'relative', zIndex: 1,
                      fontSize: 9, fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: R.full,
                      minWidth: 16, textAlign: 'center',
                      background: bc.bg, color: bc.color,
                      lineHeight: 1.6,
                    }}
                  >
                    {badge > 999 ? '999+' : badge}
                  </motion.span>
                )}
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
