import { useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { useTheme, getThemeColors } from '../context/ThemeContext'
import { PageShell, Btn } from '../ui/DS'
import GlassHeader, { GlassHeaderTab } from '../components/ui/GlassHeader'
import { jsPDF } from 'jspdf'
import { toPng, toJpeg } from 'html-to-image'

const TABS: GlassHeaderTab[] = [
  { id: 'archivos', label: 'Cargar Archivos', icon: '📁' },
  { id: 'resumen',  label: 'Resumen',         icon: '📋' },
]

function removeAccents(s: any) {
  return s ? String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim() : ''
}

function parseNum(v: any) {
  return typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')) || 0
}

function findCol(row: any, opts: string[]) {
  const keys = Object.keys(row)
  return keys.find(k => opts.some(o => k.toLowerCase() === o.toLowerCase())) || 
         keys.find(k => opts.some(o => k.toLowerCase().includes(o.toLowerCase())))
}

const EXTRAURBAN_COMUNAS = new Set([
  'ALHUE', 'BUIN', 'CALERA DE TANGO', 'COLINA', 'CURACAVI', 'EL MONTE',
  'ISLA DE MAIPO', 'LAMPA', 'LO BARNECHEA', 'MARIA PINTO', 'MELIPILLA',
  'PADRE HURTADO', 'PAINE', 'PENAFLOR', 'PIRQUE', 'SAN JOSE DE MAIPO',
  'SAN PEDRO', 'TALAGANTE', 'TILTIL'
].map(c => removeAccents(c)))

function timeToSeconds(t: string) {
  if (!t) return null
  const p = t.split(':')
  if (p.length >= 2) return (parseInt(p[0]) || 0) * 3600 + (parseInt(p[1]) || 0) * 60 + (parseInt(p[2]) || 0)
  return null
}

function fmtSecs(s: number) {
  if (s < 0) s = 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = Math.floor(s % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export default function GenerarResumen() {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)

  const [tab, setTab] = useState<'archivos' | 'resumen'>('archivos')
  const [fileSimpli, setFileSimpli] = useState<File | null>(null)
  const [fileConv, setFileConv] = useState<File | null>(null)
  const [logs, setLogs] = useState<{ msg: string; type: 'ok' | 'err' | 'warn' | 'info' }[]>([])
  const [processing, setProcessing] = useState(false)
  const [incluirPostVenta, setIncluirPostVenta] = useState(false)
  const [resumenData, setResumenData] = useState<any[]>([])

  const tableRef = useRef<HTMLDivElement>(null)

  const addLog = useCallback((msg: string, type: 'ok' | 'err' | 'warn' | 'info' = 'info') => {
    setLogs(p => [...p, { msg, type }])
  }, [])

  const readFile = (file: File): Promise<any[]> => {
    return new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = e => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' })
          const firstSheet = wb.Sheets[wb.SheetNames[0]]
          res(XLSX.utils.sheet_to_json(firstSheet, { defval: '' }))
        } catch (err) {
          rej(err)
        }
      }
      r.onerror = rej
      r.readAsArrayBuffer(file)
    })
  }

  const readWorkbook = (file: File): Promise<XLSX.WorkBook> => {
    return new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = e => {
        try {
          res(XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' }))
        } catch (err) {
          rej(err)
        }
      }
      r.onerror = rej
      r.readAsArrayBuffer(file)
    })
  }

  const procesarArchivos = async () => {
    if (!fileSimpli || !fileConv) {
      addLog('Carga ambos archivos para continuar.', 'warn')
      return
    }

    setProcessing(true)
    addLog('Procesando datos...', 'info')

    try {
      const dataSimpli = await readFile(fileSimpli)
      const convWb = await readWorkbook(fileConv)
      let planSheetData: any[] = []

      // Trata de buscar la hoja "plan" ignorando mayúsculas, si no toma la primera
      const planName = convWb.SheetNames.find(n => n.toLowerCase().trim() === 'plan') || convWb.SheetNames[0]
      if (planName) {
        planSheetData = XLSX.utils.sheet_to_json(convWb.Sheets[planName], { defval: '' })
      }

      if (!dataSimpli.length) throw new Error('El archivo SimpliRoute está vacío.')

      // Mapeo Conversión
      const ruteoDict: Record<string, string> = {} // V inicial -> V final
      if (planSheetData.length > 0) {
        const cVinicial = findCol(planSheetData[0], ['v inicial', 'v_inicial', 'veh inicial', 'veh_inicial']) || Object.keys(planSheetData[0])[0]
        const cVfinal = findCol(planSheetData[0], ['v final', 'v_final', 'veh final', 'veh_final']) || Object.keys(planSheetData[0])[1]
        
        planSheetData.forEach(r => {
          if (r[cVinicial]) {
            ruteoDict[String(r[cVinicial]).trim().toUpperCase()] = String(r[cVfinal]).trim().toUpperCase()
          }
        })
      }

      // Columnas Simpli
      const sC = {
        vehiculo: findCol(dataSimpli[0], ['vehículo', 'vehiculo', 'vehicle', 'ruta']) || 'Vehículo',
        conductor: findCol(dataSimpli[0], ['conductor', 'driver']) || 'Conductor',
        titulo: findCol(dataSimpli[0], ['título', 'titulo', 'title', 'iso']) || 'Título',
        distancia: findCol(dataSimpli[0], ['distancia', 'distance']) || 'Distancia',
        cap2: findCol(dataSimpli[0], ['capacidad espacio 2', 'capacidad 2', 'capacity 2']) || 'Capacidad espacio 2',
        tiempoEst: findCol(dataSimpli[0], ['tiempo estimado de llegada', 'eta']) || 'Tiempo estimado de llegada',
        direccion: findCol(dataSimpli[0], ['dirección', 'direccion', 'address']) || 'Dirección'
      }

      // Filtrar filas: solo aquellas con conductor vacío
      // Primero, identificamos los vehículos que tienen el conductor vacío (en general o en todas sus filas)
      // La regla acordada: Filtrar todos los vehículos en los que la columna conductor esté vacía
      // Si el conductor está vacío en el archivo para esos vehículos, mantenemos todo el conjunto de filas de ese vehículo
      const vehicleGroups: Record<string, any[]> = {}
      dataSimpli.forEach(row => {
        const v = String(row[sC.vehiculo] || '').trim().toUpperCase()
        if (v) {
          if (!vehicleGroups[v]) vehicleGroups[v] = []
          vehicleGroups[v].push(row)
        }
      })

      const summaries: any[] = []

      for (const veh in vehicleGroups) {
        const rows = vehicleGroups[veh]
        // Determinar Vehículo Final
        const vehFinal = ruteoDict[veh] || veh

        // Excepción Automática: si es VEH98 o VEH99 se toman siempre, incluso si tienen conductor
        const esExcepcion = vehFinal.toUpperCase() === 'VEH98' || vehFinal.toUpperCase() === 'VEH99'
        
        // Si no está activado 'Incluir Postventa y Proyectos' y tampoco es excepción, ignoramos si tiene un conductor asignado
        const tieneConductor = rows.some(r => String(r[sC.conductor] || '').trim() !== '')
        if (!incluirPostVenta && !esExcepcion && tieneConductor) continue 

        let minSec = Infinity
        let maxSec = -Infinity
        let realIso = 0
        const comunas = new Set<string>()
        let totalDist = 0
        let totalM3 = 0

        rows.forEach(r => {
          const t = String(r[sC.titulo]).trim().toUpperCase()
          totalDist += parseNum(r[sC.distancia])
          
          if (t !== 'INICIO' && t !== 'FIN') {
            realIso++
            totalM3 += parseNum(r[sC.cap2]) // Sums over stops
            
            const dir = String(r[sC.direccion] || '').trim()
            if (dir) {
               const parts = dir.split(',')
               if (parts.length >= 2) {
                 const comuna = parts[parts.length - 2].trim()
                 if (comuna) comunas.add(removeAccents(comuna))
               } else if (parts.length === 1) {
                 comunas.add(removeAccents(parts[0].trim()))
               }
            }
          } else if (t === 'INICIO' || t === 'FIN') {
             // In inicio/fin M3 cap2 shouldn't affect much if 0, but if it has, we ignore by putting it in else.
          }

          const tiempo = String(r[sC.tiempoEst] || '')
          let hora = ''
          if (tiempo.includes('T')) hora = tiempo.split('T')[1]
          else if (tiempo.includes(' ')) hora = tiempo.split(' ')[1]
          else hora = tiempo

          const s = timeToSeconds(hora)
          if (s !== null) {
            if (t === 'INICIO' && s < minSec) minSec = s
            if (t === 'FIN' && s > maxSec) maxSec = s
            // Fallback en caso de que minSec maxSec no se asigne bien por inicio/fin
            if (t !== 'INICIO' && t !== 'FIN') {
              if (s < minSec) minSec = s
              if (s > maxSec) maxSec = s
            }
          }
        })

        const durSec = (minSec !== Infinity && maxSec !== -Infinity) ? maxSec - minSec : 0
        let esExtraurbana = false
        for (const c of comunas) {
          if (EXTRAURBAN_COMUNAS.has(c)) {
             esExtraurbana = true; break;
          }
        }

        const zona = esExtraurbana ? 'Extraurbano' : 'Urbano'
        const tipoTicket = vehFinal.toUpperCase().includes('MINI') ? 'MiniTicket' : 'Ticket Regular'
        
        // Asignación de tipo de vehículo especial
        let tipoVehiculo = ''
        if (vehFinal.toUpperCase() === 'VEH98') tipoVehiculo = 'Proyectos'
        if (vehFinal.toUpperCase() === 'VEH99') tipoVehiculo = 'Postventa'

        const formatter = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 })

        summaries.push({
          ANDEN: '',
          LADO: '',
          Vehículo: vehFinal,
          Distancia: formatter.format(totalDist),
          'Tiempo en Ruta': fmtSecs(durSec),
          ISO: realIso,
          'Q COMUNAS': comunas.size,
          M3: formatter.format(totalM3),
          'Horario Salida': '',
          Zona: zona,
          'Tipo Vehiculo': tipoVehiculo,
          'Tipo Ticket': tipoTicket
        })
      }

      summaries.sort((a, b) => String(a.Vehículo).localeCompare(String(b.Vehículo)))
      setResumenData(summaries)
      addLog(`Resumen generado para ${summaries.length} vehículos.`, 'ok')
      
      // Fix rendering bug: wait a tick so DOM updates before switching tab
      setTimeout(() => setTab('resumen'), 50)
    } catch (err: any) {
      addLog(`Error: ${err.message}`, 'err')
    } finally {
      setProcessing(false)
    }
  }

  const copiarTabla = () => {
    if (!resumenData.length || !tableRef.current) return
    const html = tableRef.current.outerHTML
    const blob = new Blob([html], { type: 'text/html' })
    const data = [new ClipboardItem({ 'text/html': blob })]
    navigator.clipboard.write(data).then(() => {
      addLog('Tabla copiada al portapapeles.', 'ok')
    }).catch(() => addLog('Error al copiar tabla.', 'err'))
  }

  const exportarImagen = async (tipo: 'png' | 'jpg') => {
    if (!tableRef.current) return
    try {
      const el = tableRef.current
      const dataUrl = tipo === 'png' ? await toPng(el, { backgroundColor: '#ffffff' }) : await toJpeg(el, { backgroundColor: '#ffffff' })
      const link = document.createElement('a')
      link.download = `Resumen_Vehiculos.${tipo}`
      link.href = dataUrl
      link.click()
      addLog(`Exportado a ${tipo.toUpperCase()} exitosamente.`, 'ok')
    } catch (e) {
      addLog('Error al exportar imagen.', 'err')
    }
  }

  const exportarPDF = async () => {
    if (!tableRef.current) return
    try {
      const el = tableRef.current
      const dataUrl = await toPng(el, { backgroundColor: '#ffffff', pixelRatio: 2 })
      // Orientation 'l' (landscape), units 'pt', format 'letter'
      const pdf = new jsPDF('l', 'pt', 'letter')
      const margin = 72 // 1 inch in points (APA 6 margin)
      
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const contentWidth = pdfWidth - margin * 2
      const contentHeight = pdfHeight - margin * 2

      const imgProps = pdf.getImageProperties(dataUrl)
      const imgRatio = imgProps.width / imgProps.height
      
      let renderWidth = contentWidth
      let renderHeight = contentWidth / imgRatio

      // Scale to fit height if necessary
      if (renderHeight > contentHeight) {
        renderHeight = contentHeight
        renderWidth = renderHeight * imgRatio
      }

      const x = margin + (contentWidth - renderWidth) / 2
      const y = margin + (contentHeight - renderHeight) / 2
      
      pdf.addImage(dataUrl, 'PNG', x, y, renderWidth, renderHeight)
      pdf.save(`Resumen_Vehiculos.pdf`)
      addLog('Exportado a PDF exitosamente (Formato Carta Horizontal - Margen APA).', 'ok')
    } catch (e) {
      addLog('Error al exportar a PDF.', 'err')
    }
  }

  // Estilos idénticos a Ruteo AM (RuteoPR)
  const TH_STYLE = {
    background: '#0058A3', color: '#ffffff', fontWeight: 700,
    padding: '8px 12px', border: '1px solid #000', textAlign: 'center' as const,
    whiteSpace: 'nowrap' as const, fontSize: '11px'
  }
  const TD_STYLE = {
    padding: '6px 10px', border: '1px solid #000', textAlign: 'center' as const,
    color: '#111', fontSize: '11px', fontWeight: 'bold'
  }

  return (
    <PageShell>
      <GlassHeader appName="Generar Resumen" icon="📊" tabs={TABS} activeTab={tab} onTabChange={(id) => setTab(id as any)} />

      <div className="flex-1 overflow-hidden flex flex-col items-center p-6 custom-scrollbar" style={{ background: TC.bg }}>
        {tab === 'archivos' && (
          <div className="w-full max-w-4xl space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl pt-4">
                
                {/* Carta SimpliRoute */}
                <motion.div 
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="relative group overflow-hidden" 
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))', backdropFilter: 'blur(16px)', border: `1px solid ${TC.borderSoft}`, borderRadius: 24, padding: 32, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500 opacity-70"></div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></div>
                    <div className="text-[13px] font-bold tracking-wider text-blue-300 uppercase">Input SimpliRoute</div>
                  </div>
                  <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 transition-all cursor-pointer group-hover:border-blue-400/50 group-hover:bg-blue-400/5 relative" style={{ borderColor: TC.borderSoft }}>
                    <div className="text-4xl mb-4 transform transition-transform group-hover:scale-110">📁</div>
                    <span className="text-sm font-medium text-center truncate w-full px-4 text-gray-200">{fileSimpli?.name || 'Arrastra tu archivo .xlsx o haz clic'}</span>
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => {setFileSimpli(e.target.files?.[0] || null); e.target.value=''}}/>
                  </label>
                  {fileSimpli && <div className="absolute bottom-4 right-4 text-[10px] bg-green-500/20 text-green-400 px-2 py-1 rounded-full uppercase font-bold">Cargado</div>}
                </motion.div>

                {/* Carta Conversión */}
                <motion.div 
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="relative group overflow-hidden" 
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))', backdropFilter: 'blur(16px)', border: `1px solid ${TC.borderSoft}`, borderRadius: 24, padding: 32, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-pink-500 opacity-70"></div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 2.1l4 4-4 4"></path><path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8M7 21.9l-4-4 4-4"></path><path d="M21 11.8v2a4 4 0 0 1-4 4H4.2"></path></svg></div>
                    <div className="text-[13px] font-bold tracking-wider text-purple-300 uppercase">Matriz Conversión</div>
                  </div>
                  <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 transition-all cursor-pointer group-hover:border-purple-400/50 group-hover:bg-purple-400/5 relative" style={{ borderColor: TC.borderSoft }}>
                    <div className="text-4xl mb-4 transform transition-transform group-hover:scale-110">🔁</div>
                    <span className="text-sm font-medium text-center truncate w-full px-4 text-gray-200">{fileConv?.name || 'Arrastra tu conversión .xlsx o haz clic'}</span>
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => {setFileConv(e.target.files?.[0] || null); e.target.value=''}}/>
                  </label>
                  {fileConv && <div className="absolute bottom-4 right-4 text-[10px] bg-green-500/20 text-green-400 px-2 py-1 rounded-full uppercase font-bold">Cargado</div>}
                </motion.div>

              </div>

              <div className="flex flex-col items-center pt-2 gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-300">
                  <input 
                    type="checkbox" 
                    checked={incluirPostVenta} 
                    onChange={e => setIncluirPostVenta(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
                  />
                  Incluir Postventa y Proyectos
                </label>
                
                <Btn variant="primary" onClick={procesarArchivos} disabled={processing || !fileSimpli || !fileConv} style={{ padding: '14px 40px', borderRadius: 999, width: '100%', maxWidth: '400px' }}>
                  {processing ? 'Procesando...' : '▶ Generar Resumen'}
                </Btn>
              </div>
            </div>
        )}

        {tab === 'resumen' && (
          <div className="w-full max-w-5xl flex-1 flex flex-col min-h-0 animate-in fade-in duration-300">
            <div className="w-full flex justify-between items-center mb-6 mt-2 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/20 rounded-xl text-blue-400 border border-blue-500/30">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-100 tracking-tight">Tabla Resumen</h2>
                  <p className="text-xs text-blue-400/80 uppercase tracking-widest font-mono mt-0.5">{resumenData.length} Vehículos Procesados</p>
                </div>
              </div>
                
                <div className="flex bg-black/20 p-1.5 rounded-xl border border-white/5 shadow-inner">
                   <Btn onClick={copiarTabla} variant="secondary" style={{ borderRadius: '8px', padding: '8px 16px', background: 'transparent', border: 'none', color: '#cbd5e1' }} className="hover:bg-white/10 hover:text-white transition-all text-sm">📋 Html</Btn>
                   <div className="w-px bg-white/10 mx-1"></div>
                   <Btn onClick={() => exportarImagen('png')} variant="secondary" style={{ borderRadius: '8px', padding: '8px 16px', background: 'transparent', border: 'none', color: '#cbd5e1' }} className="hover:bg-white/10 hover:text-white transition-all text-sm">🖼️ PNG</Btn>
                   <Btn onClick={() => exportarImagen('jpg')} variant="secondary" style={{ borderRadius: '8px', padding: '8px 16px', background: 'transparent', border: 'none', color: '#cbd5e1' }} className="hover:bg-white/10 hover:text-white transition-all text-sm">🖼️ JPG</Btn>
                   <div className="w-px bg-white/10 mx-1"></div>
                   <Btn onClick={exportarPDF} variant="primary" style={{ borderRadius: '8px', padding: '8px 20px', background: 'linear-gradient(to right, #3b82f6, #6366f1)', border: 'none', fontWeight: 'bold' }} className="shadow-lg shadow-blue-500/20">📄 Exportar PDF</Btn>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex-1 flex flex-col relative ring-1 ring-black/5" style={{ minHeight: 0 }}>
                {resumenData.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 mb-4"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                    <div className="text-gray-400 font-bold uppercase tracking-widest text-xs">Sin datos procesados</div>
                  </div>
                ) : (
                  <div className="overflow-auto custom-scrollbar flex-1 relative bg-gray-50/30 p-4">
                    <div ref={tableRef} style={{ background: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }} className="min-w-max">
                      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontFamily: 'Inter, Arial, sans-serif' }}>
                        <thead>
                          <tr className="shadow-sm">
                            {Object.keys(resumenData[0] || {}).map((k, idx, arr) => (
                              <th key={k} style={{
                                ...TH_STYLE,
                                border: '1px solid #94a3b8',
                                borderRight: idx === arr.length - 1 ? '1px solid #94a3b8' : 'none',
                                background: 'linear-gradient(to bottom, #f8fafc, #e2e8f0)',
                                color: '#1e293b',
                                padding: '12px 14px',
                                fontSize: '12px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}>{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {resumenData.map((row, i) => (
                            <tr key={i} className="hover:bg-blue-50/80 transition-colors duration-150" style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                               {Object.values(row).map((v: any, j, arr) => (
                                 <td key={j} style={{
                                   ...TD_STYLE,
                                   border: '1px solid #cbd5e1',
                                   borderTop: 'none',
                                   borderRight: j === arr.length - 1 ? '1px solid #cbd5e1' : 'none',
                                   padding: '10px 14px',
                                   color: '#334155',
                                   fontWeight: 600
                                 }}>{v}</td>
                               ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        {logs.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-4xl mt-8">
            <div className="rounded-xl border bg-black/40 backdrop-blur-xl p-4 font-mono text-[10px] overflow-y-auto max-h-[140px] custom-scrollbar" style={{ borderColor: TC.borderSoft, color: '#e6edf3' }}>
               {logs.map((L, i) => (
                 <div key={i} className={`py-1 border-b border-white/5 last:border-0 flex gap-3 ${L.type === 'err' ? 'text-red-400' : L.type === 'warn' ? 'text-yellow-400' : L.type === 'ok' ? 'text-green-400' : 'text-blue-300'}`}>
                    <span className="opacity-20 shrink-0">{new Date().toLocaleTimeString('es-CL', { hour12: false })}</span>
                    <span className="font-medium">{L.msg}</span>
                 </div>
               ))}
               <div ref={el => el?.scrollIntoView({ behavior: 'smooth' })} />
            </div>
          </motion.div>
        )}
      </div>
    </PageShell>
  )
}
