import { useState } from 'react'
import { Upload } from 'lucide-react'
import type { Row } from './types'
import { Card, Btn } from '../../ui/DS'
import { useTheme, getThemeColors } from '../../context/ThemeContext'
import * as XLSX from 'xlsx'

// Helpers for parsing
function readXlsx(file: File): Promise<any[]> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' })
        res(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }))
      } catch (err) {
        rej(err)
      }
    }
    r.onerror = rej
    r.readAsArrayBuffer(file)
  })
}

function detectSep(line: string) {
  const s = (line.match(/;/g) || []).length
  const c = (line.match(/,/g) || []).length
  const t = (line.match(/\t/g) || []).length
  if (t > s && t > c) return '\t'
  return s > c ? ';' : ','
}

function parseRow(line: string, sep: string) {
  const r: string[] = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') inQ = !inQ
    else if (ch === sep && !inQ) { r.push(cur.trim().replace(/^"|"$/g, '')); cur = '' }
    else cur += ch
  }
  r.push(cur.trim().replace(/^"|"$/g, ''))
  return r
}

interface Props {
  columns: string[]
  rows: Row[]
  onMergeRows: (newCols: string[], newRows: Row[], source: string) => void
  onLoadJSON: (cols: string[], rows: Row[]) => void
  // Lost functionality support
  onPVPlanUpload: (file: File) => void
  onProjectsUpload: (file: File) => void
  pvPlanName: string
  projectsName: string
  TC: any
}

