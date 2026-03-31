import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Route, Truck, BarChart2, Clock, MapPin,
  Search, CheckSquare,
  Package, Settings
} from 'lucide-react'
import { useTheme, getThemeColors } from '../context/ThemeContext'
import { T, R } from '../ui/DS'
import { ResourceCardsGrid } from '../components/ui/resource-cards-grid'

interface AppInfo {
  id: string
  title: string
  description: string
  path: string
  icon: React.ReactNode
  tag: string
  tagColor: string
  area?: string
}

const APPS: AppInfo[] = [
  {
    id: 'generar-resumen',
    title: 'Generar Resumen',
    description: 'Generación de resumen de vehículos sin conductor y cálculos de tiempos, distancias, M3 y comunas.',
    path: '/generar-resumen',
    icon: <BarChart2 className="h-5 w-5" />,
    tag: 'Reportes',
    tagColor: 'text-[#388bfd] bg-[#388bfd]/10 border-[#388bfd]/20',
    area: 'md:col-span-1 lg:col-span-1'
  },
  {
    id: 'ruteo-pr',
    title: 'Ruteo AM',
    description: 'Pre Ruteo y Post Ruteo con polinomio, scoring, y exportación de correo para operaciones IKEA.',
    path: '/ruteo-pr',
    icon: <Route className="h-5 w-5" />,
    tag: 'Ruteo',
    tagColor: 'text-[#388bfd] bg-[#388bfd]/10 border-[#388bfd]/20',
    area: 'md:col-span-2 lg:col-span-2'
  },
  {
    id: 'ruteador',
    title: 'Ruteo PM',
    description: 'Herramienta principal de asignación de rutas por commune, VEH codes y Pre-Ola.',
    path: '/ruteador',
    icon: <Truck className="h-5 w-5" />,
    tag: 'Ruteo',
    tagColor: 'text-[#388bfd] bg-[#388bfd]/10 border-[#388bfd]/20',
    area: 'md:col-span-1 lg:col-span-1'
  },
  {
    id: 'auditoria',
    title: 'Auditoría de Rutas',
    description: 'Revisión y auditoría de rutas generadas, validación de ISOs y conteo de tickets.',
    path: '/auditoria',
    icon: <CheckSquare className="h-5 w-5" />,
    tag: 'Auditoría',
    tagColor: 'text-[#3fb950] bg-[#3fb950]/10 border-[#3fb950]/20',
    area: 'md:col-span-1 lg:col-span-1'
  },
  {
    id: 'ruteo-24hrs',
    title: 'Ruteo 24 hrs',
    description: 'Gestión de entregas express y rutas de 24 horas con priorización automática.',
    path: '/ruteo-24hrs',
    icon: <Clock className="h-5 w-5" />,
    tag: 'Express',
    tagColor: 'text-[#f0883e] bg-[#f0883e]/10 border-[#f0883e]/20',
    area: 'md:col-span-2 lg:col-span-2'
  },
  {
    id: 'reporte',
    title: 'Reporte de Rutas',
    description: 'Generación de reportes consolidados con métricas de desempeño y KPIs de entrega.',
    path: '/reporte',
    icon: <BarChart2 className="h-5 w-5" />,
    tag: 'Reportes',
    tagColor: 'text-[#a371f7] bg-[#a371f7]/10 border-[#a371f7]/20',
    area: 'md:col-span-1 lg:col-span-1'
  },
  {
    id: 'isos-geo',
    title: 'ISOs Sin Asignación (Geo)',
    description: 'Visualización geográfica de ISOs faltantes y análisis de cobertura por zona.',
    path: '/isos-geo',
    icon: <MapPin className="h-5 w-5" />,
    tag: 'Geo',
    tagColor: 'text-[#2b90ce] bg-[#2b90ce]/10 border-[#2b90ce]/20',
    area: 'md:col-span-1 lg:col-span-1'
  },
  {
    id: 'consultor',
    title: 'Consultor de ISOs',
    description: 'Consulta y verificación de ISOs individuales con historial y estado actual.',
    path: '/consultor',
    icon: <Search className="h-5 w-5" />,
    tag: 'Consulta',
    tagColor: 'text-[#e3b341] bg-[#e3b341]/10 border-[#e3b341]/20',
    area: 'md:col-span-1 lg:col-span-1'
  },
  {
    id: 'vehiculos',
    title: 'Entrega de Vehículos',
    description: 'Control y verificación de flota vehicular, capacidades y asignaciones activas.',
    path: '/vehiculos',
    icon: <Package className="h-5 w-5" />,
    tag: 'Flota',
    tagColor: 'text-[#f85149] bg-[#f85149]/10 border-[#f85149]/20',
    area: 'md:col-span-2 lg:col-span-2'
  },
  {
    id: 'otif',
    title: 'Actualizar OTIF',
    description: 'Procesamiento de OTIF proyectado, pivote de ParentOrder y conteo de LPN por estado.',
    path: '/otif',
    icon: <BarChart2 className="h-5 w-5" />,
    tag: 'Operaciones',
    tagColor: 'text-[#3fb950] bg-[#3fb950]/10 border-[#3fb950]/20',
    area: 'md:col-span-1 lg:col-span-1'
  },
  {
    id: 'control-despachos',
    title: 'Control de Despachos',
    description: 'Análisis de entregas vehiculares, estado de flota e ISOs sin conductor (quiebres).',
    path: '/control-despachos',
    icon: <Package className="h-5 w-5" />,
    tag: 'Flota Unificada',
    tagColor: 'text-[#f85149] bg-[#f85149]/10 border-[#f85149]/20',
    area: 'md:col-span-2 lg:col-span-2'
  },
  {
    id: 'asignador-preola',
    title: 'Asignador PREOLA',
    description: 'Asignación de órdenes a lineales por facility.',
    path: '/asignador-preola',
    icon: <Package className="h-5 w-5" />,
    tag: 'Asignación',
    tagColor: 'text-[#f0883e] bg-[#f0883e]/10 border-[#f0883e]/20',
    area: 'md:col-span-1 lg:col-span-1'
  },
]


