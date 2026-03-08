import * as XLSX from 'xlsx'
import { RouteRow, ComunaConflict, RiskResult, SummaryRow } from '../../types/auditoria'

interface Props {
  routeData: RouteRow[]
  conflicts: ComunaConflict[]
  riskResults: Record<string, RiskResult>
  summaryRows: SummaryRow[]
}

export default function TabExport({ routeData, conflicts, riskResults, summaryRows }: Props) {
  function escHtml(s: string) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function exportSummary() {
    if (!summaryRows.length) { alert('No hay datos de resumen aún. Ejecuta los análisis primero.'); return }
    const wb = XLSX.utils.book_new()
    const wsData = [['ISO', 'Vehículo', 'Dirección', 'Observación', 'Detalle', 'Estado']]
    for (const r of summaryRows) {
      wsData.push([r.iso, r.veh, r.dir || '', r.obs || '', r.detalle || '',
        r.status === 'resuelto' ? 'Resuelto' : r.status === 'aprobado' ? 'Aprobado' : r.status === 'alerta' ? 'Alerta confirmada' : 'Pendiente'])
    }
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{wch:14},{wch:20},{wch:45},{wch:20},{wch:55},{wch:14}]
    XLSX.utils.book_append_sheet(wb, ws, 'Alertas')
    XLSX.writeFile(wb, 'resumen_alertas.xlsx')
  }

  function exportConflicts() {
    if (!conflicts.length) { alert('No hay conflictos geográficos detectados.'); return }
    const wb = XLSX.utils.book_new()
    const wsData = [['ISO', 'Vehículo', 'Dirección', 'Comuna Dirección', 'Comuna Real', 'Lat', 'Lng', 'Estado']]
    for (const c of conflicts) {
      wsData.push([c.iso, c.veh, c.dir, c.comunaDireccion, c.comunaReal,
        c.lat?.toString() || '', c.lng?.toString() || '', c.status])
    }
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{wch:14},{wch:20},{wch:45},{wch:22},{wch:22},{wch:10},{wch:10},{wch:12}]
    XLSX.utils.book_append_sheet(wb, ws, 'Conflictos')
    XLSX.writeFile(wb, 'conflictos_geo.xlsx')
  }

  function exportAnomalies() {
    const allRows: any[] = []
    for (const [veh, vdata] of Object.entries(riskResults)) {
      for (const r of vdata.results) {
        if (r.riskLevel === 'low') continue
        allRows.push({
          Vehículo: veh,
          Comuna: r.comuna,
          ISOs: r.count,
          'Nivel Riesgo': r.riskLevel === 'high' ? 'Alta' : 'Moderada',
          'Score (%)': Math.round(r.riskScore * 100),
        })
      }
    }
    if (!allRows.length) { alert('No hay anomalías detectadas.'); return }
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(allRows)
    ws['!cols'] = [{wch:20},{wch:22},{wch:8},{wch:14},{wch:10}]
    XLSX.utils.book_append_sheet(wb, ws, 'Anomalias')
    XLSX.writeFile(wb, 'anomalias_riesgo.xlsx')
  }

  function copySummaryToClipboard() {
    if (!summaryRows.length) return
    const hdS = 'border:1px solid #000;padding:6px 10px;font-weight:bold;background:#0051BA;color:#FFDA1A;font-family:Arial,sans-serif;font-size:11px;'
    const tdS = 'border:1px solid #000;padding:5px 10px;background:#fff;color:#000;font-family:Arial,sans-serif;font-size:11px;'
    let rich = `<table style="border-collapse:collapse"><tr><th style="${hdS}">ISO</th><th style="${hdS}">Vehículo</th><th style="${hdS}">Dirección</th><th style="${hdS}">Observación</th><th style="${hdS}">Detalle</th><th style="${hdS}">Estado</th></tr>`
    let plain = 'ISO\tVehículo\tDirección\tObservación\tDetalle\tEstado\n'
    for (const r of summaryRows) {
      const estado = r.status === 'resuelto' ? 'Resuelto' : r.status === 'aprobado' ? 'Aprobado' : r.status === 'alerta' ? 'Alerta' : 'Pendiente'
      rich += `<tr><td style="${tdS}font-weight:700">${escHtml(r.iso)}</td><td style="${tdS}">${escHtml(r.veh)}</td><td style="${tdS}">${escHtml(r.dir||'')}</td><td style="${tdS}">${escHtml(r.obs||'')}</td><td style="${tdS}">${escHtml(r.detalle||'')}</td><td style="${tdS}">${estado}</td></tr>`
      plain += `${r.iso}\t${r.veh}\t${r.dir||''}\t${r.obs||''}\t${r.detalle||''}\t${estado}\n`
    }
    rich += '</table>'
    try {
      navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([rich], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })])
    } catch {
      navigator.clipboard.writeText(plain)
    }
  }

  const cards = [
    {
      icon: '📊', title: 'Resumen Alertas', desc: `${summaryRows.length} alertas · ${summaryRows.filter(r => r.status === 'pendiente').length} pendientes`,
      actions: [
        { label: '⬇ Excel', fn: exportSummary, color: 'green' },
        { label: '📋 Copiar', fn: copySummaryToClipboard, color: 'blue' },
      ],
      disabled: !summaryRows.length,
    },
    {
      icon: '📍', title: 'Conflictos Geográficos', desc: `${conflicts.length} conflictos de comuna`,
      actions: [{ label: '⬇ Excel', fn: exportConflicts, color: 'green' }],
      disabled: !conflicts.length,
    },
    {
      icon: '⚠️', title: 'Anomalías de Ruta', desc: `${Object.keys(riskResults).length} vehículos analizados`,
      actions: [{ label: '⬇ Excel', fn: exportAnomalies, color: 'green' }],
      disabled: !Object.keys(riskResults).length,
    },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-8">
      <h2 className="text-sm font-semibold text-gray-300 mb-6">Exportar resultados</h2>
      <div className="grid grid-cols-1 gap-4 max-w-lg">
        {cards.map(card => (
          <div
            key={card.title}
            className="rounded-xl border p-4 flex items-center gap-4"
            style={{
              background: card.disabled ? 'rgba(22,27,34,0.4)' : 'rgba(22,27,34,0.8)',
              borderColor: card.disabled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.10)',
              opacity: card.disabled ? 0.5 : 1,
            }}
          >
            <span className="text-3xl">{card.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-200">{card.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{card.desc}</div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {card.actions.map(a => (
                <button
                  key={a.label}
                  onClick={a.fn}
                  disabled={card.disabled}
                  className={`text-xs px-3 py-1.5 rounded transition-colors disabled:cursor-not-allowed
                    ${a.color === 'green'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                      : 'bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20'}`}
                >{a.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Data summary */}
      <div className="mt-8 grid grid-cols-2 gap-3 max-w-sm">
        {[
          { label: 'ISOs cargadas', val: routeData.length, color: '#7bb8ff' },
          { label: 'Con coordenadas', val: routeData.filter(r => r.lat !== null).length, color: '#34d399' },
          { label: 'Conflictos geo', val: conflicts.length, color: '#ff7b72' },
          { label: 'Vehículos analizados', val: Object.keys(riskResults).length, color: '#a371f7' },
        ].map(s => (
          <div key={s.label} className="rounded-lg p-3 border" style={{ background: 'rgba(22,27,34,0.5)', borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.val}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
