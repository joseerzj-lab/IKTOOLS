import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
// ── Components ───────────────────────────────────────────────────────────
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Copy, Maximize2, FileDown, FileSpreadsheet, AlertTriangle, Truck } from 'lucide-react'
import { useTheme, getThemeColors } from '../context/ThemeContext'
import { PageShell, Card, Btn, Badge } from '../ui/DS'
import GlassHeader from '../components/ui/GlassHeader'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LabelList } from 'recharts'
import { exportElementAsImage } from '../utils/exportUtils'
import { DropdownMenu } from '../components/ui/dropdown-menu'
import TableModal from '../components/reporte-rutas/TableModal'
import { useRiskAnalysis } from '../hooks/useRiskAnalysis'
import { useConflictAnalysis } from '../hooks/useConflictAnalysis'
import { useComunas } from '../hooks/useComunas'
import type { RouteRow, RiskResult, ComunaConflict } from '../types/auditoria'

const REPORT_TABS = [
  { id: 'carga',   label: 'Cargar Datos', icon: '📁', badgeVariant: 'blue'   },
  { id: 'reporte', label: 'Tabla de Datos', icon: '📋', badgeVariant: 'green'  },
  { id: 'grafico', label: 'Gráfico Interactivo', icon: '📊', badgeVariant: 'purple' },
  { id: 'resumen', label: 'Avance en Ruta', icon: '📝', badgeVariant: 'yellow' },
  { id: 'isos',    label: 'ISOs por camion', icon: '🚚', badgeVariant: 'orange' },
]

/* ── CSV ── */
function detectSep(line: string) { const s=(line.match(/;/g)||[]).length, c=(line.match(/,/g)||[]).length; return s>c?';':',' }
function parseRow(line: string, sep: string) { const r:string[]=[]; let cur='',inQ=false; for(let i=0;i<line.length;i++){const ch=line[i]; if(ch==='"')inQ=!inQ; else if(ch===sep&&!inQ){r.push(cur.trim().replace(/^"|"$/g,'')); cur=''} else cur+=ch} r.push(cur.trim().replace(/^"|"$/g,'')); return r }
function getKey(row:any,key:string){const k=Object.keys(row).find(k=>k.trim().toLowerCase()===key.toLowerCase()); return k?row[k]:null}

function termGradient(pct:number){const p=Math.max(0,Math.min(100,pct)); if(p>=100)return{bg:'rgba(34,197,94,.25)',txt:'#22c55e'}; if(p>=90)return{bg:'rgba(234,179,8,.2)',txt:'#eab308'}; return{bg:'rgba(239,68,68,.15)',txt:'#ef4444'}}

type PRData = {
  regions: Record<string,{
    orders:Set<string>;
    estados:Record<string,Set<string>>;
    gestiones: Record<string, number>;
    patentes:Record<string,{
      orders:Set<string>;
      estados:Record<string,Set<string>>;
      gestiones: Record<string, number>;
      poStates:Record<string,Set<string>>; 
      auditAlerts: {offRoute: number, wrongCommune: number}
    }>; 
    auditAlerts: {offRoute: number, wrongCommune: number}
  }>
  estados: string[]
  conflictedByPatente: Record<string, { po: string, states: string[], rows: any[] }[]>
  hasConflicts: boolean
  auditConflicts: ComunaConflict[]
  auditRisk: Record<string, RiskResult>
}

