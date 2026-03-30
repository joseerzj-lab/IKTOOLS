import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import { useTableSelection } from '../hooks/useTableSelection'
import { Upload, Search, Clipboard, AlertCircle } from 'lucide-react'
import { useTheme, getThemeColors } from '../context/ThemeContext'
import { C, PageShell, Card, Btn, Badge } from '../ui/DS'
import GlassHeader, { GlassHeaderTab } from '../components/ui/GlassHeader'

const DESPACHOS_TABS: GlassHeaderTab[] = [
  { id: 'carga', label: 'Carga de Datos', icon: '📥', badgeVariant: 'blue' },
  { id: 'vehiculos', label: 'Vehículos Check', icon: '🚚', badgeVariant: 'green' },
  { id: 'isos', label: 'ISOs No Asignadas', icon: '📍', badgeVariant: 'orange' },
]

/* CSV helpers */
function detectSep(line: string) { const s = (line.match(/;/g)||[]).length, c = (line.match(/,/g)||[]).length, t = (line.match(/\t/g)||[]).length; if (t > s && t > c) return '\t'; return s > c ? ';' : ',' }
function parseRow(line: string, sep: string) { const r: string[] = []; let cur = '', inQ = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"') inQ = !inQ; else if (c === sep && !inQ) { r.push(cur); cur = '' } else cur += c } r.push(cur); return r }
function clean(s: any) { return (s||'').toString().trim().replace(/^"|"$/g,'').trim() }
function findCol(headers: string[], candidates: string[]) { for (const c of candidates) { const i = headers.findIndex(h => h.toLowerCase() === c.toLowerCase()); if (i !== -1) return headers[i] } for (const c of candidates) { const i = headers.findIndex(h => h.toLowerCase().includes(c.toLowerCase())); if (i !== -1) return headers[i] } return null }

const BASE_URL = 'https://api.simpliroute.com'
const CORS_PROXIES = [
  (url:string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url:string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
]

type VehResult = { vehiculo: string; vehFinal: string; patente: string; estado: 'entregado' | 'pendiente' }
type IsoRow = { ISO: string; PATENTE: string; ESTADO: string; VEHICULO_SIMPLI: string; ANALISIS: string; _dup: boolean }

export default function ControlDespachos() {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)

  const [activeTab, setActiveTab] = useState<'carga'|'vehiculos'|'isos'>('carga')
  const [toast, setToast] = useState('')

  /* Carga State */
  const [baseData, setBaseData] = useState<any[] | null>(null) // Para reporteData literal (CSV)
  const [reporteMap, setReporteMap] = useState<Map<string,string> | null>(null) // Para Vehículos (Parent -> Patente)
  const [simpliData, setSimpliData] = useState<{vehiculo:string;titulo:string}[] | null>(null)
  const [conversionMap, setConversionMap] = useState<Map<string,string> | null>(null)
  const [stats, setStats] = useState<{s1:any;s2:any;s3:any}>({s1:null,s2:null,s3:null})

  /* API State */
  const [token, setToken] = useState('b388c699ed3bc4ecd2f748383e40b94ff650a8f6')
  const [fecha, setFecha] = useState(() => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}` })
  const [apiCache, setApiCache] = useState<{fecha: string; dfSimpli: any[]}|null>(null)
  const [apiLoading, setApiLoading] = useState(false)
  const [apiStatus, setApiStatus] = useState('')
  const [apiProgress, setApiProgress] = useState(0)

  /* Resultados State */
  const [resultadoVeh, setResultadoVeh] = useState<VehResult[]>([])
  const [resultadoIso, setResultadoIso] = useState<IsoRow[]>([])

  /* Filtros & Config */
  const [filterVehQ, setFilterVehQ] = useState('')
  const [filterIsoQ, setFilterIsoQ] = useState('')

  const [ignorarVehiculos, setIgnorarVehiculos] = useState<string[]>([])
  const [editandoIgnorados, setEditandoIgnorados] = useState(false)

  const tableRefVeh = useRef<HTMLTableElement>(null)
  const tableRefIso = useRef<HTMLTableElement>(null)
  useTableSelection(tableRefVeh)
  useTableSelection(tableRefIso)

  const flash = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }, [])

  useEffect(() => {
    const saved = localStorage.getItem('control_despachos_ignorados')
    if (saved) {
      try { setIgnorarVehiculos(JSON.parse(saved)) } catch {}
    }
  }, [])

  const saveIgnorados = (arr: string[]) => {
    setIgnorarVehiculos(arr)
    localStorage.setItem('control_despachos_ignorados', JSON.stringify(arr))
  }

  /* ── FILE 1: Reporte CSV / Base ISOs ── */
  const handleReporte = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const lines = text.split(/\r?\n/).filter(l => l.trim()); if (lines.length < 2) return
      const sep = detectSep(lines[0]); const headers = parseRow(lines[0], sep).map(clean)
      const colCom = findCol(headers, ['commerce']), colPar = findCol(headers, ['parentorder','parent_order']), colPat = findCol(headers, ['patente','Patente','placa'])
      
      const map = new Map<string,string>()
      const rawData: any[] = []
      let ikeaCount = 0, withPat = 0
      
      for (let i = 1; i < lines.length; i++) {
        const cols = parseRow(lines[i], sep).map(clean)
        const obj: any = {}; headers.forEach((h,j) => obj[h] = cols[j]||'')
        rawData.push(obj)
        if (colCom && obj[colCom].toUpperCase().trim() !== 'IKEA') continue
        ikeaCount++
        if (!colPat || !obj[colPat].trim()) continue
        withPat++
        if (colPar) map.set(obj[colPar].trim().toLowerCase(), obj[colPat].trim())
      }
      setBaseData(rawData)
      setReporteMap(map)
      setStats(p => ({...p, s1: { total: lines.length-1, ikea: ikeaCount, patente: withPat, name: file.name }}))
    }
    reader.readAsText(file, 'UTF-8'); e.target.value = ''
  }

  /* ── FILE 2: Plan Simpliroute ── */
  const handleSimpli = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    const reader = new FileReader()
    reader.onload = ev => {
      let rows: any[] = []
      if (ext === 'xlsx' || ext === 'xls') {
        const wb = XLSX.read(new Uint8Array(ev.target?.result as ArrayBuffer), { type: 'array' })
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      } else {
        const text = ev.target?.result as string; const lines = text.split(/\r?\n/).filter(l => l.trim()); if (lines.length < 2) return
        const sep = detectSep(lines[0]); const headers = parseRow(lines[0], sep).map(clean)
        rows = lines.slice(1).map(line => { const cols = parseRow(line, sep).map(clean); const obj: any = {}; headers.forEach((h,j) => obj[h] = cols[j]||''); return obj })
      }
      const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      const hKeys = Object.keys(rows[0] || {})
      const fk = (cands: string[]) => { for (const c of cands) { const k = hKeys.find(h => norm(h) === norm(c)); if (k) return k } for (const c of cands) { const k = hKeys.find(h => norm(h).includes(norm(c))); if (k) return k } return null }
      const colVeh = fk(['vehículo','vehiculo','vehicle','veh']), colTit = fk(['título','titulo','title','iso','parentorder'])
      if (!colVeh || !colTit) return
      const data = rows.filter(r => r[colVeh].toString().trim() && r[colTit].toString().trim()).map(r => ({ vehiculo: r[colVeh].toString().trim(), titulo: r[colTit].toString().trim() }))
      setSimpliData(data)
      const vehs = new Set(data.map(d => d.vehiculo)).size
      setStats(p => ({...p, s2: { isos: data.length, vehs, name: file.name }}))
    }
    if (ext === 'xlsx' || ext === 'xls') reader.readAsArrayBuffer(file); else reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  /* ── FILE 3: Conversión ── */
  const handleConversion = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const wb = XLSX.read(new Uint8Array(ev.target?.result as ArrayBuffer), { type: 'array' })
      const sheetName = wb.SheetNames.find((n: string) => n.trim().toLowerCase() === 'plan') || wb.SheetNames[0]
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' }) as any[]
      const headers = Object.keys(rows[0] || {})
      const norm2 = (s: string) => s.trim().toLowerCase().replace(/[áàä]/g,'a').replace(/[éèë]/g,'e').replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u')
      const colIni = headers.find(h => norm2(h).includes('veh') && norm2(h).includes('inic'))
      const colFin = headers.find(h => norm2(h).includes('veh') && norm2(h).includes('fin'))
      if (!colIni || !colFin) return
      const map = new Map<string,string>()
      rows.forEach(r => { const ini = r[colIni].toString().trim(); if (ini) map.set(ini.toLowerCase(), r[colFin].toString().trim() || ini) })
      setConversionMap(map)
      setStats(p => ({...p, s3: { count: map.size, name: file.name }}))
    }
    reader.readAsArrayBuffer(file); e.target.value = ''
  }

  /* ── API CALL ── */
  async function apiGet(endpoint:string, params:Record<string,string>={}) {
    const target = new URL(BASE_URL+endpoint); Object.entries(params).forEach(([k,v])=>target.searchParams.append(k,v))
    const directUrl = target.toString()
    const attempts = [
      { url: directUrl, headers: { 'Authorization': `Token ${token}` } },
      ...CORS_PROXIES.map(fn => ({ url: fn(directUrl), headers: { 'Authorization': `Token ${token}`, 'x-requested-with': 'XMLHttpRequest' } }))
    ]
    for (const attempt of attempts) { try { const r = await fetch(attempt.url, { headers: attempt.headers }); if(!r.ok) continue; const data = await r.json(); return Array.isArray(data)?data:data.results||data } catch {} }
    return null
  }

  const fetchApiSimpli = async () => {
    if (!token.trim()) return null
    if (apiCache && apiCache.fecha === fecha) {
      setApiStatus('Usando caché de SimpliRoute…')
      return apiCache.dfSimpli
    }
    setApiLoading(true); setApiStatus('Consultando SimpliRoute…'); setApiProgress(5)
    const visits = await apiGet('/v1/routes/visits/', { planned_date: fecha }); if(!visits) { setApiStatus('❌ Error de conexión API'); setApiLoading(false); setApiProgress(0); return null }
    if(!visits.length) { setApiStatus(`⚠️ Sin visitas para ${fecha}`); setApiLoading(false); setApiProgress(0); return null }
    setApiProgress(10); setApiStatus('Obteniendo detalles de ISOs…')
    const CHUNK = 20; const dfSimpli: any[] = []
    for (let i = 0; i < visits.length; i += CHUNK) {
      const batch = visits.slice(i, i+CHUNK)
      const details = await Promise.all(batch.map(async (v:any) => { const d = await apiGet(`/v1/plans/visits/${v.id}/detail/`) || {}; return { ISO: String(v.title||'S/N').trim(), VEHICULO_SIMPLI: String(d.vehicle_name||v.vehicle_name||'').trim(), CONDUCTOR_SIMPLI: String(d.driver_name||'').trim() } }))
      dfSimpli.push(...details); setApiProgress(10+70*((i+CHUNK)/visits.length))
    }
    setApiCache({ fecha, dfSimpli })
    setApiProgress(100); setTimeout(()=>setApiProgress(0),600)
    setApiLoading(false)
    setApiStatus('✅ API SimpliRoute Lista')
    return dfSimpli
  }

  /* ── PROCESAR TODO ── */
  const procesar = async () => {
    if (!baseData || !reporteMap || !simpliData) return
    
    // 1. Cruzar Vehículos Check
    const vehiculos = new Map<string, { isos: string[]; patentes: Set<string> }>()
    simpliData.forEach(({ vehiculo, titulo }) => {
      if (!vehiculos.has(vehiculo)) vehiculos.set(vehiculo, { isos: [], patentes: new Set() })
      const entry = vehiculos.get(vehiculo)!
      entry.isos.push(titulo)
      const pat = reporteMap.get(titulo.trim().toLowerCase())
      if (pat) entry.patentes.add(pat)
    })
    const resVeh: VehResult[] = []
    vehiculos.forEach((v, vehiculo) => {
      const patente = v.patentes.size > 0 ? [...v.patentes].join(' / ') : ''
      let vehFinal = vehiculo
      if (conversionMap) { const mapped = conversionMap.get(vehiculo.toLowerCase()); if (mapped) vehFinal = mapped }
      resVeh.push({ vehiculo, vehFinal, patente, estado: patente ? 'entregado' : 'pendiente' })
    })
    resVeh.sort((a,b) => { if (a.estado !== b.estado) return a.estado === 'entregado' ? -1 : 1; return a.vehFinal.localeCompare(b.vehFinal) })
    setResultadoVeh(resVeh)

    // 2. Procesar ISOs (API + Filtros)
    const dfSimpli = await fetchApiSimpli()
    if (!dfSimpli) return

    setApiStatus('Cruzando ISOs con la base…'); setApiProgress(85)
    
    // Identificar ISOs en la Base CSV que no tienen patente ni estado (no han salido)
    const keys = Object.keys(baseData[0]||{})
    const colCom = keys.find(k=>k.toLowerCase()==='commerce'), colPat = keys.find(k=>k.toLowerCase()==='patente'), colIso = keys.find(k=>k.toLowerCase()==='parentorder'), colEst = keys.find(k=>k.toLowerCase()==='estado')
    
    const baseUnassigned = baseData.filter(r => {
      if (colCom && (r[colCom]||'').toUpperCase().trim() !== 'IKEA') return false
      const pat = (r[colPat||'']||'').trim(), est = (r[colEst||'']||'').trim()
      // Filtramos las que NO tienen patente ni estado
      return !pat && !est
    })

    const baseRef:Record<string, {PATENTE:string;ESTADO:string}> = {}
    baseUnassigned.forEach(row=>{const iso=(row[colIso||'']||'').trim(); if(iso) baseRef[iso]={PATENTE:(row[colPat||'']||'').trim(), ESTADO:(row[colEst||'']||'').trim()}})

    const isoCount:Record<string,number>={}; dfSimpli.forEach(v=>{isoCount[v.ISO]=(isoCount[v.ISO]||0)+1})
    const masterData: IsoRow[] = []

    // Las ISOs a evaluar son las que salieron en la API sin conductor
    dfSimpli.forEach(row => {
      if(row.CONDUCTOR_SIMPLI!=='') return
      
      const baseObj = baseRef[row.ISO]
      // Si la ISO de la app no está en las no asignadas de la base, capaz sí salio, la ignoramos.
      if(!baseObj) return

      let analisis=''
      let dup=false
      if(isoCount[row.ISO]>1){ const otra=dfSimpli.find(r=>r.ISO===row.ISO&&r.CONDUCTOR_SIMPLI!==''); if(otra){analisis=`DUPLICADA (En ${otra.VEHICULO_SIMPLI||otra.ISO})`; dup=true} }
      
      masterData.push({ ISO:row.ISO, PATENTE:baseObj.PATENTE, ESTADO:baseObj.ESTADO, VEHICULO_SIMPLI:row.VEHICULO_SIMPLI, ANALISIS:analisis, _dup:dup })
    })

    setResultadoIso(masterData)
    setApiProgress(100); setTimeout(()=>setApiProgress(0),600)
    setApiStatus(`✅ Datos procesados con éxito.`)

    // Automáticamente ir a Vehiculos
    setActiveTab('vehiculos')
  }

  const [sortConfigVeh, setSortConfigVeh] = useState<{key:string, dir:'asc'|'desc'} | null>(null)
  const [sortConfigIso, setSortConfigIso] = useState<{key:string, dir:'asc'|'desc'} | null>(null)

  const handleSortVeh = (key: string) => {
    let dir: 'asc'|'desc' = 'asc'
    if (sortConfigVeh && sortConfigVeh.key === key && sortConfigVeh.dir === 'asc') dir = 'desc'
    setSortConfigVeh({key, dir})
  }
  const handleSortIso = (key: string) => {
    let dir: 'asc'|'desc' = 'asc'
    if (sortConfigIso && sortConfigIso.key === key && sortConfigIso.dir === 'asc') dir = 'desc'
    setSortConfigIso({key, dir})
  }

  const sortedVeh = [...resultadoVeh].sort((a,b) => {
    if (!sortConfigVeh) return 0
    const {key, dir} = sortConfigVeh
    const valA = (a as any)[key], valB = (b as any)[key]
    if (valA < valB) return dir === 'asc' ? -1 : 1
    if (valA > valB) return dir === 'asc' ? 1 : -1
    return 0
  })

  const sortedIso = [...resultadoIso].sort((a,b) => {
    if (!sortConfigIso) return 0
    const {key, dir} = sortConfigIso
    const valA = (a as any)[key], valB = (b as any)[key]
    if (valA < valB) return dir === 'asc' ? -1 : 1
    if (valA > valB) return dir === 'asc' ? 1 : -1
    return 0
  })

  const filteredVeh = sortedVeh.filter(r => !ignorarVehiculos.includes(r.vehFinal)).filter(r => !filterVehQ || r.vehiculo.toLowerCase().includes(filterVehQ.toLowerCase()) || r.patente.toLowerCase().includes(filterVehQ.toLowerCase()) || r.vehFinal.toLowerCase().includes(filterVehQ.toLowerCase()))
  const filteredIso = sortedIso.filter(r => !filterIsoQ || r.ISO.toLowerCase().includes(filterIsoQ.toLowerCase()) || r.VEHICULO_SIMPLI.toLowerCase().includes(filterIsoQ.toLowerCase()) || r.ANALISIS.toLowerCase().includes(filterIsoQ.toLowerCase()))

  const toggleIgnorar = (vehFinal: string) => {
    saveIgnorados(ignorarVehiculos.includes(vehFinal) ? ignorarVehiculos.filter(v => v !== vehFinal) : [...ignorarVehiculos, vehFinal])
  }

  const copiarVehiculos = () => {
    if(!filteredVeh.length) return
    let tsv = 'Vehículo\tVehículo Final\tPatente\tEstado\n'
    filteredVeh.forEach(r => { tsv += `${r.vehiculo}\t${r.vehFinal}\t${r.patente}\t${r.estado === 'entregado' ? 'Vehículo Entregado' : 'Vehículo Pendiente'}\n` })
    navigator.clipboard?.writeText(tsv).then(() => flash('✓ Tabla Vehículos copiada'))
  }

  const copiarColumnaISO = () => {
    if(!filteredIso.length) return
    let text = filteredIso.map(r => r.ISO).join('\n')
    navigator.clipboard?.writeText(text).then(() => flash('✓ Columna ISO copiada. Pega esto en reporte quiebres.'))
  }

  const pegarQuiebres = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      if (!lines.length) return flash('Portapapeles vacío')
      
      const newIso = [...resultadoIso]
      let mCount = 0
      
      lines.forEach(line => {
        const parts = line.split('\t').map(p => p.trim())
        if (parts.length >= 5) {
          const iso = parts[0]
          const isNotIncidence = parts[1] === '#N/A' && parts[2] === '#N/A' && parts[3] === '#N/A' && parts[4] === '#N/A'
          const rowIdx = newIso.findIndex(r => r.ISO === iso)
          
          if (rowIdx !== -1 && !isNotIncidence) {
            newIso[rowIdx] = { ...newIso[rowIdx], ANALISIS: 'Quiebre' }
            mCount++
          }
        }
      })
      
      setResultadoIso(newIso)
      flash(`✓ Se actualizaron ${mCount} registros a Quiebre`)
    } catch (e) {
      flash('❌ Error al leer portapapeles. Da permisos o copia una tabla válida.')
    }
  }

  const handleAnalisisChange = (iso: string, value: string) => {
    setResultadoIso(prev => prev.map(r => r.ISO === iso ? { ...r, ANALISIS: value } : r))
  }

  const getSortIcon = (key: string, type: 'veh'|'iso') => {
    const conf = type === 'veh' ? sortConfigVeh : sortConfigIso
    if (conf?.key !== key) return <span className="text-gray-500/30">↕</span>
    return conf.dir === 'asc' ? <span className="text-blue-500">↑</span> : <span className="text-blue-500">↓</span>
  }

  return (
    <PageShell>
      <GlassHeader 
        appName="CONTROL DE DESPACHOS"
        icon="🚚"
        tabs={DESPACHOS_TABS}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as any)}
        badges={{
          vehiculos: resultadoVeh.length,
          isos: resultadoIso.length
        }}
      />
      
      <div className="flex-1 overflow-hidden relative" style={{ background: TC.bg }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 flex flex-col overflow-hidden"
          >
            {activeTab === 'carga' && (
              <div className="h-full overflow-y-auto p-6">
                <div className="max-w-5xl mx-auto flex flex-col gap-6 py-4">
                  
                  {/* API SimpliRoute Top Params */}
                  <Card style={{ padding: 16 }}>
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-orange-500"/>
                        <span className="text-xs font-bold text-orange-500 uppercase tracking-wider">Params SimpliRoute</span>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold uppercase opacity-60">Fecha Plan</label>
                          <input type="date" className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-blue-500/50" value={fecha} onChange={e=>setFecha(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1 max-w-[200px]">
                          <label className="text-[10px] font-bold uppercase opacity-60">Token (Opcional)</label>
                          <input type="password" placeholder="SimpliRoute Token..." className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-blue-500/50" value={token} onChange={e=>setToken(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* 3 Steps */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Step 1 */}
                    <Card style={{ padding: 20 }}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">1</div>
                        <div className="text-xs font-bold uppercase tracking-wider" style={{ color: TC.text }}>Base CSV / Reporte</div>
                      </div>
                      <label className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed transition-all hover:bg-blue-500/5 cursor-pointer h-32" style={{ borderColor: TC.border }}>
                        <Upload size={20} color={C.blue} />
                        <span className="text-[11px] font-bold text-center px-2 truncate w-full" style={{ color: TC.textSub }}>{stats.s1?.name || 'Subir CSV o Excel...'}</span>
                        <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={handleReporte} />
                      </label>
                      {stats.s1 && (
                        <div className="mt-3 space-y-1">
                           <Badge variant="blue" style={{ fontSize: 9 }}>{stats.s1.ikea} IKEA</Badge>
                           <div className="text-[9px] opacity-50 px-1">{stats.s1.patente} con patente</div>
                        </div>
                      )}
                    </Card>

                    {/* Step 2 */}
                    <Card style={{ padding: 20 }}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold">2</div>
                        <div className="text-xs font-bold uppercase tracking-wider" style={{ color: TC.text }}>Plan SimpliRoute</div>
                      </div>
                      <label className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed transition-all hover:bg-orange-500/5 cursor-pointer h-32" style={{ borderColor: TC.border }}>
                        <Upload size={20} color="#f97316" />
                        <span className="text-[11px] font-bold text-center px-2 truncate w-full" style={{ color: TC.textSub }}>{stats.s2?.name || 'Subir XLSX/CSV...'}</span>
                        <input type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={handleSimpli} />
                      </label>
                      {stats.s2 && (
                        <div className="mt-3 space-y-1">
                           <Badge variant="blue" style={{ fontSize: 9 }}>{stats.s2.isos} ISOs</Badge>
                           <div className="text-[9px] opacity-50 px-1">{stats.s2.vehs} vehículos</div>
                        </div>
                      )}
                    </Card>

                    {/* Step 3 */}
                    <Card style={{ padding: 20 }}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">3</div>
                        <div className="text-xs font-bold uppercase tracking-wider" style={{ color: TC.text }}>Conversión</div>
                      </div>
                      <label className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed transition-all hover:bg-purple-500/5 cursor-pointer h-32" style={{ borderColor: TC.border }}>
                        <Upload size={20} color="#a855f7" />
                        <span className="text-[11px] font-bold text-center px-2 truncate w-full" style={{ color: TC.textSub }}>{stats.s3?.name || 'Opcional (XLSX)...'}</span>
                        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleConversion} />
                      </label>
                      {stats.s3 && (
                        <div className="mt-3 space-y-1">
                           <Badge variant="purple" style={{ fontSize: 9 }}>{stats.s3.count} mapeos</Badge>
                        </div>
                      )}
                    </Card>
                  </div>

                  <div className="flex flex-col items-center gap-4 mt-6">
                     {apiStatus && <div className="text-[11px] font-mono text-blue-400">{apiStatus}</div>}
                     {apiLoading && (
                       <div className="w-full max-w-sm h-1 bg-white/10 rounded overflow-hidden">
                         <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${apiProgress}%` }} />
                       </div>
                     )}
                     <Btn variant="primary" size="lg" style={{ padding: '16px 48px', fontSize: 14 }} onClick={procesar} disabled={!baseData || !simpliData || apiLoading}>
                       ⚡ Cruzar y Procesar
                     </Btn>
                  </div>

                </div>
              </div>
            )}
            
            {activeTab === 'vehiculos' && (
              <div className="h-full flex flex-col p-4 gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 max-w-lg">
                    <div className="relative flex-1">
                        <Search size={14} color={TC.textFaint} className="absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                          type="text" 
                          className="w-full pl-9 pr-4 py-2 rounded-xl text-xs transition-all focus:ring-2 focus:ring-blue-500/20 outline-none" 
                          style={{ background: TC.bgCard, color: TC.text, border: `1px solid ${TC.borderSoft}` }} 
                          placeholder="Filtrar por vehículo o patente..." 
                          value={filterVehQ} 
                          onChange={e => setFilterVehQ(e.target.value)}
                        />
                    </div>
                    <Btn variant="secondary" onClick={() => setEditandoIgnorados(!editandoIgnorados)} style={{ padding: '8px' }} title="Editar Ignorados">
                       <span className="text-[10px]">{editandoIgnorados ? 'Terminar Edición' : '⚙️ Filtros'}</span>
                    </Btn>
                    <Btn onClick={copiarVehiculos} disabled={!filteredVeh.length} style={{ padding: '8px 16px' }}>
                        <Clipboard size={14} /> <span className="text-[10px]">Copiar</span>
                    </Btn>
                  </div>
                </div>

                <Card style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
                  <div className="overflow-auto h-full">
                    <table ref={tableRefVeh} className="w-full text-xs font-mono" style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr className="sticky top-0 z-10 shadow-sm transition-colors">
                          <th className="text-left p-4 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-white/5" style={{ background: TC.headerBg, color: TC.textDisabled, borderBottom: `1px solid ${TC.borderSoft}` }} onClick={() => handleSortVeh('vehFinal')}>
                            Vehículo Final {getSortIcon('vehFinal', 'veh')}
                          </th>
                          <th className="text-left p-4 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-white/5" style={{ background: TC.headerBg, color: TC.textDisabled, borderBottom: `1px solid ${TC.borderSoft}` }} onClick={() => handleSortVeh('patente')}>
                            Patente {getSortIcon('patente', 'veh')}
                          </th>
                          <th className="text-left p-4 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-white/5" style={{ background: TC.headerBg, color: TC.textDisabled, borderBottom: `1px solid ${TC.borderSoft}` }} onClick={() => handleSortVeh('estado')}>
                            Estado {getSortIcon('estado', 'veh')}
                          </th>
                          {editandoIgnorados && (
                             <th className="text-right p-4 text-[10px] font-bold uppercase tracking-wider" style={{ background: TC.headerBg, color: TC.textDisabled, borderBottom: `1px solid ${TC.borderSoft}` }}>Acción</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVeh.map((r, i) => (
                          <tr key={i} className="group hover:bg-blue-500/5 transition-colors border-b" style={{ borderColor: TC.borderSoft }}>
                            <td className="p-4 font-bold" style={{ color: TC.text }}>{r.vehFinal} <span className="text-[9px] opacity-30 font-normal">({r.vehiculo})</span></td>
                            <td className="p-4">
                              {r.patente ? <span className="bg-blue-500/10 text-blue-400 font-bold px-2 py-1 rounded text-[10px] border border-blue-500/20">{r.patente}</span> : <span className="text-[10px] opacity-30 italic">No detectada</span>}
                            </td>
                            <td className="p-4">
                              {r.estado === 'entregado' ? (
                                <div className="flex items-center gap-2 text-green-500 font-bold"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Entregado</div>
                              ) : (
                                <div className="flex items-center gap-2 text-orange-400 font-bold"><div className="w-1.5 h-1.5 rounded-full bg-orange-400" />Pendiente</div>
                              )}
                            </td>
                            {editandoIgnorados && (
                              <td className="p-4 text-right">
                                <button className="text-[9px] text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500 px-2 py-1 rounded transition-colors" onClick={() => toggleIgnorar(r.vehFinal)}>Ocultar</button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'isos' && (
              <div className="h-full flex flex-col p-4 gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 max-w-lg">
                    <div className="relative flex-1">
                        <Search size={14} color={TC.textFaint} className="absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                          type="text" 
                          className="w-full pl-9 pr-4 py-2 rounded-xl text-xs transition-all focus:ring-2 focus:ring-orange-500/20 outline-none" 
                          style={{ background: TC.bgCard, color: TC.text, border: `1px solid ${TC.borderSoft}` }} 
                          placeholder="Filtrar por ISO, Vehículo o Análisis..." 
                          value={filterIsoQ} 
                          onChange={e => setFilterIsoQ(e.target.value)}
                        />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Btn onClick={copiarColumnaISO} disabled={!filteredIso.length} variant="secondary" style={{ padding: '8px 16px' }}>
                        <Clipboard size={14} /> <span className="text-[10px]">Copiar Columna ISOs</span>
                    </Btn>
                    <Btn onClick={pegarQuiebres} variant="primary" style={{ padding: '8px 16px', background: 'var(--c-orange)', borderColor: 'var(--c-orange)' }}>
                        <span className="text-[10px]">📋 Pegar Quiebres</span>
                    </Btn>
                  </div>
                </div>

                <Card style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
                  <div className="overflow-auto h-full">
                    <table ref={tableRefIso} className="w-full text-xs font-mono" style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr className="sticky top-0 z-10 shadow-sm transition-colors">
                          <th className="text-left p-4 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-white/5" style={{ background: TC.headerBg, color: TC.textDisabled, borderBottom: `1px solid ${TC.borderSoft}` }} onClick={() => handleSortIso('ISO')}>
                            ISO {getSortIcon('ISO', 'iso')}
                          </th>
                          <th className="text-left p-4 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-white/5" style={{ background: TC.headerBg, color: TC.textDisabled, borderBottom: `1px solid ${TC.borderSoft}` }} onClick={() => handleSortIso('VEHICULO_SIMPLI')}>
                            Vehículo Simpli {getSortIcon('VEHICULO_SIMPLI', 'iso')}
                          </th>
                          <th className="text-left p-4 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-white/5" style={{ background: TC.headerBg, color: TC.textDisabled, borderBottom: `1px solid ${TC.borderSoft}` }} onClick={() => handleSortIso('ANALISIS')}>
                            Análisis {getSortIcon('ANALISIS', 'iso')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredIso.map((r, i) => (
                          <tr key={i} className="group hover:bg-orange-500/5 transition-colors border-b" style={{ borderColor: TC.borderSoft }}>
                            <td className="p-4 font-bold" style={{ color: TC.text }}>
                              {r.ISO}
                              {r._dup && <Badge variant="blue" style={{ marginLeft: '8px', fontSize: 8 }}>Dup</Badge>}
                            </td>
                            <td className="p-4 opacity-80">{r.VEHICULO_SIMPLI || <span className="italic opacity-50">Sin asignar</span>}</td>
                            <td className="p-2">
                              <input 
                                type="text" 
                                value={r.ANALISIS} 
                                onChange={e => handleAnalisisChange(r.ISO, e.target.value)}
                                className="w-full bg-transparent border-b border-white/10 px-2 py-1 outline-none focus:border-orange-500/50 transition-colors"
                                placeholder="Escribe aquí..."
                                style={{ color: r.ANALISIS.includes('Quiebre') ? '#f97316' : TC.text }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-green-500 text-black font-bold text-xs px-8 py-3 rounded-full shadow-2xl z-50 pointer-events-none"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

    </PageShell>
  )
}
