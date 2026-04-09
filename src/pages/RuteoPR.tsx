import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import { } from 'lucide-react'
import { useTheme, getThemeColors } from '../context/ThemeContext'
import { PageShell, Btn } from '../ui/DS'
import GlassHeader, { GlassHeaderTab } from '../components/ui/GlassHeader'

const PR_TABS: GlassHeaderTab[] = [
  { id: 'archivos',  label: 'Cargar Archivos', icon: '📁' },
  { id: 'preruteo',  label: 'Pre Ruteo',       icon: '📋' },
  { id: 'postruteo', label: 'Post Ruteo',      icon: '⚙️' },
  { id: 'exports',   label: 'Exportar',        icon: '🚀' },
  { id: 'correo',    label: 'Generar Correo',  icon: '✉️' },
]

/* ── helpers ── */
const MINI_COMUNAS = new Set(["ÑUÑOA","NUNOA","LAS CONDES","VITACURA","PROVIDENCIA","SANTIAGO"])
function removeAccents(s:any){return s?String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().trim():""}
function esComunaMini(c:string){return MINI_COMUNAS.has(removeAccents(c))||MINI_COMUNAS.has((c||'').toUpperCase().trim())}
function formatFecha(d:Date){return`${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`}
function findCol(row:any,opts:string[]){const keys=Object.keys(row); return keys.find(k=>opts.some(o=>k.toLowerCase()===o.toLowerCase()))||keys.find(k=>opts.some(o=>k.toLowerCase().includes(o.toLowerCase())))}
function timeToSeconds(t:string){if(!t)return null; const p=t.split(':'); if(p.length>=2) return(parseInt(p[0])||0)*3600+(parseInt(p[1])||0)*60+(parseInt(p[2])||0); return null}
function fmtSecs(s:number){if(s<0)s=0; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=Math.floor(s%60); return`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`}
function parseNum(v:any){return typeof v==='number'?v:(parseFloat(String(v).replace(',','.'))||0)}
function normalizeArr(a:number[]){const mi=Math.min(...a),mx=Math.max(...a); return a.map(v=>(mi===mx||isNaN(mi))?0:(v-mi)/(mx-mi))}
function exportXlsx(data:any[],name:string,skip=false){const ws=XLSX.utils.json_to_sheet(data,{skipHeader:skip}); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Sheet1'); XLSX.writeFile(wb,name)}
function readFile(file:File):Promise<any[]>{return new Promise((res,rej)=>{const r=new FileReader(); r.onload=e=>{try{const wb=XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer),{type:'array'}); res(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''}))}catch(err){rej(err)}}; r.onerror=rej; r.readAsArrayBuffer(file)})}

const CONFIG = {
  trucks_order: Array.from({length:40},(_,i)=>i+1).filter(i=>i!==29 && i!==30).map(i=>`VEH${String(i).padStart(2,'0')}`),
  special_fixed:{} as Record<string,string>,
  extraurban_communes:["ALHUE","BUIN","CALERA DE TANGO","COLINA","CURACAVI","EL MONTE","ISLA DE MAIPO","LAMPA","LO BARNECHEA","MARIA PINTO","MELIPILLA","PADRE HURTADO","PAINE","PENAFLOR","PIRQUE","SAN JOSE DE MAIPO","SAN PEDRO","TALAGANTE","TILTIL"],
  weights:{distance_km:0.44,duration_hr:0.10,iso_count:0.20,q_comunas:0.01,volume_m3:0.25},
  zone_multiplier:{extraurbano:2.0,default:1.0}
}
Object.assign(CONFIG.special_fixed,{"Proyectos Leslie":"VEH98","VEH01 Postventa":"VEH99","VEH02 Postventa":"VEH101","Postventa 3":"VEH102"})

type TabKey = 'archivos'|'preruteo'|'postruteo'|'exports'|'correo'

