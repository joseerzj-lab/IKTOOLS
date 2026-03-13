import { useMemo, useState } from 'react'
import type { SummaryRow } from '../../types/auditoria'
import {
  PageShell, ScrollArea, Toolbar, SearchInput, FilterPills,
  Badge, Btn, Divider, EmptyState,
  C, T
} from '../../ui/DS'

interface Props {
  rows: SummaryRow[]
  onResolve: (iso: string, aKey: string | null, tipo: string, resolve: boolean) => void
  onFlag:    (iso: string, aKey: string | null, tipo: string, flag: boolean) => void
  resolvedConflicts: Set<string>
  flaggedConflicts:  Set<string>
  resolvedRisk:      Set<string>
  flaggedRisk:       Set<string>
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
      r.status === 'revisado' ? 'Revisado' : r.status === 'aprobado' ? 'Aprobado' : r.status === 'alerta' ? 'Alerta' : 'Pendiente'])
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
    const estado = r.status === 'revisado' ? 'Revisado' : r.status === 'aprobado' ? 'Aprobado' : r.status === 'alerta' ? 'Alerta' : 'Pendiente'
    rich += `<tr><td style="${tS}font-weight:700">${escHtml(r.iso)}</td><td style="${tS}">${escHtml(r.veh)}</td><td style="${tS}">${escHtml(r.dir||'')}</td><td style="${tS}">${escHtml(r.obs||'')}</td><td style="${tS}">${escHtml(r.detalle||'')}</td><td style="${tS}">${estado}</td></tr>`
    plain += `${r.iso}\t${r.veh}\t${r.dir||''}\t${r.obs||''}\t${r.detalle||''}\t${estado}\n`
  }
  rich += '</table>'
  try {
    navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([rich], { type:'text/html' }), 'text/plain': new Blob([plain], { type:'text/plain' }) })])
  } catch { navigator.clipboard.writeText(plain) }
}

type StatusFilter = 'all' | 'pendiente' | 'alerta' | 'revisado'
type TypeFilter   = 'all' | 'geo' | 'fuera' | 'ambos'

export default function TabSummary({ rows }: Props) {
  const [search, setSearch]           = useState('')
  const [typeFilter, setTypeFilter]   = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortCol, setSortCol]         = useState<string | null>(null)
  const [sortDir, setSortDir]         = useState<'asc'|'desc'>('asc')

  // Selection state
  const [selectionStart, setSelectionStart] = useState<{row: number, col: number} | null>(null)
  const [selectionEnd,   setSelectionEnd]   = useState<{row: number, col: number} | null>(null)
  const [isSelecting,    setIsSelecting]    = useState(false)

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const visible = useMemo(() => {
    let r = rows.filter(row => {
      if (typeFilter !== 'all' && row.tipo !== typeFilter) return false
      if (statusFilter !== 'all') {
        const s = row.status === 'aprobado' ? 'revisado' : row.status
        if (s !== statusFilter) return false
      }
      if (search) {
        const lo = search.toLowerCase()
        return row.iso.toLowerCase().includes(lo) || row.veh.toLowerCase().includes(lo) || (row.dir||'').toLowerCase().includes(lo)
      }
      return true
    })
    if (sortCol) {
      r = [...r].sort((a, b) => {
        const va = String((a as any)[sortCol] ?? '').toLowerCase()
        const vb = String((b as any)[sortCol] ?? '').toLowerCase()
        return sortDir === 'asc' ? va.localeCompare(vb, 'es') : vb.localeCompare(va, 'es')
      })
    } else {
      r = [...r].sort((a, b) => (STATUS_ORDER[a.status]||0) - (STATUS_ORDER[b.status]||0))
    }
    return r
  }, [rows, search, sortCol, sortDir, typeFilter, statusFilter])

  const nGeo   = rows.filter(r => r.tipo === 'geo').length
  const nFuera = rows.filter(r => r.tipo === 'fuera').length
  const nAmbos = rows.filter(r => r.tipo === 'ambos').length
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
              val = row.status === 'revisado' ? 'Revisado' : row.status === 'aprobado' ? 'Aprobado' : row.status === 'alerta' ? 'Alerta' : 'Pendiente'
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
                { key: 'fuera', label: `FR (${nFuera})` },
                { key: 'ambos', label: `FR+CI (${nAmbos})` },
              ]}
            />
            <Divider vertical />
            <FilterPills<StatusFilter>
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { key: 'all',       label: 'Todos' },
                { key: 'pendiente', label: '⏳ Pendiente' },
                { key: 'alerta',    label: '⚠ Alerta' },
                { key: 'revisado',  label: '✓ Revisado' },
              ]}
            />
          </>
        }
        right={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar ISO, veh, dir…" width={160} />
            <Btn variant="blue" size="sm" onClick={() => copyToClipboard(visible)}>📋 Copiar</Btn>
            <Btn variant="success" size="sm" onClick={() => exportXLSX(visible)}>⬇ Excel</Btn>
          </>
        }
      />

      <ScrollArea style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: T.base, minWidth: 700 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--ar-bg-card)' }}>
            <tr>
              <th style={{ ...th, width: 32, textAlign: 'center', cursor: 'default' }}>#</th>
              {COLS.map(col => (
                <th key={col.key} style={th} onClick={() => toggleSort(col.key)}>
                  {col.label}
                  {sortCol === col.key && <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const isRes = r.status === 'revisado' || r.status === 'aprobado'
              const isFlg = r.status === 'alerta'

              const tipoEl = r.tipo === 'fuera'
                ? <Badge variant="medium">Fuera de Ruta</Badge>
                : r.tipo === 'ambos'
                  ? <Badge variant="high">FR + CI</Badge>
                  : <Badge variant="blue">C. Incorrecta</Badge>

              const statusEl = isRes
                ? <span style={{ color: C.green, fontWeight: 800, fontSize: T.base }}>✓ {r.status === 'aprobado' ? 'Aprobado' : 'Revisado'}</span>
                : isFlg
                  ? <span style={{ color: C.red, fontWeight: 800, fontSize: T.base }}>⚠ Alerta</span>
                  : <span style={{ color: C.orange, fontWeight: 800, fontSize: T.base }}>⏳ Pendiente</span>

              return (
                <tr key={r.iso + i}
                  onMouseUp={() => { setIsSelecting(false); if (selectionStart && selectionEnd) handleCopySelection() }}
                  style={{
                    opacity: isRes ? 0.45 : 1,
                    background: i % 2 === 0 ? 'transparent' : 'var(--ar-bg-hover)',
                    transition: 'opacity 0.2s',
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
                        {col.key === 'status' ? statusEl : 
                         col.key === 'obs' ? (
                           <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
