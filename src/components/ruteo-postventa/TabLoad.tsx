import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import type { Row } from './types'
import { Btn } from '../../ui/DS'


interface Props {
  rows: Row[]
  onMergeRows: (newCols: string[], newRows: Row[], source: string) => void
  onLoadJSON: (cols: string[], rows: Row[]) => void
  // Lost functionality support
  onPVPlanUpload: (file: File) => void
  onProjectsUpload: (file: File) => void
  onDestinoCross: (planFile: File, convFile: File) => void
  onOriginCross: (file: File) => void
  pvPlanName: string
  projectsName: string
  TC: any
}

export default function TabLoad({ 
  rows, 
  onMergeRows, 
  onLoadJSON,
  onPVPlanUpload,
  onProjectsUpload,
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

  const sanH = (h: string) => h.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  const procesarRepites = () => {
    if (!pasteRepites.trim()) return
    const lines = pasteRepites.trim().split('\n')
    if (lines.length < 2) return

    const sep = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',')
    const rawHeaders = lines[0].split(sep).map(sanH)
    
    // Legacy header mapping
    const cIsoIdx = rawHeaders.findIndex(h => h === "ISO")
    const cVehIdx = rawHeaders.findIndex(h => h === "VEH" || h === "VEHICULO")
    const cComIdx = rawHeaders.findIndex(h => h === "COMENTARIO" || h === "COMENTARIOS")
    const cOriIdx = rawHeaders.findIndex(h => h === "ORIGEN")

    if (cIsoIdx === -1) return

    const data: Row[] = []
    lines.slice(1).forEach(line => {
      const v = line.split(sep)
      const iso = (v[cIsoIdx] || "").trim().toUpperCase().replace("NAN", "")
      if (!iso) return

      const veh = cVehIdx !== -1 ? (v[cVehIdx] || "").trim().toUpperCase().replace("NAN", "") : ""
      const com = cComIdx !== -1 ? (v[cComIdx] || "").trim().toUpperCase().replace("NAN", "") : ""
      const ori = cOriIdx !== -1 ? (v[cOriIdx] || "").trim().toUpperCase().replace("NAN", "") : ""
      
      let g = "REPITE"
      if (veh) {
        const eyr = (com.includes("ENVIO") && com.includes("RETIRO")) || com.includes("ENVIO Y RETIRO")
        
        if (veh.includes("PROYECTO LESLIE")) g = "REPITE PROYECTO"
        else if (veh.includes("LESLIE")) g = eyr ? "ENVIO Y RETIRO" : "REPITE LESLIE"
        else if (eyr) g = "ENVIO Y RETIRO"
      }
      
      data.push({
        ISO: iso,
        'GESTIÓN': g,
        ORIGEN: ori,
        DESTINO: '',
        'CORREO REPITES': 'SI',
        COMENTARIO_RAW: com,
        VEH: veh,
        _SOURCE: 'Repites'
      })
    })

    if (data.length > 0) {
      onMergeRows(['ISO','GESTIÓN','ORIGEN','DESTINO','CORREO REPITES','COMENTARIO_RAW','VEH'], data, 'Repites')
    }
    setPasteRepites('')
  }

  const procesarRetiros = () => {
    if (!pasteRetiros.trim()) return
    const lines = pasteRetiros.trim().split('\n')
    if (lines.length < 1) return
    
    const sep = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',')
    const rawHeaders = lines[0].split(sep).map(sanH)
    const cIsoIdx = rawHeaders.findIndex(h => h.includes("ISO") || h.includes("UNIDAD") || h.includes("ID"))
    if (cIsoIdx === -1) return
    
    const seen = new Set()
    const data: Row[] = []
    
    lines.slice(1).forEach(line => {
      const v = line.split(sep)
      const iso = (v[cIsoIdx] || '').trim().toUpperCase()
      if (!iso || seen.has(iso)) return
      seen.add(iso)
      data.push({
        ISO: iso,
        'GESTIÓN': 'RETIRO',
        ORIGEN: 'RETIRO',
        DESTINO: '',
        VEH: '',
        'CORREO REPITES': '',
        COMENTARIO_RAW: '',
        _SOURCE: 'Retiros'
      })
    })
    
    onMergeRows(['ISO','GESTIÓN','ORIGEN','DESTINO','VEH','CORREO REPITES','COMENTARIO_RAW'], data, 'Retiros')
    setPasteRetiros('')
  }

  const procesarEyRPaso1 = () => {
    if (!pasteEyR.trim()) return
    const lines = pasteEyR.trim().split('\n')
    if (lines.length < 1) return
    
    const sep = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',')
    const rawHeaders = lines[0].split(sep).map(sanH)
    // Usamos SOLO la columna "ASO GENERADA" (normalizada) como ISO
    const cIsoIdx = rawHeaders.findIndex(h => sanH(h) === "ASO GENERADA")
    if (cIsoIdx === -1) {
      alert('No se encontró la columna "ASO GENERADA" en la tabla pegada.')
      return
    }
    
    const isosGeneradas: string[] = []
    const newRows: Row[] = []
    
    lines.slice(1).forEach(line => {
      const v = line.split(sep)
      const isoVal = (v[cIsoIdx] || '').trim().toUpperCase()
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
    const isos = pasteK8.split(/[\n\r,;\t ]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
    const data = isos.map(iso => ({
      ISO: iso,
      'GESTIÓN': 'K8',
      ORIGEN: 'K8',
      DESTINO: '',
      VEH: '',
      'CORREO REPITES': '',
      COMENTARIO_RAW: 'K8',
      _SOURCE: 'K8'
    } as Row))
    onMergeRows(['ISO','GESTIÓN','ORIGEN','DESTINO','VEH','CORREO REPITES','COMENTARIO_RAW'], data, 'K8')
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

  const [activeModal, setActiveModal] = useState<string | null>(null)

  const modules = [
    { id: 'session', icon: '💾', title: 'Sesión de Trabajo', desc: 'Restaura tu progreso desde un archivo local (.json)' },
    { id: 'projects', icon: '🏗️', title: 'Proyectos', desc: 'Carga el documento para cruzar proyectos Leslie' },
    { id: 'duplicates', icon: '👯', title: 'Duplicados', desc: 'Detecta ISOs duplicadas subiendo el Plan Actual' },
    { id: 'quick', icon: '⚡', title: 'Carga Rápida', desc: 'Pegar repites, retiros o K8 directo desde Excel' },
    { id: 'eyr', icon: '🔄', title: 'Cargar Envio y Retiro', desc: 'Genera ASOs y cruza orígenes desde archivo' },
    { id: 'crossing', icon: '🎯', title: 'Cruce Destino', desc: 'Cruza plan y conversión de transportes' }
  ]

  const renderModalContent = () => {
    switch (activeModal) {
      case 'session':
        return (
          <div className="flex flex-col gap-4">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2" style={{ color: TC.text }}><span className="text-xl">💾</span> Cargar Sesión</h3>
            <label className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: TC.borderSoft, color: TC.textFaint }}>
              <span className="text-4xl mb-3">📂</span>
              <span className="text-sm font-bold">Cargar Sesión Guardada (.json)</span>
              <span className="text-xs mt-2 text-center max-w-[200px] opacity-70">Restaura tu progreso desde un archivo local</span>
              <input type="file" accept=".json" className="hidden" onChange={e => { handleLoadJSON(e); setActiveModal(null) }} />
            </label>
          </div>
        )
      case 'projects':
        return (
          <div className="flex flex-col gap-4">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2" style={{ color: TC.text }}><span className="text-xl">🏗️</span> Proyectos Leslie</h3>
            <label className="flex items-center gap-4 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: TC.borderSoft, color: TC.textFaint }}>
              <span className="text-4xl">🏗️</span>
              <div className="flex flex-col overflow-hidden flex-1">
                <span className="text-sm font-bold text-purple-400">Subir Archivo de Proyectos</span>
                <span className="text-xs mt-1 truncate opacity-70" title={projectsName}>{projectsName || 'Cargar .xlsx de Proyectos...'}</span>
              </div>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => {
                if (e.target.files?.[0]) onProjectsUpload(e.target.files[0])
                e.target.value = ''
                setActiveModal(null)
              }} />
            </label>
          </div>
        )
      case 'duplicates':
        return (
          <div className="flex flex-col gap-4">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2" style={{ color: TC.text }}><span className="text-xl">👯</span> Módulo de Duplicados</h3>
            <p className="text-xs mb-2 leading-relaxed" style={{ color: TC.textFaint }}>
              Sube el "Plan Actual". El sistema detectará automáticamente los ISOs duplicados.
            </p>
            <label className="flex items-center gap-4 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: TC.borderSoft, color: TC.textFaint }}>
              <span className="text-4xl">📥</span>
              <div className="flex flex-col overflow-hidden flex-1">
                <span className="text-sm font-bold text-blue-400">Subir Plan Actual</span>
                <span className="text-xs mt-1 truncate opacity-70" title={pvPlanName}>{pvPlanName || 'Cargar archivo .xlsx...'}</span>
              </div>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => {
                if (e.target.files?.[0]) onPVPlanUpload(e.target.files[0])
                e.target.value = ''
                setActiveModal(null)
              }} />
            </label>
          </div>
        )
      case 'quick':
        return (
          <div className="flex flex-col gap-5">
            <h3 className="font-bold text-lg flex items-center gap-2" style={{ color: TC.text }}><span className="text-xl">⚡</span> Carga Rápida (Pegar)</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold" style={{ color: TC.textSub }}>📦 Repites</span>
                <textarea
                  className="w-full h-20 p-2 rounded text-[10px] font-mono resize-none transition-colors border focus:outline-none custom-scrollbar"
                  style={{ background: TC.bgCardAlt, color: TC.text, borderColor: TC.borderSoft }}
                  placeholder="Pega texto de excel…"
                  value={pasteRepites}
                  onChange={e => setPasteRepites(e.target.value)}
                  onPaste={() => setTimeout(() => { procesarRepites() }, 60)}
                />
                <Btn onClick={() => { procesarRepites(); setActiveModal(null) }} size="sm" style={{ width: '100%' }}>Cargar</Btn>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold" style={{ color: TC.textSub }}>↩️ Retiros</span>
                <textarea
                  className="w-full h-20 p-2 rounded text-[10px] font-mono resize-none transition-colors border focus:outline-none custom-scrollbar"
                  style={{ background: TC.bgCardAlt, color: TC.text, borderColor: TC.borderSoft }}
                  placeholder="Pega texto de excel…"
                  value={pasteRetiros}
                  onChange={e => setPasteRetiros(e.target.value)}
                  onPaste={() => setTimeout(() => { procesarRetiros() }, 60)}
                />
                <Btn onClick={() => { procesarRetiros(); setActiveModal(null) }} size="sm" style={{ width: '100%' }}>Cargar</Btn>
              </div>
            </div>

            <div className="h-px w-full" style={{ background: TC.borderSoft }}></div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold" style={{ color: TC.textSub }}>📌 K8 (ISOs sueltas)</span>
              <textarea
                className="w-full h-16 p-2 rounded text-[10px] font-mono resize-none transition-colors border focus:outline-none"
                style={{ background: TC.bgCardAlt, color: TC.text, borderColor: TC.borderSoft }}
                placeholder="Pega ISOs separadas por saltos de línea…"
                value={pasteK8}
                onChange={e => setPasteK8(e.target.value)}
                onPaste={() => setTimeout(() => { procesarK8() }, 60)}
              />
              <Btn onClick={() => { procesarK8(); setActiveModal(null) }} size="sm" style={{ width: '100%' }}>Procesar K8</Btn>
            </div>
          </div>
        )
      case 'eyr':
        return (
          <div className="flex flex-col gap-5">
            <h3 className="font-bold text-lg flex items-center gap-2" style={{ color: TC.text }}><span className="text-xl">🔄</span> Cargar Envio y Retiro</h3>
            
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold" style={{ color: TC.textSub }}>Paso 1: Pegar ISOs (Genera ASOs)</span>
              <textarea
                className="w-full h-20 p-2 rounded text-[10px] font-mono resize-none transition-colors border focus:outline-none"
                style={{ background: TC.bgCardAlt, color: TC.text, borderColor: TC.borderSoft }}
                placeholder="Pega tabla con ISOs..."
                value={pasteEyR}
                onChange={e => setPasteEyR(e.target.value)}
              />
              <Btn onClick={procesarEyRPaso1} size="sm" style={{ width: '100%' }}>Generar (Paso 1)</Btn>
              
              {eyRAsos && (
                <div className="mt-2 p-2 rounded bg-blue-500/10 border border-blue-500/30">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-blue-400">ASOs Copiables</span>
                    <button className="text-[10px] underline text-blue-400 cursor-pointer" onClick={() => { navigator.clipboard.writeText(eyRAsos); alert('Copiadas') }}>Copiar</button>
                  </div>
                  <textarea readOnly value={eyRAsos} className="w-full h-12 text-[10px] font-mono bg-transparent border-none outline-none resize-none custom-scrollbar" style={{ color: TC.text }} />
                </div>
              )}
            </div>

            <div className="h-px w-full" style={{ background: TC.borderSoft }}></div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold" style={{ color: TC.textSub }}>Paso 2: Cruce de Origen</span>
              <label className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: TC.borderSoft, color: TC.textFaint }}>
                <span className="text-2xl">📂</span>
                <span className="text-xs font-bold">Subir Origin Cross Excel</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => {
                  if (e.target.files?.[0]) onOriginCross(e.target.files[0])
                  e.target.value = ''
                  setActiveModal(null)
                }} />
              </label>
            </div>
          </div>
        )
      case 'crossing':
        return (
          <div className="flex flex-col gap-5">
            <h3 className="font-bold text-lg flex items-center gap-2" style={{ color: TC.text }}><span className="text-xl">🎯</span> Cruce de Destino</h3>
            <p className="text-xs leading-relaxed" style={{ color: TC.textFaint }}>Cruza un Plan File con un archivo de Conversión para asignar los destinos finales.</p>
            
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors" style={{ borderColor: planCrossFile ? '#3b82f6' : TC.borderSoft, color: planCrossFile ? TC.text : TC.textFaint, background: planCrossFile ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                <span className="text-2xl">📁</span>
                <span className="text-xs font-bold text-center">Plan File</span>
                <span className="text-[10px] truncate max-w-[120px] opacity-70">{planCrossFile?.name || 'Requerido'}</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => setPlanCrossFile(e.target.files?.[0] || null)} />
              </label>

              <label className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors" style={{ borderColor: convCrossFile ? '#3b82f6' : TC.borderSoft, color: convCrossFile ? TC.text : TC.textFaint, background: convCrossFile ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                <span className="text-2xl">🔄</span>
                <span className="text-xs font-bold text-center">Conversion</span>
                <span className="text-[10px] truncate max-w-[120px] opacity-70">{convCrossFile?.name || 'Requerido'}</span>
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
                  setActiveModal(null)
                }
              }} 
              style={{ width: '100%', marginTop: 8, padding: '12px 16px' }}
            >
              ⚡ Ejecutar Cruce
            </Btn>
          </div>
        )
      default: return null
    }
  }

  return (
    <div className="flex-1 h-full overflow-y-scroll custom-scrollbar p-6 lg:p-10 relative" style={{ 
      background: TC.bg,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(255,255,255,0.18) transparent',
    }}>
      
      <div className="max-w-5xl mx-auto flex flex-col gap-8">
        <div>
          <h2 className="text-2xl font-black mb-2 flex items-center gap-3" style={{ color: TC.text }}>
            <span className="text-3xl">📥</span> Carga de Datos
          </h2>
          <p className="text-sm opacity-80 max-w-2xl" style={{ color: TC.textSub }}>
            Selecciona el módulo de carga que necesitas utilizar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map(m => (
            <div 
              key={m.id} 
              className="cursor-pointer transition-all hover:-translate-y-1 group rounded-2xl"
              style={{ padding: 24, boxShadow: `0 4px 20px rgba(0,0,0,0.05)`, background: TC.bgCard, border: `1px solid ${TC.borderSoft}`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
              onClick={() => setActiveModal(m.id)}
            >
              <div className="flex flex-col h-full gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-transform group-hover:scale-110" style={{ background: `${TC.borderSoft}50` }}>
                  {m.icon}
                </div>
                <div>
                  <h3 className="text-sm font-bold mb-1" style={{ color: TC.text }}>{m.title}</h3>
                  <p className="text-[11px] leading-relaxed" style={{ color: TC.textFaint }}>{m.desc}</p>
                </div>
              </div>
            </div>
          ))}
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

      <AnimatePresence>
        {activeModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            onClick={() => setActiveModal(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden relative"
              style={{ background: TC.bgCard, border: `1px solid ${TC.borderSoft}`, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
              onClick={e => e.stopPropagation()}
            >
              <button 
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors z-10"
                style={{ color: TC.textSub }}
                onClick={() => setActiveModal(null)}
              >
                <X size={16} />
              </button>
              
              <div className="p-6 md:p-8">
                {renderModalContent()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}

