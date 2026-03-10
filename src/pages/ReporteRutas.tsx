import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme, getThemeColors } from '../context/ThemeContext'
import { C, PageShell, Card, Btn, Badge } from '../ui/DS'
import GlassHeader from '../components/ui/GlassHeader'

const REPORT_TABS = [
  { id: 'carga',   label: 'Cargar Datos', icon: '📁', badgeVariant: 'blue'   },
  { id: 'reporte', label: 'Reporte',      icon: '📊', badgeVariant: 'green'  },
]

/* ── CSV ── */
function detectSep(line: string) { const s=(line.match(/;/g)||[]).length, c=(line.match(/,/g)||[]).length; return s>c?';':',' }
function parseRow(line: string, sep: string) { const r:string[]=[]; let cur='',inQ=false; for(let i=0;i<line.length;i++){const ch=line[i]; if(ch==='"')inQ=!inQ; else if(ch===sep&&!inQ){r.push(cur.trim().replace(/^"|"$/g,'')); cur=''} else cur+=ch} r.push(cur.trim().replace(/^"|"$/g,'')); return r }
function getKey(row:any,key:string){const k=Object.keys(row).find(k=>k.trim().toLowerCase()===key.toLowerCase()); return k?row[k]:null}

function termGradient(pct:number){const p=Math.max(0,Math.min(100,pct)); if(p>=100)return{bg:'rgba(34,197,94,.25)',txt:'#22c55e'}; if(p>=90)return{bg:'rgba(234,179,8,.2)',txt:'#eab308'}; return{bg:'rgba(239,68,68,.15)',txt:'#ef4444'}}

type PRData = {
  regions: Record<string,{orders:Set<string>;estados:Record<string,Set<string>>;patentes:Record<string,{orders:Set<string>;estados:Record<string,Set<string>>}>}>
  estados: string[]
}

