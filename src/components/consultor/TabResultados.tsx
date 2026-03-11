import { motion, AnimatePresence } from 'framer-motion'
import { useTheme, getThemeColors } from '../../context/ThemeContext'
import { C, T, R } from '../../ui/DS'
import { useRef } from 'react'
import { useTableSelection } from '../../hooks/useTableSelection'

type ISORow = {
  iso: string
  found: boolean
  parentOrder: string
  estado: string
  comentario: string
  motivo: string
}

interface Props {
  results:    ISORow[]
  onCopiar:   () => void
}

function getEstadoClass(e: string): { bg: string; color: string } {
  const l = (e || '').toLowerCase()
  if (l.includes('entregado') || l.includes('exitoso') || l.includes('completado'))
    return { bg: 'rgba(63,185,80,0.15)', color: '#3fb950' }
  if (l.includes('no entregado') || l.includes('fallido') || l.includes('rechazado') || l.includes('cancelado') || l.includes('devuelto'))
    return { bg: 'rgba(248,81,73,0.15)', color: '#ff7b72' }
  if (l.includes('en tránsito') || l.includes('en ruta') || l.includes('pendiente') || l.includes('asignado'))
    return { bg: 'rgba(56,139,253,0.15)', color: '#7bb8ff' }
  return { bg: 'rgba(240,136,62,0.15)', color: '#f0883e' }
}

const HEADERS = ['ISO', 'Estado', 'Comentario No Entrega', 'Motivo No Entrega']

export default function TabResultados({ results, onCopiar }: Props) {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)
  const found    = results.filter(r => r.found).length
  const notFound = results.filter(r => !r.found).length
  const tableRef = useRef<HTMLTableElement>(null)
  
  useTableSelection(tableRef)

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: TC.bg, color: TC.text,
      transition: 'background 0.25s, color 0.25s',
    }}>

      {/* Empty state */}
      {results.length === 0 ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12,
          color: TC.textDisabled,
        }}>
          <span style={{ fontSize: 40 }}>📋</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: TC.textSub }}>Sin resultados aún</span>
          <span style={{ fontSize: 12, color: TC.textFaint, textAlign: 'center', maxWidth: 300 }}>
            Carga un archivo CSV y usa la pestaña "Consultar" para buscar ISOs.
          </span>
        </div>
      ) : (
        <>
          {/* Stats bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 20px',
            borderBottom: `1px solid ${TC.border}`,
            flexShrink: 0,
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 800, fontFamily: T.fontMono, color: C.green, fontSize: T.xl }}>{found}</span>
              <span style={{ fontSize: T.sm, color: TC.textFaint }}>encontrados</span>
            </div>
            <div style={{ width: 1, height: 14, background: TC.border, flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 800, fontFamily: T.fontMono, color: C.red, fontSize: T.xl }}>{notFound}</span>
              <span style={{ fontSize: T.sm, color: TC.textFaint }}>no hallados</span>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, fontFamily: T.fontMono, color: TC.textFaint }}>
                {results.length} ISOs consultadas
              </span>
              <motion.button
                whileTap={{ scale: 0.94 }}
                whileHover={{ filter: 'brightness(1.1)' }}
                onClick={onCopiar}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 600, padding: '5px 12px',
                  borderRadius: R.md, cursor: 'pointer',
                  background: C.blueLight, color: C.blue,
                  border: `1px solid ${C.blueBorder}`,
                  fontFamily: T.fontFamily,
                }}
              >
                📋 Copiar tabla
              </motion.button>
            </div>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse', fontSize: T.base, fontFamily: T.fontMono }}>
              <thead>
                <tr>
                  {HEADERS.map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '8px 14px',
                      fontSize: T.sm, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      position: 'sticky', top: 0, zIndex: 2,
                      background: TC.bgCard,
                      color: TC.textDisabled,
                      borderBottom: `1px solid ${TC.border}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {results.map((r, i) => {
                    const estadoStyle = getEstadoClass(r.estado)
                    return (
                      <motion.tr
                        key={`${r.iso}-${i}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.5) }}
                        style={{
                          background: !r.found ? 'rgba(248,81,73,0.04)' : 'transparent',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = !r.found ? 'rgba(248,81,73,0.08)' : 'rgba(255,255,255,0.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background = !r.found ? 'rgba(248,81,73,0.04)' : 'transparent')}
                      >
                        <td style={{
                          padding: '8px 14px', fontWeight: 700,
                          color: r.found ? '#eab308' : '#f87171',
                          borderBottom: `1px solid ${TC.border}`,
                        }}>
                          {r.iso}
                          {!r.found && (
                            <span style={{
                              marginLeft: 8, fontSize: 9, fontWeight: 700,
                              padding: '2px 6px', borderRadius: R.pill,
                              background: 'rgba(248,81,73,0.2)', color: '#ff7b72',
                            }}>NO HALLADO</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 14px', borderBottom: `1px solid ${TC.border}` }}>
                          {r.estado && (
                            <span style={{
                              fontSize: 9, fontWeight: 700,
                              padding: '2px 8px', borderRadius: R.pill,
                              background: estadoStyle.bg,
                              color: estadoStyle.color,
                              whiteSpace: 'nowrap',
                            }}>{r.estado}</span>
                          )}
                        </td>
                        <td style={{
                          padding: '8px 14px',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          color: TC.text, borderBottom: `1px solid ${TC.border}`,
                          maxWidth: 300, fontSize: T.base,
                        }}>{r.comentario}</td>
                        <td style={{
                          padding: '8px 14px',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          color: TC.text, borderBottom: `1px solid ${TC.border}`,
                          maxWidth: 300, fontSize: T.base,
                        }}>{r.motivo}</td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export type { ISORow }
