import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { Upload, Download, FileSpreadsheet, Target } from 'lucide-react'
import { useTheme, getThemeColors } from '../context/ThemeContext'
import { C, PageShell, Card, Btn, Badge } from '../ui/DS'
import GlassHeader, { GlassHeaderTab } from '../components/ui/GlassHeader'

const R24_TABS: GlassHeaderTab[] = [
  { id: 'prep',    label: 'Preparación', icon: '🛠️', badgeVariant: 'blue'   },
  { id: 'log',     label: 'Actividad',   icon: '📈', badgeVariant: 'orange' },
  { id: 'exports', label: 'Exportación', icon: '🚀', badgeVariant: 'green'  },
]

const MINI_COMUNAS = new Set(["ÑUÑOA", "NUNOA", "LAS CONDES", "VITACURA", "PROVIDENCIA", "SANTIAGO"])

function removeAccents(str: any) {
  return str ? String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim() : ""
}

function esComunaMini(c: string) {
  return MINI_COMUNAS.has(removeAccents(c)) || MINI_COMUNAS.has((c || '').toUpperCase().trim())
}

function getFechaMañana() {
  const f = new Date(); f.setDate(f.getDate() + 1)
  return `${String(f.getDate()).padStart(2, '0')}-${String(f.getMonth() + 1).padStart(2, '0')}-${f.getFullYear()}`
}

function getFechaHoy() {
  const f = new Date()
  return `${String(f.getDate()).padStart(2, '0')}-${String(f.getMonth() + 1).padStart(2, '0')}-${f.getFullYear()}`
}

function readFile(file: File, sheetName?: string): Promise<any[]> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'binary' })
        let ws = wb.Sheets[wb.SheetNames[0]]
        if (sheetName && wb.Sheets[sheetName]) {
          ws = wb.Sheets[sheetName]
        }
        res(XLSX.utils.sheet_to_json(ws, { defval: '' }))
      } catch (err) { rej(err) }
    }
    reader.onerror = rej
    reader.readAsBinaryString(file)
  })
}

function exportXlsx(data: any[], nombre: string, skipHeader = false) {
  const ws = XLSX.utils.json_to_sheet(data, { skipHeader })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, nombre)
}

function findCol(row: any, opts: string[]) {
  const keys = Object.keys(row)
  return keys.find(k => opts.some(o => k.toLowerCase().trim() === o.toLowerCase().trim()))
    || keys.find(k => opts.some(o => k.toLowerCase().includes(o.toLowerCase())))
}

