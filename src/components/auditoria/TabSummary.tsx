import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { SummaryRow } from '../../types/auditoria'

interface Props {
  rows: SummaryRow[]
  onResolve: (iso: string, aKey: string | null, tipo: string, resolve: boolean) => void
  onFlag: (iso: string, aKey: string | null, tipo: string, flag: boolean) => void
  resolvedConflicts: Set<string>
  flaggedConflicts: Set<string>
  resolvedRisk: Set<string>
  flaggedRisk: Set<string>
}

function escHtml(s: string) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const STATUS_ORDER: Record<string, number> = { pendiente: 0, alerta: 1, resuelto: 2, aprobado: 2 }

export default function TabSummary({
  rows, onResolve, onFlag,
  resolvedConflicts, flaggedConflicts, resolvedRisk, flaggedRisk,
}: Props) {
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const visible = useMemo(() => {
    let r = search
      ? rows.filter(row =>
          row.iso.toLowerCase().includes(search.toLowerCase()) ||
          row.veh.toLowerCase().includes(search.toLowerCase())
        )
      : rows

    if (sortCol) {
      r = [...r].sort((a, b) => {
        const va = String((a as any)[sortCol] ?? '').toLowerCase()
        const vb = String((b as any)[sortCol] ?? '').toLowerCase()
        return sortDir === 'asc' ? va.localeCompare(vb, 'es') : vb.localeCompare(va, 'es')
      })
    } else {
      r = [...r].sort((a, b) => (STATUS_ORDER[a.status] || 0) - (STATUS_ORDER[b.status] || 0))
    }

    return r
  }, [rows, search, sortCol, sortDir])

  const pending = rows.filter(r => r.status === 'pendiente').length

  function exportXLSX() {
    if (!visible.length) return
    const wb = XLSX.utils.book_new()
    const wsData = [['ISO', 'Vehículo', 'Dirección', 'Observación', 'Detalle', 'Estado']]
    for (const r of visible) {
      wsData.push([r.iso, r.veh, r.dir || '', r.obs || '', r.detalle || '',
        r.status === 'resuelto' ? 'Resuelto' : r.status === 'aprobado' ? 'Aprobado' : r.status === 'alerta' ? 'Alerta' : 'Pendiente'])
    }
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{wch:14},{wch:20},{wch:45},{wch:20},{wch:55},{wch:14}]
    XLSX.utils.book_append_sheet(wb, ws, 'Alertas')
    XLSX.writeFile(wb, 'resumen_alertas.xlsx')
  }

  function copyToClipboard() {
    const hdS = 'border:1px solid #000;padding:6px 10px;font-weight:bold;background:#0051BA;color:#FFDA1A;font-family:Arial,sans-serif;font-size:11px;'
    const tdS = 'border:1px solid #000;padding:5px 10px;background:#fff;color:#000;font-family:Arial,sans-serif;font-size:11px;'
    let rich = `<table style="border-collapse:collapse"><tr><th style="${hdS}">ISO</th><th style="${hdS}">Vehículo</th><th style="${hdS}">Dirección</th><th style="${hdS}">Observación</th><th style="${hdS}">Detalle</th><th style="${hdS}">Estado</th></tr>`
    let plain = 'ISO\tVehículo\tDirección\tObservación\tDetalle\tEstado\n'
    for (const r of visible) {
      const estado = r.status === 'resuelto' ? 'Resuelto' : r.status === 'aprobado' ? 'Aprobado' : r.status === 'alerta' ? 'Alerta' : 'Pendiente'
      rich += `<tr><td style="${tdS}font-weight:700">${escHtml(r.iso)}</td><td style="${tdS}">${escHtml(r.veh)}</td><td style="${tdS}">${escHtml(r.dir||'')}</td><td style="${tdS}">${escHtml(r.obs||'')}</td><td style="${tdS}">${escHtml(r.detalle||'')}</td><td style="${tdS}">${estado}</td></tr>`
      plain += `${r.iso}\t${r.veh}\t${r.dir||''}\t${r.obs||''}\t${r.detalle||''}\t${estado}\n`
    }
    rich += '</table>'
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([rich], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })
      navigator.clipboard.write([item])
    } catch {
      navigator.clipboard.writeText(plain)
    }
  }

  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
        <div className="text-4xl">📊</div>
        <div className="text-sm">Ejecuta el análisis de anomalías y/o análisis geo para ver el resumen aquí.</div>
      </div>
    )
  }

  const COLS = [
    { key: 'iso', label: 'ISO', w: 'w-28' },
    { key: 'veh', label: 'Vehículo', w: 'w-36' },
    { key: 'dir', label: 'Dirección', w: '' },
    { key: 'obs', label: 'Observación', w: 'w-36' },
    { key: 'detalle', label: 'Detalle', w: 'w-48' },
    { key: 'status', label: 'Estado', w: 'w-24' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0 border-b border-white/5">
        <span className="text-xs text-gray-400">{rows.length} alertas · <span className="text-orange-300">{pending} pendientes</span></span>
        <div className="flex-1" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar ISO o vehículo…"
          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-gray-200
                     placeholder-gray-600 focus:outline-none focus:border-blue-500/50 w-44"
        />
        <button
          onClick={copyToClipboard}
          className="text-xs px-3 py-1.5 rounded bg-blue-500/15 text-blue-300
                     border border-blue-500/25 hover:bg-blue-500/25 transition-colors"
        >📋 Copiar</button>
        <button
          onClick={exportXLSX}
          className="text-xs px-3 py-1.5 rounded bg-green-500/10 text-green-400
                     border border-green-500/20 hover:bg-green-500/20 transition-colors"
        >⬇ Excel</button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs min-w-[700px]">
          <thead className="sticky top-0 z-10" style={{ background: 'rgba(22,27,34,0.95)' }}>
            <tr className="border-b border-white/10">
              <th className="text-left px-3 py-2 text-gray-500 font-medium w-8">#</th>
              {COLS.map(col => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className={`text-left px-3 py-2 text-gray-500 font-medium cursor-pointer hover:text-gray-300 transition-colors ${col.w}`}
                >
                  {col.label}
                  {sortCol === col.key && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
              ))}
              <th className="px-3 py-2 w-20 text-gray-500 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const isResolved = r.status === 'resuelto' || r.status === 'aprobado'
              const tipoLabel = r.tipo === 'fuera'
                ? <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/25">Fuera de Ruta</span>
                : r.tipo === 'ambos'
                  ? <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/25">FR + CI</span>
                  : <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25">C. Incorrecta</span>

              const statusEl = r.status === 'resuelto' || r.status === 'aprobado'
                ? <span className="text-green-400 font-bold">✓ {r.status === 'aprobado' ? 'Aprobado' : 'Resuelto'}</span>
                : r.status === 'alerta'
                  ? <span className="text-red-400 font-bold">⚠ Alerta</span>
                  : <span className="text-orange-300 font-bold">⏳ Pendiente</span>

              return (
                <tr
                  key={r.iso + i}
                  className={`border-b border-white/3 hover:bg-white/2 transition-colors ${isResolved ? 'opacity-40' : ''}`}
                >
                  <td className="px-3 py-2 text-gray-600 text-center">{i + 1}</td>
                  <td className="px-3 py-2 font-bold text-gray-100">
                    <button
                      onClick={() => navigator.clipboard.writeText(r.iso)}
                      className="hover:text-blue-300 transition-colors"
                      title="Copiar ISO"
                    >{r.iso}</button>
                  </td>
                  <td className="px-3 py-2 text-gray-400 max-w-[140px] truncate" title={r.veh}>{r.veh}</td>
                  <td className="px-3 py-2 text-gray-400 max-w-[200px] truncate" title={r.dir}>{r.dir || '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {tipoLabel}
                      <span className="text-gray-500">{r.obs}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-500 max-w-[190px] truncate" title={r.detalle}>{r.detalle || '—'}</td>
                  <td className="px-3 py-2 text-[10px]">{statusEl}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onResolve(r.iso, r.aKey, r.tipo, !isResolved)}
                        className="text-[9px] px-1.5 py-1 rounded bg-green-500/10 text-green-400
                                   border border-green-500/20 hover:bg-green-500/20 transition-colors"
                        title={isResolved ? 'Reabrir' : 'Resolver'}
                      >{isResolved ? '↩' : '✓'}</button>
                      <button
                        onClick={() => onFlag(r.iso, r.aKey, r.tipo, r.status !== 'alerta')}
                        className="text-[9px] px-1.5 py-1 rounded transition-colors"
                        style={{
                          background: r.status === 'alerta' ? 'rgba(248,81,73,.25)' : 'rgba(248,81,73,.08)',
                          color: '#ff7b72',
                          border: `1px solid ${r.status === 'alerta' ? 'rgba(248,81,73,.55)' : 'rgba(248,81,73,.22)'}`,
                        }}
                      >{r.status === 'alerta' ? '✕' : '⚠'}</button>
                      <button
                        onClick={() => navigator.clipboard.writeText(r.iso + (r.dir ? '\t' + r.dir : ''))}
                        className="text-[9px] px-1.5 py-1 rounded bg-white/5 text-gray-400
                                   border border-white/10 hover:bg-white/10 transition-colors"
                      >📋</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="text-center text-gray-500 py-10 text-sm">Sin resultados para "{search}"</div>
        )}
      </div>
    </div>
  )
}
