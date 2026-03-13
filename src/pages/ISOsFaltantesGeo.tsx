import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import { useTheme, getThemeColors } from '../context/ThemeContext'
import { PageShell } from '../ui/DS'
import type { GeoRow, BaseStats, ResStats, ISOGeoTabId } from '../types/isosgeo'
import GlassHeader, { GlassHeaderTab } from '../components/ui/GlassHeader'
import TabCargar from '../components/isosgeo/TabCargar'
import TabResultados from '../components/isosgeo/TabResultados'

const GEOTRACK_TABS: GlassHeaderTab[] = [
  { id: 'tab-cargar',     label: 'Cargar Base', icon: '📥', badgeVariant: 'blue'   },
  { id: 'tab-resultados', label: 'Sin Conductor', icon: '📊', badgeVariant: 'orange' },
]

/* CSV helpers */
function detectSep(line: string) { const s=(line.match(/;/g)||[]).length, c=(line.match(/,/g)||[]).length, t=(line.match(/\t/g)||[]).length; if(t>s&&t>c) return '\t'; return s>c?';':',' }
function parseRow(line: string, sep: string) { const r:string[]=[]; let cur='',inQ=false; for(let i=0;i<line.length;i++){const c=line[i]; if(c==='"')inQ=!inQ; else if(c===sep&&!inQ){r.push(cur.trim().replace(/^"|"$/g,'')); cur=''} else cur+=c} r.push(cur.trim().replace(/^"|"$/g,'')); return r }

