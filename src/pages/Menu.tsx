import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Route, Truck, BarChart2, Clock, MapPin,
  Search, CheckSquare, ExternalLink,
  Package, Settings
} from 'lucide-react'
import { useTheme, getThemeColors } from '../context/ThemeContext'
import { T, R } from '../ui/DS'
import { GlowingEffect } from '../components/ui/glowing-effect'
import { cn } from '../lib/utils'

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
]

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
}

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
        <motion.ul
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5"
        >
          {APPS.map((app) => (
            <motion.li variants={item} key={app.id} className={cn("list-none h-full", app.area)}>
              <Link to={app.path} className="block w-full h-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-[1.5rem] outline-none group pb-2">
                <div className="relative h-full rounded-[1.25rem] border-[0.75px] md:rounded-[1.5rem] p-2 hover:bg-black/5 dark:hover:bg-white/5 transition-all outline-none" style={{ borderColor: TC.borderSoft }}>
                  <GlowingEffect 
                    spread={40} 
                    glow={true} 
                    disabled={false} 
                    proximity={64} 
                    inactiveZone={0.01} 
                    borderWidth={3} 
                  />
                  <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-xl border-[0.75px] p-6 shadow-sm transition-all md:p-6" 
                      style={{ 
                        background: TC.bgCard, 
                        borderColor: TC.border,
                        boxShadow: isDark ? '0px 0px 27px 0px rgba(45,45,45,0.1)' : '0 2px 10px rgba(0,0,0,0.05)'
                      }}>
                    <div className="relative flex flex-1 flex-col justify-between gap-5">
                      
                      {/* Top Header: Icon and Tag */}
                      <div className="flex items-start justify-between">
                        <div className="w-fit rounded-lg border-[0.75px] p-2.5 transition-colors group-hover:bg-blue-500/10 group-hover:text-blue-500"
                            style={{ 
                              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                              borderColor: TC.borderSoft,
                              color: TC.textSub
                            }}>
                          {app.icon}
                        </div>
                        <span className={cn("text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full border", app.tagColor)}>
                          {app.tag}
                        </span>
                      </div>

                      {/* Content: Title & Desc */}
                      <div className="space-y-3 mt-4">
                        <div className="flex items-center gap-1.5">
                          <h3 className="pt-0.5 text-xl leading-[1.375rem] font-semibold font-sans tracking-[-0.04em] md:text-2xl md:leading-[1.875rem] text-balance group-hover:text-blue-500 transition-colors"
                              style={{ color: TC.text }}>
                            {app.title}
                          </h3>
                        </div>
                        <h2 className="font-sans text-sm leading-[1.125rem] md:text-base md:leading-[1.375rem]"
                            style={{ color: TC.textMuted }}>
                          {app.description}
                        </h2>
                      </div>
                    </div>
                    
                    {/* Footer: ExternalLink */}
                    <div className="flex items-center gap-1.5 mt-6 text-[11px] font-medium transition-colors group-hover:text-blue-500 opacity-50 group-hover:opacity-100"
                         style={{ color: TC.textDisabled }}>
                      <ExternalLink size={14} />
                      <span>{app.path}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.li>
          ))}
        </motion.ul>

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
