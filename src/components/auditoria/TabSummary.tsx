import { useMemo, useState, useRef, useEffect } from 'react'
import { Search, ArrowUp, ArrowDown } from 'lucide-react'
import type { SummaryRow } from '../../types/auditoria'
import {
  PageShell, ScrollArea, Toolbar, SearchInput, FilterPills,
  Badge, Btn, Divider, EmptyState,
  C, T
} from '../../ui/DS'

interface Props {
  rows: SummaryRow[]
  onResolve: (iso: string, tipo: string, resolve: boolean) => void
  onFlag:    (iso: string, tipo: string, flag: boolean) => void
  resolvedConflicts: Set<string>
  flaggedConflicts:  Set<string>
}

const STATUS_ORDER: Record<string, number> = { pendiente: 0, alerta: 1, revisado: 2, aprobado: 2 }

function escHtml(s: string) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function exportXLSX(rows: SummaryRow[]) {
  if (!rows.length) return
  const W = (window as any).XLSX
  if (!W) { alert('XLSX no disponible'); return }
  const wb = W.utils.book_new()
  const wsData = [['ISO', 'Vehículo', 'Dirección', 'Observación', 'Detalle', 'Estado']]
  for (const r of rows) {
    wsData.push([r.iso, r.veh, r.dir || '', r.obs || '', r.detalle || '',
      r.status === 'resuelto' ? 'Resuelto' : r.status === 'aprobado' ? 'Aprobado' : r.status === 'alerta' ? 'Alerta' : 'Pendiente'])
  }
  const ws = W.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [{wch:14},{wch:20},{wch:45},{wch:20},{wch:55},{wch:14}]
  W.utils.book_append_sheet(wb, ws, 'Alertas')
  W.writeFile(wb, 'resumen_alertas.xlsx')
}

function copyToClipboard(rows: SummaryRow[]) {
  if (!rows.length) return
  const hS = 'border:1px solid #000;padding:6px 10px;font-weight:bold;background:#0051BA;color:#FFDA1A;font-family:Arial,sans-serif;font-size:11px;'
  const tS = 'border:1px solid #000;padding:5px 10px;background:#fff;color:#000;font-family:Arial,sans-serif;font-size:11px;'
  let rich = `<table style="border-collapse:collapse"><tr><th style="${hS}">ISO</th><th style="${hS}">Vehículo</th><th style="${hS}">Dirección</th><th style="${hS}">Observación</th><th style="${hS}">Detalle</th><th style="${hS}">Estado</th></tr>`
  let plain = 'ISO\tVehículo\tDirección\tObservación\tDetalle\tEstado\n'
  for (const r of rows) {
    const estado = r.status === 'resuelto' ? 'Resuelto' : r.status === 'aprobado' ? 'Aprobado' : r.status === 'alerta' ? 'Alerta' : 'Pendiente'
    rich += `<tr><td style="${tS}font-weight:700">${escHtml(r.iso)}</td><td style="${tS}">${escHtml(r.veh)}</td><td style="${tS}">${escHtml(r.dir||'')}</td><td style="${tS}">${escHtml(r.obs||'')}</td><td style="${tS}">${escHtml(r.detalle||'')}</td><td style="${tS}">${estado}</td></tr>`
    plain += `${r.iso}\t${r.veh}\t${r.dir||''}\t${r.obs||''}\t${r.detalle||''}\t${estado}\n`
  }
  rich += '</table>'
  try {
    navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([rich], { type:'text/html' }), 'text/plain': new Blob([plain], { type:'text/plain' }) })])
  } catch { navigator.clipboard.writeText(plain) }
}

type StatusFilter = 'all' | 'pendiente' | 'alerta' | 'resuelto'
type TypeFilter   = 'all' | 'geo'

