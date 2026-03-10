import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { Upload, Download } from 'lucide-react'
import { useTheme, getThemeColors } from '../context/ThemeContext'
import { PageShell, Card, Btn } from '../ui/DS'
import GlassHeader, { GlassHeaderTab } from '../components/ui/GlassHeader'

const PR_TABS: GlassHeaderTab[] = [
  { id: 'archivos',  label: 'Cargar Archivos', icon: '📁', badgeVariant: 'blue'   },
  { id: 'preruteo',  label: 'Pre Ruteo',       icon: '📋', badgeVariant: 'orange' },
  { id: 'postruteo', label: 'Post Ruteo',      icon: '⚙️', badgeVariant: 'green'  },
  { id: 'exports',   label: 'Exportar',        icon: '🚀', badgeVariant: 'purple' },
  { id: 'correo',    label: 'Generar Correo',  icon: '✉️', badgeVariant: 'blue'   },
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
  trucks_order: Array.from({length:40},(_,i)=>i+1).filter(i=>i!==30).map(i=>`VEH${String(i).padStart(2,'0')}`),
  special_fixed:{} as Record<string,string>,
  extraurban_communes:["ALHUE","BUIN","CALERA DE TANGO","COLINA","CURACAVI","EL MONTE","ISLA DE MAIPO","LAMPA","LO BARNECHEA","MARIA PINTO","MELIPILLA","PADRE HURTADO","PAINE","PENAFLOR","PIRQUE","SAN JOSE DE MAIPO","SAN PEDRO","TALAGANTE","TILTIL"],
  weights:{distance_km:.44,duration_hr:.10,iso_count:.20,q_comunas:.01,volume_m3:.25},
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
  const [fileRuteo2, setFileRuteo2] = useState<File|null>(null)
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
    if(!fileSimpli||!fileRuteo2) return addLog('Sube ambos archivos','err')
    setProcessing(true); addLog('Procesando Polinomio…','info')
    try{
      const dataSimpli=await readFile(fileSimpli); const dataRuteo=await readFile(fileRuteo2)
      if(!dataSimpli.length||!dataRuteo.length) throw new Error('Archivos vacíos')
      const ruteoDict:Record<string,string>={}; const cI=findCol(dataRuteo[0],["ISO","ID de referencia","Title"])||Object.keys(dataRuteo[0])[0]; const cC=findCol(dataRuteo[0],["D_COUNTY","COUNTY","COMUNA"])||"D_COUNTY"
      dataRuteo.forEach(r=>{if(r[cI]) ruteoDict[String(r[cI]).trim().toUpperCase()]=r[cC]||""})
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
  const downloadRouteTo = ()=>{if(!sheetPlanData.length) return; const list=sheetPlanData.filter(r=>{const t=String(r._TITULO).trim().toUpperCase();return t!=="INICIO"&&t!=="FIN"&&r._DOFI}).map(r=>({A:r._DOFI,B:r["VEH FINAL"]})); exportXlsx(list,`2. ROUTE TO picking ${getFechaP()} entregas ${getFechaE()}.xlsx`,true); addLog('Route To exportado','ok')}
  const downloadPreola = ()=>{if(!dataF1) return addLog('Carga el archivo base','warn'); const f=dataF1.filter(r=>r['TIPO_VISITA']==='PROJECT'||r['TIPO_VISITA']==='POST_SALES'); if(!f.length) return addLog('Sin proyectos/post sales','warn'); const d=f.map(r=>({A:r['ID_REFERENCIA'],B:r['TIPO_VISITA']==='PROJECT'?'VEH98':'VEH99'})); exportXlsx(d,`3. ROUTE TO PROYECT+ POST SALES picking ${getFechaP()} entregas ${getFechaE()}.xlsx`,true); addLog('Preola exportada','ok')}

  const handleGenerarCorreo = () => {
    if (!dataF1) return addLog('Carga el archivo base SCI primero', 'err')
    const projects = dataF1.filter(r => r['TIPO_VISITA'] === 'PROJECT')
    if (!projects.length) return addLog('No se encontraron órdenes de tipo PROJECT', 'warn')

    const tableStyle = "border-collapse:collapse;font-family:Aptos,sans-serif;font-size:11pt;width:100%;margin-top:15px;"
    const thStyle = "border:1px solid #ddd;padding:8px;text-align:left;background-color:#f2f2f2;font-weight:bold;"
    const tdStyle = "border:1px solid #ddd;padding:8px;text-align:left;"

    let tableHtml = `<table style="${tableStyle}"><thead><tr><th style="${thStyle}">ISO</th><th style="${thStyle}">DIRECCIÓN</th></tr></thead><tbody>`
    projects.forEach(p => {
      tableHtml += `<tr><td style="${tdStyle}">${p['ID_REFERENCIA'] || ''}</td><td style="${tdStyle}">${p['D_STREET'] || ''} ${p['D_NUMBER'] || ''}, ${p['D_COUNTY'] || ''}</td></tr>`
    })
    tableHtml += `</tbody></table>`

    const intro = `<p style="font-family:Aptos,sans-serif;font-size:11pt;">Hej Team!,<br><br>@Despacho Ecommerce WH Comparto las órdenes correspondientes al flujo de proyectos B2C que realizamos con Transportes Leslie, el día <strong>${getFechaE()}</strong>. Por favor, solicito su ayuda para procesar estas órdenes y ubicarlas en el andén 2A (Nave 4) para Transportes Leslie, diferenciadas de los envío retiro.</p>`
    const fullHtml = intro + tableHtml

    const blob = new Blob([fullHtml], { type: 'text/html' })
    const data = [new ClipboardItem({ 'text/html': blob, 'text/plain': new Blob([intro.replace(/<[^>]+>/g, '')], { type: 'text/plain' }) })]

    navigator.clipboard.write(data).then(() => {
      addLog('✉️ Correo copiado al portapapeles (formato HTML)', 'ok')
    }).catch(() => {
      addLog('❌ Error al copiar al portapapeles', 'err')
    })
  }

  return (
    <PageShell>
      <GlassHeader 
        appName="AM Route Builder"
        appDesc="Pre-Route · Post-Route"
        icon="📦"
        tabs={PR_TABS}
        activeTab={tab}
        onTabChange={(id) => setTab(id as TabKey|'correo')}
      />

      <div className="flex flex-1 overflow-hidden" style={{ background: TC.bg }}>
        {/* Main */}
        <div className="flex-1 overflow-y-auto p-6" style={{background:TC.bg}}>
          {tab==='archivos' && (
            <div className="flex flex-col gap-4 max-w-lg">
              <Card style={{padding:16}}>
                <div className="text-[12px] font-bold text-blue-400 mb-2">📁 Archivo Base SCI <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded ml-2">Obligatorio</span></div>
                <label className="flex items-center gap-2 w-full p-2 rounded border border-dashed cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" style={{borderColor:TC.border}}>
                  <Upload size={14} color={TC.textFaint}/><span className="text-[11px] truncate flex-1" style={{color:TC.textFaint}}>{f1Name||'Seleccionar archivo…'}</span>
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleF1}/>
                </label>
                {dataF1 && <div className="text-[10px] mt-1 text-green-400">✓ {dataF1.length} filas cargadas</div>}
              </Card>
              <Card style={{padding:16}}>
                <div className="text-[12px] font-bold text-blue-400 mb-2">📅 Fecha de Picking</div>
                <input type="date" className="w-full p-2 rounded text-[11px]" style={{background:TC.bg,color:TC.text,border:`1px solid ${TC.borderSoft}`}} value={fechaPicking} onChange={e=>setFechaPicking(e.target.value)}/>
                <div className="text-[10px] mt-1" style={{color:TC.textFaint}}>Picking: <strong className="text-yellow-500">{getFechaP()}</strong> | Entrega: <strong className="text-yellow-500">{getFechaE()}</strong></div>
              </Card>
              <Card style={{padding:16}}>
                <div className="text-[12px] font-bold text-blue-400 mb-2">📁 Plan SimpliRoute <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded ml-2">Post Ruteo</span></div>
                <label className="flex items-center gap-2 w-full p-2 rounded border border-dashed cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" style={{borderColor:TC.border}}>
                  <Upload size={14} color={TC.textFaint}/><span className="text-[11px] truncate flex-1" style={{color:TC.textFaint}}>{fileSimpli?.name||'Subir Plan…'}</span>
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e=>{setFileSimpli(e.target.files?.[0]||null);e.target.value=''}}/>
                </label>
              </Card>
              <Card style={{padding:16}}>
                <div className="text-[12px] font-bold text-blue-400 mb-2">📁 Archivo Base SCI <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded ml-2">Post Ruteo</span></div>
                <label className="flex items-center gap-2 w-full p-2 rounded border border-dashed cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" style={{borderColor:TC.border}}>
                  <Upload size={14} color={TC.textFaint}/><span className="text-[11px] truncate flex-1" style={{color:TC.textFaint}}>{fileRuteo2?.name||'Subir Base…'}</span>
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e=>{setFileRuteo2(e.target.files?.[0]||null);e.target.value=''}}/>
                </label>
              </Card>
            </div>
          )}

          {tab==='preruteo' && (
            <div className="flex flex-col gap-3 max-w-lg">
              <Card style={{padding:16}}>
                <div className="text-[12px] font-bold mb-3" style={{color:TC.textSub}}>📋 Generar Tickets</div>
                <div className="text-[10px] mb-3" style={{color:TC.textFaint}}>Requiere el Archivo Base SCI cargado.</div>
                <div className="flex flex-wrap gap-2">
                  <Btn onClick={()=>descargarTickets('PROJECT','RUTEAR PROYECTOS')} disabled={!dataF1}>🏗 Proyectos</Btn>
                  <Btn onClick={()=>descargarTickets('POST_SALES','RUTEAR POST SALES')} disabled={!dataF1}>📦 Post Sales</Btn>
                  <Btn onClick={descargarMini} disabled={!dataF1}>🎫 Mini Ticket</Btn>
                  <Btn onClick={descargarRegular} disabled={!dataF1}>🎟 Regular</Btn>
                </div>
              </Card>
            </div>
          )}

          {tab==='postruteo' && (
            <div className="flex flex-col gap-3 max-w-lg">
              <Card style={{padding:16}}>
                <div className="text-[12px] font-bold mb-2" style={{color:TC.textSub}}>⚙️ Ejecutar Polinomio</div>
                <div className="text-[10px] mb-3" style={{color:TC.textFaint}}>Requiere Plan Simpliroute y Base SCI cargados en la tab Archivos.</div>
                <Btn variant="primary" style={{width:'100%'}} onClick={processFlujo2} disabled={processing||!fileSimpli||!fileRuteo2}>{processing?'Procesando…':'▶ Ejecutar Polinomio'}</Btn>
              </Card>
              {metricsData && <Card style={{padding:16}}><div className="text-[10px] text-green-400">✅ {metricsData.total} vehículos · Prom {metricsData.prom} ISOs · Total {metricsData.sum} ISOs</div></Card>}
            </div>
          )}

          {tab==='exports' && (
            <div className="flex flex-col gap-4 max-w-lg">
              <Card style={{padding:16,borderColor:'#eab308'}}>
                <div className="text-[12px] font-bold text-yellow-500 mb-3 uppercase tracking-wider">🚀 Exportaciones Finales</div>
                <div className="flex flex-col gap-2">
                  <Btn variant="primary" onClick={downloadPlan} disabled={!sheetPlanData.length} style={{background:'#eab308',borderColor:'#eab308',color:'#000',justifyContent:'flex-start'}}><Download size={14}/>1. Plan RUTEO</Btn>
                  <Btn onClick={downloadRouteTo} disabled={!sheetPlanData.length} style={{justifyContent:'flex-start'}}><Download size={14}/>2. ROUTE TO picking</Btn>
                  <Btn onClick={downloadPreola} disabled={!dataF1} style={{justifyContent:'flex-start'}}><Download size={14}/>3. ROUTE TO PROYECT+POST SALES</Btn>
                </div>
              </Card>
            </div>
          )}

          {tab === ('correo' as any) && (
            <div className="flex flex-col gap-4 max-w-lg">
              <Card style={{padding:24, textAlign:'center'}}>
                <div className="text-3xl mb-4">✉️</div>
                <h3 className="text-lg font-bold mb-2" style={{color:TC.text}}>Generar Correo Leslie</h3>
                <p className="text-[11px] mb-6" style={{color:TC.textFaint}}>
                  Crea una plantilla HTML con la tabla de órdenes de Proyectos para pegar directamente en Outlook. 
                  Se utiliza la fecha de entrega: <strong>{getFechaE()}</strong>.
                </p>
                <Btn variant="primary" onClick={handleGenerarCorreo} disabled={!dataF1} style={{width:'100%', padding:'12px'}}>
                  Copiar Cuerpo del Correo
                </Btn>
                {!dataF1 && <p className="text-[9px] mt-2 text-red-400">⚠️ Falta cargar el archivo Base SCI</p>}
              </Card>
            </div>
          )}

          {/* Log */}
          {logs.length>0 && (
            <div className="mt-6 rounded border overflow-y-auto max-h-40 font-mono text-[10px] p-3 flex flex-col gap-1" style={{background:'#0d1117',borderColor:TC.borderSoft,color:'#e6edf3'}}>
              {logs.map((L,i) => <div key={i} className={L.type==='err'?'text-red-400':L.type==='warn'?'text-yellow-400':L.type==='ok'?'text-green-400':'text-blue-300'}>{L.msg}</div>)}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