export default function ReporteRutas() {
  const { theme, isDark } = useTheme()
  const TC = getThemeColors(theme)
  const [fileName, setFileName] = useState('')
  const [data, setData] = useState<PRData|null>(null)
  const [activeTab, setActiveTab] = useState<'carga' | 'reporte'>('carga')
  const [toast, setToast] = useState('')
  const [viewMode, setViewMode] = useState<'numbers'|'pct'>('numbers')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const flash = useCallback((msg:string)=>{setToast(msg);setTimeout(()=>setToast(''),2500)},[])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const lines = text.split(/\r?\n/).filter(l=>l.trim()); if (lines.length < 2) return
      const sep = detectSep(lines[0])
      const headers = parseRow(lines[0], sep)
      const rows = lines.slice(1).map(line => { const vals = parseRow(line, sep); const obj:any={}; headers.forEach((h,i)=>obj[h]=vals[i]||''); return obj })

      const processed:PRData['regions'] = {}; const estadosSet = new Set<string>()
      rows.forEach(row => {
        const commerce=(getKey(row,'Commerce')||'').trim()
        const patente=(getKey(row,'Patente')||'').trim()
        const region=(getKey(row,'Region')||'Sin Región').trim()
        const estado=(getKey(row,'Estado')||'Sin Estado').trim()
        const parentOrder=(getKey(row,'ParentOrder')||'').trim()
        if(commerce.toLowerCase()!=='ikea'||!patente) return
        estadosSet.add(estado)
        if(!processed[region]) processed[region]={orders:new Set(),estados:{},patentes:{}}
        processed[region].orders.add(parentOrder)
        if(!processed[region].estados[estado]) processed[region].estados[estado]=new Set()
        processed[region].estados[estado].add(parentOrder)
        if(!processed[region].patentes[patente]) processed[region].patentes[patente]={orders:new Set(),estados:{}}
        processed[region].patentes[patente].orders.add(parentOrder)
        if(!processed[region].patentes[patente].estados[estado]) processed[region].patentes[patente].estados[estado]=new Set()
        processed[region].patentes[patente].estados[estado].add(parentOrder)
      })
      setData({ regions: processed, estados: [...estadosSet].sort() })
      setFileName(file.name)
      setActiveTab('reporte')
      flash('✓ Reporte procesado')
    }
    reader.readAsText(file, 'UTF-8'); e.target.value=''
  }

  const toggleRegion = (r:string) => setExpanded(p=>{const n=new Set(p); n.has(r)?n.delete(r):n.add(r); return n})
  const toggleAll = () => { if(!data) return; const allKeys=Object.keys(data.regions); setExpanded(p=>p.size>=allKeys.length?new Set():new Set(allKeys)) }

  const copiarResumen = () => {
    if(!data) return; let txt=''
    Object.keys(data.regions).sort().forEach(region=>{
      const rd=data.regions[region]; const upper=region.toUpperCase()
      if(!upper.includes('METROPOLITANA')&&!upper.includes('VALPARAISO')&&!upper.includes('VALPARAÍSO')) return
      const total=rd.orders.size; txt+=`📍 [${region.toUpperCase()}]\n   Total: ${total} órdenes — ${Object.keys(rd.patentes).length} vehículos.\n`
      data.estados.forEach(e=>{const c=rd.estados[e]?rd.estados[e].size:0; if(c>0) txt+=`   - ${e}: ${c} (${((c/total)*100).toFixed(1)}%)\n`})
      txt+='\n'
    })
    navigator.clipboard?.writeText(txt||'Sin datos RM/Valparaíso').then(()=>flash('✓ Resumen copiado'))
  }

  const allRegions = data ? Object.keys(data.regions).sort() : []

  return (
    <PageShell>
      <GlassHeader 
        appName="Route Reporter"
        appDesc="Live Progress · Metrics"
        icon="📊"
        tabs={REPORT_TABS as any}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as any)}
        badges={{ reporte: data?.regions ? Object.keys(data.regions).length : 0 }}
      />

      <div className="flex-1 overflow-hidden relative" style={{ background: TC.bg }}>
        <AnimatePresence mode="wait">
          {activeTab === 'carga' && (
            <motion.div 
              key="carga" 
              initial={{ opacity: 0, scale: 0.98 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 1.02 }} 
              className="absolute inset-0 overflow-y-auto p-12 flex flex-col items-center justify-center"
            >
              <div className="max-w-2xl w-full">
                <Card style={{ padding: 0, overflow: 'hidden', border: `1px solid ${TC.border}` }}>
                  <label className="flex flex-col items-center justify-center gap-6 p-20 cursor-pointer border-2 border-dashed rounded-xl transition-all hover:bg-blue-500/5 group" style={{ borderColor: 'rgba(56,189,248,.2)' }}>
                    <div className="text-6xl group-hover:scale-110 transition-transform duration-500">📂</div>
                    <div className="text-center">
                      <div className="text-xl font-bold mb-2" style={{ color: TC.text }}>Cargar Reporte de Operación</div>
                      <div className="text-xs uppercase tracking-widest opacity-40 font-bold mb-6" style={{ color: TC.text }}>CSV · UTF-8</div>
                      <div className="flex flex-wrap justify-center gap-2 max-w-sm mx-auto">
                        {['Commerce', 'Patente', 'Region', 'Estado', 'ParentOrder'].map(c => <Badge key={c} variant="muted" style={{ fontSize: 9 }}>{c}</Badge>)}
                      </div>
                    </div>
                    <input type="file" accept=".csv" className="hidden" onChange={handleFile}/>
                    {fileName && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 flex flex-col items-center gap-4">
                         <Badge variant="blue" style={{ padding: '8px 20px' }}>✓ {fileName}</Badge>
                         <Btn onClick={() => setActiveTab('reporte')} variant="primary" style={{ padding: '12px 32px' }}>Ver Reporte Ahora</Btn>
                      </motion.div>
                    )}
                  </label>
                </Card>
              </div>
            </motion.div>
          )}

          {activeTab === 'reporte' && (
            <motion.div 
                key="reporte" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }} 
                className="absolute inset-0 overflow-y-auto p-6"
            >
              <div className="max-w-7xl mx-auto flex flex-col gap-6">
                {!data ? (
                  <div className="flex flex-col items-center justify-center py-32 gap-6 opacity-30">
                     <div className="text-8xl">📊</div>
                     <div className="text-lg font-bold">No hay datos procesados</div>
                     <Btn onClick={() => setActiveTab('carga')}>Volver a Carga</Btn>
                  </div>
                ) : (
                  <>
                    {/* Summary Card */}
                    <Card style={{ padding: 24, background: 'linear-gradient(145deg, rgba(255,255,255,0.02), rgba(255,255,255,0))' }}>
                      <div className="flex items-center justify-between mb-6 border-b pb-4" style={{ borderColor: TC.borderSoft }}>
                        <div className="flex items-center gap-3">
                           <div className="p-2 rounded-xl bg-yellow-500/10 text-yellow-500">📝</div>
                           <div>
                              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: TC.text }}>Resumen Ejecutivo</div>
                              <div className="text-[10px] opacity-40">Región Metropolitana & Valparaíso</div>
                           </div>
                        </div>
                        <Btn onClick={copiarResumen} variant="primary" style={{ fontSize: 10, padding: '6px 16px', background: '#eab308', borderColor: '#eab308', color: '#000', fontWeight: 800 }}>📋 COP-TEXT</Btn>
                      </div>
                      <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed rounded-xl p-6" style={{ background: 'rgba(0,0,0,0.2)', color: TC.textSub, border: `1px solid ${TC.borderSoft}`, margin: 0 }}>
                        {Object.keys(data.regions).sort().filter(r => { const u = r.toUpperCase(); return u.includes('METROPOLITANA') || u.includes('VALPARAISO') || u.includes('VALPARAÍSO') }).map(region => {
                          const rd = data.regions[region]; const total = rd.orders.size
                          return `📍 [${region.toUpperCase()}]\n   Total: ${total} órdenes — ${Object.keys(rd.patentes).length} vehículos.\n${data.estados.map(e => { const c = rd.estados[e] ? rd.estados[e].size : 0; return c > 0 ? `   - ${e}: ${c} (${((c / total) * 100).toFixed(1)}%)` : '' }).filter(Boolean).join('\n')}`
                        }).join('\n\n') || 'Sin datos para RM ni Valparaíso.'}
                      </pre>
                    </Card>

                    {/* Controls Bar */}
                    <div className="flex gap-4 items-center sticky top-0 z-20 py-3 px-2 rounded-xl" style={{ backdropFilter: 'blur(10px)', background: `rgba(${isDark ? '13,17,23' : '246,248,250'},0.8)` }}>
                      <div className="flex p-1 rounded-full bg-black/5 dark:bg-white/5 border shadow-inner" style={{ borderColor: TC.border }}>
                         <button onClick={() => setViewMode('numbers')} className={`text-[10px] font-bold px-5 py-2 rounded-full transition-all ${viewMode === 'numbers' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`} style={{ border: 'none', cursor: 'pointer' }}>🔢 Números</button>
                         <button onClick={() => setViewMode('pct')} className={`text-[10px] font-bold px-5 py-2 rounded-full transition-all ${viewMode === 'pct' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`} style={{ border: 'none', cursor: 'pointer' }}>📈 Porcentajes</button>
                      </div>
                      <Btn onClick={toggleAll} style={{ fontSize: 10, padding: '7px 16px', marginLeft: 'auto' }}>
                        {expanded.size >= allRegions.length ? '⊟ Contraer' : '⊞ Expandir'} todo
                      </Btn>
                    </div>

                    {/* Table */}
                    <Card style={{ padding: 0, overflow: 'hidden', border: `1px solid ${TC.borderSoft}`, boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] font-mono" style={{ borderCollapse: 'collapse' }}>
                          <thead>
                            <tr className="shadow-sm">
                              <th className="text-left p-5 font-bold uppercase tracking-widest sticky top-0 z-10" style={{ background: TC.headerBg, color: TC.textDisabled, borderBottom: `2px solid ${TC.borderSoft}` }}>Región / Patente</th>
                              {data.estados.map(e => <th key={e} className="text-right p-5 font-bold uppercase tracking-widest sticky top-0 z-10 whitespace-nowrap" style={{ background: TC.headerBg, color: TC.textDisabled, borderBottom: `2px solid ${TC.borderSoft}` }}>{e}</th>)}
                              <th className="text-right p-5 font-bold uppercase tracking-widest sticky top-0 z-10" style={{ background: TC.headerBg, color: TC.textDisabled, borderBottom: `2px solid ${TC.borderSoft}` }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allRegions.map(region => {
                              const rd = data.regions[region]; const total = rd.orders.size; const isExp = expanded.has(region)
                              return (<>
                                <tr key={region} className="group cursor-pointer hover:bg-blue-500/10 transition-colors border-b" style={{ borderColor: TC.borderSoft }} onClick={() => toggleRegion(region)}>
                                  <td className="p-5 font-bold" style={{ color: '#0ea5e9' }}><span className="mr-4 opacity-40">{isExp ? '▼' : '▶'}</span> {region}</td>
                                  {data.estados.map(e => { const v = rd.estados[e] ? rd.estados[e].size : 0; return <td key={e} className="p-5 text-right font-bold" style={{ color: TC.text }}>{v > 0 ? (viewMode === 'pct' ? `${((v / total) * 100).toFixed(1)}%` : v) : <span className="opacity-10">·</span>}</td> })}
                                  <td className="p-5 text-right font-black" style={{ color: TC.textSub, background: isDark?'rgba(255,255,255,0.02)':'rgba(0,0,0,0.02)' }}>{viewMode === 'pct' ? '100%' : total}</td>
                                </tr>
                                {isExp && Object.keys(rd.patentes).sort().map(pat => {
                                  const pd = rd.patentes[pat]; const pT = pd.orders.size; const termIdx = data.estados.findIndex(e => e.toLowerCase().includes('terminado'))
                                  return (<tr key={`${region}-${pat}`} className="hover:bg-white/[.04] transition-colors border-b" style={{ borderColor: TC.borderSoft }}>
                                    <td className="p-3 pl-14 text-gray-500 italic relative overflow-hidden"><span className="absolute left-10 top-1/2 -translate-y-1/2 w-2 h-2 border-l-2 border-b-2 border-gray-700/50"></span>{pat}</td>
                                    {data.estados.map((e, ei) => { const v = pd.estados[e] ? pd.estados[e].size : 0; const display = v > 0 ? (viewMode === 'pct' ? `${((v / pT) * 100).toFixed(1)}%` : v) : ''; const isTerm = viewMode === 'pct' && ei === termIdx && pT > 0; const grad = isTerm ? termGradient((v / pT) * 100) : null; return <td key={e} className="p-3 text-right" style={{ color: grad ? grad.txt : TC.text, background: grad ? grad.bg : 'transparent', fontWeight: grad ? 800 : 400 }}>{isTerm && v === 0 ? '0%' : (display || <span className="opacity-10">·</span>)}</td> })}
                                    <td className="p-3 text-right font-bold opacity-30" style={{ color: TC.text }}>{viewMode === 'pct' ? '100%' : pT}</td>
                                  </tr>)
                                })}
                              </>)
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-green-600 text-white font-bold text-xs px-10 py-3 rounded-full shadow-2xl z-50 animate-bounce">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  )
}