export default function TabSummary({ rows, onResolve, onFlag }: Props) {
  const [search, setSearch]           = useState('')
  const [typeFilter, setTypeFilter]   = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortCol, setSortCol]         = useState<string | null>(null)
  const [sortDir, setSortDir]         = useState<1 | -1>(1)
  const [colFilters, setColFilters]   = useState<Record<string, Set<string>>>({})
  const [activePopup, setActivePopup] = useState<string | null>(null)
  const [popupSearch, setPopupSearch] = useState('')
  const [tempSelected, setTempSelected] = useState<Set<string>>(new Set())
  const popupRef = useRef<HTMLDivElement>(null)

  // Selection state
  const [selectionStart, setSelectionStart] = useState<{row: number, col: number} | null>(null)
  const [selectionEnd,   setSelectionEnd]   = useState<{row: number, col: number} | null>(null)
  const [isSelecting,    setIsSelecting]    = useState(false)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activePopup && popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setActivePopup(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [activePopup])

  const togglePopup = (col: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (activePopup === col) {
      setActivePopup(null)
    } else {
      setActivePopup(col)
      setPopupSearch('')
      const uniqueVals = Array.from(new Set(rows.map(r => String((r as any)[col] ?? ''))))
      setTempSelected(colFilters[col] ? new Set(colFilters[col]) : new Set(uniqueVals))
    }
  }

  const applyPopupFilter = (col: string, selectedVals: Set<string>) => {
    setColFilters(prev => {
      const next = { ...prev }
      if (selectedVals.size === 0 || selectedVals.size === Array.from(new Set(rows.map(r => String((r as any)[col] ?? '')))).length) {
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

  const visible = useMemo(() => {
    let r = rows.filter(row => {
      if (typeFilter !== 'all' && row.tipo !== typeFilter) return false
      if (statusFilter !== 'all') {
        const s = row.status === 'aprobado' ? 'resuelto' : row.status
        if (s !== statusFilter) return false
      }
      if (search) {
        const lo = search.toLowerCase()
        return row.iso.toLowerCase().includes(lo) || row.veh.toLowerCase().includes(lo) || (row.dir||'').toLowerCase().includes(lo)
      }
      return true
    })

    // Col filters
    Object.entries(colFilters).forEach(([col, vals]) => {
      if (vals.size > 0) {
        r = r.filter(row => vals.has(String((row as any)[col] ?? '')))
      }
    })

    if (sortCol) {
      r = [...r].sort((a, b) => {
        const va = String((a as any)[sortCol] ?? '').toLowerCase()
        const vb = String((b as any)[sortCol] ?? '').toLowerCase()
        return va < vb ? -sortDir : (va > vb ? sortDir : 0)
      })
    } else {
      r = [...r].sort((a, b) => (STATUS_ORDER[a.status]||0) - (STATUS_ORDER[b.status]||0))
    }
    return r
  }, [rows, search, sortCol, sortDir, typeFilter, statusFilter, colFilters])

  const nGeo   = rows.filter(r => r.tipo === 'geo').length
  const nPend  = rows.filter(r => r.status === 'pendiente').length

  if (!rows.length) return <EmptyState icon="📊" message="Carga un plan y ejecuta los análisis para ver el resumen aquí." />

  const th: React.CSSProperties = {
    padding: '10px 12px', textAlign: 'left', color: C.text,
    fontWeight: 800, fontSize: T.base, cursor: 'pointer', whiteSpace: 'nowrap',
    borderBottom: `2px solid ${C.border}`,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  }
  const td: React.CSSProperties = {
    padding: '6px 12px', fontSize: T.base,
    borderBottom: `1px solid ${C.borderSoft}`,
  }

  const COLS = [
    { key: 'iso',     label: 'ISO' },
    { key: 'veh',     label: 'Vehículo' },
    { key: 'dir',     label: 'Dirección' },
    { key: 'obs',     label: 'Observación' },
    { key: 'detalle', label: 'Detalle' },
    { key: 'status',  label: 'Estado' },
  ]

  const isSelected = (r: number, c: number) => {
    if (!selectionStart || !selectionEnd) return false
    const r1 = Math.min(selectionStart.row, selectionEnd.row)
    const r2 = Math.max(selectionStart.row, selectionEnd.row)
    const c1 = Math.min(selectionStart.col, selectionEnd.col)
    const c2 = Math.max(selectionStart.col, selectionEnd.col)
    return r >= r1 && r <= r2 && c >= c1 && c <= c2
  }

  const handleCopySelection = () => {
    if (!selectionStart || !selectionEnd) return
    const r1 = Math.min(selectionStart.row, selectionEnd.row)
    const r2 = Math.max(selectionStart.row, selectionEnd.row)
    const c1 = Math.min(selectionStart.col, selectionEnd.col)
    const c2 = Math.max(selectionStart.col, selectionEnd.col)

    let text = ''
    for (let i = r1; i <= r2; i++) {
        const row = visible[i]
        const rowCells: any[] = []
        for (let j = c1; j <= c2; j++) {
            const key = COLS[j].key
            let val = (row as any)[key] ?? ''
            if (key === 'status') {
              val = row.status === 'resuelto' ? 'Resuelto' : row.status === 'aprobado' ? 'Aprobado' : row.status === 'alerta' ? 'Alerta' : 'Pendiente'
            }
            rowCells.push(val)
        }
        text += rowCells.join('\t') + '\n'
    }
    navigator.clipboard.writeText(text).then(() => {
        // toast? Or just subtle UI feedback
    })
  }

  return (
    <PageShell>
      <Toolbar
        left={
          <>
            <span style={{ fontSize: T.base, color: C.textMuted }}>
              {rows.length} alertas · <span style={{ color: C.orange, fontWeight: 700 }}>{nPend} pendientes</span>
            </span>
            <Divider vertical />
            <FilterPills<TypeFilter>
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { key: 'all',   label: `Todos (${rows.length})` },
                { key: 'geo',   label: `CI (${nGeo})` },
              ]}
            />
            <Divider vertical />
            <FilterPills<StatusFilter>
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { key: 'all',       label: 'Todos' },
                { key: 'pendiente', label: '⏳ Pendiente' },
                { key: 'alerta',    label: 'Alerta' },
                {key: 'resuelto',  label: '✓ Resuelto' },
              ]}
            />
          </>
        }
        right={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar ISO, veh, dir…" width={160} />
            <Btn variant="blue" size="sm" onClick={() => copyToClipboard(visible)}>📋 Copiar</Btn>
            <Btn variant="success" size="sm" onClick={() => exportXLSX(visible)}>⬇ Excel</Btn>
            {Object.keys(colFilters).length > 0 && (
              <Btn variant="danger" size="sm" onClick={() => setColFilters({})}>✕ Quitar Filtros</Btn>
            )}
          </>
        }
      />

      <ScrollArea style={{ overflowX: 'auto', position: 'relative' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: T.base, minWidth: 700 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--ar-bg-card)' }}>
            <tr>
              <th style={{ ...th, width: 32, textAlign: 'center', cursor: 'default' }}>#</th>
              {COLS.map(col => {
                const isFiltered = colFilters[col.key] && colFilters[col.key].size > 0
                return (
                  <th key={col.key} style={{...th, position: 'relative'}}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span onClick={() => handleSort(col.key, sortDir === 1 ? -1 : 1)} style={{ flex: 1, userSelect: 'none' }}>
                        {col.label} {sortCol === col.key && <span style={{ marginLeft: 4 }}>{sortDir === 1 ? '↑' : '↓'}</span>}
                      </span>
                      <button 
                        onClick={(e) => togglePopup(col.key, e)}
                        style={{
                          background: isFiltered || activePopup === col.key ? '#3b82f6' : 'transparent',
                          color: isFiltered || activePopup === col.key ? '#fff' : C.textFaint,
                          border: 'none', borderRadius: 4, padding: 4, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >
                        <Search size={12} />
                      </button>
                    </div>

                    {activePopup === col.key && (
                      <div 
                        ref={popupRef}
                        style={{
                          position: 'absolute', top: '100%', left: 0, marginTop: 4, minWidth: 220,
                          background: 'var(--ar-bg-card)', border: `1px solid ${C.border}`,
                          borderRadius: 8, padding: 12, zIndex: 50,
                          boxShadow: '0 10px 25px rgba(0,0,0,0.5)', cursor: 'default',
                          textTransform: 'none', fontWeight: 500
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                          <Btn size="xs" variant="secondary" onClick={() => handleSort(col.key, 1)} style={{ flex: 1 }}><ArrowUp size={10}/> A-Z</Btn>
                          <Btn size="xs" variant="secondary" onClick={() => handleSort(col.key, -1)} style={{ flex: 1 }}><ArrowDown size={10}/> Z-A</Btn>
                          <Btn size="xs" variant="danger" onClick={() => handleSort(col.key, null)} style={{ padding: '0 8px' }}>✕</Btn>
                        </div>
                        <input 
                          type="text" 
                          placeholder="Buscar..." 
                          value={popupSearch}
                          onChange={e => setPopupSearch(e.target.value)}
                          style={{
                            width: '100%', padding: '6px 8px', fontSize: 11, marginBottom: 8,
                            background: 'var(--ar-bg-hover)', border: `1px solid ${C.borderSoft}`,
                            color: C.text, borderRadius: 4, outline: 'none'
                          }}
                          autoFocus
                        />
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 10 }}>
                          <button onClick={() => {
                            const uniqueVals = Array.from(new Set(rows.map(r => String((r as any)[col.key] ?? ''))))
                            setTempSelected(new Set(uniqueVals))
                          }} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0 }}>Todos</button>
                          <button onClick={() => setTempSelected(new Set())} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0 }}>Ninguno</button>
                        </div>
                        
                        <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12, fontSize: 11 }} className="custom-scrollbar">
                          {(() => {
                            const uniqueVals = Array.from(new Set(rows.map(r => String((r as any)[col.key] ?? '')))).sort()
                            const filteredVals = uniqueVals.filter(v => v.toLowerCase().includes(popupSearch.toLowerCase()))
                            
                            return filteredVals.map(v => (
                              <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
                                <input 
                                  type="checkbox" 
                                  checked={tempSelected.has(v)}
                                  onChange={(e) => {
                                    const next = new Set(tempSelected)
                                    if (e.target.checked) next.add(v)
                                    else next.delete(v)
                                    setTempSelected(next)
                                  }}
                                />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v || '(vacío)'}</span>
                              </label>
                            ))
                          })()}
                        </div>
                        
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Btn variant="blue" size="xs" onClick={() => applyPopupFilter(col.key, tempSelected)} style={{ flex: 1 }}>Aplicar</Btn>
                          <Btn variant="secondary" size="xs" onClick={() => setActivePopup(null)} style={{ flex: 1 }}>Cancelar</Btn>
                        </div>
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const isRes = r.status === 'resuelto' || r.status === 'aprobado'
              const isFlg = r.status === 'alerta'

              const tipoEl = <Badge variant="blue">C. Incorrecta</Badge>

              const riskIcon = ''

              const statusEl = (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {isRes 
                    ? <span style={{ color: C.green, fontWeight: 800, fontSize: T.base }}>✓ {r.status === 'aprobado' ? 'Aprobado' : 'Resuelto'}</span>
                    : isFlg
                      ? <span style={{ color: C.red, fontWeight: 800, fontSize: T.base }}>Alerta</span>
                      : <span style={{ color: C.orange, fontWeight: 800, fontSize: T.base }}>⏳ Pendiente</span>
                  }
                  
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    <Btn 
                      variant={isRes ? 'success' : 'secondary'} 
                      size="xs" 
                      onClick={(e) => { e.stopPropagation(); onResolve(r.iso, r.tipo, !isRes) }}
                      title={isRes ? 'Reabrir' : 'Marcar como resuelto'}
                    >
                      {isRes ? '↩' : '✓'}
                    </Btn>
                    <Btn 
                      variant={isFlg ? 'danger' : 'secondary'} 
                      size="xs" 
                      onClick={(e) => { e.stopPropagation(); onFlag(r.iso, r.tipo, !isFlg) }}
                      title={isFlg ? 'Quitar alerta' : 'Marcar Alerta'}
                    >
                      {isFlg ? '✕' : 'Alerta'}
                    </Btn>
                  </div>
                </div>
              )

              return (
                <tr key={r.iso + i}
                  onMouseUp={() => { setIsSelecting(false); if (selectionStart && selectionEnd) handleCopySelection() }}
                  style={{
                    opacity: isRes ? 0.5 : 1,
                    background: isFlg 
                      ? 'rgba(239, 68, 68, 0.08)' 
                      : (i % 2 === 0 ? 'transparent' : 'var(--ar-bg-hover)'),
                    transition: 'all 0.2s',
                    borderLeft: isFlg ? `3px solid ${C.red}` : `3px solid transparent`,
                  }}>
                  <td style={{ ...td, textAlign: 'center', color: C.text, fontWeight: 700, fontSize: T.sm, background: 'var(--ar-bg-card)', borderRight: `1px solid ${C.border}` }}>{i + 1}</td>

                  {COLS.map((col, j) => {
                    const sel = isSelected(i, j)
                    return (
                      <td key={col.key}
                        onMouseDown={() => { setSelectionStart({row: i, col: j}); setSelectionEnd({row: i, col: j}); setIsSelecting(true) }}
                        onMouseEnter={() => { if (isSelecting) setSelectionEnd({row: i, col: j}) }}
                        style={{
                          ...td,
                          color: col.key === 'iso' ? C.blue : C.text,
                          fontWeight: col.key === 'iso' ? 800 : 500,
                          background: sel ? 'rgba(56,139,253,0.15)' : 'transparent',
                          maxWidth: col.key === 'dir' || col.key === 'detalle' ? 240 : 'auto',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          userSelect: 'none',
                        }}
                        title={String((r as any)[col.key] ?? '')}
                      >
                        {col.key === 'status' ? statusEl :                          col.key === 'obs' ? (
                           <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                             {riskIcon && <span title="Riesgo Alto">{riskIcon}</span>}
                             {tipoEl}
                             <span style={{ color: C.textMuted, fontSize: T.sm }}>{r.obs}</span>
                           </div>
                         ) : String((r as any)[col.key] ?? '—')}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div style={{ textAlign: 'center', color: C.textFaint, padding: '40px 0', fontSize: T.md }}>Sin resultados</div>
        )}
      </ScrollArea>
    </PageShell>
  )
}