const BASE_URL = 'https://api.simpliroute.com'
const CORS_PROXIES = [
  (url:string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url:string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
]

export default function ISOsFaltantesGeo() {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)

  const [activeTab, setActiveTab] = useState<string>('tab-cargar')
  
  // State
  const [token, setToken] = useState('b388c699ed3bc4ecd2f748383e40b94ff650a8f6')
  const [fecha, setFecha] = useState(() => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}` })
  const [baseData, setBaseData] = useState<any[]|null>(null)
  const [baseName, setBaseName] = useState('')
  const [baseStats, setBaseStats] = useState<BaseStats|null>(null)
  const [results, setResults] = useState<GeoRow[]>([])
  const [resStats, setResStats] = useState<ResStats|null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [toast, setToast] = useState('')

  const flash = useCallback((msg:string) => { setToast(msg); setTimeout(()=>setToast(''),2500) }, [])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      let data: any[]
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const wb = XLSX.read(new Uint8Array(ev.target?.result as ArrayBuffer), { type: 'array' })
        data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      } else {
        const text = ev.target?.result as string; const lines = text.split(/\r?\n/).filter(Boolean); const sep = detectSep(lines[0]); const headers = parseRow(lines[0], sep)
        data = lines.slice(1).map(line => { const vals = parseRow(line, sep); const obj:any={}; headers.forEach((h,i)=>obj[h]=vals[i]||''); return obj })
      }
      const keys = Object.keys(data[0]||{}); const colCom = keys.find(k=>k.toLowerCase()==='commerce')
      const ikeaCount = colCom ? data.filter(r=>(r[colCom]||'').toUpperCase().trim()==='IKEA').length : data.length
      setBaseData(data); setBaseName(file.name); setBaseStats({ total: data.length, ikea: ikeaCount })
    }
    if (file.name.endsWith('.xlsx')||file.name.endsWith('.xls')) reader.readAsArrayBuffer(file); else reader.readAsText(file,'UTF-8')
    e.target.value=''
  }

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

  const iniciarAnalisis = async () => {
    if (!token.trim() || !baseData) return; setLoading(true); setStatus('Consultando SimpliRoute…'); setProgress(5)
    const visits = await apiGet('/v1/routes/visits/', { planned_date: fecha }); if(!visits) { setStatus('❌ Error de conexión'); setLoading(false); setProgress(0); return }
    if(!visits.length) { setStatus(`⚠️ Sin visitas para ${fecha}`); setLoading(false); setProgress(0); return }
    setProgress(10); setStatus('Obteniendo detalles…')
    const CHUNK = 20; const dfSimpli: any[] = []
    for (let i = 0; i < visits.length; i += CHUNK) {
      const batch = visits.slice(i, i+CHUNK)
      const details = await Promise.all(batch.map(async (v:any) => { const d = await apiGet(`/v1/plans/visits/${v.id}/detail/`) || {}; return { ISO: String(v.title||'S/N').trim(), VEHICULO_SIMPLI: String(d.vehicle_name||v.vehicle_name||'').trim(), CONDUCTOR_SIMPLI: String(d.driver_name||'').trim() } }))
      dfSimpli.push(...details); setProgress(10+70*((i+CHUNK)/visits.length))
    }
    setStatus('Cruzando con base…'); setProgress(85)
    const keys = Object.keys(baseData[0]||{}); const colCom = keys.find(k=>k.toLowerCase()==='commerce'); const colPat = keys.find(k=>k.toLowerCase()==='patente'); const colIso = keys.find(k=>k.toLowerCase()==='parentorder'); const colEst = keys.find(k=>k.toLowerCase()==='estado')
    const baseRef:Record<string,{PATENTE:string;ESTADO:string}>={}
    const filtered = colIso ? baseData.filter(r=>!colCom||(r[colCom]||'').toUpperCase().trim()==='IKEA') : baseData
    filtered.forEach(row=>{const iso=(row[colIso||'']||'').trim(); if(iso) baseRef[iso]={PATENTE:(row[colPat||'']||'').trim(), ESTADO:(row[colEst||'']||'').trim()}})
    const isoCount:Record<string,number>={}; dfSimpli.forEach(v=>{isoCount[v.ISO]=(isoCount[v.ISO]||0)+1})
    const masterData:GeoRow[]=[]; dfSimpli.forEach(row=>{
      if(row.CONDUCTOR_SIMPLI!=='') return
      const base=baseRef[row.ISO]; const patente=base?base.PATENTE:''; const estado=base?base.ESTADO:''
      let analisis=''; let dup=false
      if(isoCount[row.ISO]>1){ const otra=dfSimpli.find(r=>r.ISO===row.ISO&&r.CONDUCTOR_SIMPLI!==''); if(otra){analisis=`DUPLICADA (En ${otra.VEHICULO_SIMPLI||otra.ISO})`; dup=true} }
      masterData.push({ISO:row.ISO, PATENTE:patente, ESTADO:estado, VEHICULO:row.VEHICULO_SIMPLI, ANALISIS:analisis, _dup:dup})
    })
    setProgress(100); setTimeout(()=>setProgress(0),600)
    const dups=masterData.filter(r=>r._dup).length
    setResults(masterData); setResStats({total:masterData.length,dups}); setLoading(false)
    setStatus(`✅ ${masterData.length} sin conductor, ${dups} duplicadas`)
    
    // Auto-switch to results tab after completion
    setActiveTab('tab-resultados')
  }

  const copiar = () => {
    if(!results.length) return
    let tsv = 'ISO\tPatente\tEstado\tVehículo Simpli\tAnálisis\n'
    results.forEach(r=>{tsv+=`${r.ISO}\t${r.PATENTE}\t${r.ESTADO}\t${r.VEHICULO}\t${r.ANALISIS}\n`})
    navigator.clipboard?.writeText(tsv).then(()=>flash('✓ Tabla copiada'))
  }

  // Badges calculation
  const badges: Partial<Record<ISOGeoTabId, number>> = {
    'tab-resultados': results.length || undefined,
  }

  return (
    <PageShell>
      <GlassHeader 
        appName="Consultar ISOs Sin Asignacion"
        icon="📍"
        tabs={GEOTRACK_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        badges={badges as any}
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
            {activeTab === 'tab-cargar' && (
              <TabCargar
                token={token} setToken={setToken}
                fecha={fecha} setFecha={setFecha}
                baseName={baseName} baseStats={baseStats}
                handleFile={handleFile}
                loading={loading} progress={progress}
                status={status} resStats={resStats}
                iniciarAnalisis={iniciarAnalisis}
                baseDataReady={!!baseData}
                TC={TC}
              />
            )}
            
            {activeTab === 'tab-resultados' && (
              <TabResultados
                results={results}
                copiar={copiar}
                TC={TC}
              />
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
            className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-green-500 text-black font-bold text-xs px-5 py-2 rounded-full shadow-lg z-50"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

    </PageShell>
  )
}
