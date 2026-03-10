import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { Upload, Truck, Search, Clipboard } from 'lucide-react'
import { useTheme, getThemeColors } from '../context/ThemeContext'
import { C, PageShell, Card, Btn, Badge } from '../ui/DS'
import GlassHeader, { GlassHeaderTab } from '../components/ui/GlassHeader'

const VERIVEL_TABS: GlassHeaderTab[] = [
  { id: 'carga',      label: 'Cargar Datos', icon: '📥', badgeVariant: 'blue'   },
  { id: 'resultados', label: 'Verificación', icon: '🚚', badgeVariant: 'green'  },
]

/* CSV helpers */
function detectSep(line: string) { const s = (line.match(/;/g)||[]).length, c = (line.match(/,/g)||[]).length, t = (line.match(/\t/g)||[]).length; if (t > s && t > c) return '\t'; return s > c ? ';' : ',' }
function parseRow(line: string, sep: string) { const r: string[] = []; let cur = '', inQ = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"') inQ = !inQ; else if (c === sep && !inQ) { r.push(cur); cur = '' } else cur += c } r.push(cur); return r }
function clean(s: any) { return (s||'').toString().trim().replace(/^"|"$/g,'').trim() }
function findCol(headers: string[], candidates: string[]) { for (const c of candidates) { const i = headers.findIndex(h => h.toLowerCase() === c.toLowerCase()); if (i !== -1) return headers[i] } for (const c of candidates) { const i = headers.findIndex(h => h.toLowerCase().includes(c.toLowerCase())); if (i !== -1) return headers[i] } return null }

type VehResult = { vehiculo: string; vehFinal: string; patente: string; estado: 'entregado' | 'pendiente' }

export default function VerificadorVehiculos() {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)

  const [activeTab, setActiveTab] = useState<'carga' | 'resultados'>('carga')
  const [reporteData, setReporteData] = useState<Map<string,string> | null>(null)
  const [simpliData, setSimpliData] = useState<{vehiculo:string;titulo:string}[] | null>(null)
  const [conversionMap, setConversionMap] = useState<Map<string,string> | null>(null)
  const [resultado, setResultado] = useState<VehResult[]>([])
  const [filterQ, setFilterQ] = useState('')
  const [toast, setToast] = useState('')
  const [stats, setStats] = useState<{s1:any;s2:any;s3:any}>({s1:null,s2:null,s3:null})

  const flash = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }, [])

  /* ── FILE 1: Reporte CSV ── */
  const handleReporte = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const lines = text.split(/\r?\n/).filter(l => l.trim()); if (lines.length < 2) return
      const sep = detectSep(lines[0])
      const headers = parseRow(lines[0], sep).map(clean)
      const colCom = findCol(headers, ['commerce']), colPar = findCol(headers, ['parentorder','parent_order']), colPat = findCol(headers, ['patente','Patente','placa'])
      if (!colPar || !colPat) return
      const map = new Map<string,string>()
      let ikeaCount = 0, withPat = 0
      for (let i = 1; i < lines.length; i++) {
        const cols = parseRow(lines[i], sep).map(clean)
        const obj: any = {}; headers.forEach((h,j) => obj[h] = cols[j]||'')
        if (colCom && obj[colCom].toUpperCase().trim() !== 'IKEA') continue
        ikeaCount++
        if (!obj[colPat].trim()) continue
        withPat++
        map.set(obj[colPar].trim().toLowerCase(), obj[colPat].trim())
      }
      setReporteData(map)
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
        const text = ev.target?.result as string
        const lines = text.split(/\r?\n/).filter(l => l.trim()); if (lines.length < 2) return
        const sep = detectSep(lines[0])
        const headers = parseRow(lines[0], sep).map(clean)
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
      const sheetName = wb.SheetNames.find(n => n.trim().toLowerCase() === 'plan') || wb.SheetNames[0]
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

  /* ── CRUZAR ── */
  const cruzar = () => {
    if (!reporteData || !simpliData) return
    const vehiculos = new Map<string, { isos: string[]; patentes: Set<string> }>()
    simpliData.forEach(({ vehiculo, titulo }) => {
      if (!vehiculos.has(vehiculo)) vehiculos.set(vehiculo, { isos: [], patentes: new Set() })
      const entry = vehiculos.get(vehiculo)!
      entry.isos.push(titulo)
      const pat = reporteData.get(titulo.trim().toLowerCase())
      if (pat) entry.patentes.add(pat)
    })
    const res: VehResult[] = []
    vehiculos.forEach((v, vehiculo) => {
      const patente = v.patentes.size > 0 ? [...v.patentes].join(' / ') : ''
      let vehFinal = vehiculo
      if (conversionMap) { const mapped = conversionMap.get(vehiculo.toLowerCase()); if (mapped) vehFinal = mapped }
      res.push({ vehiculo, vehFinal, patente, estado: patente ? 'entregado' : 'pendiente' })
    })
    res.sort((a,b) => { if (a.estado !== b.estado) return a.estado === 'entregado' ? -1 : 1; return a.vehFinal.localeCompare(b.vehFinal) })
    setResultado(res)
  }

  const copiar = () => {
    const filtered = resultado.filter(r => !filterQ || r.vehiculo.toLowerCase().includes(filterQ.toLowerCase()) || r.patente.toLowerCase().includes(filterQ.toLowerCase()))
    let tsv = 'Vehículo\tPatente\tEstado\n'
    filtered.forEach(r => { tsv += `${r.vehiculo}\t${r.patente}\t${r.estado === 'entregado' ? 'Vehículo Entregado' : 'Vehículo Pendiente Entrega'}\n` })
    navigator.clipboard?.writeText(tsv).then(() => flash('✓ Tabla copiada'))
  }

  const ent = resultado.filter(r => r.estado === 'entregado').length
  const pend = resultado.filter(r => r.estado === 'pendiente').length
  const filtered = resultado.filter(r => !filterQ || r.vehiculo.toLowerCase().includes(filterQ.toLowerCase()) || r.patente.toLowerCase().includes(filterQ.toLowerCase()))

  const handleCruzar = () => {
    cruzar()
    setActiveTab('resultados')
  }

  return (
    <PageShell>
      <GlassHeader 
        appName="Consultar Entrega de Vehículos"
        appDesc="SimpliRoute Cross-Check"
        icon="🚛"
        tabs={VERIVEL_TABS}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as any)}
        badges={{
          resultados: resultado.length
        }}
      />

      <div className="flex-1 overflow-hidden" style={{ background: TC.bg }}>
        <div className="h-full overflow-y-auto p-6">
          
          {activeTab === 'carga' && (
            <div className="max-w-4xl mx-auto flex flex-col gap-8 py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Step 1 */}
                <Card style={{ padding: 20 }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">1</div>
                    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: TC.text }}>Reporte CSV</div>
                  </div>
                  <label className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed transition-all hover:bg-blue-500/5 cursor-pointer h-32" style={{ borderColor: TC.border }}>
                    <Upload size={20} color={C.blue} />
                    <span className="text-[11px] font-bold text-center px-2 truncate w-full" style={{ color: TC.textSub }}>{stats.s1?.name || 'Subir CSV...'}</span>
                    <input type="file" accept=".csv,.txt" className="hidden" onChange={handleReporte} />
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

              <div className="flex flex-col items-center gap-4 mt-4">
                 <Btn variant="primary" size="lg" style={{ padding: '16px 48px', fontSize: 14 }} onClick={handleCruzar} disabled={!reporteData || !simpliData}>⚡ Cruzar Archivos Ahora</Btn>
                 <p className="text-[10px] text-gray-500 italic">Los datos se procesarán localmente para identificar vehículos no entregados.</p>
              </div>
            </div>
          )}

          {activeTab === 'resultados' && (
            <div className="h-full flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 max-w-md">
                   <div className="relative flex-1">
                      <Search size={14} color={TC.textFaint} className="absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text" 
                        className="w-full pl-9 pr-4 py-2 rounded-xl text-xs transition-all focus:ring-2 focus:ring-blue-500/20" 
                        style={{ background: TC.bgCard, color: TC.text, border: `1px solid ${TC.borderSoft}` }} 
                        placeholder="Filtrar por vehículo o patente..." 
                        value={filterQ} 
                        onChange={e => setFilterQ(e.target.value)}
                      />
                   </div>
                   <Btn onClick={copiar} disabled={!resultado.length} style={{ padding: '8px 16px' }}>
                      <Clipboard size={14} /> <span className="text-[10px]">Copiar</span>
                   </Btn>
                </div>

                {resultado.length > 0 && (
                  <div className="flex items-center gap-4 px-4 py-2 rounded-xl border border-dashed" style={{ borderColor: TC.borderSoft }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-[10px] font-bold text-green-500 font-mono">{ent}</span>
                      <span className="text-[9px] uppercase tracking-wider opacity-60">Entregados</span>
                    </div>
                    <div className="w-px h-3 bg-gray-500/20" />
                    <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                      <span className="text-[10px] font-bold text-orange-500 font-mono">{pend}</span>
                      <span className="text-[9px] uppercase tracking-wider opacity-60">Pendientes</span>
                    </div>
                  </div>
                )}
              </div>

              <Card style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
                {resultado.length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
                      <Truck size={48} strokeWidth={1} />
                      <div className="text-sm font-bold">Sin resultados</div>
                      <Btn onClick={() => setActiveTab('carga')}>Ir a Carga</Btn>
                   </div>
                ) : (
                  <div className="overflow-auto h-full">
                    <table className="w-full text-xs font-mono" style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr className="sticky top-0 z-10 shadow-sm">
                          {['Vehículo', 'Destinos', 'Patente detectada', 'Estado Final'].map(h => (
                            <th key={h} className="text-left p-4 text-[10px] font-bold uppercase tracking-wider" style={{ background: TC.headerBg, color: TC.textDisabled, borderBottom: `1px solid ${TC.borderSoft}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((r, i) => (
                          <tr key={i} className="group hover:bg-blue-500/5 transition-colors border-b" style={{ borderColor: TC.borderSoft }}>
                            <td className="p-4 font-bold" style={{ color: TC.text }}>{r.vehFinal} <span className="text-[9px] opacity-30 font-normal">({r.vehiculo})</span></td>
                            <td className="p-4">
                               <Badge variant={r.estado === 'entregado' ? 'teal' : 'purple'} style={{ fontSize: 9 }}>MATCH OK</Badge>
                            </td>
                            <td className="p-4">
                              {r.patente ? (
                                <span className="bg-blue-500/10 text-blue-400 font-bold px-2 py-1 rounded text-[10px] border border-blue-500/20">{r.patente}</span>
                              ) : (
                                <span className="text-[10px] opacity-30 italic">No detectada</span>
                              )}
                            </td>
                            <td className="p-4">
                              {r.estado === 'entregado' ? (
                                <div className="flex items-center gap-2 text-green-500 font-bold">
                                   <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                   Vehículo Entregado
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-orange-400 font-bold">
                                   <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                   Pendiente Entrega
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>

      {toast && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-green-500 text-black font-bold text-xs px-8 py-3 rounded-full shadow-2xl z-50">{toast}</div>}
    </PageShell>
  )
}
