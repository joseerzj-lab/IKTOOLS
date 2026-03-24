import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Copy, Image as ImageIcon, Loader2 } from 'lucide-react'
import { useTheme, getThemeColors } from '../../context/ThemeContext'
import ImageModal from '../ui/ImageModal'
import { searchMultipleISOs, type SimpliRouteResult } from '../../utils/simpliRouteApi'

export type ExplorarSearchMode = 'geosort' | 'simpliroute'

interface Props {
  rawRows: any[]
}

function getKey(row: any, key: string) {
  const k = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase())
  return k ? row[k] : null
}

/* ── iOS-style Switch ── */
function ModeSwitch({ mode, onChange }: { mode: ExplorarSearchMode; onChange: (m: ExplorarSearchMode) => void }) {
  const isSimpli = mode === 'simpliroute'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <span style={{
        fontSize: 10, fontWeight: 700,
        color: !isSimpli ? '#3fb950' : 'rgba(255,255,255,0.35)',
        transition: 'color 0.25s',
      }}>📂 GeoSort</span>

      <motion.div
        onClick={() => onChange(isSimpli ? 'geosort' : 'simpliroute')}
        style={{
          width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
          background: isSimpli
            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
            : 'linear-gradient(135deg, #22c55e, #16a34a)',
          padding: 3,
          display: 'flex', alignItems: 'center',
          boxShadow: isSimpli
            ? '0 2px 10px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
            : '0 2px 10px rgba(34,197,94,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
          transition: 'background 0.3s, box-shadow 0.3s',
        }}
        whileTap={{ scale: 0.92 }}
      >
        <motion.div
          animate={{ x: isSimpli ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{
            width: 18, height: 18, borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
          }}
        />
      </motion.div>

      <span style={{
        fontSize: 10, fontWeight: 700,
        color: isSimpli ? '#a78bfa' : 'rgba(255,255,255,0.35)',
        transition: 'color 0.25s',
      }}>🌐 SimpliRoute</span>
    </div>
  )
}

/* ── SimpliRoute columns to show in the table ── */
const SIMPLI_COLS = [
  'ISO', 'Id de referencia', 'Fecha planificada', 'Conductor', 'Vehículo',
  'Dirección', 'Estado', 'Latitud', 'Longitud', 'Carga', 'Carga 2',
  'Comentarios', 'Motivo',
]

function simpliRowToMap(r: SimpliRouteResult): Record<string, string> {
  return {
    'ISO': r.titulo || r.iso,
    'Id de referencia': r.idReferencia,
    'Fecha planificada': r.fechaPlanificada,
    'Conductor': r.conductor,
    'Vehículo': r.vehiculo,
    'Dirección': r.direccion,
    'Estado': r.estado,
    'Latitud': r.latitud,
    'Longitud': r.longitud,
    'Carga': r.carga,
    'Carga 2': r.carga2,
    'Comentarios': r.comentario,
    'Motivo': r.motivo,
    'Foto (URL)': r.fotoUrl,
  }
}