export default function TabLoad({ 
  columns, 
  rows, 
  onMergeRows, 
  onLoadJSON,
  onPVPlanUpload,
  onProjectsUpload,
  pvPlanName,
  projectsName
}: Props) {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)

  const [pasteRepites, setPasteRepites] = useState('')
  const [pasteRetiros, setPasteRetiros] = useState('')
  const [pasteK8, setPasteK8] = useState('')

  const procesarDesdeTexto = (text: string, source: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) return
    const sep = detectSep(lines[0])
    const headers = parseRow(lines[0], sep)
    const data = lines.slice(1).map(line => {
      const vals = parseRow(line, sep)
      const obj: Row = {}
      headers.forEach((h, i) => obj[h] = vals[i] || '')
      obj['_SOURCE'] = source
      return obj
    })
    onMergeRows(headers, data, source)
  }

  const procesarRepites = () => { if (!pasteRepites.trim()) return; procesarDesdeTexto(pasteRepites, 'Repites'); setPasteRepites('') }
  const procesarRetiros = () => { if (!pasteRetiros.trim()) return; procesarDesdeTexto(pasteRetiros, 'Retiros'); setPasteRetiros('') }
  const procesarK8 = () => {
    if (!pasteK8.trim()) return
    const isos = pasteK8.split(/[\n\r,;\t ]+/).map(s => s.trim()).filter(Boolean)
    const isoCol = columns.find(c => c.toLowerCase() === 'iso') || 'ISO'
    const newCols = columns.includes(isoCol) ? columns : [...columns, isoCol]
    const newRows = isos.map(iso => ({ [isoCol]: iso, _SOURCE: 'K8' } as Row))
    onMergeRows(newCols, newRows, 'K8')
    setPasteK8('')
  }

  const handleLoadJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        onLoadJSON(data.columns || [], data.rows || [])
      } catch {}
    }
    reader.readAsText(file); e.target.value = ''
  }

  const handleLoadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const data = await readXlsx(file)
    if (!data.length) return
    const cols = Object.keys(data[0]).filter(k => !k.startsWith('__EMPTY'))
    onMergeRows(cols, data.map(r => {
      const o: Row = {}
      cols.forEach(c => o[c] = String(r[c] || ''))
      return o
    }), file.name)
    e.target.value = ''
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6" style={{ background: TC.bg }}>
      <div className="flex gap-6">
        <Card style={{ flex: 1, padding: 16 }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: TC.textSub }}>
            <span className="text-lg">📥</span> Archivos
          </div>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col items-center justify-center p-6 rounded border-2 border-dashed cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: TC.borderSoft, color: TC.textFaint }}>
              <Upload size={24} className="mb-2" />
              <span className="text-xs font-bold">Subir Excel (.xlsx)</span>
              <span className="text-[10px] mt-1 text-center max-w-[200px]">Carga planillas desde tu computadora</span>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleLoadExcel} />
            </label>

            <label className="flex flex-col items-center justify-center p-6 rounded border-2 border-dashed cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: TC.borderSoft, color: TC.textFaint }}>
              <span className="text-2xl mb-2">💾</span>
              <span className="text-xs font-bold">Cargar Sesión (.json)</span>
              <span className="text-[10px] mt-1 text-center max-w-[200px]">Restaura una sesión previamente guardada</span>
              <input type="file" accept=".json" className="hidden" onChange={handleLoadJSON} />
            </label>

            <div className="h-px w-full my-2" style={{ background: TC.borderSoft }}></div>

            <label className="flex items-center gap-2 p-3 rounded border-2 border-dashed cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: TC.borderSoft, color: TC.textFaint }}>
              <span className="text-lg">🔍</span>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold">Plan PV (Duplicados)</span>
                <span className="text-[9px] truncate max-w-[150px]">{pvPlanName || 'Subir .xlsx/.csv…'}</span>
              </div>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && onPVPlanUpload(e.target.files[0])} />
            </label>

            <label className="flex items-center gap-2 p-3 rounded border-2 border-dashed cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: TC.borderSoft, color: TC.textFaint }}>
              <span className="text-lg">🏗️</span>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold">Proyectos Leslie</span>
                <span className="text-[9px] truncate max-w-[150px]">{projectsName || 'Subir .xlsx/.csv…'}</span>
              </div>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && onProjectsUpload(e.target.files[0])} />
            </label>
          </div>
        </Card>

        <Card style={{ flex: 2, padding: 16 }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: TC.textSub }}>
            <span className="text-lg">🧩</span> Módulos Pega/Copia
          </div>
          <div className="text-[11px] mb-4" style={{ color: TC.textFaint }}>
            Pega directamente desde Excel (Ctrl+C, Ctrl+V) en los recuadros de abajo.
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[{ label: '📦 Repites', state: pasteRepites, set: setPasteRepites, fn: procesarRepites },
              { label: '↩️ Retiros', state: pasteRetiros, set: setPasteRetiros, fn: procesarRetiros }].map(m => (
              <div key={m.label} className="flex flex-col gap-1">
                <div className="text-[11px] font-bold" style={{ color: TC.textSub }}>{m.label}</div>
                <textarea
                  className="w-full h-24 p-2 rounded text-[10px] font-mono resize-none transition-colors"
                  style={{ background: TC.bgCardAlt, color: TC.text, border: `1px solid ${TC.borderSoft}` }}
                  placeholder="Pega aquí (con cabeceras)…"
                  value={m.state}
                  onChange={e => m.set(e.target.value)}
                  onPaste={() => setTimeout(m.fn, 60)}
                />
                <Btn onClick={m.fn} size="sm" style={{ width: '100%', marginTop: 4 }}>Procesar</Btn>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t pt-4" style={{ borderColor: TC.borderSoft }}>
            <div className="flex flex-col gap-1 max-w-[50%]">
              <div className="text-[11px] font-bold" style={{ color: TC.textSub }}>📌 K8 (Lista de ISOs)</div>
              <textarea
                className="w-full h-24 p-2 rounded text-[10px] font-mono resize-none transition-colors"
                style={{ background: TC.bgCardAlt, color: TC.text, border: `1px solid ${TC.borderSoft}` }}
                placeholder="Pega una lista de ISOs separada por saltos de línea…"
                value={pasteK8}
                onChange={e => setPasteK8(e.target.value)}
                onPaste={() => setTimeout(procesarK8, 60)}
              />
              <Btn onClick={procesarK8} size="sm" style={{ width: '100%', marginTop: 4 }}>Procesar K8</Btn>
            </div>
          </div>
        </Card>
      </div>
      
      {rows.length > 0 && (
         <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(56,189,248,.1)', border: `1px solid rgba(56,189,248,.3)` }}>
            <span style={{ color: TC.textSub, fontSize: 13 }}>
                Actualmente tienes <strong>{rows.length}</strong> datos cargados en la sesión. 
                Ve al <strong style={{ color: '#38bdf8' }}>Dashboard</strong> para gestionarlos.
            </span>
         </div>
      )}
    </div>
  )
}
