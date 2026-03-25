import { motion, AnimatePresence } from 'framer-motion'
import { useTheme, getThemeColors } from '../../context/ThemeContext'

export type SearchMode = 'geosort' | 'simpliroute'

interface Props {
  isoInput:           string
  onInputChange:      (v: string) => void
  onConsultar:        () => void
  onClear:            () => void
  hasData:            boolean
  searchMode:         SearchMode
  onSearchModeChange: (m: SearchMode) => void
  loading?:           boolean
  loadingProgress?:   string
}

/* ── Inline Btn ────────────────────────────────────────────── */
function Btn({ children, variant = 'primary', size = 'md', style, onClick, disabled }: {
  children: React.ReactNode
  variant?: 'primary' | 'ghost'
  size?:    'sm' | 'md' | 'lg'
  style?:   React.CSSProperties
  onClick?: () => void
  disabled?: boolean
}) {
  const V = {
    primary: { background: 'linear-gradient(135deg,#0051BA,#1a6dd4)', color: '#fff', border: '1px solid rgba(56,139,253,0.4)', boxShadow: '0 2px 12px rgba(0,81,186,0.3)' },
    ghost:   { background: 'transparent', color: 'var(--ar-text-faint)', border: '1px solid transparent' },
  }
  const S = {
    sm: { fontSize: 11, padding: '5px 12px', borderRadius: 8, height: 28 },
    md: { fontSize: 12, padding: '7px 16px', borderRadius: 10, height: 36 },
    lg: { fontSize: 13, padding: '10px 22px', borderRadius: 12, height: 44 },
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


export default function TabConsultar({
  isoInput, onInputChange, onConsultar, onClear, hasData,
  searchMode, loading, loadingProgress,
}: Props) {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)

  const canSearch = searchMode === 'simpliroute'
    ? !!isoInput.trim() && !loading
    : hasData && !!isoInput.trim()

  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      background: TC.bg, color: TC.text,
      padding: '28px 36px',
      display: 'flex', flexDirection: 'column', gap: 20,
      boxSizing: 'border-box',
      transition: 'background 0.25s, color 0.25s',
    }}>

      {/* Header */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: TC.text, margin: 0 }}>
          Consultar ISOs
        </h2>
        <p style={{ fontSize: 12, color: TC.textFaint, margin: '4px 0 0' }}>
          {searchMode === 'geosort'
            ? 'Busca en el archivo CSV cargado (GeoSort / ParentOrder).'
            : 'Busca directamente en SimpliRoute por título de ISO.'}
        </p>
      </div>

      {/* No data warning — only in GeoSort mode */}
      <AnimatePresence>
        {searchMode === 'geosort' && !hasData && (
          <motion.div
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            style={{
              padding: '14px 18px',
              borderRadius: 12,
              background: 'rgba(240,136,62,0.1)',
              border: '1px solid rgba(240,136,62,0.3)',
              color: '#f0883e',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
              overflow: 'hidden',
            }}
          >
            ⚠️ Primero carga un archivo CSV en la pestaña "Base Recibida"
          </motion.div>
        )}
      </AnimatePresence>

      {/* SimpliRoute info banner */}
      <AnimatePresence>
        {searchMode === 'simpliroute' && (
          <motion.div
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            style={{
              padding: '14px 18px',
              borderRadius: 12,
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: '#a78bfa',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
              overflow: 'hidden',
            }}
          >
            🌐 Modo SimpliRoute — Busca ISOs directamente en la API (no requiere CSV)
          </motion.div>
        )}
      </AnimatePresence>

      {/* Textarea glassmorphism */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
          borderTop: '1px solid rgba(255,255,255,0.15)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          borderRight: '1px solid rgba(255,255,255,0.02)',
          borderBottom: '1px solid rgba(255,255,255,0.02)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          padding: 20,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        <textarea
          value={isoInput}
          onChange={e => onInputChange(e.target.value)}
          placeholder={searchMode === 'geosort'
            ? 'Ej:\nISO-00123\nISO-00456\nISO-00789'
            : 'Ej:\n400123456\n400789012\n(título de visita en SimpliRoute)'}
          style={{
            width: '100%',
            minHeight: 140,
            padding: 14,
            borderRadius: 12,
            background: TC.bg,
            color: TC.text,
            border: `1px solid ${TC.border}`,
            fontSize: 12,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            resize: 'vertical',
            outline: 'none',
            transition: 'border-color 0.2s',
            boxSizing: 'border-box',
          }}
          onFocus={e => e.currentTarget.style.borderColor = searchMode === 'simpliroute' ? 'rgba(139,92,246,0.5)' : 'rgba(56,139,253,0.5)'}
          onBlur={e => e.currentTarget.style.borderColor = TC.border}
          disabled={loading}
        />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Btn
            variant="primary"
            size="lg"
            onClick={onConsultar}
            disabled={!canSearch}
            style={{
              flex: 1,
              ...(searchMode === 'simpliroute' ? {
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 2px 12px rgba(99,102,241,0.3)',
              } : {}),
            }}
          >
            {loading ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  style={{ display: 'inline-block' }}
                >⏳</motion.span>
                {' '}{loadingProgress || 'Consultando…'}
              </>
            ) : (
              <>🔎 Consultar ISOs {searchMode === 'simpliroute' ? '(API)' : ''}</>
            )}
          </Btn>
          <Btn variant="ghost" size="sm" onClick={onClear} disabled={loading}>
            ✕ Limpiar
          </Btn>
        </div>
      </motion.div>

      {/* ISO count hint */}
      {isoInput.trim() && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            fontSize: 11,
            color: TC.textFaint,
            fontFamily: '"JetBrains Mono", monospace',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          📝 {isoInput.split(/[\n\r,;\t ]+/).filter(s => s.trim()).length} ISOs detectadas
        </motion.div>
      )}
    </div>
  )
}
