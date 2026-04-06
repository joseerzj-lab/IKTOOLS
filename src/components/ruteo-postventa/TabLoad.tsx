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
  onExportJSON: () => void
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
  onExportJSON,
  pvPlanName,
  projectsName,
  TC
}: Props) {


  const [pasteUnified, setPasteUnified] = useState('')
  const [eyRAsos, setEyRAsos] = useState('')
  const [planCrossFile, setPlanCrossFile] = useState<File | null>(null)
  const [convCrossFile, setConvCrossFile] = useState<File | null>(null)
  const [pendingIsos, setPendingIsos] = useState<string[] | null>(null)

  const genId = () => Math.random().toString(36).substring(2, 11) + Date.now().toString(36)

  const sanH = (h: string) => h.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  const applyTabularLogic = (v: string[], isRetiroTable: boolean, cIsoIdx: number, cVehIdx: number, cComIdx: number, cOriIdx: number, source: string): Row | null => {
    const iso = (v[cIsoIdx] || "").trim().toUpperCase().replace("NAN", "")
    if (!iso) return null
    
    const veh = cVehIdx !== -1 ? (v[cVehIdx] || "").trim().toUpperCase().replace("NAN", "") : ""
    const com = cComIdx !== -1 ? (v[cComIdx] || "").trim().toUpperCase().replace("NAN", "") : ""
    const ori = cOriIdx !== -1 ? (v[cOriIdx] || "").trim().toUpperCase().replace("NAN", "") : ""
    
    let g = isRetiroTable ? "RETIRO" : "REPITE"
    if (!isRetiroTable && ori === 'RETIRO') g = 'RETIRO'
    if (veh) {
      const eyr = (com.includes("ENVIO") && com.includes("RETIRO")) || com.includes("ENVIO Y RETIRO")
      if (veh.includes("LESLIE") && veh.includes("PROYECTO")) g = "REPITE PROYECTO"
      else if (veh.includes("LESLIE")) g = eyr ? "ENVIO Y RETIRO" : "REPITE LESLIE"
      else if (eyr) g = "ENVIO Y RETIRO"
    }
    
    return {
      _ikid: genId(),
      ISO: iso,
      'GESTIÓN': g,
      ORIGEN: ori || (g === 'RETIRO' ? 'RETIRO' : ''),
      DESTINO: '',
      'CORREO REPITES': g.includes('REPITE') ? 'SI' : '',
      COMENTARIO_RAW: com,
      VEH: veh,
      _SOURCE: source
    } as Row
  }

  const procesarUnificado = () => {
    const raw = pasteUnified.trim()
    if (!raw) return
    const lines = raw.split(/\r?\n/)
    const sep = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',')
    const rawHeaders = lines[0].split(sep).map(sanH)
    
    // 1. Detección de Envío y Retiro (Columna ASO GENERADA)
    if (rawHeaders.includes("ASO GENERADA")) {
      const cIsoIdx = rawHeaders.indexOf("ASO GENERADA")
      const isosGeneradas: string[] = []
      const data: Row[] = lines.slice(1).map(line => {
        const v = line.split(sep)
        const iso = (v[cIsoIdx] || '').trim().toUpperCase()
        if (iso) isosGeneradas.push(iso)
        return {
          _ikid: genId(),
          ISO: iso,
          'GESTIÓN': 'ENVIO Y RETIRO',
          ORIGEN: 'PENDIENTE',
          DESTINO: '',
          VEH: '',
          'CORREO REPITES': '',
          COMENTARIO_RAW: '',
          _SOURCE: 'EyR_Unificado'
        } as Row
      }).filter(r => r.ISO)
      
      if (data.length) {
        onMergeRows(['ISO','GESTIÓN','ORIGEN','DESTINO','VEH','CORREO REPITES','COMENTARIO_RAW'], data, 'Envío y Retiro')
        setEyRAsos(isosGeneradas.join(','))
      }
      setPasteUnified('')
      return
    }

    // 2. Detección de Repites / Retiros (Tabular con más de 1 columna)
    if (rawHeaders.length > 1) {
      const isRetiroTable = rawHeaders[7] === "ISO" || rawHeaders[7] === "ASO"
      const cIsoIdx = isRetiroTable ? 7 : rawHeaders.findIndex(h => h === "ISO" || h === "ASO" || h.includes("UNIDAD") || h.includes("ID") || h.includes("TITULO"))
      if (cIsoIdx !== -1) {
        const cVehIdx = rawHeaders.findIndex(h => h === "VEH" || h === "VEHICULO" || h === "PATENTE" || h === "MODELO")
        const cComIdx = rawHeaders.findIndex(h => h === "COMENTARIO" || h === "COMENTARIOS" || h === "DETAIL" || h === "OBSERVACION")
        const cOriIdx = rawHeaders.findIndex(h => h === "ORIGEN" || h === "TRANS")
        
        const data: Row[] = lines.slice(1).map(line => {
          const v = line.split(sep)
          return applyTabularLogic(v, isRetiroTable, cIsoIdx, cVehIdx, cComIdx, cOriIdx, 'Unificado_Tabular')
        }).filter(Boolean) as Row[]

        if (data.length) {
          onMergeRows(['ISO','GESTIÓN','ORIGEN','DESTINO','CORREO REPITES','COMENTARIO_RAW','VEH'], data, 'Carga')
        }
        setPasteUnified('')
        return
      }
    }

    // 3. Fallback: Choice of Management
    const isos = raw.split(/[\n\r,;\t ]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
    if (isos.length) {
      setPendingIsos(isos)
      setActiveModal('selection')
    }
    setPasteUnified('')
  }


  const finalizeRawLoad = (gestion: string) => {
    if (!pendingIsos) return
    const data = pendingIsos.map(iso => ({
      _ikid: genId(),
      ISO: iso,
      'GESTIÓN': gestion,
      ORIGEN: gestion === 'K8' ? 'K8' : (gestion === 'RETIRO' ? 'RETIRO' : ''),
      DESTINO: '',
      VEH: '',
      'CORREO REPITES': gestion.includes('REPITE') ? 'SI' : '',
      COMENTARIO_RAW: gestion,
      _SOURCE: 'Carga_Manual'
    } as Row))
    onMergeRows(['ISO','GESTIÓN','ORIGEN','DESTINO','VEH','CORREO REPITES','COMENTARIO_RAW'], data, 'Carga ' + gestion)
    setPendingIsos(null)
    setActiveModal(null)
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
    { id: 'unified', icon: '⚡', title: 'Carga', desc: 'Sube Repites, Retiros, K8 o Envío y Retiro' },
    { id: 'crossing', icon: '🎯', title: 'Cruce', desc: 'Cruce de Destinos y Orígenes' },
    { id: 'session', icon: '💾', title: 'Sesión', desc: 'Guardar/Cargar progreso' },
    { id: 'projects', icon: '🏗️', title: 'Proyectos', desc: 'Documento proyectos Leslie' },
    { id: 'duplicates', icon: '👯', title: 'Duplicados', desc: 'Detectar ISOs duplicadas' }
  ];

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

            <div className="h-px w-full my-2" style={{ background: TC.borderSoft }}></div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold opacity-50 uppercase tracking-widest">O guardar actual</span>
              <Btn variant="primary" onClick={() => { onExportJSON(); setActiveModal(null) }} style={{ width: '100%', justifyContent: 'center', height: 48, borderRadius: 12 }}>
                <span className="text-xl mr-2">💾</span> Guardar Sesión Actual (.json)
              </Btn>
            </div>
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
      case 'selection':
        return (
          <div className="flex flex-col gap-5">
            <h3 className="font-bold text-lg flex items-center gap-2" style={{ color: TC.text }}><span className="text-xl">🤔</span> ¿Qué tipo de gestión es?</h3>
            <p className="text-xs opacity-70 leading-relaxed" style={{ color: TC.text }}>
              Detectamos <span className="font-bold text-blue-400">{pendingIsos?.length} ISOs</span> sin formato de tabla. Selecciona el tipo de gestión para cargarlas:
            </p>
            <div className="grid grid-cols-2 gap-3">
              {['RETIRO', 'REPITE', 'K8', 'ENVIO Y RETIRO', 'PROYECTO', 'SOLO ENVIO'].map(g => (
                <button
                  key={g}
                  onClick={() => finalizeRawLoad(g)}
                  className="py-3 px-4 rounded-xl border-2 font-bold text-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: TC.bgCardAlt, borderColor: TC.borderSoft, color: TC.text }}
                >
                  {g}
                </button>
              ))}
            </div>
            <button onClick={() => { setPendingIsos(null); setActiveModal(null) }} className="text-[10px] opacity-40 hover:opacity-100 transition-opacity uppercase tracking-widest font-bold mt-2">Cancelar</button>
          </div>
        )
      case 'unified':
        return (
          <div className="flex flex-col gap-5">
            <h3 className="font-bold text-lg flex items-center gap-2" style={{ color: TC.text }}><span className="text-xl">⚡</span> Carga de Datos</h3>
            <p className="text-xs opacity-70 leading-relaxed" style={{ color: TC.text }}>
              Pega cualquier tabla de Repites, Retiros o Envío y Retiro. Si pegas solo una lista de ISOs, seleccionas la gestión después.
            </p>
            <textarea
              className="w-full h-40 p-3 rounded-xl text-[11px] font-mono transition-all border focus:ring-2 focus:ring-blue-500/50 outline-none"
              style={{ background: TC.bgCardAlt, color: TC.text, borderColor: TC.borderSoft }}
              placeholder="Pega aquí los datos desde Excel..."
              value={pasteUnified}
              onChange={e => setPasteUnified(e.target.value)}
              onPaste={() => {
                setTimeout(() => { procesarUnificado() }, 50)
              }}
            />
            <Btn onClick={() => { procesarUnificado() }} style={{ width: '100%', height: 44, borderRadius: 12 }}>
              Procesar y Cargar
            </Btn>

            {eyRAsos && (
              <div className="mt-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-blue-400">ISOs para Cruce</span>
                  <button className="text-[10px] underline text-blue-400 cursor-pointer" onClick={() => { navigator.clipboard.writeText(eyRAsos); alert('Copiadas') }}>Copiar</button>
                </div>
                <textarea readOnly value={eyRAsos} className="w-full h-16 text-[10px] font-mono bg-transparent border-none outline-none resize-none custom-scrollbar" style={{ color: TC.text }} />
              </div>
            )}
          </div>
        )
      case 'crossing':
        return (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="font-bold text-lg mb-1 flex items-center gap-2" style={{ color: TC.text }}><span className="text-xl">🎯</span> Cruce de Destinos</h3>
              <p className="text-[11px] opacity-60">Cruza Plan File con Conversión para asignar destino final.</p>
            </div>
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
            <Btn variant="primary" disabled={!planCrossFile || !convCrossFile} onClick={() => { if(planCrossFile && convCrossFile) onDestinoCross(planCrossFile, convCrossFile); setActiveModal(null) }} style={{ width: '100%', height: 44, borderRadius: 12 }}>⚡ Ejecutar Cruce</Btn>
            
            <div className="h-px w-full my-2" style={{ background: TC.borderSoft }}></div>
            
            <div>
              <h3 className="font-bold text-lg mb-1 flex items-center gap-2" style={{ color: TC.text }}><span className="text-xl">🚚</span> Cruce de Orígenes</h3>
              <p className="text-[11px] opacity-60">Sube el Origin Cross Excel para asignar origen a ISOs pendientes.</p>
            </div>
            <label className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: TC.borderSoft, color: TC.textFaint }}>
              <span className="text-2xl">📂</span>
              <div className="flex flex-col">
                <span className="text-xs font-bold">Subir Excel Cruce Origen</span>
                <span className="text-[10px] opacity-60">Asignación automática de origen</span>
              </div>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => {
                if (e.target.files?.[0]) { onOriginCross(e.target.files[0]); setActiveModal(null) }
              }} />
            </label>
          </div>
        )
      default: return null
    }
  }

  return (
    <div className="flex-1 h-full overflow-y-scroll custom-scrollbar p-6 lg:p-10 relative" style={{ 
      background: TC.bg,
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
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
              style={{ padding: 24, boxShadow: `0 4px 20px rgba(0,0,0,0.05)`, background: TC.bgCard, border: `1px solid ${TC.borderSoft}`, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
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
