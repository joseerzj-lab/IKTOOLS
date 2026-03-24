import { motion, AnimatePresence } from 'framer-motion'
import { useTheme, getThemeColors } from '../../context/ThemeContext'
import { C, T, R } from '../../ui/DS'
import { useRef, useState } from 'react'
import { useTableSelection } from '../../hooks/useTableSelection'
import { Image as ImageIcon } from 'lucide-react'
import ImageModal from '../ui/ImageModal'
import type { SearchMode } from './TabConsultar'

type ISORow = {
  iso: string
  found: boolean
  parentOrder: string
  estado: string
  comentario: string
  motivo: string
  imageUrl: string
  direccion: string
  // Optional SimpliRoute fields
  conductor?: string
  vehiculo?: string
  fechaPlanificada?: string
  idReferencia?: string
  latitud?: string
  longitud?: string
  carga?: string
  carga2?: string
}

interface Props {
  results:     ISORow[]
  onCopiar:    () => void
  searchMode?: SearchMode
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

const HEADERS_GEO = ['ISO', 'Dirección', 'Estado', 'Comentario No Entrega', 'Motivo No Entrega', 'Fotos']
const HEADERS_SIMPLI = ['ISO', 'Id Referencia', 'Fecha Planificada', 'Conductor', 'Vehículo', 'Dirección', 'Estado', 'Latitud', 'Longitud', 'Carga', 'Carga 2', 'Comentario', 'Motivo', 'Fotos']

export default function TabResultados({ results, onCopiar, searchMode = 'geosort' }: Props) {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)
  const found    = results.filter(r => r.found).length
  const notFound = results.filter(r => !r.found).length
  const tableRef = useRef<HTMLTableElement>(null)
  const isSimpli = searchMode === 'simpliroute'
  const HEADERS = isSimpli ? HEADERS_SIMPLI : HEADERS_GEO
  
