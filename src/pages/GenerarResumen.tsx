import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
        // Regla: Tomar vehículos donde la columna conductor esté vacía.
        // Si no está activado 'Incluir Postventa y Proyectos', ignoramos si tiene un conductor asignado
        const tieneConductor = rows.some(r => String(r[sC.conductor] || '').trim() !== '')
        if (!incluirPostVenta && tieneConductor) continue 


        // Determinar Vehículo Final
        const vehFinal = ruteoDict[veh] || veh

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
          'Tipo Vehiculo': '',
          'Tipo Ticket': tipoTicket
        })
      }

      summaries.sort((a, b) => String(a.Vehículo).localeCompare(String(b.Vehículo)))
      setResumenData(summaries)
      addLog(`Resumen generado para ${summaries.length} vehículos.`, 'ok')
      setTab('resumen')
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
      const pdf = new jsPDF('p', 'pt', 'a4')
      const imgProps = pdf.getImageProperties(dataUrl)
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(`Resumen_Vehiculos.pdf`)
      addLog('Exportado a PDF exitosamente.', 'ok')
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
        <AnimatePresence mode="wait">
          {tab === 'archivos' && (
            <motion.div key="archivos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-4xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', border: `1px solid ${TC.borderSoft}`, borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="text-[12px] font-bold text-blue-400">📄 Archivo SimpliRoute (Input)</div>
                  <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 transition-all hover:bg-white/5 cursor-pointer" style={{ borderColor: TC.borderSoft }}>
                    <div className="text-3xl mb-4">📁</div>
                    <span className="text-xs font-medium text-center truncate w-full">{fileSimpli?.name || 'Cargar SimpliRoute (.xlsx)'}</span>
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => {setFileSimpli(e.target.files?.[0] || null); e.target.value=''}}/>
                  </label>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', border: `1px solid ${TC.borderSoft}`, borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="text-[12px] font-bold text-blue-400">📄 Archivo Conversión</div>
                  <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 transition-all hover:bg-white/5 cursor-pointer" style={{ borderColor: TC.borderSoft }}>
                    <div className="text-3xl mb-4">🔁</div>
                    <span className="text-xs font-medium text-center truncate w-full">{fileConv?.name || 'Cargar Conversión (.xlsx)'}</span>
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => {setFileConv(e.target.files?.[0] || null); e.target.value=''}}/>
                  </label>
                </div>

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
            </motion.div>
          )}

          {tab === 'resumen' && (
            <motion.div key="resumen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-5xl flex flex-col h-full">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div className="text-sm font-bold text-blue-400">Resumen de {resumenData.length} Vehículos</div>
                <div className="flex gap-2">
                   <Btn onClick={copiarTabla} variant="secondary" size="sm">📋 Copiar HTML</Btn>
                   <Btn onClick={() => exportarImagen('png')} variant="secondary" size="sm">🖼️ PNG</Btn>
                   <Btn onClick={() => exportarImagen('jpg')} variant="secondary" size="sm">🖼️ JPG</Btn>
                   <Btn onClick={exportarPDF} variant="secondary" size="sm">📄 PDF</Btn>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg border border-black/10 flex-1 overflow-auto custom-scrollbar p-6">
                {resumenData.length === 0 ? (
                  <div className="text-center text-gray-400 font-bold py-20 uppercase tracking-widest text-xs">Sin datos procesados</div>
                ) : (
                  <div ref={tableRef} style={{ background: '#ffffff', padding: '10px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Arial, sans-serif' }}>
                      <thead>
                        <tr>
                          {Object.keys(resumenData[0] || {}).map(k => (
                            <th key={k} style={TH_STYLE}>{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resumenData.map((row, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f0f6ff' }}>
                             {Object.values(row).map((v: any, j) => (
                               <td key={j} style={TD_STYLE}>{v}</td>
                             ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