export default function Ruteo24h() {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)

  const [dataF1, setDataF1] = useState<any[] | null>(null)
  const [f1Name, setF1Name] = useState('')
  const [filesPost, setFilesPost] = useState<{ isos: File | null, plan: File | null, conv: File | null }>({ isos: null, plan: null, conv: null })
  
  const [activeTab, setActiveTab] = useState<'prep' | 'log' | 'exports'>('prep')
  const [logs, setLogs] = useState<{ ts: string, msg: string, type: 'info' | 'ok' | 'err' | 'warn' }[]>([])
  
  const [postResult, setPostResult] = useState<{ allRows: any[], postSalesRows: any[], restoRows: any[], matched: number } | null>(null)
  const [processing, setProcessing] = useState(false)

  const addLog = useCallback((msg: string, type: 'info' | 'ok' | 'err' | 'warn' = 'info') => {
    setLogs(prev => [...prev, { ts: new Date().toLocaleTimeString('es'), msg, type }])
  }, [])

  const handleF1 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = await readFile(file)
      setDataF1(data)
      setF1Name(file.name)
      addLog(`Pre Ruteo: ${data.length} filas cargadas — ${file.name}`, 'ok')
    } catch (err) {
      addLog(`Error al leer archivo SCI: ${err}`, 'err')
    }
    e.target.value = ''
  }

  // Pre Ruteo Exports
  const handlePreRuteoExport = (type: 'proyectos' | 'post_sales' | 'mini' | 'regular') => {
    if (!dataF1) return addLog('Carga el archivo SCI primero', 'warn')
    let rows: any[] = []
    let name = ''

    if (type === 'proyectos') {
      rows = dataF1.filter(r => r['TIPO_VISITA'] === 'PROJECT')
      name = `RUTEAR PROYECTOS ${getFechaMañana()}.xlsx`
    } else if (type === 'post_sales') {
      rows = dataF1.filter(r => r['TIPO_VISITA'] === 'POST_SALES')
      name = `RUTEAR POST SALES ${getFechaMañana()}.xlsx`
    } else if (type === 'mini') {
      rows = dataF1.filter(r => {
        if (r['TIPO_VISITA'] === 'PROJECT' || r['TIPO_VISITA'] === 'POST_SALES') return false
        if (r['MINI_TICKET'] !== 'mini_ticket') return false
        return esComunaMini(r['D_COUNTY'] || r['CONDUCTOR'] || r['Conductor'] || '')
      })
      name = `RUTEAR MINI TICKET ${getFechaMañana()}.xlsx`
    } else {
      rows = dataF1.filter(r => {
        if (r['TIPO_VISITA'] === 'PROJECT' || r['TIPO_VISITA'] === 'POST_SALES') return false
        if (r['MINI_TICKET'] === 'no_mini_ticket') return true
        if (r['MINI_TICKET'] === 'mini_ticket') return !esComunaMini(r['D_COUNTY'] || r['CONDUCTOR'] || r['Conductor'] || '')
        return false
      })
      name = `RUTEAR TICKET ${getFechaMañana()}.xlsx`
    }

    if (!rows.length) return addLog(`Sin datos para ${type}`, 'warn')
    exportXlsx(rows, name)
    addLog(`${name} exportado: ${rows.length} filas`, 'ok')
  }

  const handleSetPostFile = (key: 'isos' | 'plan' | 'conv', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFilesPost(p => ({ ...p, [key]: file }))
    addLog(`Archivo "${key}" cargado: ${file.name}`, 'info')
    e.target.value = ''
  }

  const procesarPostRuteo = async () => {
    if (!filesPost.isos || !filesPost.plan || !filesPost.conv) {
      addLog('Faltan archivos para el Post Ruteo', 'warn')
      return
    }
    setProcessing(true)
    addLog('Iniciando Post Ruteo...', 'info')

    try {
      const [rowsISOs, rowsPlan, rowsConv] = await Promise.all([
        readFile(filesPost.isos), readFile(filesPost.plan), readFile(filesPost.conv, 'Plan')
      ])
      addLog(`Leídos - ISOs: ${rowsISOs.length} | Plan: ${rowsPlan.length} | Conversión: ${rowsConv.length}`, 'info')

      const kISO = findCol(rowsISOs[0] || {}, ['ISO', 'iso', 'Iso'])
      const kTit = findCol(rowsPlan[0] || {}, ['Título', 'Titulo', 'TITULO', 'TÍTULO', 'Title', 'ISO'])
      const kDofi = findCol(rowsPlan[0] || {}, ['ID de referencia', 'ID_REFERENCIA', 'DOFI', 'Dofi', 'id de referencia'])
      const kVehI = findCol(rowsPlan[0] || {}, ['Vehículo', 'Vehiculo', 'VEHICULO', 'VEHÍCULO', 'Vehicle', 'Ruta'])
      const kVini = findCol(rowsConv[0] || {}, ['VEH INICIAL', 'VEH_INICIAL', 'INICIAL', 'veh inicial'])
      const kVfin = findCol(rowsConv[0] || {}, ['VEH FINAL', 'VEH_FINAL', 'FINAL', 'veh final'])

      if (!kISO) throw new Error(`Sin columna ISO. Cols: ${Object.keys(rowsISOs[0] || {}).join(', ')}`)
      if (!kTit) throw new Error(`Sin columna Título. Cols: ${Object.keys(rowsPlan[0] || {}).join(', ')}`)
      if (!kDofi) throw new Error(`Sin ID de referencia en el Plan.`)
      if (!kVehI) throw new Error(`Sin Vehículo en el Plan.`)
      if (!kVini) throw new Error(`Sin VEH INICIAL en Conversión.`)
      if (!kVfin) throw new Error(`Sin VEH FINAL en Conversión.`)

      const mapConv: any = {}
      rowsConv.forEach(r => {
        const ini = (r[kVini] || '').trim().toUpperCase()
        const fin = (r[kVfin] || '').trim().toUpperCase()
        if (ini) mapConv[ini] = fin || ini
      })

      const mapPlan: any = {}
      rowsPlan.forEach(r => {
        const t = (r[kTit] || '').trim().toUpperCase()
        if (!t || t === 'INICIO' || t === 'FIN') return
        const vehIni = (r[kVehI] || '').trim().toUpperCase()
        const vehFin = mapConv[vehIni] || vehIni
        mapPlan[t] = { dofi: (r[kDofi] || '').trim(), vehIni, vehFin }
      })

      const isosRuteadas = rowsISOs
        .map(r => (r[kISO] || '').trim().toUpperCase())
        .filter(iso => iso && iso !== 'INICIO' && iso !== 'FIN')

      let matched = 0, unmatched = 0
      const resultado = isosRuteadas.map(iso => {
        const found = mapPlan[iso]
        if (found) {
          matched++
          return { iso, dofi: found.dofi, vehIni: found.vehIni, vehFin: found.vehFin, _found: true }
        } else {
          unmatched++
          return { iso, dofi: '', vehIni: '', vehFin: '', _found: false }
        }
      })

      addLog(`Cruce: ${matched} encontradas, ${unmatched} sin match`, unmatched > 0 ? 'warn' : 'ok')

      const PS_VEHS = new Set(['VEH99', 'VEH101', 'VEH102', 'POST VENTA', 'POSTVENTA'])
      const isPostSales = (r: any) => {
        const v = (r.vehFin || r.vehIni || '').toUpperCase()
        return PS_VEHS.has(v) || v.includes('POST') || v.includes('POSTVENTA')
      }

      const postSalesRows = resultado.filter(r => r._found && isPostSales(r)).map(r => ({ ...r, vehFin: 'VEH99' }))
      const restoRows = resultado.filter(r => r._found && !isPostSales(r))

      setPostResult({ allRows: resultado, postSalesRows, restoRows, matched })
      addLog(`Post Sales: ${postSalesRows.length} | Resto: ${restoRows.length}`, 'ok')
      setActiveTab('exports')

    } catch (e: any) {
      addLog('ERROR: ' + e.message, 'err')
    } finally {
      setProcessing(false)
    }
  }

  const handlePostExport = (type: 'preola' | 'post_sales') => {
    if (!postResult) return addLog('Procesa el Post Ruteo primero', 'warn')
    let rows: any[] = []
    let name = ''

    if (type === 'preola') {
      rows = postResult.restoRows.filter(r => r.dofi).map(r => ({ A: r.dofi, B: r.vehFin }))
      name = `PREOLA ROUTE TO ${getFechaHoy()} entregas ${getFechaMañana()}.xlsx`
    } else if (type === 'post_sales') {
      rows = postResult.postSalesRows.filter(r => r.dofi).map(r => ({ A: r.dofi, B: r.vehFin }))
      name = `POST SALES ROUTE TO ${getFechaHoy()} entregas ${getFechaMañana()}.xlsx`
    }

    if (!rows.length) return addLog(`Sin filas para exportar (${type})`, 'warn')
    exportXlsx(rows, name, true)
    addLog(`${name} exportado: ${rows.length} filas`, 'ok')
  }

  return (
    <PageShell>
      <GlassHeader 
        appName="Ruteo 24H Engine"
        icon="🕒"
        tabs={R24_TABS}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as any)}
        badges={{
          exports: postResult?.matched || 0
        }}
      />

      <div className="flex-1 overflow-hidden" style={{ background: TC.bg }}>
        <div className="h-full overflow-y-auto p-6">
          
          {activeTab === 'prep' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: TC.textDisabled }}>1. Pre-Routing</h2>
                <Card style={{ padding: 24 }}>
                  <div className="text-[11px] font-semibold mb-3" style={{ color: TC.textSub }}>Archivo Base SCI</div>
                  <label className="flex flex-col items-center justify-center gap-3 w-full p-8 rounded-xl border-2 border-dashed hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-all mb-4" style={{ borderColor: TC.border }}>
                    <Upload size={24} color={C.blue} />
                    <div className="text-center">
                      <div className="text-sm font-bold" style={{ color: TC.text }}>{f1Name || 'Seleccionar archivo...'}</div>
                      <div className="text-[10px]" style={{ color: TC.textFaint }}>Formatos aceptados: .xlsx, .xls</div>
                    </div>
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleF1} />
                  </label>
                  {dataF1 && (
                    <div className="flex flex-col gap-2">
                      <Badge variant="blue" style={{ padding: '8px 12px', justifyContent: 'center' }}>✓ {dataF1.length} filas preparadas</Badge>
                      <Btn onClick={() => handlePreRuteoExport('proyectos')} style={{ width: '100%' }}>Descargar Proyectos</Btn>
                      <Btn onClick={() => handlePreRuteoExport('post_sales')} style={{ width: '100%' }}>Descargar Post Sales</Btn>
                    </div>
                  )}
                </Card>
              </div>

              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: TC.textDisabled }}>2. Post-Routing</h2>
                <Card style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div className="text-[11px] font-semibold mb-2" style={{ color: TC.textSub }}>1. Ruteo formato Simpliroute <span className="text-red-500">*</span></div>
                    <label className="flex items-center gap-3 w-full p-3 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors" style={{ borderColor: TC.borderSoft, background: TC.bg }}>
                      <FileSpreadsheet size={16} color={TC.textFaint} />
                      <span className="text-xs truncate flex-1" style={{ color: TC.text }}>{filesPost.isos?.name || 'Subir ISOs...'}</span>
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleSetPostFile('isos', e)} />
                    </label>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold mb-2" style={{ color: TC.textSub }}>2. Plan Simpliroute <span className="text-red-500">*</span></div>
                    <label className="flex items-center gap-3 w-full p-3 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors" style={{ borderColor: TC.borderSoft, background: TC.bg }}>
                      <FileSpreadsheet size={16} color={TC.textFaint} />
                      <span className="text-xs truncate flex-1" style={{ color: TC.text }}>{filesPost.plan?.name || 'Subir Plan...'}</span>
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleSetPostFile('plan', e)} />
                    </label>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold mb-2" style={{ color: TC.textSub }}>3. Conversión Vehículos <span className="text-red-500">*</span></div>
                    <label className="flex items-center gap-3 w-full p-3 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors" style={{ borderColor: TC.borderSoft, background: TC.bg }}>
                      <FileSpreadsheet size={16} color={TC.textFaint} />
                      <span className="text-xs truncate flex-1" style={{ color: TC.text }}>{filesPost.conv?.name || 'Subir Conversión...'}</span>
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleSetPostFile('conv', e)} />
                    </label>
                  </div>
                  <Btn variant="primary" style={{ width: '100%', padding: '12px', marginTop: 8 }} onClick={procesarPostRuteo} disabled={processing || !filesPost.isos || !filesPost.plan || !filesPost.conv}>
                    {processing ? 'Procesando...' : '▶ Procesar Post Ruteo'}
                  </Btn>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'log' && (
            <div className="flex flex-col h-full gap-4 max-w-5xl mx-auto">
              {postResult && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl border" style={{ borderColor: TC.borderSoft, background: TC.bgCard }}>
                  <div className="text-center p-2"><div className="text-2xl font-bold font-mono" style={{ color: TC.text }}>{postResult.allRows.length}</div><div className="text-[10px] uppercase tracking-wider text-gray-500">ISOs Total</div></div>
                  <div className="text-center p-2 border-l" style={{ borderColor: TC.borderSoft }}><div className="text-2xl font-bold font-mono text-green-500">{postResult.matched}</div><div className="text-[10px] uppercase tracking-wider text-gray-500">Match</div></div>
                  <div className="text-center p-2 border-l" style={{ borderColor: TC.borderSoft }}><div className="text-2xl font-bold font-mono text-blue-500">{postResult.postSalesRows.length}</div><div className="text-[10px] uppercase tracking-wider text-gray-500">Post Sales</div></div>
                  <div className="text-center p-2 border-l" style={{ borderColor: TC.borderSoft }}><div className="text-2xl font-bold font-mono text-purple-500">{postResult.restoRows.length}</div><div className="text-[10px] uppercase tracking-wider text-gray-500">Resto</div></div>
                </div>
              )}
              
              <div className="flex-1 rounded-xl border overflow-y-auto font-mono text-xs p-5 flex flex-col gap-2 min-h-[400px]" style={{ background: '#0d1117', borderColor: TC.borderSoft, color: '#e6edf3', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)' }}>
                {logs.length === 0 && <div className="text-gray-500 italic pb-10">Esperando acciones para generar logs...</div>}
                {logs.map((L, i) => (
                  <div key={i} className="flex gap-4 border-b border-white/5 pb-1">
                    <span className="text-gray-500 shrink-0 opacity-50">[{L.ts}]</span>
                    <span className={L.type === 'err' ? 'text-red-400' : L.type === 'warn' ? 'text-yellow-400' : L.type === 'ok' ? 'text-green-400' : 'text-blue-300'}>
                      {L.msg}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'exports' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto py-4">
              <Card style={{ padding: 24 }}>
                <h3 className="text-sm font-bold mb-6 flex items-center gap-3 border-b pb-3" style={{ borderColor: TC.borderSoft, color: TC.text }}>
                  <Upload size={18} color={C.blue} /> Descargas Pre-Ruteo
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  <Btn onClick={() => handlePreRuteoExport('proyectos')} disabled={!dataF1} style={{ justifyContent: 'flex-start', padding: '12px 18px' }}><Download size={16} /> Descargar Proyectos</Btn>
                  <Btn onClick={() => handlePreRuteoExport('post_sales')} disabled={!dataF1} style={{ justifyContent: 'flex-start', padding: '12px 18px' }}><Download size={16} /> Descargar Post Sales</Btn>
                  <Btn onClick={() => handlePreRuteoExport('mini')} disabled={!dataF1} style={{ justifyContent: 'flex-start', padding: '12px 18px' }}><Download size={16} /> Descargar Mini Ticket</Btn>
                  <Btn onClick={() => handlePreRuteoExport('regular')} disabled={!dataF1} style={{ justifyContent: 'flex-start', padding: '12px 18px' }}><Download size={16} /> Descargar Ticket Regular</Btn>
                </div>
              </Card>

              <Card style={{ padding: 24 }}>
                <h3 className="text-sm font-bold mb-6 flex items-center gap-3 border-b pb-3" style={{ borderColor: TC.borderSoft, color: TC.text }}>
                  <Target size={18} className="text-orange-500" /> Descargas Post-Ruteo
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  <Btn variant="primary" onClick={() => handlePostExport('preola')} disabled={!postResult} style={{ justifyContent: 'flex-start', padding: '12px 18px', background: '#f0883e', borderColor: '#f0883e' }}><Download size={16} /> Preola Completa</Btn>
                  <Btn onClick={() => handlePostExport('post_sales')} disabled={!postResult} style={{ justifyContent: 'flex-start', padding: '12px 18px' }}><Download size={16} /> Solo Post Sales</Btn>
                </div>
              </Card>
            </div>
          )}

        </div>
      </div>
    </PageShell>
  )
}