export default function ReporteRutas() {
  const { theme, isDark, setIsExporting } = useTheme()
  const TC = getThemeColors(theme)
  const [fileName, setFileName] = useState('')
  const [rawRows, setRawRows] = useState<any[]>([])
  const [data, setData] = useState<PRData|null>(null)
  const [activeTab, setActiveTab] = useState<'carga' | 'reporte' | 'grafico' | 'resumen' | 'isos'>('carga')
  const [toast, setToast] = useState('')
  const [viewMode, setViewMode] = useState<'numbers'|'pct'>('numbers')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  
  const [chartLayout, setChartLayout] = useState<'vertical' | 'horizontal'>('vertical')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)

  // -- Filtering & Sorting
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set())
  const [isSearching, setIsSearching] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: '', direction: null })

  // -- Modals Data (Conflicts & Patente Detail)
  const [conflictModalOpen, setConflictModalOpen] = useState(false)
  const [conflictModalData, setConflictModalData] = useState<any[]>([])
  const [conflictModalCols, setConflictModalCols] = useState<string[]>([])
  const [activePatente, setActivePatente] = useState('')

  const [patenteModalOpen, setPatenteModalOpen] = useState(false)
  const [patenteModalData, setPatenteModalData] = useState<any[]>([])
  const [patenteModalCols, setPatenteModalCols] = useState<any[]>([])
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showConflictAlert, setShowConflictAlert] = useState(true)

  // -- Audit hooks
  const { runAnalysis: runRisk } = useRiskAnalysis()
  const { runAnalysis: runConflict } = useConflictAnalysis()
  const { ready: comunasReady, getAdjMap } = useComunas()

  // -- Modal Cell Selection
  const [selection, setSelection] = useState<{ start: {r: number, c: number} | null, end: {r: number, c: number} | null }>({ start: null, end: null })
  const [isDragging, setIsDragging] = useState(false)

  const [chartRegion, setChartRegion] = useState('')
  const [summaryRegion, setSummaryRegion] = useState('ALL')

  const tableRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (r: number, c: number) => {
    setSelection({ start: {r, c}, end: {r, c} })
    setIsDragging(true)
  }

  const handleMouseEnter = (r: number, c: number) => {
    if (isDragging) {
      setSelection(prev => ({ ...prev, end: {r, c} }))
    }
  }

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [handleMouseUp])

  const processCSVData = (rows: any[]) => {
      const processed:PRData['regions'] = {}; const estadosSet = new Set<string>()
      const rawRowsByPO: Record<string, any[]> = {}
      
      setRawRows(rows)

      rows.forEach(row => {
        const commerce=(getKey(row,'Commerce')||'').trim()
        const patente=(getKey(row,'Patente')||'').trim()
        const region=(getKey(row,'Region')||'Sin Región').trim()
        const estado=(getKey(row,'Estado')||'Sin Estado').trim()
        const parentOrder=(getKey(row,'ParentOrder')||'').trim()
        const gestion=(getKey(row,'Gestión')||getKey(row,'GESTIÓN')||'DIRECTO').trim().toUpperCase()

        if(commerce.toLowerCase()!=='ikea'||!patente) return
        
        estadosSet.add(estado)
        if (!rawRowsByPO[parentOrder]) rawRowsByPO[parentOrder] = []
        rawRowsByPO[parentOrder].push(row)

        if(!processed[region]) {
          processed[region]={
            orders:new Set(),
            estados:{},
            gestiones:{},
            patentes:{}, 
            auditAlerts: {offRoute:0, wrongCommune:0}
          }
        }
        processed[region].orders.add(parentOrder)
        if(!processed[region].estados[estado]) processed[region].estados[estado]=new Set()
        processed[region].estados[estado].add(parentOrder)
        
        if(!processed[region].gestiones[gestion]) processed[region].gestiones[gestion] = 0
        processed[region].gestiones[gestion]++

        const pats = processed[region].patentes
        if(!pats[patente]) {
          pats[patente]={
            orders:new Set(),
            estados:{},
            gestiones:{},
            poStates:{}, 
            auditAlerts: {offRoute:0, wrongCommune:0}
          }
        }
        pats[patente].orders.add(parentOrder)
        if(!pats[patente].estados[estado]) pats[patente].estados[estado]=new Set()
        pats[patente].estados[estado].add(parentOrder)
        if(!pats[patente].poStates[parentOrder]) pats[patente].poStates[parentOrder]=new Set()
        pats[patente].poStates[parentOrder].add(estado)

        if(!pats[patente].gestiones[gestion]) pats[patente].gestiones[gestion] = 0
        pats[patente].gestiones[gestion]++
      })

      const conflictedByPatente: Record<string, { po: string, states: string[], rows: any[] }[]> = {}
      let hasConflicts = false

      Object.values(processed).forEach(rData => {
        Object.entries(rData.patentes).forEach(([patente, pData]) => {
          const conf = Object.entries(pData.poStates)
            .filter(([, s]) => s.size > 1)
            .map(([po, s]) => ({ po, states: Array.from(s), rows: rawRowsByPO[po] || [] }))
          
          if (conf.length) {
            if (!conflictedByPatente[patente]) conflictedByPatente[patente] = []
            conflictedByPatente[patente].push(...conf)
            hasConflicts = true
          }
        })
      })

      const auditData: RouteRow[] = rows.map(r => ({
        iso: (getKey(r, 'ISO') || getKey(r, 'TITULO') || getKey(r, 'ISO/TITULO') || '').toString().trim(),
        veh: (getKey(r, 'Patente') || '').toString().trim(),
        dir: (getKey(r, 'Direccion') || getKey(r, 'DIRECCION_ENTREGA') || '').toString().trim(),
        comuna: (getKey(r, 'Comuna') || getKey(r, 'CITY') || '').toString().trim(),
        provincia: '',
        lat: parseFloat(getKey(r, 'Latitud') || getKey(r, 'Y') || 'NaN'),
        lng: parseFloat(getKey(r, 'Longitud') || getKey(r, 'X') || 'NaN'),
        parada: parseInt(getKey(r, 'Parada') || '0')
      })).filter(r => r.iso && r.veh)
      
      const hasGeo = auditData.some(r => !isNaN(r.lat!) && !isNaN(r.lng!))
      const cleanedAuditData = auditData.map(r => ({ ...r, lat: isNaN(r.lat!) ? null : r.lat, lng: isNaN(r.lng!) ? null : r.lng }))

      let auditRisk: Record<string, RiskResult> = {}
      let auditConflicts: ComunaConflict[] = []

      if (comunasReady) {
        const adjMap = getAdjMap()
        auditRisk = runRisk(cleanedAuditData, new Set(), adjMap)
        if (hasGeo) {
          auditConflicts = runConflict(cleanedAuditData)
        }
      }

      // Map audit metrics back to patentes and regions
      Object.keys(processed).forEach(reg => {
        processed[reg].auditAlerts = { offRoute: 0, wrongCommune: 0 }
        Object.keys(processed[reg].patentes).forEach(pat => {
          const pData = processed[reg].patentes[pat]
          const offRouteCount = auditRisk[pat]?.results.filter(r => r.riskLevel === 'high' || r.riskLevel === 'medium').reduce((a, b) => a + b.count, 0) || 0
          const wrongCommuneCount = auditConflicts.filter(c => c.veh === pat).length
          pData.auditAlerts = { offRoute: offRouteCount, wrongCommune: wrongCommuneCount }
          processed[reg].auditAlerts.offRoute += offRouteCount
          processed[reg].auditAlerts.wrongCommune += wrongCommuneCount
        })
      })

      setData({ 
        regions: processed, 
        estados: [...estadosSet].sort(),
        conflictedByPatente,
        hasConflicts,
        auditConflicts,
        auditRisk
      })
      setSelectedRegions(new Set(Object.keys(processed)))
      setActiveTab('reporte')
      setChartRegion(Object.keys(processed).sort()[0] || '')
  }

  const flash = useCallback((msg:string)=>{setToast(msg);setTimeout(()=>setToast(''),2500)}, [])

  const exportToImage = async (elementRef: React.RefObject<HTMLDivElement|null>, filename: string, mode: 'download' | 'copy' = 'download') => {
    const el = elementRef.current
    if (!el) {
      flash('❌ Error: Elemento no encontrado')
      return
    }
    
    await exportElementAsImage(el, filename, {
      mode,
      backgroundColor: '#ffffff',
      onNotify: flash,
      onBeforeExport: () => setIsExporting(true),
      onAfterExport: () => setIsExporting(false)
    })
  }

  const handleBarClick = (payloadData: any) => {
    if (!payloadData || !payloadData.patente) return
    const pat = payloadData.patente
    openPatenteModal(pat)
  }

  const openPatenteModal = (patente: string) => {
    const rows = rawRows.filter(r => (getKey(r, 'Patente') || '').trim() === patente)
    const knownCols = new Set(['commerce','patente','region','estado','parentorder'])
    let extraCols: string[] = []
    if (rows.length > 0) {
      extraCols = Object.keys(rows[0]).filter(k => !knownCols.has(k.trim().toLowerCase()))
    }
    const cols = ['Estado', 'Patente', 'Region', 'ParentOrder', ...extraCols]
    const pData = rows.map(r => ({
      Estado: (getKey(r, 'Estado') || '').trim(),
      Patente: (getKey(r, 'Patente') || '').trim(),
      Region: (getKey(r, 'Region') || '').trim(),
      ParentOrder: (getKey(r, 'ParentOrder') || '').trim(),
      ...Object.fromEntries(extraCols.map(c => [c, String(r[c] ?? '')]))
    }))

    setActivePatente(patente)
    setPatenteModalCols(cols)
    setPatenteModalData(pData)
    setPatenteModalOpen(true)
  }

  const openConflictModal = (patente: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!data || !data.conflictedByPatente[patente]) return
    const conflicts = data.conflictedByPatente[patente]
    
    const knownCols = new Set(['commerce','patente','region','estado','parentorder'])
    let extraCols: string[] = []
    if (conflicts[0].rows.length > 0) {
      extraCols = Object.keys(conflicts[0].rows[0]).filter(k => !knownCols.has(k.trim().toLowerCase()))
    }
    const cols = ['Estado', 'Patente', 'Region', 'ParentOrder', ...extraCols, '_isConflict']
    
    const conflictedPOs = new Set(conflicts.map(c => c.po))
    const cData: any[] = []
    
    conflicts.forEach(({po, rows}) => {
      rows.forEach(r => {
        cData.push({
          Estado: (getKey(r, 'Estado') || '').trim(),
          Patente: (getKey(r, 'Patente') || '').trim(),
          Region: (getKey(r, 'Region') || '').trim(),
          ParentOrder: po,
          _isConflict: conflictedPOs.has(po),
          _refRow: r, // Keep ref to original
          ...Object.fromEntries(extraCols.map(c => [c, String(r[c] ?? '')]))
        })
      })
    })

    setActivePatente(patente)
    setConflictModalCols(cols)
    setConflictModalData(cData)
    setConflictModalOpen(true)
  }

  const handleDeleteConflictRow = (rowIndex: number) => {
    const rowToRemove = conflictModalData[rowIndex]
    if (!rowToRemove) return

    const newRawRows = rawRows.filter(r => r !== rowToRemove._refRow)
    const newModalData = conflictModalData.filter((_, i) => i !== rowIndex)
    setConflictModalData(newModalData)
    processCSVData(newRawRows)
    flash('✓ Fila eliminada')
    if (newModalData.length === 0) setConflictModalOpen(false)
  }

  const exportModalDataCSV = (mdata: any[], cols: string[], filename: string) => {
    const csvCols = cols.filter(c => c !== '_isConflict')
    const escCSV = (v: any) => { const s = String(v ?? ''); return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s }
    let csv = csvCols.map(escCSV).join(',') + '\n'
    mdata.forEach((row: any) => { csv += csvCols.map(c => escCSV(row[c] ?? '')).join(',') + '\n' })
    const blob = new Blob(["\uFEFF"+csv], {type: 'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${filename}.csv`
    link.click()
  }

  const formatPct = (v: number) => {
    const val = parseFloat(v.toFixed(1)).toString().replace('.', ',')
    return val + '%'
  }

  const chartData = useMemo(() => {
    if (!data || !chartRegion || !data.regions[chartRegion]) return []
    const rd = data.regions[chartRegion]
    const pats = Object.keys(rd.patentes).sort()
    
    return pats.map(pat => {
      const pd = rd.patentes[pat]
      const obj: any = { patente: pat }
      let terminados = 0, planificados = 0, pendientes = 0, enRuta = 0
      let total = pd.orders.size
      
      data.estados.forEach(e => {
        const v = pd.estados[e] ? pd.estados[e].size : 0
        const elow = e.toLowerCase()
        if (elow.includes('terminado')) terminados += v
        else if (elow.includes('planificado')) planificados += v
        else if (elow.includes('en ruta') || elow.includes('enruta')) enRuta += v
        else if (elow.includes('pendiente')) pendientes += v
        else obj[e] = v
      })
      
      obj.Terminado = terminados
      obj.Planificado = planificados
      obj.Pendiente = pendientes
      obj['En Ruta'] = enRuta
      obj.totalNum = total
      obj.dummy = 0.05
      const val = total > 0 ? (terminados / total) * 100 : 0
      if (terminados === 0) obj.pctCompletado = 0
      else if (planificados === 0 && enRuta === 0) obj.pctCompletado = 100
      else obj.pctCompletado = Math.round(val)

      return obj
    }).sort((a,b) => b.totalNum - a.totalNum).slice(0, 80)
  }, [data, chartRegion])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const lines = text.split(/\r?\n/).filter(l=>l.trim()); if (lines.length < 2) return
      const sep = detectSep(lines[0])
      const headers = parseRow(lines[0], sep)
      const rows = lines.slice(1).map(line => { const vals = parseRow(line, sep); const obj:any={}; headers.forEach((h,i)=>obj[h]=vals[i]||''); return obj })
      setFileName(file.name)
      processCSVData(rows)
      flash('✓ Reporte procesado')
    }
    reader.readAsText(file, 'UTF-8'); e.target.value=''
  }

  const toggleRegion = (r:string) => setExpanded(p=>{const n=new Set(p); n.has(r)?n.delete(r):n.add(r); return n})
  const toggleAll = () => { if(!data) return; const allKeys=allRegions; setExpanded(p=>p.size>=allKeys.length?new Set():new Set(allKeys)) }
  
  const allRegions = useMemo(() => data ? Object.keys(data.regions).sort() : [], [data])
  
  const displayedRegions = useMemo(() => {
    if (!data) return []
    return allRegions.filter(r => selectedRegions.has(r))
  }, [data, allRegions, selectedRegions])

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' }
        if (prev.direction === 'desc') return { key: '', direction: null }
      }
      return { key, direction: 'asc' }
    })
  }

  const getSortedPatentes = useCallback((region: string) => {
    if (!data || !data.regions[region]) return []
    const rd = data.regions[region]
    let pats = Object.keys(rd.patentes)

    if (sortConfig.key && sortConfig.direction) {
      pats.sort((a, b) => {
        const pdA = rd.patentes[a]
        const pdB = rd.patentes[b]
        const totalA = pdA.orders.size
        const totalB = pdB.orders.size

        let valA: number, valB: number

        if (sortConfig.key === 'Total') {
          valA = totalA
          valB = totalB
        } else {
          // It's a state column
          const vA = pdA.estados[sortConfig.key] ? pdA.estados[sortConfig.key].size : 0
          const vB = pdB.estados[sortConfig.key] ? pdB.estados[sortConfig.key].size : 0
          
          if (viewMode === 'pct') {
            valA = totalA > 0 ? (vA / totalA) * 100 : 0
            valB = totalB > 0 ? (vB / totalB) * 100 : 0
          } else {
            valA = vA
            valB = vB
          }
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    } else {
      pats.sort()
    }

    return pats
  }, [data, sortConfig, viewMode])

  const exportTableCSV = () => {
    if(!data) return
    const esc = (v: any) => { 
      const s = String(v ?? ''); 
      return (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes(';')) ? `"${s.replace(/"/g, '""')}"` : s 
    }
    const sep = ','
    
    let csv = `Región / Patente${sep}${data.estados.map(esc).join(sep)}${sep}Total\n`
    allRegions.forEach(region => {
      const rd = data.regions[region]; const total = rd.orders.size;
      let line = `${esc(region)}${sep}`
      data.estados.forEach(e => {
         const v = rd.estados[e] ? rd.estados[e].size : 0
         line += `${v > 0 ? (viewMode === 'pct' ? formatPct((v/total)*100) : v) : ''}${sep}`
      })
      line += `${viewMode === 'pct' ? formatPct(100) : total}\n`
      csv += line
      
      const patentes = getSortedPatentes(region)
      patentes.forEach(pat => {
        const pd = rd.patentes[pat]; const pT = pd.orders.size;
        let pLine = ` ${esc(pat)}${sep}`
        data.estados.forEach(e => {
            const v = pd.estados[e] ? pd.estados[e].size : 0
            pLine += `${v > 0 ? (viewMode === 'pct' ? formatPct((v/pT)*100) : v) : ''}${sep}`
        })
        pLine += `${viewMode === 'pct' ? formatPct(100) : pT}\n`
        csv += pLine
      })
    })
    const blob = new Blob(["\uFEFF"+csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Reporte_Rutas_Tabla.csv`;
    link.click();
    flash('✓ Excel exportado')
  }

  const exportSummaryCSV = () => {
    if(!data) return
    let csv = `Región\tÓrdenes\tVehículos\n`
    const regionsToProcess = summaryRegion === 'ALL' ? allRegions : [summaryRegion]
    regionsToProcess.forEach(r => {
      const rd = data.regions[r]; if(!rd) return
      const totOrder = rd.orders.size; const totVeh = Object.keys(rd.patentes).length
      csv += `${r}\t${totOrder}\t${totVeh}\n`
    })
    const blob = new Blob(["\uFEFF"+csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Reporte_Rutas_Resumen.csv`;
    link.click();
    flash('✓ Excel exportado')
  }

  const handleManualSearch = () => {
    if (!searchQuery.trim() || rawRows.length === 0) {
      setSearchResults([])
      flash('⚠️ Ingresa un término para buscar')
      return
    }

    setIsSearching(true)
    // Small timeout to allow the "Buscando..." animation to render before heavy work
    setTimeout(() => {
      const q = searchQuery.toLowerCase().trim()
      const results = []
      const primaryFields = ['ParentOrder', 'TITULO', 'ISO', 'TITULO_ISO', 'TÍTULO', 'Referencia', 'Order', 'ISO/TITULO', 'Patente', 'Region']

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i]
        
        // Skip non-Ikea rows
        const commerce = (getKey(row, 'Commerce') || '').toString().toLowerCase()
        if (commerce !== 'ikea') continue

        let match = false
        for (const field of primaryFields) {
           const val = (getKey(row, field) || '').toString().toLowerCase()
           if (val.includes(q)) {
             match = true
             break
           }
        }

        if (!match) {
          const values = Object.values(row)
          for (let j = 0; j < values.length; j++) {
            if (String(values[j]).toLowerCase().includes(q)) {
              match = true
              break
            }
          }
        }

        if (match) {
          results.push(row)
        }
      }

      setSearchResults(results)
      setIsSearching(false)
      
      if (results.length > 0) {
        setIsSearchModalOpen(true)
      } else {
        flash('❌ No se encontraron resultados para esta búsqueda')
      }
    }, 200)
  }

  const displayedModalData = searchResults

  const copySearchData = () => {
    if (displayedModalData.length === 0) return
    const keys = Object.keys(displayedModalData[0])
    let text = keys.join('\t') + '\n'
    displayedModalData.forEach((row: any) => {
      text += keys.map(k => String(row[k] || '').replace(/\t/g, ' ')).join('\t') + '\n'
    })
    navigator.clipboard?.writeText(text).then(() => flash('✓ Tabla copiada (formato Excel)'))
  }

  return (
    <PageShell>
      <GlassHeader 
        appName="REPORTE DE RUTAS"
        icon="📊"
        tabs={REPORT_TABS as any}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as any)}
        badges={{ reporte: data?.regions ? Object.keys(data.regions).length : 0 }}
      />

      <div className="flex-1 overflow-hidden relative" style={{ background: theme === 'landscape' ? 'transparent' : TC.bg }}>
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
                    <div className="flex gap-4 items-center sticky top-0 z-20 py-3 px-4 rounded-xl border shadow-lg" style={{ backdropFilter: 'blur(12px)', background: isDark ? 'rgba(30,41,59,0.7)' : 'rgba(246,248,250,0.8)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
                      <div className="flex p-1 rounded-full bg-black/5 dark:bg-white/5 border shadow-inner transition-colors" style={{ borderColor: TC.border }}>
                         <button onClick={() => setViewMode('numbers')} className={`text-[10px] font-bold px-5 py-2 rounded-full transition-all ${viewMode === 'numbers' ? 'bg-blue-600 text-white shadow-lg' : 'hover:text-blue-500'}`} style={{ border: 'none', cursor: 'pointer', color: viewMode === 'numbers' ? 'white' : TC.textMuted }}>🔢 Números</button>
                         <button onClick={() => setViewMode('pct')} className={`text-[10px] font-bold px-5 py-2 rounded-full transition-all ${viewMode === 'pct' ? 'bg-blue-600 text-white shadow-lg' : 'hover:text-blue-500'}`} style={{ border: 'none', cursor: 'pointer', color: viewMode === 'pct' ? 'white' : TC.textMuted }}>📈 Porcentajes</button>
                      </div>
                      
                       <div className="flex-1 max-w-sm ml-4 relative">
                        <DropdownMenu
                          closeOnSelect={false}
                          options={[
                            { label: 'Todas las Regiones', onClick: () => setSelectedRegions(new Set(allRegions)), Icon: <Badge variant="blue" style={{ fontSize: 9 }}>ALL</Badge> },
                            { label: 'Ninguna', onClick: () => setSelectedRegions(new Set()), Icon: <X size={14} /> },
                            ...allRegions.map(r => ({
                              label: r,
                              onClick: () => setSelectedRegions(prev => {
                                const n = new Set(prev)
                                n.has(r) ? n.delete(r) : n.add(r)
                                return n
                              }),
                              Icon: <div className={`w-3 h-3 rounded-full ${selectedRegions.has(r) ? 'bg-blue-500' : 'bg-gray-500/20'}`} />
                            }))
                          ]}
                        >
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-bold transition-colors" style={{ color: TC.text }}>📍 Regiones ({selectedRegions.size})</span>
                          </div>
                        </DropdownMenu>
                      </div>

                      <div className="flex-1 max-w-sm ml-4 relative">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                          <Search size={14} />
                        </div>
                        <input
                          type="text"
                          placeholder="Buscar ISO / ParentOrder..."
                          className="w-full bg-white/5 border text-xs rounded-full pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
                          style={{ borderColor: TC.border, color: TC.text }}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <AnimatePresence>
                          {isSearching && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[9px] font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded-full pointer-events-none"
                            >
                              <div className="w-2 h-2 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                              Buscando...
                            </motion.div>
                          )}
                        </AnimatePresence>
                        {searchQuery.trim() && (
                          <button
                            onClick={handleManualSearch}
                            className="absolute inset-y-1 right-1 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-all flex items-center justify-center group"
                            title="Buscar"
                          >
                            <Search size={16} className="group-hover:scale-110 transition-transform" />
                          </button>
                        )}
                      </div>

                      <div className="ml-auto flex gap-2">
                        <DropdownMenu
                          options={[
                            { label: 'Descargar Imagen', onClick: () => exportToImage(tableRef, 'reporte_rutas_tabla', 'download'), Icon: <FileDown size={14} /> },
                            { label: 'Copiar Imagen', onClick: () => exportToImage(tableRef, 'reporte_rutas_tabla', 'copy'), Icon: <Copy size={14} /> },
                            { label: 'Exportar Excel (CSV)', onClick: exportTableCSV, Icon: <FileSpreadsheet size={14} /> }
                          ]}
                        >
                          <FileDown size={14} className="mr-2" /> Exportar Tabla
                        </DropdownMenu>
                        <Btn onClick={toggleAll} style={{ fontSize: 10, padding: '7px 16px' }}>
                          {expanded.size >= allRegions.length ? '⊟ Contraer' : '⊞ Expandir'} todo
                        </Btn>
                      </div>
                    </div>

                    {data.hasConflicts && showConflictAlert && (
                      <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 flex items-center gap-3 relative group mb-2">
                         <AlertTriangle size={18} className="text-orange-500 shrink-0" />
                         <div className="text-sm pr-8" style={{ color: TC.text }}>
                           <strong>⚠️ Conflictos de Estado:</strong> Hay ParentOrders con múltiples estados simultáneos.
                         </div>
                         <button onClick={() => setShowConflictAlert(false)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-orange-500/20 rounded-full transition-colors text-orange-500/50 hover:text-orange-500"><X size={16} /></button>
                      </div>
                    )}

                    {(data.auditRisk && Object.keys(data.auditRisk).length > 0) && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-3 relative group">
                         <Truck size={18} className="text-red-500 shrink-0" />
                         <div className="text-sm pr-8" style={{ color: TC.text }}>
                           <strong>🔍 Auditoría Geográfica:</strong> Se han detectado rutas con riesgo de Off-Route o Comuna Incorrecta. Revisa las patentes marcadas.
                         </div>
                      </div>
                    )}

                    <Card style={{ padding: 0, overflow: 'hidden', border: `1px solid ${TC.borderSoft}`, boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
                      <div className="overflow-x-auto" ref={tableRef} id="table-export-container">
                        <table className="w-full text-[11px] font-mono" style={{ borderCollapse: 'collapse', background: TC.bgCard }}>
                          <thead>
                            <tr className="shadow-sm">
                              <th className="text-left p-5 font-black uppercase tracking-widest cursor-pointer hover:bg-black/5" style={{ background: TC.headerBg, color: isDark ? '#ffffff' : '#000000', borderBottom: `2px solid ${TC.borderSoft}` }} onClick={() => handleSort('Región')}>
                                Región / Patente {sortConfig.key === 'Región' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                              </th>
                              {data.estados.map(e => (
                                <th key={e} className="text-right p-5 font-black uppercase tracking-widest whitespace-nowrap cursor-pointer hover:bg-black/5" style={{ background: TC.headerBg, color: isDark ? '#ffffff' : '#000000', borderBottom: `2px solid ${TC.borderSoft}` }} onClick={() => handleSort(e)}>
                                  {e} {sortConfig.key === e ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                                </th>
                              ))}
                              <th className="text-right p-5 font-black uppercase tracking-widest cursor-pointer hover:bg-black/5" style={{ background: TC.headerBg, color: isDark ? '#ffffff' : '#000000', borderBottom: `2px solid ${TC.borderSoft}` }} onClick={() => handleSort('Total')}>
                                Total {sortConfig.key === 'Total' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            <AnimatePresence mode="popLayout">
                              {displayedRegions.map(region => {
                                const rd = data.regions[region]; const total = rd.orders.size; const isExp = expanded.has(region)
                                const patentes = getSortedPatentes(region)
                                return (
                                  <React.Fragment key={region}>
                                    <motion.tr 
                                      layout
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.95 }}
                                      className="group cursor-pointer hover:bg-blue-500/10 transition-colors border-b" 
                                      style={{ borderColor: TC.borderSoft }} 
                                      onClick={() => toggleRegion(region)}
                                    >
                                      <td className="p-5 font-bold" style={{ color: '#0ea5e9' }}>
                                        <div className="flex items-center gap-2">
                                          <span className="mr-4 opacity-40">{isExp ? '▼' : '▶'}</span> 
                                          {region}
                                          {rd.auditAlerts && (rd.auditAlerts.offRoute > 0 || rd.auditAlerts.wrongCommune > 0) && (
                                            <div className="flex gap-1 ml-2">
                                              {rd.auditAlerts.offRoute > 0 && <Badge variant="medium" style={{ fontSize: 8 }}>FR: {rd.auditAlerts.offRoute}</Badge>}
                                              {rd.auditAlerts.wrongCommune > 0 && <Badge variant="high" style={{ fontSize: 8 }}>CI: {rd.auditAlerts.wrongCommune}</Badge>}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      {data.estados.map(e => { const v = rd.estados[e] ? rd.estados[e].size : 0; return <td key={e} className="p-5 text-right font-bold" style={{ color: TC.text }}>{v > 0 ? (viewMode === 'pct' ? formatPct((v/total)*100) : v) : <span className="opacity-10">·</span>}</td> })}
                                      <td className="p-5 text-right font-black" style={{ color: TC.textSub, background: isDark?'rgba(255,255,255,0.02)':'rgba(0,0,0,0.02)' }}>{viewMode === 'pct' ? formatPct(100) : total}</td>
                                    </motion.tr>
                                    {isExp && patentes.map((pat, pIdx) => {
                                      const pd = rd.patentes[pat]; const pT = pd.orders.size; const termIdx = data.estados.findIndex(e => e.toLowerCase().includes('terminado'))
                                      
                                      let sumPct = 0
                                      data.estados.forEach(e => {
                                        const v = pd.estados[e] ? pd.estados[e].size : 0
                                        sumPct += pT > 0 ? (v/pT)*100 : 0
                                      })
                                      const isConf = viewMode === 'pct' && sumPct > 100.5
                                      const hasConfData = data.conflictedByPatente[pat]
                                      const rowBgClass = isConf ? 'bg-orange-50 dark:bg-orange-900/10' : 'hover:bg-white/[.04]'
                                      
                                      return (
                                        <motion.tr 
                                          layout
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          exit={{ opacity: 0, x: 10 }}
                                          transition={{ delay: pIdx * 0.01 }}
                                          key={`${region}-${pat}`} 
                                          className={`${rowBgClass} transition-colors border-b`} 
                                          style={{ borderColor: TC.borderSoft }}
                                        >
                                          <td className="p-3 pl-14 text-gray-500 italic relative overflow-hidden flex items-center gap-2">
                                            <span className="absolute left-10 top-1/2 -translate-y-1/2 w-2 h-2 border-l-2 border-b-2 border-gray-700/50"></span>
                                            <span className={`text-base font-black ${isConf ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100'}`}>{pat}</span>
                                            {pd.auditAlerts && pd.auditAlerts.offRoute > 0 && <Badge variant="medium" style={{ fontSize: 8 }}>FR: {pd.auditAlerts.offRoute}</Badge>}
                                            {pd.auditAlerts && pd.auditAlerts.wrongCommune > 0 && <Badge variant="high" style={{ fontSize: 8 }}>CI: {pd.auditAlerts.wrongCommune}</Badge>}
                                            {isConf && hasConfData && (
                                              <button data-html2canvas-ignore onClick={(e) => openConflictModal(pat, e)} className="text-[9px] bg-orange-100 text-orange-600 border border-orange-300 px-2 py-0.5 rounded-full hover:bg-orange-200 transition-colors ml-1">
                                                ⚠️ Conflictos ({data.conflictedByPatente[pat].length} PO)
                                              </button>
                                            )}
                                            <button data-html2canvas-ignore onClick={(e) => { e.stopPropagation(); openPatenteModal(pat) }} className="text-[9px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors ml-1 flex items-center gap-1">
                                               <Search size={10} /> Ver filas
                                            </button>
                                          </td>
                                          {data.estados.map((e, ei) => { 
                                            const v = pd.estados[e] ? pd.estados[e].size : 0;
                                            const isTermCol = ei === termIdx;
                                            
                                            let finalPct = 0;
                                            if (viewMode === 'pct' && pT > 0) {
                                              const finished = pd.estados[data.estados[termIdx]] ? pd.estados[data.estados[termIdx]].size : 0;
                                              finalPct = (finished / pT) * 100;
                                            }

                                            const display = v > 0 ? (viewMode === 'pct' ? formatPct((v/pT)*100) : v) : (isTermCol && viewMode === 'pct' && pT > 0 ? formatPct(0) : '');
                                            
                                            // Final display for Terminado column
                                            const finalDisplay = (isTermCol && viewMode === 'pct' && pT > 0) ? formatPct(finalPct) : display;

                                            const isTerm = viewMode === 'pct' && ei === termIdx && pT > 0 && !isConf; 
                                            const grad = isTerm ? termGradient(Math.round(finalPct)) : null; 
                                            return (
                                              <td key={e} className="p-3 text-right" style={{ color: grad ? grad.txt : (isConf ? '#c2410c' : TC.text), background: grad ? grad.bg : 'transparent', fontWeight: grad ? 800 : 400 }}>
                                                {finalDisplay || <span className="opacity-10">·</span>}
                                              </td>
                                            ) 
                                          })}
                                          <td className="p-3 text-right font-bold opacity-30" style={{ color: TC.text }}>{viewMode === 'pct' ? formatPct(100) : pT}</td>
                                        </motion.tr>
                                      )
                                    })}
                                  </React.Fragment>
                                )
                              })}
                            </AnimatePresence>
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'grafico' && (
            <motion.div 
                key="grafico" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }} 
                className="absolute inset-0 overflow-y-auto p-6"
            >
              <div className="max-w-7xl mx-auto flex flex-col gap-6">
                {!data ? (
                  <div className="flex flex-col items-center justify-center py-32 gap-6 opacity-30">
                     <div className="text-8xl">📈</div>
                     <div className="text-lg font-bold">No hay datos procesados</div>
                     <Btn onClick={() => setActiveTab('carga')}>Volver a Carga</Btn>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-4 items-center sticky top-0 z-20 py-3 px-4 rounded-xl border shadow-lg" style={{ backdropFilter: 'blur(12px)', background: isDark ? 'rgba(30,41,59,0.7)' : 'rgba(246,248,250,0.8)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
                      <div className="flex-1 flex items-center gap-4">
                        <DropdownMenu
                          options={allRegions.map(r => ({
                            label: r,
                            onClick: () => setChartRegion(r),
                            Icon: <div className={`w-3 h-3 rounded-full ${chartRegion === r ? 'bg-purple-500' : 'bg-gray-500/20'}`} />
                          }))}
                        >
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-bold text-gray-900 dark:text-white">📍 Región: {chartRegion || 'Seleccionar...'}</span>
                          </div>
                        </DropdownMenu>

                        <div className="h-6 w-[1px] bg-gray-500/20 mx-2" />

                        <div className="flex items-center bg-black/5 dark:bg-white/5 p-1 rounded-lg gap-1">
                          <button 
                            onClick={() => setChartLayout('vertical')}
                            className={`px-3 py-1 rounded-md text-[9px] font-bold transition-all ${chartLayout === 'vertical' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                          >
                             Bars Verticales
                          </button>
                          <button 
                            onClick={() => setChartLayout('horizontal')}
                            className={`px-3 py-1 rounded-md text-[9px] font-bold transition-all ${chartLayout === 'horizontal' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                          >
                             Bars Horizontales
                          </button>
                        </div>
                      </div>
                      <DropdownMenu
                        options={[
                          { label: 'Descargar Imagen', onClick: () => exportToImage(chartRef, 'reporte_grafico', 'download'), Icon: <FileDown size={14} /> },
                          { label: 'Copiar Imagen', onClick: () => exportToImage(chartRef, 'reporte_grafico', 'copy'), Icon: <Copy size={14} /> }
                        ]}
                      >
                        <FileDown size={14} className="mr-2" /> Exportar Gráfico
                      </DropdownMenu>
                    </div>

                    <Card style={{ padding: '24px', position: 'relative' }}>
                      <div ref={chartRef} id="chart-export-container" style={{ background: TC.bgCard, padding: '24px', borderRadius: '16px' }}>
                        <div className="text-center mb-6">
                          <h2 className="text-xl font-black tracking-tight" style={{ color: TC.text }}>Estado de Vehículos: {chartRegion}</h2>
                        </div>
                        <div style={{ width: '100%', height: chartLayout === 'horizontal' ? Math.max(600, chartData.length * 40) : 600 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                              data={chartData} 
                              layout={chartLayout === 'horizontal' ? 'vertical' : 'horizontal'}
                              margin={{ top: 20, right: 60, left: chartLayout === 'horizontal' ? 100 : 20, bottom: chartLayout === 'horizontal' ? 20 : 60 }} 
                              barCategoryGap="20%" 
                              onClick={(e: any) => e && e.activePayload && handleBarClick(e.activePayload[0].payload)}
                            >
                              <CartesianGrid strokeDasharray="3 3" opacity={0.1} horizontal={chartLayout === 'vertical'} vertical={chartLayout === 'horizontal'} />
                              {chartLayout === 'vertical' ? (
                                <>
                                  <XAxis dataKey="patente" angle={-45} textAnchor="end" height={80} interval={0} tick={{ fontSize: 10, fill: TC.textSub }} />
                                  <YAxis 
                                    tick={{ fontSize: 11, fill: TC.textSub }} 
                                    domain={[0, (dataMax: number) => Math.round((dataMax + 10) / 10) * 10]}
                                  />
                                </>
                              ) : (
                                <>
                                  <XAxis type="number" tick={{ fontSize: 11, fill: TC.textSub }} domain={[0, (dataMax: number) => Math.round((dataMax + 10) / 10) * 10]} />
                                  <YAxis dataKey="patente" type="category" width={90} tick={{ fontSize: 10, fill: TC.textSub }} />
                                </>
                              )}
                              <RechartsTooltip 
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                                contentStyle={{ backgroundColor: TC.bgCard, borderColor: TC.border, borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} 
                                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                formatter={(value: any, name: any) => {
                                  if (name === 'patente') return [value, 'Patente']
                                  if (name === 'pctCompletado') return [formatPct(Number(value)), 'Completado']
                                  return [value, name]
                                }}
                              />
                              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                              <Bar dataKey="Terminado" stackId="a" fill="#22c55e" radius={[0,0,0,0]} barSize={60} />
                              <Bar dataKey="Planificado" stackId="a" fill="#f97316" radius={[0,0,0,0]} barSize={60} />
                              <Bar dataKey="Pendiente" stackId="a" fill="#eab308" radius={[0,0,0,0]} barSize={60} />
                              <Bar dataKey="En Ruta" stackId="a" fill="#ef4444" radius={[4,4,0,0]} barSize={60} />
                              {/* 0-height bar at the top of stack to hold labels */}
                              <Bar dataKey="dummy" stackId="a" fill="transparent" isAnimationActive={false} barSize={60}>
                                <LabelList 
                                  dataKey="pctCompletado" 
                                  position={chartLayout === 'horizontal' ? 'right' : 'top'} 
                                  offset={5}
                                  formatter={(v: any) => formatPct(Number(v))} 
                                  style={{ fill: TC.text, fontSize: 11, fontWeight: 900, textAnchor: 'middle' }} 
                                />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </Card>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'resumen' && (
            <motion.div 
                key="resumen" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }} 
                className="absolute inset-0 overflow-y-auto p-6"
            >
              <div className="max-w-4xl mx-auto flex flex-col gap-6">
                {!data ? (
                  <div className="flex flex-col items-center justify-center py-32 gap-6 opacity-30">
                     <div className="text-8xl">📝</div>
                     <div className="text-lg font-bold">No hay datos procesados</div>
                     <Btn onClick={() => setActiveTab('carga')}>Volver a Carga</Btn>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-4 items-center sticky top-0 z-20 py-3 px-4 rounded-xl border shadow-lg" style={{ backdropFilter: 'blur(12px)', background: isDark ? 'rgba(30,41,59,0.7)' : 'rgba(246,248,250,0.8)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
                      <div className="flex-1">
                        <DropdownMenu
                          options={[
                            { label: 'Todas las Regiones', onClick: () => setSummaryRegion('ALL'), Icon: <Badge variant="blue" style={{ fontSize: 9 }}>ALL</Badge> },
                            ...allRegions.map(r => ({
                              label: r,
                              onClick: () => setSummaryRegion(r),
                              Icon: <div className={`w-3 h-3 rounded-full ${summaryRegion === r ? 'bg-yellow-500' : 'bg-gray-500/20'}`} />
                            }))
                          ]}
                        >
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-bold text-gray-900 dark:text-white">📍 Región: {summaryRegion === 'ALL' ? 'Todas' : summaryRegion}</span>
                          </div>
                        </DropdownMenu>
                      </div>
                      <DropdownMenu
                        options={[
                          { label: 'Descargar Imagen', onClick: () => exportToImage(summaryRef, 'resumen_ejecutivo', 'download'), Icon: <FileDown size={14} /> },
                          { label: 'Copiar Imagen', onClick: () => exportToImage(summaryRef, 'resumen_ejecutivo', 'copy'), Icon: <Copy size={14} /> },
                          { label: 'Exportar Datos (Excel)', onClick: exportSummaryCSV, Icon: <FileSpreadsheet size={14} /> }
                        ]}
                      >
                        <FileDown size={14} className="mr-2" /> Exportar Resumen
                      </DropdownMenu>
                    </div>

                    <Card style={{ padding: 0, background: TC.bgCard, border: `1px solid ${TC.borderSoft}`, boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
                      <div ref={summaryRef} id="summary-export-container" style={{ padding: '32px', background: TC.bgCard, borderRadius: '16px' }}>
                        <div className="text-center mb-8 pb-6 border-b" style={{ borderColor: TC.borderSoft }}>
                          <h2 className="text-2xl font-black tracking-tighter" style={{ color: TC.text }}>
                            Avance en Ruta
                          </h2>
                          <div className="flex justify-center mt-2">
                            <Badge variant="purple" style={{ fontSize: 10, padding: '4px 12px' }}>
                              {summaryRegion === 'ALL' ? 'Métricas Globales (Multiregión)' : `Métricas de la Región: ${summaryRegion}`}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                          <div className="grid grid-cols-2 gap-4">
                            {(() => {
                              let totalOrders = 0, totalPatentes = new Set(), terminados = 0
                              const regionsToProcess = summaryRegion === 'ALL' ? allRegions : [summaryRegion]
                              
                              regionsToProcess.forEach(r => {
                                 const rd = data.regions[r]; if(!rd) return
                                 totalOrders += rd.orders.size
                                 Object.keys(rd.patentes).forEach(p => totalPatentes.add(p))
                                 
                                 Object.keys(rd.estados).forEach(e => {
                                   if (e.toLowerCase().includes('terminado')) {
                                     terminados += rd.estados[e].size
                                   }
                                 })
                              })

                              const pctTerminado = totalOrders > 0 ? Math.round((terminados / totalOrders) * 100) : 0

                              return (
                                <>
                                  <div className="p-4 rounded-xl flex flex-col items-center justify-center border backdrop-blur-md" style={{ borderColor: TC.borderSoft, background: 'rgba(56,189,248,0.05)' }}>
                                    <div className="text-3xl font-black" style={{ color: '#0ea5e9' }}>{totalOrders}</div>
                                    <div className="text-[10px] uppercase tracking-widest opacity-50 mt-1 font-bold">Total Órdenes</div>
                                  </div>
                                  <div className="p-4 rounded-xl flex flex-col items-center justify-center border backdrop-blur-md" style={{ borderColor: TC.borderSoft, background: 'rgba(168,85,247,0.05)' }}>
                                    <div className="text-3xl font-black" style={{ color: '#a855f7' }}>{totalPatentes.size}</div>
                                    <div className="text-[10px] uppercase tracking-widest opacity-50 mt-1 font-bold">Vehículos Activos</div>
                                  </div>
                                  <div className="p-4 rounded-xl flex flex-col items-center justify-center border backdrop-blur-md" style={{ borderColor: TC.borderSoft, background: 'rgba(234,179,8,0.05)' }}>
                                    <div className="text-3xl font-black" style={{ color: '#eab308' }}>{totalPatentes.size ? (totalOrders / totalPatentes.size).toFixed(1) : 0}</div>
                                    <div className="text-[10px] uppercase tracking-widest opacity-50 mt-1 font-bold">Promedio / Vehículo</div>
                                  </div>
                                  <div className="p-4 rounded-xl flex flex-col items-center justify-center border backdrop-blur-md" style={{ borderColor: TC.borderSoft, background: 'rgba(34,197,94,0.05)' }}>
                                    <div className="text-3xl font-black" style={{ color: '#22c55e' }}>{pctTerminado}%</div>
                                    <div className="text-[10px] uppercase tracking-widest opacity-50 mt-1 font-bold">Órdenes Terminadas</div>
                                    <div className="w-full h-1.5 bg-black/5 dark:bg-white/5 rounded-full mt-2 overflow-hidden">
                                       <div className="h-full bg-green-500 rounded-full transition-all duration-1000" style={{ width: `${pctTerminado}%` }} />
                                    </div>
                                  </div>
                                </>
                              )
                            })()}
                          </div>

                          {/* Distribución por Gestión */}
                          <div className="p-6 rounded-xl border flex flex-col gap-4" style={{ borderColor: TC.borderSoft, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                            <div className="text-xs font-black uppercase tracking-widest opacity-50 mb-2">Distribución por Gestión</div>
                            <div className="space-y-3">
                              {(() => {
                                const gMap: Record<string, number> = {}
                                const regionsToProcess = summaryRegion === 'ALL' ? allRegions : [summaryRegion]
                                regionsToProcess.forEach(r => {
                                  const rd = data.regions[r]; if(!rd) return
                                  Object.entries(rd.gestiones).forEach(([g, v]) => {
                                    gMap[g] = (gMap[g] || 0) + v
                                  })
                                })
                                const total = Object.values(gMap).reduce((a, b) => a + b, 0)
                                return Object.entries(gMap).sort((a, b) => b[1] - a[1]).map(([g, v]) => {
                                  const p = total > 0 ? Math.round((v / total) * 100) : 0
                                  let color = '#3b82f6'; // Default blue
                                  if (g.includes('RECOMIENZO') || g.includes('REPITE')) color = '#f97316'; // Orange
                                  if (g.includes('RETIRO')) color = '#8b5cf6'; // Purple
                                  if (g.includes('EYR')) color = '#ec4899'; // Pink

                                  return (
                                    <div key={g} className="flex flex-col gap-1">
                                      <div className="flex justify-between text-[10px] font-bold">
                                        <span style={{ color: TC.text }}>{g}</span>
                                        <span style={{ color: TC.textMuted }}>{v} ({p}%)</span>
                                      </div>
                                      <div className="w-full h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${p}%`, background: color }} />
                                      </div>
                                    </div>
                                  )
                                })
                              })()}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border overflow-hidden backdrop-blur-md" style={{ borderColor: TC.borderSoft, background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)' }}>
                          <table className="w-full text-xs font-mono" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: TC.headerBg }}>
                                <th className="p-3 text-left border-b font-black" style={{ borderColor: TC.borderSoft, color: isDark ? '#ffffff' : '#000000' }}>Región</th>
                                <th className="p-3 text-right border-b font-black" style={{ borderColor: TC.borderSoft, color: isDark ? '#ffffff' : '#000000' }}>Órdenes</th>
                                <th className="p-3 text-right border-b font-black" style={{ borderColor: TC.borderSoft, color: isDark ? '#ffffff' : '#000000' }}>Vehículos</th>
                                <th className="p-3 text-right border-b font-black" style={{ borderColor: TC.borderSoft, color: isDark ? '#ffffff' : '#000000' }}>% Avance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(summaryRegion === 'ALL' ? allRegions : [summaryRegion]).map(r => {
                                const rd = data.regions[r]; if(!rd) return null
                                const totOrder = rd.orders.size; const totVeh = Object.keys(rd.patentes).length
                                
                                let rTerminados = 0
                                Object.keys(rd.estados).forEach(e => {
                                  if (e.toLowerCase().includes('terminado')) {
                                    rTerminados += rd.estados[e].size
                                  }
                                })
                                const rPct = totOrder > 0 ? Math.round((rTerminados / totOrder) * 100) : 0

                                return (
                                  <tr key={r} className="border-b last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ borderColor: TC.borderSoft }}>
                                    <td className="p-3 font-bold" style={{ color: TC.text }}>{r}</td>
                                    <td className="p-3 text-right font-bold opacity-70" style={{ color: TC.text }}>{totOrder}</td>
                                    <td className="p-3 text-right font-bold opacity-70" style={{ color: TC.text }}>{totVeh}</td>
                                    <td className="p-3 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <span className="font-black text-sm w-12 text-right" style={{ color: rPct >= 90 ? '#22c55e' : rPct >= 50 ? '#eab308' : '#ef4444' }}>{rPct}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </Card>
                  </>
                )}
              </div>
            </motion.div>
          )}
          {activeTab === 'isos' && (
            <motion.div 
                key="isos" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }} 
                className="absolute inset-0 overflow-y-auto p-6"
            >
              <div className="max-w-7xl mx-auto flex flex-col gap-6">
                {!data ? (
                  <div className="flex flex-col items-center justify-center py-32 gap-6 opacity-30">
                     <div className="text-8xl">🚚</div>
                     <div className="text-lg font-bold">No hay datos procesados</div>
                     <Btn onClick={() => setActiveTab('carga')}>Volver a Carga</Btn>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center bg-black/5 dark:bg-white/5 p-4 rounded-xl border" style={{ borderColor: TC.borderSoft }}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 text-orange-500 rounded-lg">
                          <Truck size={20} />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold" style={{ color: TC.text }}>ISOs por Camión (Región Metropolitana)</h2>
                          <p className="text-[10px] opacity-50 font-mono uppercase tracking-widest">Cálculo exclusivo Región Metropolitana</p>
                        </div>
                      </div>
                      <Btn onClick={() => {
                        const rmData = Object.entries(data.regions).find(([r]) => r.toLowerCase().includes('metropolitana'))?.[1]
                        if (!rmData) { flash('❌ No se encontraron datos de RM'); return }
                        
                        const vehicles = Object.keys(rmData.patentes)
                        const isosReal = rmData.orders.size
                        const miniVehicles = vehicles.filter(v => rmData.patentes[v].orders.size > 45)
                        const camionVehicles = vehicles.filter(v => rmData.patentes[v].orders.size <= 45)
                        const isosMini = miniVehicles.reduce((acc, v) => acc + rmData.patentes[v].orders.size, 0)
                        const isosCamion = camionVehicles.reduce((acc, v) => acc + rmData.patentes[v].orders.size, 0)
                        
                        const row = [
                          new Date().toLocaleDateString(),
                          vehicles.length,
                          isosReal,
                          (isosReal / vehicles.length).toFixed(2).replace('.', ','),
                          '',
                          '',
                          miniVehicles.length,
                          isosMini,
                          miniVehicles.length ? (isosMini / miniVehicles.length).toFixed(2).replace('.', ',') : '0,00',
                          camionVehicles.length,
                          isosCamion,
                          camionVehicles.length ? (isosCamion / camionVehicles.length).toFixed(2).replace('.', ',') : '0,00'
                        ]
                        
                        navigator.clipboard.writeText(row.join('\t')).then(() => flash('✓ Datos copiados (Info solamente)'))
                      }} variant="primary" style={{ fontSize: 11, padding: '8px 20px' }}>
                        <Copy size={14} className="mr-2 inline-block" /> Copiar Info solamente
                      </Btn>
                    </div>

                    <Card style={{ padding: 0, overflow: 'hidden', border: `1px solid ${TC.borderSoft}` }}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] font-mono" style={{ borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: TC.headerBg }}>
                              {[
                                'Fecha', 'Vehiculos', 'ISOs real', 'IxC real', 'ISOs teo.', 'IxC teo.',
                                'Mini', 'ISOs mini', 'IxMini', 'Camion', 'ISOs camion', 'IxCam'
                              ].map(h => (
                                <th key={h} className="p-4 text-center font-bold uppercase tracking-tighter border-b" style={{ borderColor: TC.borderSoft, color: TC.textDisabled }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const rmEntry = Object.entries(data.regions).find(([r]) => r.toLowerCase().includes('metropolitana'))
                              if (!rmEntry) return (
                                <tr>
                                  <td colSpan={12} className="p-10 text-center opacity-40 font-bold">No se encontró la Región Metropolitana en los datos cargados</td>
                                </tr>
                              )
                              const rmData = rmEntry[1]
                              const vehicles = Object.keys(rmData.patentes)
                              const isosReal = rmData.orders.size
                              const miniVehicles = vehicles.filter(v => rmData.patentes[v].orders.size > 45)
                              const camionVehicles = vehicles.filter(v => rmData.patentes[v].orders.size <= 45)
                              const isosMini = miniVehicles.reduce((acc, v) => acc + rmData.patentes[v].orders.size, 0)
                              const isosCamion = camionVehicles.reduce((acc, v) => acc + rmData.patentes[v].orders.size, 0)

                              return (
                                <tr className="text-center font-bold" style={{ color: TC.text }}>
                                  <td className="p-4 border-b" style={{ borderColor: TC.borderSoft }}>{new Date().toLocaleDateString()}</td>
                                  <td className="p-4 border-b" style={{ borderColor: TC.borderSoft }}>{vehicles.length}</td>
                                  <td className="p-4 border-b font-black" style={{ borderColor: TC.borderSoft, color: '#0ea5e9' }}>{isosReal}</td>
                                  <td className="p-4 border-b" style={{ borderColor: TC.borderSoft }}>{(isosReal / vehicles.length).toFixed(2).replace('.', ',')}</td>
                                  <td className="p-4 border-b bg-black/5 dark:bg-white/5" style={{ borderColor: TC.borderSoft }}>-</td>
                                  <td className="p-4 border-b bg-black/5 dark:bg-white/5" style={{ borderColor: TC.borderSoft }}>-</td>
                                  <td className="p-4 border-b" style={{ borderColor: TC.borderSoft, color: '#a855f7' }}>{miniVehicles.length}</td>
                                  <td className="p-4 border-b" style={{ borderColor: TC.borderSoft }}>{isosMini}</td>
                                  <td className="p-4 border-b" style={{ borderColor: TC.borderSoft }}>{miniVehicles.length ? (isosMini / miniVehicles.length).toFixed(2).replace('.', ',') : '0,00'}</td>
                                  <td className="p-4 border-b" style={{ borderColor: TC.borderSoft, color: '#f97316' }}>{camionVehicles.length}</td>
                                  <td className="p-4 border-b" style={{ borderColor: TC.borderSoft }}>{isosCamion}</td>
                                  <td className="p-4 border-b" style={{ borderColor: TC.borderSoft }}>{camionVehicles.length ? (isosCamion / camionVehicles.length).toFixed(2).replace('.', ',') : '0,00'}</td>
                                </tr>
                              )
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card style={{ padding: '24px' }}>
                         <h3 className="text-sm font-bold mb-4 opacity-50 uppercase tracking-widest">Distribución de Flota RM</h3>
                         <div className="flex items-end gap-1 h-32">
                           {(() => {
                              const rmEntry = Object.entries(data.regions).find(([r]) => r.toLowerCase().includes('metropolitana'))
                              if (!rmEntry) return null
                              const rmData = rmEntry[1]
                              const vehicles = Object.keys(rmData.patentes)
                              const mini = vehicles.filter(v => rmData.patentes[v].orders.size > 45).length
                              const cam = vehicles.length - mini
                              const max = Math.max(mini, cam)
                              return (
                                <>
                                  <div className="flex-1 flex flex-col items-center gap-2">
                                    <div className="w-full bg-purple-500/20 border-t-4 border-purple-500 rounded-t-lg transition-all duration-1000" style={{ height: `${(mini/max)*100}%` }}></div>
                                    <span className="text-[10px] font-bold">Mini ({mini})</span>
                                  </div>
                                  <div className="flex-1 flex flex-col items-center gap-2">
                                    <div className="w-full bg-orange-500/20 border-t-4 border-orange-500 rounded-t-lg transition-all duration-1000" style={{ height: `${(cam/max)*100}%` }}></div>
                                    <span className="text-[10px] font-bold">Camión ({cam})</span>
                                  </div>
                                </>
                              )
                           })()}
                         </div>
                      </Card>
                      <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                         <div className="space-y-4">
                           <div className="flex justify-between items-center text-xs">
                             <span className="opacity-60">Criterio Mini:</span>
                             <span className="font-bold underline text-purple-500">&gt; 45 ISOs</span>
                           </div>
                           <div className="flex justify-between items-center text-xs">
                             <span className="opacity-60">Criterio Camión:</span>
                             <span className="font-bold underline text-orange-500">≤ 45 ISOs</span>
                           </div>
                           <div className="pt-4 border-t border-dashed opacity-30"></div>
                           <p className="text-[10px] leading-relaxed opacity-40 italic text-center">
                             "La eficiencia se mide en la capacidad de carga optimizada por tipología de vehículo."
                           </p>
                         </div>
                      </Card>
                    </div>
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

      <AnimatePresence>
        {isSearchModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSearchModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 md:inset-10 lg:inset-x-20 z-[101] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: TC.bgCard, border: `1px solid ${TC.border}` }}
            >
              <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: TC.borderSoft, background: TC.headerBg }}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                    <Search size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-tight" style={{ color: TC.text }}>
                      Resultados para "{searchQuery}"
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Btn onClick={copySearchData} disabled={displayedModalData.length === 0} variant="primary" style={{ fontSize: 11, padding: '6px 14px' }}>
                    <Copy size={14} className="mr-1 inline-block" /> Copiar Tabla
                  </Btn>
                  <button 
                    onClick={() => setIsSearchModalOpen(false)}
                    className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-red-500"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-white dark:bg-black/20 p-4 relative">
                {isSearching && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-[2px]">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 font-bold text-xs animate-pulse" style={{ color: TC.text }}>Buscando con precisión...</p>
                  </div>
                )}
                
                {displayedModalData.length === 0 && !isSearching ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                    <Maximize2 size={48} className="mb-4 opacity-50" />
                    <p className="text-sm font-bold">No se encontraron datos</p>
                  </div>
                ) : (
                  <div className="inline-block min-w-full">
                    <table className="w-full text-[11px] font-mono whitespace-nowrap" style={{ borderCollapse: 'collapse' }}>
                      <thead className="select-none">
                        <tr>
                          {Object.keys(displayedModalData[0]).map(key => (
                            <th key={key} className="px-3 py-2 text-left font-bold border sticky top-0 bg-gray-100 dark:bg-gray-800 z-10" style={{ borderColor: TC.borderSoft, color: TC.textSub }}>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="select-none">
                        {(() => {
                          let rMin = -1, rMax = -1, cMin = -1, cMax = -1
                          if (selection.start && selection.end) {
                            rMin = Math.min(selection.start.r, selection.end.r)
                            rMax = Math.max(selection.start.r, selection.end.r)
                            cMin = Math.min(selection.start.c, selection.end.c)
                            cMax = Math.max(selection.start.c, selection.end.c)
                          }
                          const isMultipleSelected = rMin !== rMax || cMin !== cMax

                          return displayedModalData.map((row: any, idx: number) => (
                            <tr key={idx} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10">
                              {Object.keys(row).map((key, cidx) => {
                                const isSelected = idx >= rMin && idx <= rMax && cidx >= cMin && cidx <= cMax
                                return (
                                  <td 
                                    key={key} 
                                    className="px-3 py-1.5 border relative cursor-cell" 
                                    style={{ borderColor: TC.borderSoft, color: TC.text }}
                                    onMouseDown={() => handleMouseDown(idx, cidx)}
                                    onMouseEnter={() => handleMouseEnter(idx, cidx)}
                                    onClick={() => {
                                       if (!isDragging && !isMultipleSelected) {
                                           setSelection({ start: {r: idx, c: cidx}, end: {r: idx, c: cidx} })
                                       }
                                    }}
                                  >
                                    {isSelected && (
                                      <div className="absolute inset-0 pointer-events-none bg-blue-500/20 mix-blend-multiply dark:mix-blend-screen ring-1 ring-inset ring-blue-500/50" />
                                    )}
                                    <span className="relative z-10">{String(row[key] || '')}</span>
                                  </td>
                                )
                              })}
                            </tr>
                          ))
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <TableModal 
        isOpen={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        title={`Conflictos — Patente: ${activePatente}`}
        subtitle={`${data?.conflictedByPatente[activePatente]?.length || 0} ParentOrder(s) con múltiples estados simultáneos`}
        data={conflictModalData}
        columns={conflictModalCols}
        isConflictModal={true}
        onDeleteRow={handleDeleteConflictRow}
        onExportCSV={() => exportModalDataCSV(conflictModalData, conflictModalCols, `Conflictos_${activePatente}`)}
        TC={TC}
      />

      <TableModal 
        isOpen={patenteModalOpen}
        onClose={() => setPatenteModalOpen(false)}
        title={`Detalle Patente`}
        subtitle={`Viendo detalle de filas para ${activePatente}`}
        data={patenteModalData}
        columns={patenteModalCols}
        onExportCSV={() => exportModalDataCSV(patenteModalData, patenteModalCols, `Detalle_${activePatente}`)}
        TC={TC}
      />

    </PageShell>
  )
}
