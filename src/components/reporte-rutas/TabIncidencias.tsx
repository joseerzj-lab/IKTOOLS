import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, MapPin, Camera, Maximize2, X, AlertCircle } from 'lucide-react'
import { Badge, Btn } from '../../ui/DS'
import ImageModal from '../ui/ImageModal'

interface IncidentEvent {
  id: string
  iso: string
  fecha: string
  motivo: string
  comentario: string
  fotos: string[]
  region: string
  comuna: string
  estado: string
}

interface IncidentVehicle {
  patente: string
  region: string
  empresa: string
  totalFotos: number
  incidentCount: number
  eventos: IncidentEvent[]
}

interface Props {
  incidencias: Record<string, IncidentVehicle>
  selectedRegions: Set<string>
  isDark: boolean
  TC: any
}

export default function TabIncidencias({ incidencias, selectedRegions, isDark, TC }: Props) {
  const [selectedPatente, setSelectedPatente] = useState<string>('')
  const [localSearch, setLocalSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalImages, setModalImages] = useState<string[]>([])

  const filteredVehicles = useMemo(() => {
    return Object.values(incidencias)
      .filter(v => selectedRegions.has(v.region))
      .filter(v => v.patente.toLowerCase().includes(localSearch.toLowerCase()))
      .sort((a, b) => b.incidentCount - a.incidentCount || b.totalFotos - a.totalFotos)
  }, [incidencias, selectedRegions, localSearch])

  const activeVehicle = useMemo(() => {
    if (!selectedPatente) return null
    return incidencias[selectedPatente] || null
  }, [incidencias, selectedPatente])

  const openPhotos = (photos: string[]) => {
    setModalImages(photos)
    setModalOpen(true)
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ background: TC.bg }}>
      {/* --- MASTER PANEL (Left) --- */}
      <div 
        className="w-80 flex-shrink-0 flex flex-col border-r shadow-xl z-10" 
        style={{ background: TC.bgCard, borderColor: TC.borderSoft }}
      >
        <div className="p-4 border-b" style={{ borderColor: TC.borderSoft }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              placeholder="Buscar patente..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              style={{ background: isDark ? 'rgba(0,0,0,0.2)' : '#fff', borderColor: TC.border, color: TC.text }}
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-40" style={{ color: TC.text }}>
              {filteredVehicles.length} vehículos
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredVehicles.length === 0 ? (
            <div className="p-10 text-center opacity-30">
              <AlertCircle size={32} className="mx-auto mb-2" />
              <p className="text-xs font-bold">Sin coincidencias</p>
            </div>
          ) : (
            filteredVehicles.map(v => (
              <motion.div
                key={v.patente}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setSelectedPatente(v.patente)}
                className={`px-4 py-3 cursor-pointer border-b transition-all relative group ${selectedPatente === v.patente ? 'bg-blue-500/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                style={{ borderColor: TC.borderSoft }}
              >
                {selectedPatente === v.patente && (
                  <motion.div layoutId="active-indicator" className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                )}
                
                <div className="flex justify-between items-center">
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-black mono tracking-tighter truncate" style={{ color: TC.text }}>{v.patente}</span>
                    <span className="text-[9px] font-bold opacity-40 -mt-0.5 uppercase truncate max-w-[140px]" style={{ color: TC.textSub }}>{v.empresa}</span>
                  </div>
                  <div className="flex flex-col items-end shrink-0 ml-2">
                    <div style={{ fontSize: 8, padding: '1px 5px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, fontWeight: 700 }}>
                      {v.incidentCount} {v.incidentCount === 1 ? 'INCIDENCIA' : 'INCIDENCIAS'}
                    </div>
                  </div>
                </div>
                
                <div className="mt-2 flex items-center justify-between opacity-60">
                  <div className="flex items-center gap-1">
                    <MapPin size={10} style={{ color: TC.textSub }} />
                    <span className="text-[9px] font-medium truncate max-w-[100px]" style={{ color: TC.textSub }}>{v.region}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Camera size={10} style={{ color: TC.textSub }} />
                    <span className="text-[9px] font-bold" style={{ color: TC.textSub }}>{v.totalFotos}</span>
                  </div>
                </div>

                <div className="mt-2 flex gap-1 h-8">
                   {v.eventos.flatMap(e => e.fotos).slice(0, 6).map((f, i) => (
                     <div key={i} className="flex-1 h-full rounded bg-gray-200 dark:bg-gray-800 overflow-hidden border border-black/5 dark:border-white/5">
                        <img src={f} alt="" className="w-full h-full object-cover opacity-60" />
                     </div>
                   ))}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* --- DETAIL PANEL (Right) --- */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <AnimatePresence mode="wait">
          {!activeVehicle ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-20 text-center opacity-30"
            >
              <Camera size={64} className="mb-4" style={{ color: TC.text }} />
              <h3 className="text-lg font-bold" style={{ color: TC.text }}>Reporte Fotográfico de Incidencias</h3>
              <p className="text-sm max-w-xs mx-auto" style={{ color: TC.textSub }}>
                Selecciona un vehículo de la lista lateral para visualizar sus fotos y detalles de incidencias.
              </p>
            </motion.div>
          ) : (
            <motion.div 
              key={activeVehicle.patente}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 overflow-y-auto p-8"
            >
              {/* Header Detalle */}
              <div className="mb-8 flex justify-between items-start">
                <div>
                  <div className="flex flex-col mb-4">
                    <span className="text-[10px] font-bold opacity-40 tracking-widest uppercase mb-1" style={{ color: TC.text }}>Patente del Vehículo</span>
                    <h2 className="text-5xl font-black mono tracking-tighter" style={{ color: TC.text }}>{activeVehicle.patente}</h2>
                    <span className="text-sm font-bold opacity-60 mt-1" style={{ color: TC.text }}>{activeVehicle.empresa}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold opacity-60">
                    <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/10 text-blue-500"><MapPin size={14} /> {activeVehicle.region}</div>
                    <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/10 text-red-500"><AlertCircle size={14} /> {activeVehicle.incidentCount} INCIDENCIAS</div>
                    <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-gray-500/10 text-gray-500"><Camera size={14} /> {activeVehicle.totalFotos} FOTOS</div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Btn 
                    onClick={() => {
                        const csvHeaders = "Patente,Empresa,Cant. Incidencias,ISOs\n"
                        const rows = Object.values(incidencias).map(v => {
                            const isos = v.eventos.map(e => e.iso).join('; ')
                            return `${v.patente},${v.empresa},${v.incidentCount},"${isos}"`
                        }).join('\n')
                        const blob = new Blob(["\uFEFF" + csvHeaders + rows], { type: 'text/csv;charset=utf-8;' })
                        const url = URL.createObjectURL(blob)
                        const link = document.createElement("a")
                        link.href = url
                        link.download = `Reporte_Incidencias.csv`
                        link.click()
                    }} 
                    variant="primary" 
                    style={{ boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                  >
                    📊 Generar Reporte
                  </Btn>
                  <Btn onClick={() => setSelectedPatente('')} variant="ghost" style={{ padding: 0, width: 40, height: 40, borderRadius: '50%' }}>
                    <X size={20} />
                  </Btn>
                </div>
              </div>

              {/* Timeline de Eventos */}
              <div className="space-y-12 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-px before:bg-blue-500/20">
                {activeVehicle.eventos.map((ev) => (
                  <div key={ev.id} className="relative pl-16">
                    {/* Dot Indication */}
                    <div className="absolute left-4 top-2 w-4 h-4 rounded-full bg-blue-500 border-4 border-white dark:border-slate-900 shadow-sm z-10" />
                    
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[10px] font-black mono">#{ev.id.slice(0, 8)}</span>
                          <span className="text-xs font-bold opacity-40 uppercase tracking-widest">{ev.fecha}</span>
                        </div>
                        <div className="flex items-center gap-1">
                           <Badge variant="muted" style={{ fontSize: 13, background: TC.bg, border: `1px solid ${TC.border}`, color: TC.text }}>
                             <span className="mono mr-1 opacity-50">ISO:</span> {ev.iso}
                           </Badge>
                           <button 
                             onClick={() => { navigator.clipboard.writeText(ev.iso); alert('Copiado!') }}
                             className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors"
                             title="Copiar ISO"
                           >
                             <Search size={14} className="rotate-90" />
                           </button>
                        </div>
                      </div>
                      <h4 className="text-lg font-bold" style={{ color: TC.text }}>{ev.motivo || 'Motivo no especificado'}</h4>
                      <p className="text-sm opacity-70 mt-1 max-w-2xl" style={{ color: TC.textSub }}>{ev.comentario || 'Sin observaciones adicionales registradas.'}</p>
                      <div className="mt-3 flex items-center gap-2 text-[10px] font-bold opacity-60">
                        <Badge variant="muted" style={{ fontSize: 9 }}>Comuna: {ev.comuna}</Badge>
                        <Badge variant="muted" style={{ fontSize: 9 }}>Estado: {ev.estado}</Badge>
                      </div>

                    {/* Galería del Evento */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {ev.fotos.map((foto, fidx) => (
                        <motion.div 
                          key={fidx}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => openPhotos(ev.fotos)}
                          className="aspect-square rounded-xl overflow-hidden border-2 cursor-pointer shadow-lg group relative"
                          style={{ borderColor: TC.borderSoft }}
                        >
                           <img src={foto} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                           <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Maximize2 size={24} className="text-white" />
                           </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ImageModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        images={modalImages}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(155, 155, 155, 0.2); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(155, 155, 155, 0.4); }
      `}</style>
    </div>
  )
}
