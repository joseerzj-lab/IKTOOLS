import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Copy, Image as ImageIcon, Loader2 } from 'lucide-react'
import { useTheme, getThemeColors } from '../../context/ThemeContext'
import ImageModal from '../ui/ImageModal'

interface Props {
  rawRows: any[]
}

function getKey(row: any, key: string) {
  const k = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase())
  return k ? row[k] : null
}

export default function TabExplorar({ rawRows }: Props) {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [displayData, setDisplayData] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [modalImages, setModalImages] = useState<string[]>([])

  const columns = useMemo(() => {
    if (rawRows.length === 0) return []
    return Object.keys(rawRows[0])
  }, [rawRows])

  const handleManualSearch = () => {
    if (!searchQuery.trim() || rawRows.length === 0) {
      setDisplayData([])
      setHasSearched(true)
      return
    }

    setIsSearching(true)
    setTimeout(() => {
      const q = searchQuery.toLowerCase().trim()
      const results = rawRows.filter(row => {
        // Prioritize some fields
        const pOrder = String(getKey(row, 'parentorder') || '').toLowerCase()
        const iso = String(getKey(row, 'iso') || '').toLowerCase()
        if (pOrder.includes(q) || iso.includes(q)) return true
        
        // Fallback to all values
        return Object.values(row).some(v => String(v).toLowerCase().includes(q))
      })
      setDisplayData(results)
      setHasSearched(true)
      setIsSearching(false)
    }, 150)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleManualSearch()
    }
  }

  const copyTable = () => {
    if (displayData.length === 0) return
    const keys = columns
    let text = ['Fotos', ...keys].join('\t') + '\n'
    displayData.forEach(row => {
      const imgCell = getKey(row, 'imageurl') ? 'Sí' : 'No'
      text += [imgCell, ...keys.map(k => String(row[k] || '').replace(/\t/g, ' '))].join('\t') + '\n'
    })
    navigator.clipboard?.writeText(text)
  }

  const openPhotos = (row: any) => {
    const urlStr = getKey(row, 'imageurl') || ''
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

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: TC.bg, color: TC.text, padding: '20px', gap: '16px',
      transition: 'background 0.25s, color 0.25s', boxSizing: 'border-box'
    }}>
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-lg font-bold">Consultar ISO ({rawRows.length} registros en total)</h2>
          <p className="text-xs opacity-70">
            {hasSearched ? `Resultados: ${displayData.length} encontrados` : 'Ingresa un término para buscar sin trabar el sistema'}
          </p>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
             <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none opacity-50">
               <Search size={14} />
             </div>
             <input
               type="text"
               placeholder="Buscar en la base..."
               className="w-full bg-white/5 border text-xs rounded-lg pl-9 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono shadow-sm"
               style={{ borderColor: TC.border, color: TC.text, background: TC.bgCard }}
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               onKeyDown={handleKeyDown}
             />
             <div className="absolute inset-y-1 right-1">
               <button
                 onClick={handleManualSearch}
                 disabled={isSearching}
                 className="h-full px-3 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white rounded transition-all flex items-center justify-center disabled:opacity-50 disabled:active:scale-100"
               >
                 {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
               </button>
             </div>
          </div>
          <button
            onClick={copyTable}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
          >
            <Copy size={14} /> Copiar
          </button>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto rounded-xl border shadow-sm" style={{ borderColor: TC.borderSoft, background: TC.bgCard }}>
        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center h-full opacity-50">
            <span className="text-4xl text-blue-500">🔍</span>
            <p className="mt-4 text-sm font-bold opacity-80">Escribe algo y presiona buscar</p>
            <p className="text-xs opacity-60 mt-1">Buscaremos sobre los {rawRows.length} registros cargados</p>
          </div>
        ) : displayData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-50">
            <span className="text-4xl">📭</span>
            <p className="mt-2 text-sm font-bold">No hay resultados para tu búsqueda</p>
          </div>
        ) : (
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
                            onClick={() => openPhotos(row)}
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
        )}
      </div>

      <ImageModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        images={modalImages} 
      />
    </div>
  )
}
