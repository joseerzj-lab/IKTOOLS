import { motion } from 'framer-motion'
import { TabId } from '../../types/auditoria'

interface Tab {
  id: TabId
  label: string
  icon: string
  badge?: number | null
  badgeColor?: 'blue' | 'orange' | 'red' | 'green'
}

interface Props {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  badges: Partial<Record<TabId, number>>
}

const TABS: Tab[] = [
  { id: 'tab-vehiculos', label: 'Route Plan',      icon: '📋', badgeColor: 'blue' },
  { id: 'tab-mapa',      label: 'Off-Route',        icon: '⚠️', badgeColor: 'orange' },
  { id: 'tab-geo',       label: 'Wrong Commune',    icon: '📍', badgeColor: 'red' },
  { id: 'tab-resumen',   label: 'Summary',          icon: '📊', badgeColor: 'blue' },
  { id: 'tab-export',    label: 'Exportar',         icon: '🚀' },
]

const badgeStyles: Record<string, string> = {
  blue:   'bg-blue-500/20 text-blue-300',
  orange: 'bg-orange-500/20 text-orange-300',
  red:    'bg-red-500/20 text-red-300',
  green:  'bg-green-500/20 text-green-300',
}

export default function GlassHeader({ activeTab, onTabChange, badges }: Props) {
  return (
    <nav
      className="flex items-center gap-1 px-4 h-11 flex-shrink-0 overflow-x-auto"
      style={{
        background: 'rgba(22, 27, 34, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 1px 0 rgba(0,81,186,0.10)',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2 mr-3 flex-shrink-0">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center text-xs shadow"
          style={{ background: 'linear-gradient(135deg,#003A8C,#0051BA 55%,#1a6dd4)' }}
        >
          🔍
        </div>
        <span className="text-[10px] font-bold tracking-widest uppercase text-gray-500 hidden sm:block">
          Auditoría
        </span>
      </div>

      <div className="w-px h-4 bg-white/10 mr-1 flex-shrink-0" />

      {/* Tabs */}
      {TABS.map(tab => {
        const isActive = activeTab === tab.id
        const badge = badges[tab.id]

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                       whitespace-nowrap transition-colors duration-150 flex-shrink-0"
            style={{ color: isActive ? '#e6edf3' : '#8b949e' }}
          >
            {/* Active background */}
            {isActive && (
              <motion.span
                layoutId="glass-tab-bg"
                className="absolute inset-0 rounded-md"
                style={{ background: 'rgba(0,81,186,0.15)', border: '1px solid rgba(0,81,186,0.35)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            {/* Active underline */}
            {isActive && (
              <motion.span
                layoutId="glass-tab-line"
                className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                style={{ background: '#0051BA' }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {badge != null && badge > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center
                                  ${badgeStyles[tab.badgeColor ?? 'blue']}`}>
                  {badge}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