export default function Menu() {
  const { theme, toggle, isDark, setTheme } = useTheme()
  const TC = getThemeColors(theme)

  const [logoClicks, setLogoClicks] = useState(0)
  const [lastClickTime, setLastClickTime] = useState(0)

  const handleLogoClick = () => {
    const now = Date.now()
    if (theme === 'landscape') {
      setTheme('dark')
      return
    }
    
    if (now - lastClickTime < 500) {
      const newClicks = logoClicks + 1
      setLogoClicks(newClicks)
      if (newClicks >= 2) {
        setTheme('landscape')
        setLogoClicks(0)
      }
    } else {
      setLogoClicks(0)
    }
    setLastClickTime(now)
  }

  return (
    <div 
      className="h-screen overflow-y-auto relative transition-colors duration-300 custom-scrollbar"
      style={{ background: theme === 'landscape' ? 'transparent' : TC.bg, color: TC.text, fontFamily: T.fontFamily }}
    >
      {/* Target ambient glow similar to Auditoria */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-500"
        style={{
          background: theme === 'landscape'
            ? 'radial-gradient(ellipse 60% 40% at 50% -10%, rgba(255,255,255,0.15) 0%, transparent 70%)'
            : isDark 
              ? 'radial-gradient(ellipse 60% 40% at 50% -10%, rgba(56,139,253,0.12) 0%, transparent 70%)'
              : 'radial-gradient(ellipse 60% 40% at 50% -10%, rgba(56,139,253,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Header bar */}
      <div style={{
        background: TC.headerBg,
        borderBottom: `1px solid ${TC.border}`,
        userSelect: 'none',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 50
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 24px', maxWidth: '1200px', margin: '0 auto'
        }}>
          {theme === 'landscape' ? (
            <div 
              onClick={handleLogoClick}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 15px rgba(255, 255, 255, 0.3)',
                cursor: 'pointer', flexShrink: 0,
                border: '1px solid rgba(255, 255, 255, 0.4)',
                backdropFilter: 'blur(5px)'
              }}
            >
              <span style={{ fontSize: 18 }}>🏔️</span>
            </div>
          ) : (
            <img 
              src={`${import.meta.env.BASE_URL}logo_ikea.png`}
              onClick={handleLogoClick}
              alt="IKEA"
              style={{
                height: 24, 
                width: 'auto',
                cursor: 'pointer',
                flexShrink: 0
              }}
            />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <h1 style={{
              fontSize: 22, fontWeight: 900,
              letterSpacing: '0.05em',
              color: TC.text,
              textTransform: 'uppercase',
              margin: 0,
              fontFamily: T.fontFamily,
              textShadow: theme === 'landscape' ? '0 2px 10px rgba(0,0,0,0.3)' : 'none'
            }}>
              MENÚ PRINCIPAL
            </h1>
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
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 16,
              transition: 'background 0.2s',
              color: TC.text
            }}
          >
             {isDark ? '☀️' : '🌙'}
          </motion.button>
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-14">
        {/* Header Content */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: TC.text }}>
            Panel de Herramientas
          </h1>
          <p className="text-sm max-w-lg" style={{ color: TC.textMuted }}>
            Selecciona la aplicación para continuar con el ruteo o revisión de operaciones logísticas en IKEA.
          </p>
        </motion.div>

        {/* App grid */}
        <ResourceCardsGrid 
          items={APPS.map(app => ({
            title: app.title,
            description: app.description,
            href: app.path,
            icon: app.icon,
            // You can add lastUpdated here if you have that data
          }))}
          isGlass={theme === 'landscape'}
          className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        />

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-16 text-center text-[11px] flex items-center justify-center gap-2"
          style={{ color: TC.textFaint }}
        >
          <Settings size={12} />
          <p>IKEA Ops Tools · Interfaz Unificada · {new Date().getFullYear()}</p>
        </motion.div>
      </div>
    </div>
  )
}
