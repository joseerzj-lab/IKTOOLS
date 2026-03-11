import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { RouteRow } from '../../types/auditoria'
import { useTheme, getThemeColors } from '../../context/ThemeContext'

interface Props {
  routeData: RouteRow[]
  parsing:   boolean
  onFile:    (file: File) => void
  onClear:   () => void
}

// ── Inline Button ─────────────────────────────────────────────
function Btn({ children, variant = 'primary', size = 'md', style, onClick, disabled }: {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'danger'
  size?:    'sm' | 'md' | 'lg'
  style?:   React.CSSProperties
  onClick?: () => void
  disabled?: boolean
}) {
  const V = {
    primary:   { background: 'linear-gradient(135deg,#0051BA,#1a6dd4)', color: '#fff',    border: '1px solid rgba(56,139,253,0.4)', boxShadow: '0 2px 12px rgba(0,81,186,0.3)' },
    secondary: { background: 'var(--ar-bg-hover)',                      color: 'var(--ar-text-sub)', border: '1px solid var(--ar-border)' },
    danger:    { background: 'rgba(248,81,73,0.15)',                    color: '#ff7b72', border: '1px solid rgba(248,81,73,0.35)' },
  }
  const S = {
    sm: { fontSize: 11, padding: '5px 12px', borderRadius: 8,  height: 28 },
    md: { fontSize: 12, padding: '7px 16px', borderRadius: 10, height: 36 },
    lg: { fontSize: 13, padding: '10px 22px',borderRadius: 12, height: 44 },
  }
  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.94 }}
      whileHover={{ filter: disabled ? 'none' : 'brightness(1.1)' }}
      type="button" disabled={disabled} onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 6, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', opacity: disabled ? 0.5 : 1,
        ...V[variant], ...S[size], ...style }}
    >{children}</motion.button>
  )
}

// ── Stat pill ─────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ y: -2, scale: 1.05 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '12px 24px',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
        borderTop: '1px solid rgba(255,255,255,0.2)',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        borderRight: '1px solid rgba(255,255,255,0.02)',
        borderBottom: '1px solid rgba(255,255,255,0.02)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        backdropFilter: 'blur(20px)',
        borderRadius: 16,
      }}>
      <span style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1, textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>{value}</span>
      <span style={{ fontSize: 10, color: 'var(--ar-text-sub)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
    </motion.div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function TabPlanCarga({ routeData, parsing, onFile, onClear }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { theme } = useTheme()
  const TC = getThemeColors(theme)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }, [onFile])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) onFile(f)
    e.target.value = ''
  }, [onFile])

  const vehs    = new Set(routeData.map(r => r.veh)).size
  const comunas = new Set(routeData.map(r => r.comuna)).size
  const hasGeo  = routeData.filter(r => r.lat !== null).length

  return (
    <div 
      className="custom-scrollbar"
      style={{
        height: '100%', overflowY: 'scroll',
        background: TC.bg, color: TC.text,
        padding: '28px 36px',
        display: 'flex', flexDirection: 'column', gap: 20,
        boxSizing: 'border-box',
        transition: 'background 0.25s, color 0.25s',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.18) transparent',
      }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: TC.text, margin: 0 }}>
            Cargar Plan de Rutas
          </h2>
          <p style={{ fontSize: 12, color: TC.textFaint, marginTop: 4, margin: '4px 0 0' }}>
            XLSX o CSV con columnas: Título, Vehículo, Dirección — Lat/Lng opcionales
          </p>
        </div>
        <div>
          <Btn variant="primary" size="md" onClick={() => inputRef.current?.click()}>
            📂 {routeData.length ? 'Cambiar archivo' : 'Cargar archivo'}
          </Btn>
          <input
            ref={inputRef} type="file"
            accept=".xlsx,.xls,.csv,.tsv"
            style={{ display: 'none' }}
            onChange={handleInputChange}
          />
        </div>
      </div>

      {/* Drop zone */}
      <motion.div
        animate={{ 
          borderColor: dragging ? 'rgba(56,139,253,0.8)' : 'rgba(255,255,255,0.15)',
          background: dragging ? 'linear-gradient(135deg, rgba(56,139,253,0.1) 0%, rgba(56,139,253,0.02) 100%)' : 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
        }}
        whileHover={{ scale: 1.01, boxShadow: '0 12px 40px rgba(0,0,0,0.3), inset 1px 1px 0 rgba(255,255,255,0.1)' }}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          borderRadius: 24, 
          borderTop: '1px solid rgba(255,255,255,0.2)', 
          borderLeft: '1px solid rgba(255,255,255,0.1)', 
          borderRight: '1px solid rgba(255,255,255,0.02)', 
          borderBottom: '1px solid rgba(255,255,255,0.02)',
          padding: '40px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          backdropFilter: 'blur(40px) saturate(120%)',
          WebkitBackdropFilter: 'blur(40px) saturate(120%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          transition: 'background 0.2s, border-color 0.2s', cursor: 'pointer',
        }}
        onClick={() => inputRef.current?.click()}
      >
        <div style={{ fontSize: 32 }}>
          {parsing ? '⏳' : routeData.length ? '✅' : '📂'}
        </div>
        {parsing ? (
          <span style={{ fontSize: 13, color: TC.textFaint }}>Procesando archivo…</span>
        ) : routeData.length ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#3fb950' }}>
              {routeData.length} ISOs cargadas
            </div>
            <div style={{ fontSize: 11, color: TC.textFaint, marginTop: 3 }}>
              Haz click o arrastra para reemplazar
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: TC.textFaint }}>Arrastra tu archivo aquí</div>
            <div style={{ fontSize: 11, color: TC.textDisabled, marginTop: 3 }}>
              o haz click para buscar
            </div>
          </div>
        )}
      </motion.div>

      {/* Stats + clear */}
      <AnimatePresence>
        {routeData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}
          >
            <StatPill label="ISOs"      value={routeData.length} color="#7bb8ff" />
            <StatPill label="Vehículos" value={vehs}             color="#a78bfa" />
            <StatPill label="Comunas"   value={comunas}          color="#34d399" />
            <StatPill label="Con GPS"   value={hasGeo}           color="#f0883e" />
            <div style={{ marginLeft: 'auto' }}>
              <Btn variant="danger" size="sm" onClick={onClear}>🗑 Limpiar</Btn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>



    </div>
  )
}