import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, Columns3, Plus, Trash2, Filter, ArrowDownAZ, ArrowUpZA, FileDown, FileSpreadsheet, Image as ImageIcon } from 'lucide-react'
import { DropdownMenu } from '../ui/dropdown-menu'
import { exportElementAsImage } from '../../utils/exportUtils'
import type { Row, Stats } from './types'
import { useTheme, getThemeColors } from '../../context/ThemeContext'
import { Btn } from '../../ui/DS'
import { useVirtualizer } from '@tanstack/react-virtual'

interface Props {
// ... (rest of props)
  columns: string[]
  rows: Row[]
  visibleCols: Set<string>
  setVisibleCols: React.Dispatch<React.SetStateAction<Set<string>>>
  stats: Stats
  onUpdateCell: (rowIdx: number, col: string, value: string) => void
  onAddRow: () => void
  onDeleteRow: (idx: number) => void
  onCrearNueva: () => void
  onUpdateRows: (rows: Row[]) => void
  onNotify: (msg: string) => void
  onClearAll: () => void
}

export default function TabDashboard({
  columns, rows, visibleCols, setVisibleCols,
  stats, onUpdateCell, onAddRow, onDeleteRow, onCrearNueva,
  onUpdateRows, onNotify, onClearAll
}: Props) {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)

  const [search, setSearch] = useState('')
  const [showVisPanel, setShowVisPanel] = useState(false)
  const [showReplace, setShowReplace] = useState(false)
  const [replaceText, setReplaceText] = useState('')
  
  // -- Excel-like filters
  const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null)
  const [colFilters, setColFilters] = useState<Record<string, Set<string>>>({})
  const [sortCol, setSortCol] = useState<{ col: string, dir: 'asc' | 'desc' } | null>(null)
  const [filterSearch, setFilterSearch] = useState('')
  const filterMenuRef = useRef<HTMLDivElement>(null)

  // -- Cell Selection
  const [selection, setSelection] = useState<{ start: {r: number, c: number} | null, end: {r: number, c: number} | null }>({ start: null, end: null })
  const [isDragging, setIsDragging] = useState(false)
  
  const handleMouseDown = (r: number, c: number) => {
    setSelection({ start: {r, c}, end: {r, c} })
    setIsDragging(true)
  }
  
  const handleMouseEnter = (r: number, c: number) => {
    if (isDragging) {
      setSelection(p => ({ ...p, end: {r, c} }))
    }
  }
  
  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Handle Ctrl+C and Ctrl+V for selection
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!selection.start || !selection.end || isDragging) return

      const rMin = Math.min(selection.start.r, selection.end.r)
      const rMax = Math.max(selection.start.r, selection.end.r)
      const cMin = Math.min(selection.start.c, selection.end.c)
      const cMax = Math.max(selection.start.c, selection.end.c)
      const isMultipleSelected = rMin !== rMax || cMin !== cMax

      const isInputFocused = document.activeElement?.tagName === 'INPUT' && !isMultipleSelected
      
      if (!isInputFocused || e.shiftKey) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
           if (e.shiftKey) {
             e.preventDefault()
             const currentRows = getFilteredAndSorted()
             const vCols = columns.filter(c => visibleCols.has(c))
             let currentR = selection.end.r
             let currentC = selection.end.c
             if (e.key === 'ArrowUp') currentR = Math.max(0, currentR - 1)
             if (e.key === 'ArrowDown') currentR = Math.min(currentRows.length - 1, currentR + 1)
             if (e.key === 'ArrowLeft') currentC = Math.max(0, currentC - 1)
             if (e.key === 'ArrowRight') currentC = Math.min(vCols.length - 1, currentC + 1)
             
             if (document.activeElement instanceof HTMLElement) {
                 document.activeElement.blur()
             }
             setSelection(p => ({ ...p, end: { r: currentR, c: currentC } }))
             return
           } else if (isMultipleSelected) {
             e.preventDefault()
             const currentRows = getFilteredAndSorted()
             const vCols = columns.filter(c => visibleCols.has(c))
             let currentR = selection.end.r
             let currentC = selection.end.c
             if (e.key === 'ArrowUp') currentR = Math.max(0, currentR - 1)
             if (e.key === 'ArrowDown') currentR = Math.min(currentRows.length - 1, currentR + 1)
             if (e.key === 'ArrowLeft') currentC = Math.max(0, currentC - 1)
             if (e.key === 'ArrowRight') currentC = Math.min(vCols.length - 1, currentC + 1)
             
             setSelection({ start: { r: currentR, c: currentC }, end: { r: currentR, c: currentC } })
             setTimeout(() => {
                document.getElementById(`cell-${currentR}-${currentC}`)?.focus()
             }, 0)
             return
           }
        }
      }

      // Handle Copy (Ctrl+C)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (isMultipleSelected) {
           e.preventDefault()
           const vCols = columns.filter(c => visibleCols.has(c))
           const textRows = []
           const currentRows = getFilteredAndSorted()
           
           for (let i = rMin; i <= rMax; i++) {
               const rowText = []
               for (let j = cMin; j <= cMax; j++) {
                   const colName = vCols[j]
                   if (colName && currentRows[i]) {
                       rowText.push(currentRows[i][colName] || '')
                   }
               }
               textRows.push(rowText.join('\t'))
           }
           
           navigator.clipboard.writeText(textRows.join('\n'))
             .then(() => onNotify(`✓ ${textRows.length} fila(s) copiadas`))
             .catch(() => onNotify('⚠️ Error al copiar'))
        }
      }

      // Handle Paste (Ctrl+V)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
         try {
            const text = await navigator.clipboard.readText()
            if (!text) return
            const isTabularData = text.includes('\t') || text.includes('\n')
            
            if (isMultipleSelected || isTabularData) {
                e.preventDefault()
                const vCols = columns.filter(c => visibleCols.has(c))
                const currentRows = getFilteredAndSorted()
                const pasteRows = text.replace(/\r?\n$/, '').split(/\r?\n/).map(r => r.split('\t'))
                
                const newRows = [...rows]
                let updatedCount = 0

                if (pasteRows.length === 1 && pasteRows[0].length === 1 && isMultipleSelected) {
                    const val = pasteRows[0][0]
                    for (let i = rMin; i <= rMax; i++) {
                        const rowObj = currentRows[i]
                        if (!rowObj) continue
                        const originalIdx = rows.findIndex(r => r === rowObj)
                        if (originalIdx >= 0) {
                            for (let j = cMin; j <= cMax; j++) {
                               const colName = vCols[j]
                               if (colName) {
                                  newRows[originalIdx] = { ...newRows[originalIdx], [colName]: val }
                                  updatedCount++
                               }
                            }
                        }
                    }
                    if (updatedCount > 0) {
                       onUpdateRows(newRows)
                       onNotify(`✓ Pegado idéntico en celdas seleccionadas`)
                    }
                } else if (pasteRows.length > 0) {
                    // Distribute tabular data
                    for (let pr = 0; pr < pasteRows.length; pr++) {
                        const targetRow = currentRows[rMin + pr]
                        if (!targetRow) continue
                        const originalIdx = rows.findIndex(r => r === targetRow)
                        if (originalIdx >= 0) {
                            for (let pc = 0; pc < pasteRows[pr].length; pc++) {
                                const colName = vCols[cMin + pc]
                                if (colName && pasteRows[pr][pc] !== undefined) {
                                    newRows[originalIdx] = { ...newRows[originalIdx], [colName]: pasteRows[pr][pc] }
                                    updatedCount++
                                }
                            }
                        }
                    }
                    if (updatedCount > 0) {
                       onUpdateRows(newRows)
                       onNotify(`✓ ${updatedCount} celdas distribuidas desde tabla`)
                    }
                }
            }
         } catch(err) {
            console.error('Failed to paste from clipboard:', err)
         }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [selection, isDragging, columns, visibleCols, rows, search, colFilters, sortCol])
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setActiveFilterCol(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const handleReplaceAll = () => {
    if (!search) return
    let updatedCount = 0
    const newRows = rows.map(r => {
      let changed = false
      const nr = { ...r }
      for (const c of columns) {
        if (visibleCols.has(c) && nr[c] && nr[c].toLowerCase().includes(search.toLowerCase())) {
          // regex replace case insensitive string replace
          const regex = new RegExp(search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi')
          nr[c] = String(nr[c]).replace(regex, replaceText)
          changed = true
        }
      }
      if (changed) updatedCount++
      return nr
    })
    
    if (updatedCount > 0) {
      onUpdateRows(newRows)
      onNotify(`✓ ${updatedCount} filas actualizadas`)
    } else {
      onNotify('ℹ️ No se encontraron coincidencias para reemplazar')
    }
  }

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text
    const parts = String(text).split(new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'))
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() 
            ? <mark key={i} className="bg-yellow-400/40 text-inherit rounded-sm px-0.5">{part}</mark> 
            : part
        )}
      </>
    )
  }

  const handleDuplicateRow = (idx: number) => {
    const newRows = [...rows]
    newRows.splice(idx + 1, 0, { ...rows[idx] })
    onUpdateRows(newRows)
    onNotify('✓ Fila duplicada')
  }

  const handleCycleGestion = (idx: number) => {
    const gestions = ['REPITE', 'RETIRO', 'K8', 'ENVIO Y RETIRO', 'SOLO ENVIO', 'PROYECTO']
    const current = String(rows[idx]['GESTIÓN'] || '').toUpperCase()
    const nextIdx = (gestions.indexOf(current) + 1) % gestions.length
    onUpdateCell(idx, 'GESTIÓN', gestions[nextIdx])
  }

  const getFilteredAndSorted = () => {
    let result = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(r => columns.some(c => (r[c] || '').toLowerCase().includes(q)))
    }
    
    // Apply column filters
    Object.entries(colFilters).forEach(([col, allowedValues]) => {
      if (allowedValues.size > 0) {
        result = result.filter(r => allowedValues.has(r[col] || ''))
      }
    })
    
    // Apply sorting
    if (sortCol) {
      result = [...result].sort((a, b) => {
        const valA = (a[sortCol.col] || '').toLowerCase()
        const valB = (b[sortCol.col] || '').toLowerCase()
        if (valA < valB) return sortCol.dir === 'asc' ? -1 : 1
        if (valA > valB) return sortCol.dir === 'asc' ? 1 : -1
        return 0
      })
    }
    
    return result
  }

  const exportToImage = async () => {
    const el = parentRef.current
    if (!el) return
    await exportElementAsImage(el, 'Dashboard_Ruteo.png', {
      backgroundColor: theme === 'light' ? '#f6f8fa' : '#0d1117',
      onNotify
    })
  }

  const exportTableCSV = () => {
    if (!rows.length) return
    const vCols = columns.filter(c => visibleCols.has(c))
    let csv = vCols.join('\t') + '\n'
    getFilteredAndSorted().forEach(r => {
      csv += vCols.map(c => String(r[c] || '').replace(/\t/g, ' ')).join('\t') + '\n'
    })
    const blob = new Blob(["\uFEFF"+csv], {type: 'text/csv;charset=utf-8;'})
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `Dashboard_Ruteo.csv`
    link.click()
    onNotify('✓ Excel exportado')
  }

  const filtered = getFilteredAndSorted()
  const vCols = columns.filter(c => visibleCols.has(c))

  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  })

  // Find duplicates
  const isoCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    const isoCol = columns.find(c => c.toLowerCase() === 'iso') || 'ISO'
    rows.forEach(r => {
      const val = (r[isoCol] || '').trim().toLowerCase()
      if (val) counts[val] = (counts[val] || 0) + 1
    })
    return counts
  }, [rows, columns])


  const uniqueValuesForCol = (col: string) => {
    const vals = new Set<string>()
    rows.forEach(r => vals.add(r[col] || ''))
    return Array.from(vals).sort((a,b) => a.localeCompare(b))
  }

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ background: TC.bg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
      {/* Stats bar */}
      {rows.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 border-b flex-wrap" style={{ borderColor: TC.borderSoft }}>
          <div className="flex items-center gap-1.5">
            <span className="text-yellow-500 font-bold font-mono text-lg">{filtered.length}</span>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: TC.textDisabled }}>ISOs</span>
          </div>
          {Object.entries(stats.gestion).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: TC.bgCard, border: `1px solid ${TC.borderSoft}` }}>
              <span className="text-yellow-500 font-bold font-mono text-sm">{v}</span>
              <span className="text-[9px] uppercase tracking-wider max-w-[70px] truncate" style={{ color: TC.textDisabled }} title={k}>{k}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search + filters */}
      <div className="flex flex-col border-b" style={{ borderColor: TC.borderSoft }}>
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="flex items-center gap-2 flex-1 max-w-[280px] relative">
            <Search size={12} color={TC.textFaint} className="absolute left-2" />
            <input
              type="text"
              className="w-full pl-7 pr-2 py-1.5 rounded text-[11px] outline-none transition-colors focus:ring-1 focus:ring-blue-500/50"
              style={{ background: TC.bgCard, color: TC.text, border: `1px solid ${TC.borderSoft}` }}
              placeholder="Buscar… (Filtra la tabla)"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowReplace(p => !p)}
            className="text-[10px] font-bold px-2 py-1.5 rounded transition-colors hover:bg-white/10 flex items-center gap-1"
            style={{ color: showReplace ? '#38bdf8' : TC.textFaint, background: showReplace ? 'rgba(56,189,248,0.1)' : 'transparent', border: `1px solid ${showReplace ? '#38bdf8' : TC.borderSoft}`, cursor: 'pointer' }}
          >
            Reemplazar
          </button>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu
              options={[
                { label: 'Exportar Imagen (Fondo Blanco)', onClick: exportToImage, Icon: <ImageIcon size={14} /> },
                { label: 'Exportar Datos (CSV)', onClick: exportTableCSV, Icon: <FileSpreadsheet size={14} /> }
              ]}
            >
              <FileDown size={14} className="mr-2" /> Exportar
            </DropdownMenu>
            <button
              onClick={() => setShowVisPanel(p => !p)}
              className="text-[10px] font-bold px-2 py-1.5 rounded transition-colors hover:bg-white/10 flex items-center gap-1"
              style={{ color: TC.textFaint, background: showVisPanel ? 'rgba(255,255,255,0.05)' : 'transparent', border: `1px solid ${TC.borderSoft}`, cursor: 'pointer' }}
            >
              <Columns3 size={12} /> Cols
            </button>
            {rows.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-[10px] font-bold px-2 py-1.5 rounded transition-colors hover:bg-red-500/10 flex items-center gap-1"
                style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer' }}
                title="Borrar todos los datos"
              >
                <Trash2 size={12} /> Limpiar
              </button>
            )}
          </div>
        </div>
        
        {showReplace && (
          <div className="flex items-center gap-3 px-4 py-2 bg-blue-500/5 border-t" style={{ borderColor: 'rgba(56,189,248,0.2)' }}>
            <span className="text-[10px] font-bold text-blue-400">Buscar y Reemplazar:</span>
            <input
              type="text"
              className="w-[180px] px-2 py-1 rounded text-[11px] outline-none"
              style={{ background: TC.bgCard, color: TC.text, border: `1px solid ${TC.borderSoft}` }}
              placeholder="Búsqueda exacta..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span className="text-[10px] opacity-50">→</span>
            <input
              type="text"
              className="w-[180px] px-2 py-1 rounded text-[11px] outline-none focus:ring-1 focus:ring-blue-500/50"
              style={{ background: TC.bgCard, color: TC.text, border: `1px solid ${TC.borderSoft}` }}
              placeholder="Reemplazar por..."
              value={replaceText}
              onChange={e => setReplaceText(e.target.value)}
            />
            <Btn size="sm" onClick={handleReplaceAll} disabled={!search}>Reemplazar Todo</Btn>
            <span className="text-[9px] opacity-60 ml-2 italic">Afecta solo columnas visibles</span>
          </div>
        )}
      </div>

      {showVisPanel && (
        <div className="flex flex-wrap gap-2.5 px-6 py-4 border-b animate-in fade-in slide-in-from-top-1" style={{ borderColor: TC.borderSoft, background: TC.bgCardAlt }}>
          <div className="w-full text-[10px] font-bold uppercase tracking-widest mb-1 opacity-40">Visibilidad de Columnas</div>
          {columns.map(c => (
            <label
              key={c}
              className="flex items-center gap-2.5 text-sm font-bold px-4 py-2 rounded-xl cursor-pointer transition-all hover:scale-105 active:scale-95"
              style={{
                background: visibleCols.has(c) ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${visibleCols.has(c) ? '#38bdf8' : TC.borderSoft}`,
                color: visibleCols.has(c) ? '#38bdf8' : TC.textFaint,
                boxShadow: visibleCols.has(c) ? '0 0 15px rgba(56, 189, 248, 0.25)' : 'none'
              }}
            >
              <input
                type="checkbox"
                className="accent-blue-500 w-4 h-4"
                checked={visibleCols.has(c)}
                onChange={() => setVisibleCols(p => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n })}
              />
              {c}
            </label>
          ))}
        </div>
      )}

      {/* Grid */}
      <div 
        ref={parentRef}
        className="flex-1 min-h-0 overflow-auto custom-scrollbar" 
        id="dashboard-table-container"
      >
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 p-10 text-center">
            <div className="w-20 h-20 rounded-[2rem] bg-blue-500/5 border-2 border-dashed flex items-center justify-center mb-2" style={{ borderColor: TC.borderSoft }}>
               <Plus size={32} className="text-blue-500/40" />
            </div>
            <div className="max-w-xs">
              <h3 className="text-lg font-bold mb-1" style={{ color: TC.text }}>No hay datos</h3>
              <p className="text-xs mb-6" style={{ color: TC.textFaint }}>Empieza creando una tabla vacía con las columnas por defecto o carga un archivo.</p>
            </div>
            <Btn variant="primary" size="lg" onClick={onCrearNueva} style={{ padding: '12px 32px' }}>
              <Plus size={16} /> Crear Tabla Nueva
            </Btn>
          </div>
        ) : (
          <div style={{ minWidth: '100%', width: 'fit-content' }}>
            <div className="sticky top-0 z-[110] flex" style={{ background: TC.bgCardAlt, borderBottom: `1px solid ${TC.borderSoft}`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
              <div className="w-8 p-1.5 flex items-center justify-center shrink-0 border-r" style={{ borderColor: TC.borderSoft }}>
                <span className="text-[10px] font-bold" style={{ color: TC.text }}>#</span>
              </div>
              {vCols.map(c => {
                const isActive = colFilters[c]?.size > 0
                return (
                  <div key={c} className="p-1.5 min-w-[120px] flex-1 border-r" style={{ borderColor: TC.borderSoft }}>
                    <div className="flex items-center justify-between mb-1.5 px-1 relative">
                      <div className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: isActive ? '#38bdf8' : TC.text }}>
                        {c}
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setActiveFilterCol(activeFilterCol === c ? null : c); setFilterSearch('') }}
                        className={`p-1 rounded transition-colors hover:bg-white/10 ${isActive ? 'text-blue-400 bg-blue-500/10' : 'text-gray-500 opacity-50 hover:opacity-100'}`}
                      >
                        <Filter size={11} />
                      </button>
                      
                      {activeFilterCol === c && (
                        <div ref={filterMenuRef} className="absolute top-full right-0 mt-1 w-48 rounded-xl shadow-xl border z-[200] overflow-hidden" style={{ background: TC.bgCard, borderColor: TC.borderSoft }}>
                          <div className="p-2 border-b flex flex-col gap-1" style={{ borderColor: TC.borderSoft }}>
                            <button 
                              onClick={() => { setSortCol({ col: c, dir: 'asc' }); setActiveFilterCol(null) }}
                              className="flex items-center gap-2 text-[10px] p-1.5 hover:bg-white/5 rounded cursor-pointer transition-colors w-full text-left"
                              style={{ color: TC.text, background: sortCol?.col === c && sortCol.dir === 'asc' ? 'rgba(56,189,248,0.1)' : 'transparent' }}
                            >
                              <ArrowDownAZ size={12} className={sortCol?.col === c && sortCol.dir === 'asc' ? 'text-blue-400' : ''} /> Ordenar A a Z
                            </button>
                            <button 
                              onClick={() => { setSortCol({ col: c, dir: 'desc' }); setActiveFilterCol(null) }}
                              className="flex items-center gap-2 text-[10px] p-1.5 hover:bg-white/5 rounded cursor-pointer transition-colors w-full text-left"
                              style={{ color: TC.text, background: sortCol?.col === c && sortCol.dir === 'desc' ? 'rgba(56,189,248,0.1)' : 'transparent' }}
                            >
                              <ArrowUpZA size={12} className={sortCol?.col === c && sortCol.dir === 'desc' ? 'text-blue-400' : ''} /> Ordenar Z a A
                            </button>
                          </div>
                          <div className="p-2 border-b" style={{ borderColor: TC.borderSoft }}>
                            <div className="relative">
                              <Search size={10} color={TC.textFaint} className="absolute left-2 top-1/2 -translate-y-1/2" />
                              <input 
                                type="text"
                                autoFocus
                                className="w-full pl-6 pr-2 py-1 text-[10px] rounded outline-none"
                                style={{ background: 'rgba(255,255,255,0.05)', color: TC.text, border: `1px solid ${TC.borderSoft}` }}
                                placeholder="Buscar valor..."
                                value={filterSearch}
                                onChange={e => setFilterSearch(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
                            <label className="flex items-center gap-2 p-1.5 hover:bg-white/5 rounded cursor-pointer transition-colors mb-1 border-b" style={{ borderColor: TC.borderSoft }}>
                              <input 
                                type="checkbox" 
                                className="accent-blue-500 w-3 h-3"
                                checked={!colFilters[c] || colFilters[c].size === 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setColFilters(p => { const n = {...p}; delete n[c]; return n })
                                  } else {
                                    setColFilters(p => ({ ...p, [c]: new Set(['__EMPTY__']) }))
                                  }
                                }}
                              />
                              <span className="text-[10px] font-bold" style={{ color: TC.text }}>(Seleccionar Todo)</span>
                            </label>
                            {uniqueValuesForCol(c)
                              .filter(v => !filterSearch || v.toLowerCase().includes(filterSearch.toLowerCase()))
                              .map(v => (
                                <label key={v} className="flex items-center gap-2 p-1.5 hover:bg-white/5 rounded cursor-pointer transition-colors">
                                  <input 
                                    type="checkbox" 
                                    className="accent-blue-500 w-3 h-3"
                                    checked={!colFilters[c] || colFilters[c].size === 0 || colFilters[c].has(v)}
                                    onChange={(e) => {
                                      setColFilters(p => {
                                        const prevSet = p[c] || new Set(uniqueValuesForCol(c))
                                        const newSet = new Set(prevSet)
                                        if (e.target.checked) newSet.add(v)
                                        else newSet.delete(v)
                                        if (newSet.size === uniqueValuesForCol(c).length) {
                                          const n = {...p}; delete n[c]; return n
                                        }
                                        return { ...p, [c]: newSet }
                                      })
                                    }}
                                  />
                                  <span className="text-[10px] truncate" style={{ color: v ? TC.text : TC.textFaint }}>{v || '(Vacío)'}</span>
                                </label>
                            ))}
                          </div>
                          {colFilters[c] && colFilters[c].size > 0 && (
                            <div className="p-1.5 border-t bg-black/10 flex justify-between" style={{ borderColor: TC.borderSoft }}>
                              <button className="text-[9px] text-gray-500 hover:text-white px-2 py-1" onClick={() => setActiveFilterCol(null)}>Cerrar</button>
                              <button className="text-[9px] text-red-400 hover:text-red-300 px-2 py-1" onClick={() => setColFilters(p => { const n = {...p}; delete n[c]; return n })}>Borrar</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div className="w-24 shrink-0" />
            </div>

            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const ri = virtualRow.index
                const r = filtered[ri]
                const isoCol = columns.find(cl => cl.toLowerCase() === 'iso') || 'ISO'
                const isRetiro = String(r['GESTIÓN'] || '').trim().toUpperCase() === 'RETIRO'
                const isDup = !isRetiro && isoCounts[(r[isoCol] || '').trim().toLowerCase()] > 1
                
                return (
                  <div
                    key={virtualRow.key}
                    className={`absolute top-0 left-0 w-full flex text-[11px] font-mono group ${isDup ? 'bg-red-500/10' : ri % 2 === 0 ? 'bg-black/5 dark:bg-white/5' : ''} hover:bg-blue-500/10 dark:hover:bg-blue-400/10`}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      borderBottom: `1px solid ${isDup ? 'rgba(239,68,68,0.3)' : TC.borderSoft}`
                    }}
                  >
                    <div className="w-8 p-1.5 text-center text-[9px] font-bold border-r shrink-0 flex items-center justify-center relative" style={{ color: isDup ? '#ef4444' : TC.textSub, borderColor: isDup ? 'rgba(239,68,68,0.3)' : TC.borderSoft }}>
                      {isDup && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500" />}
                      {ri + 1}
                    </div>

                    {vCols.map((c, ci) => {
                      let isSelected = false
                      let isMultipleSelected = false
                      if (selection.start && selection.end) {
                         const rMin = Math.min(selection.start.r, selection.end.r)
                         const rMax = Math.max(selection.start.r, selection.end.r)
                         const cMin = Math.min(selection.start.c, selection.end.c)
                         const cMax = Math.max(selection.start.c, selection.end.c)
                         isSelected = ri >= rMin && ri <= rMax && ci >= cMin && ci <= cMax
                         isMultipleSelected = rMin !== rMax || cMin !== cMax
                      }
                      
                      return (
                        <div 
                          key={c} 
                          className="flex-1 border-r min-w-[120px] relative overflow-hidden" 
                          style={{ borderColor: isDup ? 'rgba(239,68,68,0.3)' : TC.borderSoft }}
                          onMouseDown={() => handleMouseDown(ri, ci)}
                          onMouseEnter={() => handleMouseEnter(ri, ci)}
                        >
                          <div className={`absolute inset-0 pointer-events-none transition-colors duration-75 ${isSelected ? 'bg-blue-500/20 mix-blend-multiply dark:mix-blend-screen ring-1 ring-inset ring-blue-500/50' : ''}`} />
                          
                          {(!isSelected || isMultipleSelected) && search.trim() ? (
                            <div className="w-full px-2 py-2 truncate transition-all text-[11px] font-mono" style={{ color: TC.text }}>
                              {highlightText(r[c] || '', search)}
                            </div>
                          ) : (
                            <input
                              id={`cell-${ri}-${ci}`}
                              type="text"
                              className={`w-full h-full px-2 py-0 bg-transparent outline-none transition-all placeholder-opacity-20 focus:backdrop-blur-md focus:bg-white/5 dark:focus:bg-white/5 focus:ring-1 focus:ring-inset focus:ring-blue-500 ${isMultipleSelected ? 'pointer-events-none selection:bg-transparent cursor-default text-inherit' : ''} text-[11px] font-mono`}
                              style={{ color: TC.text, border: 'none' }}
                              value={r[c] || ''}
                              onChange={e => onUpdateCell(ri, c, e.target.value)}
                              onFocus={() => {
                                if (!isDragging && !isMultipleSelected) {
                                  setSelection({ start: {r: ri, c: ci}, end: {r: ri, c: ci} })
                                }
                              }}
                              autoComplete="off"
                              onKeyDown={e => {
                                const focusCell = (r_idx: number, c_idx: number) => {
                                  const el = document.getElementById(`cell-${r_idx}-${c_idx}`)
                                  if (el) {
                                      el.focus()
                                      setSelection({ start: {r: r_idx, c: c_idx}, end: {r: r_idx, c: c_idx} })
                                      return true
                                  }
                                  return false
                                }
                                if (!e.shiftKey) {
                                  if (e.key === 'ArrowUp') { e.preventDefault(); focusCell(ri - 1, ci) }
                                  else if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); focusCell(ri + 1, ci) }
                                  else if (e.key === 'ArrowLeft') {
                                    if (e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) { e.preventDefault(); focusCell(ri, ci - 1) }
                                  } else if (e.key === 'ArrowRight') {
                                    if (e.currentTarget.selectionStart === e.currentTarget.value.length && e.currentTarget.selectionEnd === e.currentTarget.value.length) { e.preventDefault(); focusCell(ri, ci + 1) }
                                  }
                                }
                              }}
                              readOnly={isMultipleSelected}
                            />
                          )}
                        </div>
                      )
                    })}

                    <div className="w-24 px-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity sticky right-0 bg-inherit z-10 border-l" style={{ borderColor: TC.borderSoft }}>
                      <button onClick={() => handleCycleGestion(ri)} className="p-1 hover:bg-blue-500/20 text-blue-400 rounded-md transition-colors" title="Cambiar Gestión"><ArrowDownAZ size={10} /></button>
                      <button onClick={() => handleDuplicateRow(ri)} className="p-1 hover:bg-green-500/20 text-green-400 rounded-md transition-colors" title="Duplicar Fila"><Plus size={10} /></button>
                      <button onClick={() => onDeleteRow(ri)} className="p-1 hover:bg-red-500/20 text-red-400 rounded-md transition-colors" title="Eliminar fila"><Trash2 size={10} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
            
            <div className="p-2 border-t" style={{ borderColor: TC.borderSoft }}>
               <button
                  onClick={onAddRow}
                  className="w-full text-left px-3 py-2 text-[11px] font-semibold transition-colors hover:bg-blue-500/5 hover:text-blue-400 flex items-center gap-1"
                  style={{ color: TC.textFaint, background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <Plus size={12} /> Nueva fila
                </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      {rows.length > 0 && (
         <div className="flex items-center gap-3 px-4 py-1.5 text-[10px]" style={{ background: TC.bgCardAlt, borderTop: `1px solid ${TC.borderSoft}`, flexShrink: 0 }}>
            <span style={{ color: TC.textSub }}>Total: <strong className="text-yellow-500 font-mono">{rows.length}</strong></span>
            <span style={{ color: TC.textDisabled }}>|</span>
            <span style={{ color: TC.textSub }}>Vista: <strong className="text-yellow-500 font-mono">{filtered.length}</strong></span>
         </div>
      )}
    </div>
  )
}
