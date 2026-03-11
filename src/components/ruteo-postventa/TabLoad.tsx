import { useState } from 'react'
import type { Row } from './types'
import { Card, Btn } from '../../ui/DS'


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
  onConversionUpload: (file: File) => void
  onDestinoCross: (planFile: File, convFile: File) => void
  onOriginCross: (file: File) => void
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
  onConversionUpload,
  onDestinoCross,
  onOriginCross,
  pvPlanName,
  projectsName,
  TC
}: Props) {


  const [pasteRepites, setPasteRepites] = useState('')
  const [pasteRetiros, setPasteRetiros] = useState('')
  const [pasteK8, setPasteK8] = useState('')
  const [pasteEyR, setPasteEyR] = useState('')
  const [eyRAsos, setEyRAsos] = useState('')
  const [planCrossFile, setPlanCrossFile] = useState<File | null>(null)
  const [convCrossFile, setConvCrossFile] = useState<File | null>(null)

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
  const procesarEyRPaso1 = () => {
    if (!pasteEyR.trim()) return
    const lines = pasteEyR.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) return
    const sep = detectSep(lines[0])
    const headers = parseRow(lines[0], sep)
    
    // Buscar la columna de ISO/ASO
    const colIso = headers.find(h => h.toUpperCase().includes("ASO GENERADA") || h.toUpperCase().includes("ASO") || h.toUpperCase().includes("ISO"))
    if (!colIso) return alert("Falta columna ASO/ISO")

    const isosGeneradas: string[] = []
    const newRows: Row[] = []
    
    lines.slice(1).forEach(line => {
      const vals = parseRow(line, sep)
      const isoIdx = headers.indexOf(colIso)
      const isoVal = vals[isoIdx]
      if (isoVal) {
        newRows.push({
          ISO: isoVal,
          'GESTIÓN': 'ENVIO Y RETIRO',
          ORIGEN: 'PENDIENTE',
          DESTINO: '',
          VEH: '',
          'CORREO REPITES': '',
          COMENTARIO_RAW: '',
          _SOURCE: 'EyR_Paso1'
        })
        isosGeneradas.push(isoVal)
      }
    })
    
    if (newRows.length) {
      onMergeRows(['ISO','GESTIÓN','ORIGEN','DESTINO','VEH','CORREO REPITES','COMENTARIO_RAW'], newRows, 'EyR Paso 1')
      setEyRAsos(isosGeneradas.join(','))
      setPasteEyR('')
    }
  }

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

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-6" style={{ background: TC.bg }}>
      
      <div className="flex gap-6 flex-col md:flex-row mb-6">
        
        {/* SECCIÓN 1: CARGAS DE SESIÓN Y PROYECTOS */}
        <div className="flex flex-col gap-6 flex-1">
          <Card style={{ padding: 16 }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: TC.textSub }}>
              <span className="text-lg">💾</span> Sesión de Trabajo
            </div>
            <label className="flex flex-col items-center justify-center p-6 rounded border-2 border-dashed cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: TC.borderSoft, color: TC.textFaint }}>
              <span className="text-2xl mb-2">📂</span>
              <span className="text-xs font-bold">Cargar Sesión Guardada (.json)</span>
              <span className="text-[10px] mt-1 text-center max-w-[200px]">Restaura tu progreso desde un archivo local</span>
              <input type="file" accept=".json" className="hidden" onChange={handleLoadJSON} />
            </label>
          </Card>

          <Card style={{ padding: 16 }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: TC.textSub }}>
              <span className="text-lg">🏗️</span> Proyectos
            </div>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 p-3 rounded border-2 border-dashed cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: TC.borderSoft, color: TC.textFaint }}>
                <span className="text-2xl">🏗️</span>
                <div className="flex flex-col overflow-hidden flex-1">
                  <span className="text-xs font-bold text-purple-400">Proyectos Leslie</span>
                  <span className="text-[10px] truncate" title={projectsName}>{projectsName || 'Cargar .xlsx de Proyectos...'}</span>
                </div>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && onProjectsUpload(e.target.files[0])} />
              </label>
            </div>
          </Card>
        </div>

        {/* SECCIÓN 2: MÓDULO DUPLICADOS */}
        <div className="flex-1">
          <Card style={{ padding: 16 }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: TC.textSub }}>
              <span className="text-lg">👯</span> Módulo de Duplicados
            </div>
            <div className="text-[10px] mb-4" style={{ color: TC.textFaint }}>
              Sube el "Plan Actual". El sistema detectará automáticamente los ISOs duplicados presentes en el dashboard comparándolos con este plan.
            </div>
            
            <div className="flex flex-col gap-4 mb-4">
              <label className="flex items-center gap-3 p-6 rounded border-2 border-dashed cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: TC.borderSoft, color: TC.textFaint }}>
                <span className="text-3xl">📥</span>
                <div className="flex flex-col overflow-hidden flex-1">
                  <span className="text-sm font-bold text-blue-400">Subir Plan Actual</span>
                  <span className="text-[10px] truncate opacity-70" title={pvPlanName}>{pvPlanName || 'Cargar archivo .xlsx...'}</span>
                </div>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && onPVPlanUpload(e.target.files[0])} />
              </label>
            </div>
          </Card>
        </div>
      </div>

      <div className="flex gap-6 relative flex-col md:flex-row">
        {/* SECCIÓN 3: ACCIONES RÁPIDAS (PEGAR TEXTO) */}
        <Card style={{ flex: 1, padding: 16 }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: TC.textSub }}>
            <span className="text-lg">📋</span> Acciones Rápidas (Pegar & Excel)
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[{ label: '📦 Copiar Repites', state: pasteRepites, set: setPasteRepites, fn: procesarRepites },
              { label: '↩️ Copiar Retiros', state: pasteRetiros, set: setPasteRetiros, fn: procesarRetiros }].map(m => (
              <div key={m.label} className="flex flex-col gap-1">
                <div className="text-[11px] font-bold mb-1" style={{ color: TC.textSub }}>{m.label}</div>
                <textarea
                  className="w-full h-16 p-2 rounded text-[10px] font-mono resize-none transition-colors border focus:outline-none custom-scrollbar"
                  style={{ background: TC.bgCardAlt, color: TC.text, borderColor: TC.borderSoft }}
                  placeholder="Pega texto de excel…"
                  value={m.state}
                  onChange={e => m.set(e.target.value)}
                  onPaste={() => setTimeout(m.fn, 60)}
                />
                <Btn onClick={m.fn} size="sm" style={{ width: '100%', marginTop: 4 }}>Extraer</Btn>
              </div>
            ))}
          </div>
          
          <div className="h-px w-full my-4" style={{ background: TC.borderSoft }}></div>

          <div>
            <div className="text-[11px] font-bold mb-2" style={{ color: TC.textSub }}>📌 Pegar K8 (ISOs sueltas)</div>
            <textarea
              className="w-full h-16 p-2 rounded text-[10px] font-mono resize-none transition-colors border focus:outline-none"
              style={{ background: TC.bgCardAlt, color: TC.text, borderColor: TC.borderSoft }}
              placeholder="Pega ISOs separadas por saltos de línea…"
              value={pasteK8}
              onChange={e => setPasteK8(e.target.value)}
              onPaste={() => setTimeout(procesarK8, 60)}
            />
            <Btn onClick={procesarK8} size="sm" style={{ width: '100%', marginTop: 4 }}>Procesar K8</Btn>
          </div>

          <div className="h-px w-full my-4" style={{ background: TC.borderSoft }}></div>

          {/* Ship & Return */}
          <div>
            <div className="text-[11px] font-bold mb-2 flex items-center gap-1" style={{ color: TC.text }}>
              <span>📦</span> Ship & Return
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[9px]" style={{ color: TC.textSub }}>1. Pegar ISOs (Crea ASOs)</span>
                <textarea
                  className="w-full h-10 p-2 rounded text-[10px] font-mono resize-none transition-colors border focus:outline-none"
                  style={{ background: TC.bgCardAlt, color: TC.text, borderColor: TC.borderSoft }}
                  placeholder="Pega ISOs..."
                  value={pasteEyR}
                  onChange={e => setPasteEyR(e.target.value)}
                />
                <Btn onClick={procesarEyRPaso1} size="sm" style={{ width: '100%', padding: '2px' }}>Paso 1</Btn>
                
                {eyRAsos && (
                  <div className="mt-1 p-1 rounded" style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[8px] font-bold text-blue-400">ASOs Copiables</span>
                      <button className="text-[8px] underline text-blue-400" onClick={() => { navigator.clipboard.writeText(eyRAsos); alert('Copiadas') }}>Copiar</button>
                    </div>
                    <textarea readOnly value={eyRAsos} className="w-full h-8 text-[8px] font-mono bg-transparent border-none outline-none resize-none custom-scrollbar" style={{ color: TC.text }} />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[9px]" style={{ color: TC.textSub }}>2. Cruce de Origen</span>
                <label className="flex flex-col justify-center items-center gap-1 p-2 h-20 rounded border-2 border-dashed cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: TC.borderSoft, color: TC.textFaint }}>
                  <span className="text-xl">📂</span>
                  <span className="text-[9px] font-bold text-center">Subir Origin Cross Excel</span>
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => {
                      if (e.target.files?.[0]) onOriginCross(e.target.files[0])
                      e.target.value = ''
                  }} />
                </label>
              </div>
            </div>
          </div>

        </Card>

        {/* SECCIÓN 3: MÓDULOS DE CRUCE DE DESTINO Y VEHÍCULOS */}
        <Card style={{ flex: 1, padding: 16 }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: TC.textSub }}>
            <span className="text-lg">🔁</span> Cargar Destino Final / Cruces
          </div>
          
          <div className="flex flex-col gap-5">
            {/* Conversion */}
            <div>
              <label className="flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors hover:bg-purple-500/10" style={{ borderColor: 'rgba(168, 85, 247, 0.4)', color: TC.textFaint }}>
                <span className="text-lg outline outline-1 outline-purple-500/50 rounded-full w-8 h-8 flex items-center justify-center text-purple-400">🔄</span>
                <div className="flex flex-col flex-1">
                  <span className="text-[11px] font-bold" style={{ color: TC.text }}>Conversión de Transporte</span>
                  <span className="text-[9px] opacity-70">Convierte los vehículos en toda la tabla (INI → FIN)</span>
                </div>
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => {
                    if (e.target.files?.[0]) onConversionUpload(e.target.files[0])
                    e.target.value = ''
                }} />
              </label>
            </div>

            <div className="h-px w-full" style={{ background: TC.borderSoft }}></div>

            {/* Cruce de Destino */}
            <div>
              <div className="text-[11px] font-bold mb-2 flex items-center gap-1" style={{ color: TC.text }}>
                <span>🎯</span> Cruce de Destino
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: planCrossFile ? 'var(--blue)' : TC.borderSoft, color: planCrossFile ? TC.text : TC.textFaint, background: planCrossFile ? 'rgba(56, 189, 248, 0.05)' : 'transparent' }}>
                  <span className="flex-shrink-0">📁</span>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-[9px] font-bold truncate">1. Plan File</span>
                    <span className="text-[8px] truncate opacity-80">{planCrossFile?.name || 'Requerido'}</span>
                  </div>
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => setPlanCrossFile(e.target.files?.[0] || null)} />
                </label>

                <label className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: convCrossFile ? 'var(--blue)' : TC.borderSoft, color: convCrossFile ? TC.text : TC.textFaint, background: convCrossFile ? 'rgba(56, 189, 248, 0.05)' : 'transparent' }}>
                  <span className="flex-shrink-0">📁</span>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-[9px] font-bold truncate">2. Conversion</span>
                    <span className="text-[8px] truncate opacity-80">{convCrossFile?.name || 'Requerido'}</span>
                  </div>
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => setConvCrossFile(e.target.files?.[0] || null)} />
                </label>
              </div>

              <Btn 
                variant="primary" 
                disabled={!planCrossFile || !convCrossFile} 
                onClick={() => {
                  if (planCrossFile && convCrossFile) {
                    onDestinoCross(planCrossFile, convCrossFile)
                    setPlanCrossFile(null)
                    setConvCrossFile(null)
                  }
                }} 
                style={{ width: '100%', marginTop: 8 }}
              >
                ⚡ Ejecutar Cruce de Destino
              </Btn>
            </div>
            
          </div>
        </Card>
      </div>
      
      {rows.length > 0 && (
         <div className="text-center p-4 rounded-xl mt-auto" style={{ background: 'rgba(56,189,248,.1)', border: `1px solid rgba(56,189,248,.3)` }}>
            <span style={{ color: TC.textSub, fontSize: 13 }}>
                Actualmente tienes <strong>{rows.length}</strong> datos cargados en la sesión. 
                Ve al <strong style={{ color: '#38bdf8' }}>Dashboard</strong> para gestionarlos.
            </span>
         </div>
      )}
    </div>
  )
}

