import React, { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Copy, Pin, PinOff, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { Btn } from '../../ui/DS'

interface TableModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  data: any[]
  columns: string[]
  isConflictModal?: boolean
  isInline?: boolean
  onDeleteRow?: (rowIndex: number) => void
  TC: any // Theme colors
  onExportCSV?: () => void
}

export default function TableModal({
  isOpen,
  onClose,
  title,
  subtitle,
  data,
  columns,
  isConflictModal = false,
  isInline = false,
  onDeleteRow,
  TC,
  onExportCSV
}: TableModalProps) {
  const [colFilters, setColFilters] = useState<Record<string, Set<string>>>({})
  const [frozenCols, setFrozenCols] = useState<Set<string>>(new Set())
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const [activePopup, setActivePopup] = useState<string | null>(null)
  const [popupSearch, setPopupSearch] = useState('')
  const [tempSelected, setTempSelected] = useState<Set<string>>(new Set())
  const [editMode, setEditMode] = useState(false)

  // Cell selection state
  const [selection, setSelection] = useState<{ start: { r: number, c: number } | null, end: { r: number, c: number } | null }>({ start: null, end: null })
  const [isDragging, setIsDragging] = useState(false)

  const popupRef = useRef<HTMLDivElement>(null)

  // -- Filtering & Sorting --
  const displayData = useMemo(() => {
    let result = data.map((row, _origIdx) => ({ ...row, _origIdx }))
    
    // Filter
    Object.entries(colFilters).forEach(([col, vals]) => {
      if (vals.size > 0) {
        result = result.filter(row => vals.has(String(row[col] ?? '')))
      }
    })

    // Sort
    if (sortCol) {
      result.sort((a, b) => {
        const av = String(a[sortCol] ?? '').toLowerCase()
        const bv = String(b[sortCol] ?? '').toLowerCase()
        return av < bv ? -sortDir : (av > bv ? sortDir : 0)
      })
    }

    return result
  }, [data, colFilters, sortCol, sortDir])

  // -- Event Listeners (Click Outside) --
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activePopup && popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setActivePopup(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [activePopup])

  // -- Cell Selection Keybindings --
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((!isOpen && !isInline) || activePopup || !displayData.length) return
      if (!selection.start || !selection.end || isDragging) return

      const rMin = Math.min(selection.start.r, selection.end.r)
      const rMax = Math.max(selection.start.r, selection.end.r)
      const cMin = Math.min(selection.start.c, selection.end.c)
      const cMax = Math.max(selection.start.c, selection.end.c)
      const isMultipleSelected = rMin !== rMax || cMin !== cMax

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
         if (e.shiftKey) {
           e.preventDefault()
           const maxR = displayData.length - 1
           const maxC = columns.length - 1
           let currentR = selection.end.r
           let currentC = selection.end.c
           if (e.key === 'ArrowUp') currentR = Math.max(0, currentR - 1)
           if (e.key === 'ArrowDown') currentR = Math.min(maxR, currentR + 1)
           if (e.key === 'ArrowLeft') currentC = Math.max(0, currentC - 1)
           if (e.key === 'ArrowRight') currentC = Math.min(maxC, currentC + 1)
           setSelection(p => ({ ...p, end: { r: currentR, c: currentC } }))
           return
         } else if (isMultipleSelected) {
           e.preventDefault()
           const maxR = displayData.length - 1
           const maxC = columns.length - 1
           let currentR = selection.end.r
           let currentC = selection.end.c
           if (e.key === 'ArrowUp') currentR = Math.max(0, currentR - 1)
           if (e.key === 'ArrowDown') currentR = Math.min(maxR, currentR + 1)
           if (e.key === 'ArrowLeft') currentC = Math.max(0, currentC - 1)
           if (e.key === 'ArrowRight') currentC = Math.min(maxC, currentC + 1)
           setSelection({ start: { r: currentR, c: currentC }, end: { r: currentR, c: currentC } })
           return
         }
      }

      // Copy
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
         e.preventDefault()
         const textRows = []
         for (let i = rMin; i <= rMax; i++) {
             const rowText = []
             for (let j = cMin; j <= cMax; j++) {
                 const colName = columns[j]
                 if (colName && displayData[i]) {
                     rowText.push(String(displayData[i][colName] || '').replace(/\t/g, ' '))
                 }
             }
             textRows.push(rowText.join('\t'))
         }
         navigator.clipboard.writeText(textRows.join('\n')).then(() => {
           // Optional: hook a toast here
         })
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    const handleMouseUp = () => setIsDragging(false)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [selection, isDragging, isOpen, isInline, activePopup, displayData, columns])

  // -- Handlers --
  const toggleFreeze = (col: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFrozenCols(prev => {
      const next = new Set(prev)
      next.has(col) ? next.delete(col) : next.add(col)
      return next
    })
  }

  const togglePopup = (col: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (activePopup === col) {
      setActivePopup(null)
    } else {
      setActivePopup(col)
      setPopupSearch('')
      const uniqueVals = Array.from(new Set(data.map(r => String(r[col] ?? ''))))
      setTempSelected(colFilters[col] ? new Set(colFilters[col]) : new Set(uniqueVals))
    }
  }

  const applyPopupFilter = (col: string, selectedVals: Set<string>) => {
    setColFilters(prev => {
      const next = { ...prev }
      if (selectedVals.size === 0 || selectedVals.size === Array.from(new Set(data.map(r => String(r[col] ?? '')))).length) {
        delete next[col]
      } else {
        next[col] = selectedVals
      }
      return next
    })
    setActivePopup(null)
  }

  const handleSort = (col: string, dir: 1 | -1 | null) => {
    if (dir === null) {
      setSortCol(null)
    } else {
      setSortCol(col)
      setSortDir(dir)
    }
    setActivePopup(null)
  }

  const copyTable = () => {
    if (!displayData.length) return
    const keys = columns.filter(c => c !== '_isConflict')
    let text = keys.join('\t') + '\n'
    displayData.forEach(row => {
      text += keys.map(k => String(row[k] || '').replace(/\t/g, ' ')).join('\t') + '\n'
    })
    navigator.clipboard?.writeText(text)
  }

  // Calculate sticky left offsets for frozen columns
  const getStickyStyles = (colName: string, isHeader: boolean = false) => {
    if (!frozenCols.has(colName)) return {}
    const frozenArr = Array.from(frozenCols).filter(c => columns.includes(c))
    const index = frozenArr.indexOf(colName)
    let leftOffset = (editMode ? 40 : 0) // if edit mode is active, account for the trash column
    
    // Estimate width based on typical column sizes or just fixed for simplicity
    // For a more robust approach, we could use refs, but fixed is easier here
    leftOffset += index * 120 
    
    return {
      position: 'sticky' as any,
      left: leftOffset,
      zIndex: isHeader ? 20 : 10,
      backgroundColor: TC.bgCard, // overridden below based on row
      boxShadow: '1px 0 0 rgba(0,0,0,0.1)'
    }
  }

  if (!isOpen && !isInline) return null

  const modalContent = (
      <motion.div
        initial={isInline ? false : { opacity: 0, scale: 0.95, y: 20 }}
        animate={isInline ? undefined : { opacity: 1, scale: 1, y: 0 }}
        exit={isInline ? undefined : { opacity: 0, scale: 0.95, y: 20 }}
        className={isInline ? "flex flex-col flex-1 h-full rounded-xl overflow-hidden shadow-sm" : "fixed inset-4 md:inset-10 lg:inset-x-20 z-[101] flex flex-col rounded-2xl overflow-hidden shadow-2xl"}
        style={{ background: TC.bgCard, border: `1px solid ${TC.borderSoft}` }}
      >
        <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: TC.borderSoft, background: TC.headerBg }}>
          <div>
            <h3 className="font-bold text-base tracking-tight" style={{ color: TC.text }}>{title}</h3>
            {subtitle && <p className="text-[11px] opacity-70" style={{ color: TC.textFaint }}>{subtitle}</p>}
          </div>
          {!isInline && (
            <button onClick={onClose} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-red-500">
              <X size={20} />
            </button>
          )}
        </div>

        <div className="px-6 py-3 border-b flex flex-wrap gap-2 items-center" style={{ borderColor: TC.borderSoft, background: TC.bg }}>
          {onExportCSV && (
            <Btn onClick={onExportCSV} variant="primary" style={{ fontSize: 11, padding: '6px 14px' }}>
              ⬇️ Exportar CSV
            </Btn>
          )}
          <Btn onClick={copyTable} style={{ fontSize: 11, padding: '6px 14px', background: '#22c55e', color: 'white', border: 'none' }}>
            <Copy size={14} className="mr-1 inline-block" /> Copiar Tabla
          </Btn>
          {isConflictModal && (
            <>
              <Btn 
                onClick={() => setEditMode(!editMode)} 
                style={{ fontSize: 11, padding: '6px 14px', background: editMode ? '#0051ba' : '#e8f0fb', color: editMode ? 'white' : '#003a8c', border: `1px solid ${editMode ? '#003a8c' : '#b8d0f0'}` }}
              >
                {editMode ? '✅ Salir edición' : '✏️ Modo edición'}
              </Btn>
              {editMode && (
                <span className="text-[10px] bg-yellow-100 text-yellow-800 border border-yellow-300 px-3 py-1 rounded-md ml-2">
                  ✏️ Edición activa — 🗑️ para eliminar fila
                </span>
              )}
            </>
          )}
        </div>

        {Object.keys(colFilters).length > 0 && (
          <div className="px-6 py-2 border-b flex flex-wrap gap-2 items-center text-[10px]" style={{ borderColor: TC.borderSoft, background: TC.bg }}>
            <span style={{ color: TC.textSub }}>Filtros activos:</span>
            {Object.entries(colFilters).map(([col, vals]) => (
              <span key={col} className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                {col}: {Array.from(vals).map(v => v || '(vacío)').join(', ')}
                <button onClick={() => setColFilters(p => { const next = {...p}; delete next[col]; return next })} className="hover:text-red-500 ml-1">×</button>
              </span>
            ))}
            <button onClick={() => setColFilters({})} className="text-red-500 font-bold ml-2">✕ Limpiar</button>
          </div>
        )}

        <div className="flex-1 overflow-auto bg-white dark:bg-black/20 relative" id="cf-table-wrap">
          <table className="min-w-full text-[11px] font-mono whitespace-nowrap" style={{ borderCollapse: 'collapse' }}>
            <thead className="select-none sticky top-0 z-30 shadow-sm" style={{ background: TC.headerBg }}>
              <tr>
                {editMode && (
                  <th className="px-3 py-2 text-center border-b sticky left-0 z-40 bg-blue-600 text-white w-8" style={{ borderColor: TC.borderSoft }}>
                    🗑️
                  </th>
                )}
                {columns.map(col => {
                  if (col === '_isConflict') return null
                  const isFiltered = colFilters[col] && colFilters[col].size > 0
                  const isFrozen = frozenCols.has(col)
                  const stickyStyle = getStickyStyles(col, true)
                  
                  return (
                    <th 
                      key={col} 
                      className={`px-3 py-2 text-left font-bold border-b relative group ${isFrozen ? 'shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}
                      style={{ 
                        borderColor: TC.borderSoft, 
                        color: TC.textSub, 
                        background: TC.headerBg,
                        ...stickyStyle
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{col}</span>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={(e) => toggleFreeze(col, e)}
                            className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${isFrozen ? 'text-blue-500 opacity-100' : 'text-gray-400 hover:text-blue-500'}`}
                            title={isFrozen ? 'Desanclar' : 'Anclar columna'}
                          >
                            {isFrozen ? <PinOff size={12} /> : <Pin size={12} />}
                          </button>
                          <button 
                            onClick={(e) => togglePopup(col, e)}
                            className={`p-1 rounded transition-colors ${isFiltered || activePopup === col ? 'bg-blue-500 text-white' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}
                          >
                            <Search size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Filter Popup */}
                      {activePopup === col && (
                        <div 
                          ref={popupRef}
                          className="absolute top-full right-0 mt-1 min-w-[220px] bg-white dark:bg-gray-800 rounded-lg shadow-xl border p-3 z-50 font-sans"
                          style={{ borderColor: TC.borderSoft }}
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="flex gap-1 mb-2">
                            <button onClick={() => handleSort(col, 1)} className="flex-1 text-[10px] bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded py-1 flex items-center justify-center gap-1"><ArrowUp size={10}/> A-Z</button>
                            <button onClick={() => handleSort(col, -1)} className="flex-1 text-[10px] bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded py-1 flex items-center justify-center gap-1"><ArrowDown size={10}/> Z-A</button>
                            <button onClick={() => handleSort(col, null)} className="flex-1 text-[10px] bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded py-1 text-red-500">✕</button>
                          </div>
                          <input 
                            type="text" 
                            placeholder="Buscar..." 
                            value={popupSearch}
                            onChange={e => setPopupSearch(e.target.value)}
                            className="w-full text-[11px] p-1.5 mb-2 border rounded dark:bg-gray-900 dark:border-gray-700"
                            autoFocus
                          />
                          <div className="flex gap-2 mb-2 text-[10px]">
                            <button onClick={() => {
                              const uniqueVals = Array.from(new Set(data.map(r => String(r[col] ?? ''))))
                              setTempSelected(new Set(uniqueVals))
                            }} className="text-blue-500 hover:underline">Todos</button>
                            <button onClick={() => setTempSelected(new Set())} className="text-blue-500 hover:underline">Ninguno</button>
                          </div>
                          
                          <div className="max-h-40 overflow-y-auto mb-3 flex flex-col gap-1 text-[11px]">
                            {(() => {
                              const uniqueVals = Array.from(new Set(data.map(r => String(r[col] ?? '')))).sort()
                              const filteredVals = uniqueVals.filter(v => v.toLowerCase().includes(popupSearch.toLowerCase()))
                              const currentSelected = tempSelected
                              
                              return filteredVals.map(v => (
                                <label key={v} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded">
                                  <input 
                                    type="checkbox" 
                                    checked={currentSelected.has(v)}
                                    onChange={(e) => {
                                      const next = new Set(tempSelected)
                                      if (e.target.checked) next.add(v)
                                      else next.delete(v)
                                      setTempSelected(next)
                                    }}
                                  />
                                  <span className="truncate">{v || '(vacío)'}</span>
                                </label>
                              ))
                            })()}
                          </div>
                          
                          <div className="flex gap-2">
                            <Btn variant="primary" onClick={() => applyPopupFilter(col, tempSelected)} style={{ flex: 1, padding: '4px', fontSize: 10 }}>Aplicar</Btn>
                            <Btn onClick={() => setActivePopup(null)} style={{ flex: 1, padding: '4px', fontSize: 10 }}>Cancelar</Btn>
                          </div>
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="select-none">
              {displayData.map((row, idx) => {
                const isConflictRow = row._isConflict
                const rowBgClass = isConflictRow ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                
                return (
                  <tr key={idx} className={`${rowBgClass} transition-colors border-b`} style={{ borderColor: TC.borderSoft }}>
                    {editMode && (
                      <td className="px-3 py-1.5 border-b sticky left-0 z-20 text-center" style={{ borderColor: TC.borderSoft, background: isConflictRow ? '#fee2e2' : TC.bgCard }}>
                        <button onClick={() => onDeleteRow?.(row._origIdx)} className="text-red-500 hover:scale-110 transition-transform p-1">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                    {columns.map((col, cidx) => {
                      if (col === '_isConflict') return null
                      let isSelected = false
                      if (selection.start && selection.end) {
                          const rMin = Math.min(selection.start.r, selection.end.r)
                          const rMax = Math.max(selection.start.r, selection.end.r)
                          const cMin = Math.min(selection.start.c, selection.end.c)
                          const cMax = Math.max(selection.start.c, selection.end.c)
                          isSelected = idx >= rMin && idx <= rMax && cidx >= cMin && cidx <= cMax
                      }

                      const stickyStyle = getStickyStyles(col, false)
                      // adjust background for sticky cells to match row
                      if (stickyStyle.position) {
                        stickyStyle.backgroundColor = isConflictRow ? (/*light*/ '#fee2e2') : (idx % 2 === 0 ? '#fafafa' : '#ffffff')
                        // simplistic generic hex representation, relies mostly on the wrapper classes for accurate dark mode,
                        // but sticking strictly to inline style requires careful calculation. We'll use CSS classes instead where possible.
                      }

                      return (
                        <td 
                          key={col} 
                          className={`px-3 py-1.5 border-b relative cursor-cell ${frozenCols.has(col) ? 'sticky z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}
                          style={{ 
                            borderColor: TC.borderSoft, 
                            color: isConflictRow && col === columns[0] ? '#ef4444' : TC.text,
                            ...stickyStyle,
                            backgroundColor: frozenCols.has(col) ? (isConflictRow ? 'var(--red-100, #fee2e2)' : TC.bgCard) : undefined
                          }}
                          onMouseDown={() => { setSelection({start: {r:idx, c:cidx}, end: {r:idx, c:cidx}}); setIsDragging(true) }}
                          onMouseEnter={() => { if(isDragging) setSelection(p => ({...p, end: {r:idx, c:cidx}})) }}
                        >
                          <div className={`absolute inset-0 pointer-events-none transition-colors duration-75 ${isSelected ? 'bg-blue-500/20 mix-blend-multiply dark:mix-blend-screen ring-1 ring-inset ring-blue-500/50 z-20' : ''}`} />
                          
                          {col === 'Estado' ? (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${getStateColor(String(row[col]))}`}>
                              {String(row[col] ?? '')}
                            </span>
                          ) : col === 'ParentOrder' ? (
                            <span className="font-mono text-[10px] opacity-80">{String(row[col] ?? '')}</span>
                          ) : (
                            <span className="relative z-10">{String(row[col] ?? '')}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
  )

  if (isInline) return modalContent

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
        onClick={onClose}
      />
      {modalContent}
    </AnimatePresence>
  )
}

function getStateColor(state: string) {
  const s = state.toLowerCase()
  if (s.includes('terminado')) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (s.includes('ruta')) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  if (s.includes('planificado')) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
  if (s.includes('pendiente')) return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
}