export default function TabExplorar({ rawRows }: Props) {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)

  const [searchMode, setSearchMode] = useState<ExplorarSearchMode>('geosort')
  const [searchQuery, setSearchQuery] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [displayData, setDisplayData] = useState<any[]>([])
  const [simpliResults, setSimpliResults] = useState<SimpliRouteResult[]>([])
  const [searchProgress, setSearchProgress] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalImages, setModalImages] = useState<string[]>([])

  const columns = useMemo(() => {
    if (rawRows.length === 0) return []
    return Object.keys(rawRows[0])
  }, [rawRows])

  /* ── GeoSort search (local CSV) ── */
  const handleGeoSearch = () => {
    if (!searchQuery.trim() || rawRows.length === 0) {
      setDisplayData([])
      setHasSearched(true)
      return
    }
    setIsSearching(true)
    setTimeout(() => {
      const q = searchQuery.toLowerCase().trim()
      const results = rawRows.filter(row => {
        const pOrder = String(getKey(row, 'parentorder') || '').toLowerCase()
        const iso = String(getKey(row, 'iso') || '').toLowerCase()
        if (pOrder.includes(q) || iso.includes(q)) return true
        return Object.values(row).some(v => String(v).toLowerCase().includes(q))
      })
      setDisplayData(results)
      setSimpliResults([])
      setHasSearched(true)
      setIsSearching(false)
    }, 150)
  }

  /* ── SimpliRoute search (API) ── */
  const handleSimpliSearch = async () => {
    if (!searchQuery.trim()) {
      setSimpliResults([])
      setDisplayData([])
      setHasSearched(true)
      return
    }
    setIsSearching(true)
    setSearchProgress('Conectando…')

    const isos = searchQuery.split(/[\n\r,;\t ]+/).map(s => s.trim()).filter(Boolean)

    try {
      const results = await searchMultipleISOs(isos, (done, total) => {
        setSearchProgress(`${done}/${total}`)
      })
      setSimpliResults(results)
      setDisplayData([]) // clear geo data
      setHasSearched(true)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSearching(false)
      setSearchProgress('')
    }
  }

  const handleManualSearch = () => {
    if (searchMode === 'simpliroute') {
      handleSimpliSearch()
    } else {
      handleGeoSearch()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleManualSearch()
  }

  const copyTable = () => {
    if (searchMode === 'simpliroute' && simpliResults.length > 0) {
      const header = ['Fotos', ...SIMPLI_COLS].join('\t') + '\n'
      const body = simpliResults.map(r => {
        const m = simpliRowToMap(r)
        return [r.fotoUrl ? 'Sí' : 'No', ...SIMPLI_COLS.map(c => m[c] || '')].join('\t')
      }).join('\n')
      navigator.clipboard?.writeText(header + body)
      return
    }
    if (displayData.length === 0) return
    const keys = columns
    let text = ['Fotos', ...keys].join('\t') + '\n'
    displayData.forEach(row => {
      const imgCell = getKey(row, 'imageurl') ? 'Sí' : 'No'
      text += [imgCell, ...keys.map(k => String(row[k] || '').replace(/\t/g, ' '))].join('\t') + '\n'
    })
    navigator.clipboard?.writeText(text)
  }

  const openPhotos = (urlStr: string) => {
    if (!urlStr) return
    const urls = urlStr.split(',')
      .map((s: string) => s.trim().replace(/^[\[\]"']+|[\[\]"']+$/g, '').trim())
      .filter((s: string) => s.startsWith('http'))
    if (urls.length > 0) {
      setModalImages(urls)
      setModalOpen(true)
    } else {
      const fallbackUrls = urlStr.split(',')
        .map((s: string) => s.trim().replace(/^[\[\]"']+|[\[\]"']+$/g, '').trim())
        .filter(Boolean)
      if (fallbackUrls.length > 0) {
        setModalImages(fallbackUrls)
        setModalOpen(true)
      }
    }
  }

  const isSimpli = searchMode === 'simpliroute'
  const showSimpliTable = isSimpli && simpliResults.length > 0
  const showGeoTable = !isSimpli && displayData.length > 0
  const noResults = hasSearched && !showSimpliTable && !showGeoTable

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: TC.bg, color: TC.text, padding: '20px', gap: '16px',
      transition: 'background 0.25s, color 0.25s', boxSizing: 'border-box'
    }}>
      {/* Search Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 className="text-lg font-bold">
              Consultar ISO {isSimpli ? '(SimpliRoute)' : `(${rawRows.length} registros en total)`}
            </h2>
            <p className="text-xs opacity-70">
              {hasSearched
                ? `Resultados: ${isSimpli ? `${simpliResults.filter(r => r.found).length} encontrados` : `${displayData.length} encontrados`}`
                : isSimpli
                  ? 'Ingresa ISOs para buscar en SimpliRoute'
                  : 'Ingresa un término para buscar en la base cargada'}
            </p>
          </div>
          <ModeSwitch mode={searchMode} onChange={setSearchMode} />
        </div>

        <div className="flex gap-2 w-full">
          <div className="relative flex-1">
             <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none opacity-50">
               <Search size={14} />
             </div>
             <input
               type="text"
               placeholder={isSimpli ? "Buscar ISO en SimpliRoute (título)…" : "Buscar en la base…"}
               className="w-full bg-white/5 border text-xs rounded-lg pl-9 pr-10 py-2 focus:outline-none focus:ring-2 transition-all font-mono shadow-sm"
               style={{
                 borderColor: TC.border, color: TC.text, background: TC.bgCard,
                 ...(isSimpli ? { '--tw-ring-color': 'rgba(139,92,246,0.5)' } as any : {}),
               }}
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               onKeyDown={handleKeyDown}
               disabled={isSearching}
             />
             <div className="absolute inset-y-1 right-1">
               <button
                 onClick={handleManualSearch}
                 disabled={isSearching}
                 className="h-full px-3 hover:brightness-110 active:scale-95 text-white rounded transition-all flex items-center justify-center disabled:opacity-50 disabled:active:scale-100"
                 style={{
                   background: isSimpli
                     ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                     : '#3b82f6',
                 }}
               >
                 {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
               </button>
             </div>
          </div>

          {(showGeoTable || showSimpliTable) && (
            <button
              onClick={copyTable}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              <Copy size={14} /> Copiar
            </button>
          )}
        </div>

        {/* Progress indicator */}
        <AnimatePresence>
          {isSearching && isSimpli && searchProgress && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                fontSize: 11, color: '#a78bfa', fontFamily: '"JetBrains Mono", monospace',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'inline-block' }}>⏳</motion.span>
              Consultando SimpliRoute… {searchProgress}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto rounded-xl border shadow-sm" style={{ borderColor: TC.borderSoft, background: TC.bgCard }}>
        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center h-full opacity-50">
            <span className="text-4xl text-blue-500">{isSimpli ? '🌐' : '🔍'}</span>
            <p className="mt-4 text-sm font-bold opacity-80">
              {isSimpli ? 'Ingresa ISOs y presiona buscar' : 'Escribe algo y presiona buscar'}
            </p>
            <p className="text-xs opacity-60 mt-1">
              {isSimpli ? 'Se buscará en la API de SimpliRoute' : `Buscaremos sobre los ${rawRows.length} registros cargados`}
            </p>
          </div>
        ) : noResults ? (
          <div className="flex flex-col items-center justify-center h-full opacity-50">
            <span className="text-4xl">📭</span>
            <p className="mt-2 text-sm font-bold">No hay resultados para tu búsqueda</p>
          </div>
        ) : showSimpliTable ? (
          /* ── SimpliRoute Table ── */
          <table className="w-full text-left border-collapse text-[11px] font-mono whitespace-nowrap" style={{ minWidth: 1200 }}>
            <thead className="sticky top-0 z-10 shadow-sm" style={{ background: TC.headerBg }}>
              <tr>
                <th className="px-4 py-3 font-bold uppercase tracking-wider border-b" style={{ borderColor: TC.borderSoft, color: TC.textSub }}>
                  Fotos
                </th>
                {SIMPLI_COLS.map(col => (
                  <th key={col} className="px-4 py-3 font-bold uppercase tracking-wider border-b" style={{ borderColor: TC.borderSoft, color: TC.textSub }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {simpliResults.map((r, idx) => {
                  const m = simpliRowToMap(r)
                  const hasPhotos = !!r.fotoUrl
                  return (
                    <motion.tr
                      key={`${r.iso}-${idx}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                      style={{
                        borderColor: TC.borderSoft,
                        background: !r.found ? 'rgba(248,81,73,0.04)' : 'transparent',
                      }}
                    >
                      <td className="px-4 py-2 border-r" style={{ borderColor: TC.borderSoft }}>
                        {hasPhotos ? (
                          <button
                            onClick={() => openPhotos(r.fotoUrl)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-all shadow-sm font-sans font-bold text-[10px]"
                          >
                            <ImageIcon size={12} /> Ver Fotos
                          </button>
                        ) : (
                          <span className="text-gray-400 text-[10px] pl-2 font-sans">Sin fotos</span>
                        )}
                      </td>
                      {SIMPLI_COLS.map(col => (
                        <td key={col} className="px-4 py-2" style={{
                          color: col === 'ISO' && !r.found ? '#f87171' : TC.text,
                          fontWeight: col === 'ISO' ? 700 : 400,
                        }}>
                          {m[col] || ''}
                          {col === 'ISO' && !r.found && (
                            <span style={{
                              marginLeft: 6, fontSize: 9, fontWeight: 700,
                              padding: '1px 5px', borderRadius: 999,
                              background: 'rgba(248,81,73,0.2)', color: '#ff7b72',
                            }}>NO HALLADO</span>
                          )}
                        </td>
                      ))}
                    </motion.tr>
                  )
                })}
              </AnimatePresence>
            </tbody>
          </table>
        ) : showGeoTable ? (
          /* ── GeoSort Table (original) ── */
          <table className="w-full text-left border-collapse text-[11px] font-mono whitespace-nowrap">
            <thead className="sticky top-0 z-10 shadow-sm" style={{ background: TC.headerBg }}>
              <tr>
                <th className="px-4 py-3 font-bold uppercase tracking-wider border-b" style={{ borderColor: TC.borderSoft, color: TC.textSub }}>
                  Fotos
                </th>
                {columns.map(col => (
                  <th key={col} className="px-4 py-3 font-bold uppercase tracking-wider border-b" style={{ borderColor: TC.borderSoft, color: TC.textSub }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {displayData.map((row, idx) => {
                  const imgUrlStr = getKey(row, 'imageurl') || ''
                  const hasPhotos = imgUrlStr.length > 0
                  return (
                    <motion.tr
                      key={idx}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                      style={{ borderColor: TC.borderSoft }}
                    >
                      <td className="px-4 py-2 border-r" style={{ borderColor: TC.borderSoft }}>
                        {hasPhotos ? (
                          <button
                            onClick={() => openPhotos(imgUrlStr)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-all shadow-sm font-sans font-bold text-[10px]"
                          >
                            <ImageIcon size={12} /> Ver Fotos
                          </button>
                        ) : (
                          <span className="text-gray-400 text-[10px] pl-2 font-sans">Sin fotos</span>
                        )}
                      </td>
                      {columns.map(col => (
                        <td key={col} className="px-4 py-2" style={{ color: TC.text }}>
                          {String(row[col] ?? '')}
                        </td>
                      ))}
                    </motion.tr>
                  )
                })}
              </AnimatePresence>
            </tbody>
          </table>
        ) : null}
      </div>

      <ImageModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        images={modalImages}
      />
    </div>
  )
}
