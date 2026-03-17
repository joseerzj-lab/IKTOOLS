import { useState } from 'react'
import { Download, FileJson, Copy, CheckCircle2 } from 'lucide-react'
import type { Row, Stats } from './types'
import { Card, Btn } from '../../ui/DS'
import { useTheme, getThemeColors } from '../../context/ThemeContext'
import * as XLSX from 'xlsx'

interface Props {
  rows: Row[]
  stats: Stats
  onExportJSON: () => void
}

export default function TabExport({ rows, stats, onExportJSON }: Props) {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)
  
  const [copiedId, setCopiedId] = useState<string | null>(null)
  
  const handleExportXLSX = () => {
    if (!rows.length) return
    const sortedRows = [...rows].sort((a, b) => {
      const valA = String(a.DESTINO || '').toUpperCase()
      const valB = String(b.DESTINO || '').toUpperCase()
      return valA.localeCompare(valB)
    })
    const ws = XLSX.utils.json_to_sheet(sortedRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    XLSX.writeFile(wb, `Ruteo_Postventa_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const buildHTMLTable = (data: any[], cols: string[]) => {
    const tableStyle = "border-collapse:collapse;font-family:Aptos,Calibri,Arial,sans-serif;font-size:12pt;width:100%;"
    const thStyle = "border:1px solid black;padding:6px 10px;font-weight:bold;text-align:center;background:#0051BA;color:#FFDA1A;"
    const tdStyle = "border:1px solid black;padding:5px 10px;text-align:center;color:#000000;background:#ffffff;"

    let html = `<table style="${tableStyle}"><thead><tr>`
    cols.forEach(c => { html += `<th style="${thStyle}">${c}</th>` })
    html += `</tr></thead><tbody>`
    
    data.forEach(r => {
      html += `<tr>`
      cols.forEach(c => {
        html += `<td style="${tdStyle}">${r[c] || ''}</td>`
      })
      html += `</tr>`
    })
    
    html += `</tbody></table>`
    return html
  }

  const copyAsHTML = (html: string, plainText: string, id: string) => {
    const container = document.createElement('div')
    container.innerHTML = html
    container.style.position = 'fixed'
    container.style.left = '-9999px'
    document.body.appendChild(container)

    const blobHTML = new Blob([html], { type: 'text/html' })
    const blobText = new Blob([plainText], { type: 'text/plain' })
    
    const data = [new ClipboardItem({
      'text/html': blobHTML,
      'text/plain': blobText
    })]

    navigator.clipboard.write(data).then(() => {
      document.body.removeChild(container)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }).catch(_err => {
      const range = document.createRange()
      range.selectNodeContents(container)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      document.execCommand('copy')
      selection?.removeAllRanges()
      document.body.removeChild(container)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const handleCopyTable = () => {
    if (!rows.length) return
    const cols = Object.keys(rows[0] || {}).filter(k => k !== '_SOURCE' && k !== 'Commerce' && !k.startsWith('_'))
    const sortedRows = [...rows].sort((a, b) => {
      const valA = String(a.DESTINO || '').toUpperCase()
      const valB = String(b.DESTINO || '').toUpperCase()
      return valA.localeCompare(valB)
    })
    const html = buildHTMLTable(sortedRows, cols)
    const plain = sortedRows.map(r => cols.map(c => r[c] || '').join('\t')).join('\n')
    copyAsHTML(html, plain, 'table')
  }

  const handleCopyISOs = () => {
    const isos = rows.map(r => String(r.ISO || '')).filter(Boolean)
    const text = isos.join(', ')
    navigator.clipboard.writeText(text)
    setCopiedId('isos')
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center gap-8" style={{ background: TC.bg }}>
      <div className="max-w-4xl w-full flex flex-col md:flex-row gap-6">
        
        {/* COLUMNA IZQUIERDA: Exportar y Copiar Tabla */}
        <div className="flex-1 flex flex-col gap-6">
           <Card style={{ padding: 24, textAlign: 'center' }}>
              <div className="text-4xl mb-4">⬇️</div>
              <h2 className="text-xl font-bold mb-2" style={{ color: TC.text }}>Exportar Archivo</h2>
              <p className="text-[11px] mb-6" style={{ color: TC.textFaint }}>Descarga la sesión actual para usarla en Excel o como JSON de respaldo.</p>
              
              <div className="flex gap-3 justify-center text-sm">
                 <Btn variant="primary" onClick={handleExportXLSX} disabled={!rows.length}>
                    <Download size={14} /> Excel (.xlsx)
                 </Btn>
                 <Btn onClick={onExportJSON} disabled={!rows.length}>
                    <FileJson size={14} /> JSON
                 </Btn>
              </div>
           </Card>

           <Card style={{ padding: 24 }}>
              <h3 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: TC.text }}>📋 Copiar Tabla (Outlook)</h3>
              <p className="text-[11px] mb-4" style={{ color: TC.textFaint }}>Copia la vista actual (todas las columnas principales) con formato para pegar en un correo.</p>
              
              <Btn variant="primary" onClick={handleCopyTable} disabled={!rows.length} style={{ width: '100%', justifyContent: 'center' }}>
                 {copiedId === 'table' ? <><CheckCircle2 size={14} className="text-green-500" /> ¡Copiado!</> : <><Copy size={14} /> Copiar Tabla HTML</>}
              </Btn>
           </Card>
        </div>

        {/* COLUMNA DERECHA: ISOs de la vista y Resumen Gestión */}
        <div className="flex-1 flex flex-col gap-6">
           <Card style={{ padding: 24, flex: 1 }}>
              <div className="flex items-center justify-between mb-2">
                 <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: TC.text }}>📝 ISOs Actuales</h3>
                 <Btn size="sm" onClick={handleCopyISOs} disabled={!rows.length}>
                    {copiedId === 'isos' ? <><CheckCircle2 size={12} className="text-green-500" /> Copiadas</> : <><Copy size={12} /> Copiar ISOs</>}
                 </Btn>
              </div>
              <textarea 
                 className="w-full h-24 p-2 rounded text-[10px] font-mono resize-none transition-colors border outline-none custom-scrollbar"
                 style={{ background: TC.bgCardAlt, color: TC.textSub, borderColor: TC.borderSoft }}
                 readOnly 
                 value={rows.map(r => String(r.ISO || '')).filter(Boolean).join(', ')}
                 placeholder="Aquí aparecerán las ISOs separadas por coma..."
              />

              <h3 className="text-sm font-bold mb-2 mt-6 flex items-center gap-2" style={{ color: TC.text }}>📊 Resumen por Gestión</h3>
              <div className="text-[11px] font-mono leading-relaxed custom-scrollbar max-h-32 overflow-y-auto" style={{ color: TC.textSub }}>
                 {Object.entries(stats.gestion).length === 0 ? (
                    <span className="opacity-50 italic">Sin datos</span>
                 ) : (
                    Object.entries(stats.gestion).map(([g, count]) => (
                       <div key={g} className="flex justify-between border-b border-dashed py-1" style={{ borderColor: TC.borderSoft }}>
                          <span>{g}</span>
                          <span className="font-bold text-blue-400">{count}</span>
                       </div>
                    ))
                 )}
              </div>
           </Card>
        </div>

      </div>
    </div>
  )
}