export default function RuteoPR() {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)

  const [tab, setTab] = useState<TabKey>('archivos')
  const [dataF1, setDataF1] = useState<any[]|null>(null)
  const [f1Name, setF1Name] = useState('')
  const [fechaPicking, setFechaPicking] = useState(()=>{const d=new Date(); return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`})
  const [fileSimpli, setFileSimpli] = useState<File|null>(null)
  const [logs, setLogs] = useState<{msg:string;type:'ok'|'err'|'warn'|'info'}[]>([])
  const [sheetPlanData, setSheetPlanData] = useState<any[]>([])
  const [sheetResumenData, setSheetResumenData] = useState<any[]>([])
  const [sheetPolinomioData, setSheetPolinomioData] = useState<any[]>([])
  const [metricsData, setMetricsData] = useState<{total:number;prom:number;sum:number}|null>(null)
  const [processing, setProcessing] = useState(false)

  const addLog = useCallback((msg:string,type:'ok'|'err'|'warn'|'info'='info')=>setLogs(p=>[...p,{msg,type}]),[])
  const parseFecha = () => { const [y,m,d] = fechaPicking.split('-').map(Number); return new Date(y,m-1,d) }
  const getFechaP = () => formatFecha(parseFecha())
  const getFechaE = () => { const d = parseFecha(); d.setDate(d.getDate()+1); return formatFecha(d) }

  const handleF1 = async (e:React.ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0]; if(!file) return; try{const data=await readFile(file); setDataF1(data); setF1Name(file.name); addLog(`Base SCI: ${data.length} filas — ${file.name}`,'ok')}catch(err){addLog(`Error: ${err}`,'err')} e.target.value=''}

  const descargarTickets = (tipoVisita:string, nombreBase:string)=>{if(!dataF1) return; const f=dataF1.filter(r=>r['TIPO_VISITA']===tipoVisita); if(!f.length) return addLog(`Sin datos para ${tipoVisita}`,'warn'); exportXlsx(f,`${nombreBase} ${getFechaE()}.xlsx`); addLog(`${nombreBase}: ${f.length} filas`,'ok')}
  const descargarMini = ()=>{if(!dataF1) return; const f=dataF1.filter(r=>{if(r['TIPO_VISITA']==='PROJECT'||r['TIPO_VISITA']==='POST_SALES') return false; if(r['MINI_TICKET']!=='mini_ticket') return false; return esComunaMini(r['D_COUNTY']||r['CONDUCTOR']||'')}); if(!f.length) return addLog('Sin Mini Tickets','warn'); exportXlsx(f,`RUTEAR MINI TICKET ${getFechaE()}.xlsx`); addLog(`Mini Ticket: ${f.length}`,'ok')}
  const descargarRegular = ()=>{if(!dataF1) return; const f=dataF1.filter(r=>{if(r['TIPO_VISITA']==='PROJECT'||r['TIPO_VISITA']==='POST_SALES') return false; if(r['MINI_TICKET']==='no_mini_ticket') return true; if(r['MINI_TICKET']==='mini_ticket') return!esComunaMini(r['D_COUNTY']||r['CONDUCTOR']||''); return false}); if(!f.length) return addLog('Sin Ticket Regular','warn'); exportXlsx(f,`RUTEAR TICKET ${getFechaE()}.xlsx`); addLog(`Regular: ${f.length}`,'ok')}

  const processFlujo2 = async ()=>{
    if(!fileSimpli || !dataF1) return addLog('Carga el Archivo Base (Tab Archivos) y el Plan SimpliRoute','err')
    setProcessing(true); addLog('Procesando Polinomio…','info')
    try{
      const dataSimpli=await readFile(fileSimpli);
      if(!dataSimpli.length || !dataF1.length) throw new Error('Archivos vacíos')
      const ruteoDict:Record<string,string>={}; const cI=findCol(dataF1[0],["ISO","ID de referencia","Title"])||Object.keys(dataF1[0])[0]; const cC=findCol(dataF1[0],["D_COUNTY","COUNTY","COMUNA"])||"D_COUNTY"
      dataF1.forEach(r=>{if(r[cI]) ruteoDict[String(r[cI]).trim().toUpperCase()]=r[cC]||""})
      const sC={conductor:findCol(dataSimpli[0],["Conductor","Driver"])||"Conductor",titulo:findCol(dataSimpli[0],["Título","Title","ISO"])||"Título",vehiculo:findCol(dataSimpli[0],["Vehículo","Vehicle","Ruta"])||"Vehículo",distancia:findCol(dataSimpli[0],["Distancia","Distance"])||"Distancia",cap2:findCol(dataSimpli[0],["Capacidad 2","Capacity 2"])||"Capacidad 2",tiempoEst:findCol(dataSimpli[0],["Tiempo estimado de llegada","ETA"])||"Tiempo estimado de llegada",idRef:findCol(dataSimpli[0],["ID de referencia","DOFI"])||"ID de referencia"}
      const extraUrbanSet=new Set(CONFIG.extraurban_communes.map(c=>removeAccents(c)))
      const cleanSimpli=dataSimpli.map(row=>{const t=String(row[sC.titulo]).trim().toUpperCase(); if(t!=="INICIO"&&t!=="FIN") row[sC.conductor]=ruteoDict[t]||row[sC.conductor]; const zona=extraUrbanSet.has(removeAccents(row[sC.conductor]))?"Extraurbano":"Urbano"; const tiempo=row[sC.tiempoEst]||""; let fecha="",hora=""; if(tiempo.includes("T")){const p=tiempo.split("T");fecha=p[0];hora=p[1]}else if(tiempo.includes(" ")){const p=tiempo.split(" ");fecha=p[0];hora=p[1]}else{fecha=tiempo}; return{...row,_zona:zona,_fecha:fecha,_hora:hora}})
      const groups:Record<string,{rows:any[]}>={}; cleanSimpli.forEach(row=>{const v=String(row[sC.vehiculo]||"").trim(); if(!groups[v])groups[v]={rows:[]}; groups[v].rows.push(row)})
      const summaries:any[]=[]
      for(const veh in groups){const rows=groups[veh].rows; const dist=rows.reduce((a,r)=>a+parseNum(r[sC.distancia]),0); const cap=rows.reduce((a,r)=>a+parseNum(r[sC.cap2]),0); let minSec=Infinity,maxSec=-Infinity,realIso=0; rows.forEach(r=>{const t=String(r[sC.titulo]).trim().toUpperCase(); if(t!=="INICIO"&&t!=="FIN")realIso++; const s=timeToSeconds(r._hora); if(s!==null){if(s<minSec)minSec=s;if(s>maxSec)maxSec=s}}); const durSec=(minSec!==Infinity&&maxSec!==-Infinity)?maxSec-minSec:0; const comunas=new Set(rows.filter(r=>{const t=String(r[sC.titulo]).trim().toUpperCase();return t!=="INICIO"&&t!=="FIN"}).map(r=>r[sC.conductor]).filter(Boolean)); const zonas:{[k:string]:number}={"Urbano":0,"Extraurbano":0}; rows.forEach(r=>zonas[r._zona]++); const pred=zonas["Extraurbano"]>0?"Extraurbano":"Urbano"; summaries.push({original_vehicle:veh,Zona:pred,distance_km:dist,duration_hr:durSec/3600,duration_formatted:fmtSecs(durSec),iso_count:realIso,q_comunas:comunas.size,volume_m3:cap,family:String(veh).toLowerCase().startsWith("mini")?"mini":"truck"})}
      let trucks=summaries.filter(s=>s.family==="truck"&&!CONFIG.special_fixed[s.original_vehicle]); let minis=summaries.filter(s=>s.family==="mini"&&!CONFIG.special_fixed[s.original_vehicle]); const specials=summaries.filter(s=>!!CONFIG.special_fixed[s.original_vehicle])
      const aD=normalizeArr(trucks.map(s=>s.distance_km)),aDur=normalizeArr(trucks.map(s=>s.duration_hr)),aI=normalizeArr(trucks.map(s=>s.iso_count)),aC=normalizeArr(trucks.map(s=>s.q_comunas)),aV=normalizeArr(trucks.map(s=>s.volume_m3))
      trucks.forEach((s,i)=>{s.score_base=CONFIG.weights.distance_km*aD[i]+CONFIG.weights.duration_hr*aDur[i]+CONFIG.weights.iso_count*aI[i]+CONFIG.weights.q_comunas*aC[i]+CONFIG.weights.volume_m3*aV[i]; s.score=s.score_base*(s.Zona.toLowerCase()==="extraurbano"?CONFIG.zone_multiplier.extraurbano:CONFIG.zone_multiplier.default)})
      minis.forEach(s=>{s.score_base=0;s.score=0}); specials.forEach(s=>{s.score_base=0;s.score=0})
      minis.sort((a,b)=>(parseInt(a.original_vehicle.replace(/\D/g,''))||999)-(parseInt(b.original_vehicle.replace(/\D/g,''))||999)); trucks.sort((a,b)=>b.score-a.score)
      const vehicleMap:Record<string,string>={}; minis.forEach((r,idx)=>{r.final_route_to=`MINI${String(idx+1).padStart(2,'0')}`; vehicleMap[r.original_vehicle]=r.final_route_to}); trucks.forEach((r,idx)=>{r.final_route_to=CONFIG.trucks_order[idx]||`VEH${String(idx+1).padStart(2,'0')}`; vehicleMap[r.original_vehicle]=r.final_route_to}); specials.forEach(s=>{s.final_route_to=CONFIG.special_fixed[s.original_vehicle]; vehicleMap[s.original_vehicle]=s.final_route_to})
      const ordered=[...minis,...trucks,...specials]
      const originalKeys=Object.keys(dataSimpli[0]); const planData=cleanSimpli.map(row=>{const o:any={}; originalKeys.forEach(k=>{if(!k.startsWith("__EMPTY")&&!["_zona","_fecha","_hora"].includes(k))o[k]=row[k]}); o["DIA"]=row._fecha; o["HORA"]=row._hora; const v=String(row[sC.vehiculo]||"").trim(); o["VEH INICIAL"]=v; o["VEH FINAL"]=vehicleMap[v]||v; o["_DOFI"]=row[sC.idRef]; o["_TITULO"]=row[sC.titulo]; return o})
      const polyData=ordered.map(o=>({"VEH INICIAL":o.original_vehicle,"VEH FINAL":o.final_route_to,"Familia":o.family,"Zona":o.Zona,"Paradas ISO":o.iso_count,"Distancia Total (km)":+o.distance_km.toFixed(2),"Volumen (m3)":+o.volume_m3.toFixed(2),"Tiempo en Ruta":o.duration_formatted,"Cant. Comunas":o.q_comunas,"Score Base":+o.score_base.toFixed(4),"Score Final":+o.score.toFixed(4)}))
      const resData=ordered.map(o=>({"ANDEN":"","LADO":"","Vehículo":o.final_route_to,"Distancia":+o.distance_km.toFixed(2),"Tiempo en Ruta":o.duration_formatted,"ISO":o.iso_count,"Q COMUNAS":o.q_comunas,"M3":+o.volume_m3.toFixed(2),"Horario salida":"","Zona":o.Zona,"Tipo Vehículo":"","Tipo Ticket":o.final_route_to.toUpperCase().startsWith("MINI")?"MiniTicket":"Ticket Regular"}))
      const metricsVehs=ordered.filter(o=>!["Proyectos Leslie","VEH01 Postventa","VEH99"].includes(o.original_vehicle)); const totalVeh=metricsVehs.length; const sumISO=metricsVehs.reduce((s,o)=>s+o.iso_count,0); const promISO=totalVeh>0?+(sumISO/totalVeh).toFixed(2):0
      setSheetPlanData(planData); setSheetPolinomioData(polyData); setSheetResumenData(resData); setMetricsData({total:totalVeh,prom:promISO,sum:sumISO})
      addLog(`¡Polinomio listo! ${totalVeh} vehículos, ${sumISO} ISOs`,'ok')
    }catch(e:any){addLog('Error: '+e.message,'err')}finally{setProcessing(false)}
  }

  const downloadPlan = ()=>{if(!sheetPlanData.length) return; const wb=XLSX.utils.book_new(); const print=sheetPlanData.map(r=>{const c={...r}; delete c._DOFI; delete c._TITULO; return c}); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(print),"Plan"); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(sheetPolinomioData),"Polinomio"); const ws3=XLSX.utils.json_to_sheet(sheetResumenData); if(metricsData) XLSX.utils.sheet_add_aoa(ws3,[["Vehículos","Promedio de ISO","Suma de ISO"],[metricsData.total,metricsData.prom,metricsData.sum]],{origin:"N1"}); XLSX.utils.book_append_sheet(wb,ws3,"Resumen"); XLSX.writeFile(wb,`1. Simpliroute_Plan_${getFechaE()} RUTEO.xlsx`); addLog('Plan exportado','ok')}
  const downloadRouteTo = () => {
    if(!sheetPlanData.length) return; 
    const list = sheetPlanData.filter(r => {
      const t = String(r._TITULO).trim().toUpperCase();
      return t !== "INICIO" && t !== "FIN" && r._DOFI;
    }).map(r => ({ A: r._DOFI, B: r["VEH FINAL"] })); 
    
    for (let i = 0; i < list.length; i += 1000) {
      const chunk = list.slice(i, i + 1000);
      const suffix = i === 0 ? '' : ` ${Math.floor(i/1000) + 1}`;
      exportXlsx(chunk, `2. ROUTE TO picking ${getFechaP()} entregas ${getFechaE()}${suffix}.xlsx`, true);
    }
    addLog(`Route To exportado (${Math.ceil(list.length/1000)} archivo/s)`, 'ok');
  }
  const downloadPreola = ()=>{if(!dataF1) return addLog('Carga el archivo base','warn'); const f=dataF1.filter(r=>r['TIPO_VISITA']==='PROJECT'||r['TIPO_VISITA']==='POST_SALES'); if(!f.length) return addLog('Sin proyectos/post sales','warn'); const d=f.map(r=>({A:r['ID_REFERENCIA'],B:r['TIPO_VISITA']==='PROJECT'?'VEH98':'VEH99'})); exportXlsx(d,`3. ROUTE TO PROYECT+ POST SALES picking ${getFechaP()} entregas ${getFechaE()}.xlsx`,true); addLog('Preola exportada','ok')}

  const handleGenerarCorreo = () => {
    if (!sheetResumenData.length || !metricsData) {
      addLog('⚠️ Primero ejecuta el Polinomio (Post Ruteo) para generar los datos del correo', 'warn')
      return
    }

    const EMAIL_STYLES = {
      tableWrap:   'width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;margin-bottom:18px;',
      th:          'background:#0058A3;color:#ffffff;font-weight:700;padding:7px 10px;border:1px solid #004080;text-align:center;white-space:nowrap;',
      tdCenter:    'padding:6px 10px;border:1px solid #d0d0d0;text-align:center;color:#111;',
      trAlt:       'background:#f0f6ff;',
      trNormal:    'background:#ffffff;',
    }

    const miniTable = `
      <table style="${EMAIL_STYLES.tableWrap}max-width:360px;">
        <thead>
          <tr>
            <th style="${EMAIL_STYLES.th}">Vehículos</th>
            <th style="${EMAIL_STYLES.th}">Promedio de ISO</th>
            <th style="${EMAIL_STYLES.th}">Suma de ISO</th>
          </tr>
        </thead>
        <tbody>
          <tr style="${EMAIL_STYLES.trNormal}">
            <td style="${EMAIL_STYLES.tdCenter}">${metricsData.total ?? '-'}</td>
            <td style="${EMAIL_STYLES.tdCenter}">${metricsData.prom  ?? '-'}</td>
            <td style="${EMAIL_STYLES.tdCenter}">${metricsData.sum   ?? '-'}</td>
          </tr>
        </tbody>
      </table>`

    const EXCLUIDOS = new Set(["VEH98", "VEH99", "VEH101", "VEH102"])
    const filas = sheetResumenData.filter(r => !EXCLUIDOS.has(String(r["Vehículo"]).toUpperCase()))
    let resumenTable = '<p style="color:#888;font-size:12px;">Sin datos de resumen.</p>'

    if (filas.length > 0) {
      const cols = ["ANDEN","LADO","Vehículo","Distancia","Tiempo en Ruta","ISO","Q COMUNAS","M3","Horario salida","Zona","Tipo Vehículo","Tipo Ticket"]
      const headers = cols.map(c => `<th style="${EMAIL_STYLES.th}">${c}</th>`).join('')
      const rows = filas.map((r, idx) => {
        const bg = idx % 2 === 0 ? EMAIL_STYLES.trNormal : EMAIL_STYLES.trAlt
        const cells = cols.map(c => `<td style="${EMAIL_STYLES.tdCenter}">${r[c] ?? ''}</td>`).join('')
        return `<tr style="${bg}">${cells}</tr>`
      }).join('')
      
      resumenTable = `
        <table style="${EMAIL_STYLES.tableWrap}">
          <thead><tr>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>`
    }

    const fullHtml = `
      <div style="font-family:Arial,sans-serif;font-size:13px;color:#111;line-height:1.7;max-width:760px;">
        <p style="margin:0 0 14px;">Team,</p>
        <p style="margin:0 0 18px;">Esperando que se encuentren bien, les envío archivo con detalle de las rutas.</p>
        <p style="margin:0 0 20px;">
          <span style="background:#ffda1a;color:#000;font-weight:700;padding:3px 8px;border-radius:3px;">
            Equipo la PRE-OLA ya se encuentra cargada a sistema
          </span>
        </p>
        ${miniTable}
        ${resumenTable}
      </div>`

    const blob = new Blob([fullHtml], { type: 'text/html' })
    const data = [new ClipboardItem({ 'text/html': blob })]

    navigator.clipboard.write(data).then(() => {
      addLog('✉️ Correo copiado al portapapeles (formato HTML)', 'ok')
    }).catch(() => {
      const tmp = document.createElement('div')
      tmp.innerHTML = fullHtml
      navigator.clipboard.writeText(tmp.innerText).then(() => {
         addLog('✉️ Correo copiado como texto plano (Fallback)', 'warn')
      })
    })
  }

  return (
    <PageShell>
      <GlassHeader appName="AM Route Builder" icon="📦" tabs={PR_TABS} activeTab={tab} onTabChange={(id) => setTab(id as TabKey)} />

      <div className="flex-1 overflow-hidden flex flex-col items-center p-6 custom-scrollbar" style={{ background: TC.bg }}>
        <AnimatePresence mode="wait">
          {tab === 'archivos' && (
            <motion.div key="archivos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-4xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* SCI Base */}
                <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', border: `1px solid ${TC.borderSoft}`, borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="text-[12px] font-bold text-blue-400">📁 Archivo Base SCI <span className="text-red-500 font-bold ml-2">!</span></div>
                  <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 transition-all hover:bg-white/5 cursor-pointer" style={{ borderColor: TC.borderSoft }}>
                    <div className="text-3xl mb-4">📄</div>
                    <span className="text-xs font-medium text-center truncate w-full">{f1Name || 'Base SCI'}</span>
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleF1}/>
                  </label>
                  {dataF1 && (
                    <div className="text-[10px] font-bold text-green-400 uppercase text-center">{dataF1.length} filas cargadas</div>
                  )}
                </div>

                <div className="space-y-6">
                  <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', border: `1px solid ${TC.borderSoft}`, borderRadius: 16, padding: 20 }}>
                    <div className="text-[11px] font-bold text-blue-400 mb-4 uppercase tracking-widest">Fecha de Picking</div>
                    <input type="date" className="w-full p-2 rounded-lg text-xs font-bold outline-none border mb-3" style={{ background: 'rgba(0,0,0,0.2)', color: TC.text, borderColor: TC.borderSoft }} value={fechaPicking} onChange={e=>setFechaPicking(e.target.value)} />
                    <div className="flex justify-between text-[10px] font-mono opacity-60">
                      <div>PICK: <span className="text-orange-400">{getFechaP()}</span></div>
                      <div>ENTREGA: <span className="text-green-400">{getFechaE()}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'preruteo' && (
            <motion.div key="preruteo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-xl">
              <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', border: `1px solid ${TC.borderSoft}`, borderRadius: 24, padding: 40, textAlign: 'center' }}>
                <div className="grid grid-cols-2 gap-4">
                  <Btn onClick={()=>descargarTickets('PROJECT','RUTEAR PROYECTOS')} disabled={!dataF1} variant="secondary" style={{ padding: 20, borderRadius: 16 }}>Proyectos</Btn>
                  <Btn onClick={()=>descargarTickets('POST_SALES','RUTEAR POST SALES')} disabled={!dataF1} variant="secondary" style={{ padding: 20, borderRadius: 16 }}>Post Sales</Btn>
                  <Btn onClick={descargarMini} disabled={!dataF1} variant="secondary" style={{ padding: 20, borderRadius: 16 }}>Mini Tickets</Btn>
                  <Btn onClick={descargarRegular} disabled={!dataF1} variant="secondary" style={{ padding: 20, borderRadius: 16 }}>Ticket Regular</Btn>
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'postruteo' && (
            <motion.div key="postruteo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-xl">
              <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', border: `1px solid ${TC.borderSoft}`, borderRadius: 24, padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="flex flex-col gap-4 text-left">
                    <div className="text-[11px] font-bold text-blue-400 uppercase tracking-widest">Plan de Simpliroute</div>
                    <label className="flex items-center gap-3 p-4 rounded-xl border border-dashed hover:bg-white/5 cursor-pointer" style={{ borderColor: TC.borderSoft }}>
                      <span className="text-xl">📁</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold truncate">{fileSimpli?.name || 'Cargar Plan Finalizado'}</div>
                        <div className="text-[10px] opacity-40">Archivo exportado de SimpliRoute</div>
                      </div>
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e=>{setFileSimpli(e.target.files?.[0]||null);e.target.value=''}}/>
                    </label>
                </div>

                <div className="pt-4">
                  <Btn variant="primary" onClick={processFlujo2} disabled={processing || !fileSimpli || !dataF1} style={{ padding: '14px 40px', borderRadius: 999, width: '100%' }}>
                    {processing ? 'Procesando...' : '▶ Ejecutar Polinomio'}
                  </Btn>
                </div>
                {metricsData && (
                  <div className="flex justify-center gap-8 mt-10">
                    <div className="text-center"><div className="text-[10px] opacity-40 font-bold uppercase mb-1">Vehículos</div><div className="text-2xl font-black text-blue-400">{metricsData.total}</div></div>
                    <div className="text-center"><div className="text-[10px] opacity-40 font-bold uppercase mb-1">Prom ISO</div><div className="text-2xl font-black text-blue-400">{metricsData.prom}</div></div>
                    <div className="text-center"><div className="text-[10px] opacity-40 font-bold uppercase mb-1">Total ISO</div><div className="text-2xl font-black text-blue-400">{metricsData.sum}</div></div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {tab === 'exports' && (
            <motion.div key="exports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-xl">
              <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', border: `1px solid ${TC.borderSoft}`, borderRadius: 24, padding: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Btn variant="primary" onClick={downloadPlan} disabled={!sheetPlanData.length} style={{ background: '#eab308', borderColor: '#eab308', color: '#000', borderRadius: 12, height: 50 }}>1. Plan RUTEO</Btn>
                <Btn onClick={downloadRouteTo} disabled={!sheetPlanData.length} variant="secondary" style={{ borderRadius: 12, height: 50 }}>2. Route To (Picking)</Btn>
                <Btn onClick={downloadPreola} disabled={!dataF1} variant="secondary" style={{ borderRadius: 12, height: 50 }}>3. Pre-Ola (Proyectos)</Btn>
              </div>
            </motion.div>
          )}

          {tab === 'correo' && (
            <motion.div key="correo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-4xl">
              <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', border: `1px solid ${TC.borderSoft}`, borderRadius: 24, overflow: 'hidden' }}>
                <div className="border-b p-6 flex items-center justify-between" style={{ borderColor: TC.borderSoft }}>
                   <div className="text-sm font-bold uppercase tracking-widest opacity-60">Correo Polinomio</div>
                   <Btn variant="primary" onClick={handleGenerarCorreo} disabled={!sheetResumenData.length} size="sm">Copiar HTML</Btn>
                </div>
                <div className="p-8">
                  {!sheetResumenData.length ? <div className="py-20 text-center opacity-30 text-xs uppercase font-bold tracking-widest">Sin datos</div> : (
                    <div className="bg-white p-6 rounded-xl shadow-inner max-h-[400px] overflow-auto border border-black/10">
                      <div style={{ fontFamily: 'Arial, sans-serif', color: '#111', fontSize: '12px', lineHeight: '1.5' }}>
                        <p>Team,</p><p>Esperando que se encuentren bien, les envío archivo con detalle de las rutas.</p>
                        <div className="bg-[#ffda1a] p-2 inline-block font-bold mb-4 rounded">Equipo la PRE-OLA ya se encuentra cargada a sistema</div>
                        <table className="w-full border-collapse mb-4 text-[10px]" style={{ border: '1px solid #ddd' }}>
                          <tr style={{ background: '#0058A3', color: '#fff' }}><th className="p-2 border">Vehículos</th><th className="p-2 border">Prom ISO</th><th className="p-2 border">Suma ISO</th></tr>
                          <tr className="text-center font-bold font-mono"><td className="p-2 border">{metricsData?.total}</td><td className="p-2 border">{metricsData?.prom}</td><td className="p-2 border">{metricsData?.sum}</td></tr>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {logs.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-4xl mt-8">
            <div className="rounded-xl border bg-black/40 backdrop-blur-xl p-4 font-mono text-[10px] overflow-y-auto max-h-[140px] custom-scrollbar" style={{ borderColor: TC.borderSoft, color: '#e6edf3' }}>
               {logs.map((L,i) => (
                 <div key={i} className={`py-1 border-b border-white/5 last:border-0 flex gap-3 ${L.type==='err'?'text-red-400':L.type==='warn'?'text-yellow-400':L.type==='ok'?'text-green-400':'text-blue-300'}`}>
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