  useTableSelection(tableRef)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalImages, setModalImages] = useState<string[]>([])

  const openPhotos = (urlStr: string) => {
    if (!urlStr) return
    const urls = urlStr.split(',')
      .map(s => s.trim().replace(/^[\[\]"']+|[\[\]"']+$/g, '').trim())
      .filter(s => s.startsWith('http'))
      
    if (urls.length > 0) {
      setModalImages(urls)
      setModalOpen(true)
    } else {
      const fallbackUrls = urlStr.split(',')
        .map(s => s.trim().replace(/^[\[\]"']+|[\[\]"']+$/g, '').trim())
        .filter(Boolean)
      if (fallbackUrls.length > 0) {
        setModalImages(fallbackUrls)
        setModalOpen(true)
      }
    }
  }

  /* ── Render a table cell ── */
  const cellStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '8px 14px',
    borderBottom: `1px solid ${TC.border}`,
    ...extra,
  })

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

            {isSimpli && (
              <>
                <div style={{ width: 1, height: 14, background: TC.border, flexShrink: 0 }} />
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                  background: 'rgba(99,102,241,0.15)', color: '#a78bfa',
                }}>🌐 SimpliRoute</span>
              </>
            )}

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
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse', fontSize: T.base, fontFamily: T.fontMono, minWidth: isSimpli ? 1000 : undefined }}>
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
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {results.map((r, i) => {
                    const estadoStyle = getEstadoClass(r.estado)

                    /* Map header name → cell content */
                    const cellFor = (h: string) => {
                      switch (h) {
                        case 'ISO': return (
                          <td key={h} style={cellStyle({ fontWeight: 700, color: r.found ? '#eab308' : '#f87171' })}>
                            {r.iso}
                            {!r.found && (
                              <span style={{
                                marginLeft: 8, fontSize: 9, fontWeight: 700,
                                padding: '2px 6px', borderRadius: R.pill,
                                background: 'rgba(248,81,73,0.2)', color: '#ff7b72',
                              }}>NO HALLADO</span>
                            )}
                          </td>
                        )
                        case 'Id Referencia': return (
                          <td key={h} style={cellStyle({ color: TC.text, fontSize: T.sm, whiteSpace: 'nowrap' })}>{r.idReferencia || '—'}</td>
                        )
                        case 'Fecha Planificada': return (
                          <td key={h} style={cellStyle({ color: TC.textFaint, fontSize: T.sm, whiteSpace: 'nowrap', fontFamily: T.fontMono })}>{r.fechaPlanificada || '—'}</td>
                        )
                        case 'Conductor': return (
                          <td key={h} style={cellStyle({ color: TC.text, fontSize: T.sm, whiteSpace: 'nowrap' })}>{r.conductor || <span style={{ color: TC.textDisabled }}>—</span>}</td>
                        )
                        case 'Vehículo': return (
                          <td key={h} style={cellStyle({ color: TC.text, fontSize: T.sm, whiteSpace: 'nowrap' })}>{r.vehiculo || <span style={{ color: TC.textDisabled }}>—</span>}</td>
                        )
                        case 'Dirección': return (
                          <td key={h} style={cellStyle({ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: TC.textSub, maxWidth: 200, fontSize: T.sm })}>{r.direccion}</td>
                        )
                        case 'Estado': return (
                          <td key={h} style={cellStyle()}>
                            {r.estado && (
                              <span style={{
                                fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: R.pill,
                                background: estadoStyle.bg, color: estadoStyle.color, whiteSpace: 'nowrap',
                              }}>{r.estado}</span>
                            )}
                          </td>
                        )
                        case 'Latitud': return (
                          <td key={h} style={cellStyle({ color: TC.textFaint, fontSize: T.sm, fontFamily: T.fontMono })}>{r.latitud || ''}</td>
                        )
                        case 'Longitud': return (
                          <td key={h} style={cellStyle({ color: TC.textFaint, fontSize: T.sm, fontFamily: T.fontMono })}>{r.longitud || ''}</td>
                        )
                        case 'Carga': return (
                          <td key={h} style={cellStyle({ color: TC.text, fontSize: T.sm })}>{r.carga || ''}</td>
                        )
                        case 'Carga 2': return (
                          <td key={h} style={cellStyle({ color: TC.text, fontSize: T.sm })}>{r.carga2 || ''}</td>
                        )
                        case 'Comentario':
                        case 'Comentario No Entrega': return (
                          <td key={h} style={cellStyle({ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: TC.text, maxWidth: 300, fontSize: T.base })}>{r.comentario}</td>
                        )
                        case 'Motivo':
                        case 'Motivo No Entrega': return (
                          <td key={h} style={cellStyle({ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: TC.text, maxWidth: 300, fontSize: T.base })}>{r.motivo}</td>
                        )
                        case 'Fotos': return (
                          <td key={h} style={cellStyle()}>
                            {r.imageUrl && r.imageUrl.trim().length > 0 ? (
                              <button
                                onClick={() => openPhotos(r.imageUrl)}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 6,
                                  padding: '4px 10px', background: '#3b82f6', color: 'white',
                                  borderRadius: '6px', fontSize: 11, fontWeight: 'bold', border: 'none', cursor: 'pointer'
                                }}
                              >
                                <ImageIcon size={14} /> Ver Fotos
                              </button>
                            ) : (
                              <span style={{ fontSize: 11, color: TC.textFaint }}>Sin fotos</span>
                            )}
                          </td>
                        )
                        default: return <td key={h} style={cellStyle()}></td>
                      }
                    }

                    return (
                      <motion.tr
                        key={`${r.iso}-${i}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.5) }}
                        style={{ background: !r.found ? 'rgba(248,81,73,0.04)' : 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.style.background = !r.found ? 'rgba(248,81,73,0.08)' : 'rgba(255,255,255,0.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background = !r.found ? 'rgba(248,81,73,0.04)' : 'transparent')}
                      >
                        {HEADERS.map(h => cellFor(h))}
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </>
      )}

      <ImageModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        images={modalImages}
      />
    </div>
  )
}

export type { ISORow }


