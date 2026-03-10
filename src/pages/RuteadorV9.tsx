import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme, getThemeColors } from '../context/ThemeContext'
import { PageShell } from '../ui/DS'
import GlassHeader from '../components/ruteo-postventa/GlassHeader'
import TabLoad from '../components/ruteo-postventa/TabLoad'
import TabDashboard from '../components/ruteo-postventa/TabDashboard'
import TabExport from '../components/ruteo-postventa/TabExport'
import TabTemplates from '../components/ruteo-postventa/TabTemplates'
import TabDuplicates from '../components/ruteo-postventa/TabDuplicates'
import TabProjects from '../components/ruteo-postventa/TabProjects'
import type { Row, Stats, TabKey } from '../components/ruteo-postventa/types'
import * as XLSX from 'xlsx'

export default function RuteadorV9() {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)

  // ── State ──
  const [tab, setTab] = useState<TabKey>('load')
  const [columns, setColumns] = useState<string[]>(() => {
    try {
        const saved = localStorage.getItem('r9-cols')
        return saved ? JSON.parse(saved) : ['ISO', 'Commerce', 'GESTIÓN', 'ORIGEN', 'DESTINO', 'CORREO REPITES']
    } catch { return ['ISO', 'Commerce', 'GESTIÓN', 'ORIGEN', 'DESTINO', 'CORREO REPITES'] }
  })
  const [rows, setRows] = useState<Row[]>(() => {
    try {
        const saved = localStorage.getItem('r9-rows')
        return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
        const saved = localStorage.getItem('r9-vis')
        return saved ? new Set(JSON.parse(saved)) : new Set(['ISO', 'Commerce', 'GESTIÓN', 'ORIGEN', 'DESTINO', 'CORREO REPITES'])
    } catch { return new Set(['ISO', 'Commerce', 'GESTIÓN', 'ORIGEN', 'DESTINO', 'CORREO REPITES']) }
  })
  const [toast, setToast] = useState('')
  
  // Lost functionality state
  const [pvPlanData, setPvPlanData] = useState<string[]>([])
  const [pvPlanName, setPvPlanName] = useState('')
  const [proyectosData, setProyectosData] = useState<any[]>([])
  const [projectsName, setProjectsName] = useState('')

  // ── Persistence ──
  useEffect(() => { localStorage.setItem('r9-cols', JSON.stringify(columns)) }, [columns])
  useEffect(() => { localStorage.setItem('r9-rows', JSON.stringify(rows)) }, [rows])
  useEffect(() => { localStorage.setItem('r9-vis', JSON.stringify([...visibleCols])) }, [visibleCols])

  // ── Helpers ──
  const flash = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }, [])

  const onMergeRows = (newCols: string[], newRows: Row[], source: string) => {
    const mergedCols = [...new Set([...columns, ...newCols])]
    setColumns(mergedCols)
    setRows(prev => [...prev, ...newRows])
    
    // Ensure new columns are visible
    setVisibleCols(prev => {
      const next = new Set(prev)
      newCols.forEach(c => next.add(c))
      return next
    })

    flash(`✓ ${newRows.length} filas agregadas desde ${source}`)
    setTab('dashboard')
  }

  const onLoadJSON = (cols: string[], rows: Row[]) => {
    setColumns(cols)
    setRows(rows)
    setVisibleCols(new Set(cols))
    flash('✓ Sesión cargada correctamente')
    setTab('dashboard')
  }

  const updateCell = (ri: number, col: string, val: string) => {
    setRows(prev => {
      const next = [...prev]
      next[ri] = { ...next[ri], [col]: val }
      return next
    })
  }

  const addRow = () => {
    const newRow: Row = {}
    columns.forEach(c => newRow[c] = '')
    setRows(prev => [...prev, newRow])
  }

  const deleteRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx))
  }

  const crearNueva = () => {
    const defaultCols = ['ISO', 'Commerce', 'GESTIÓN', 'ORIGEN', 'DESTINO', 'CORREO REPITES']
    setColumns(defaultCols)
    setVisibleCols(new Set(defaultCols))
    
    // Add one empty row so the table structure is visible
    const newRow: Row = {}
    defaultCols.forEach(c => newRow[c] = '')
    setRows([newRow])
    
    flash('✓ Nueva tabla creada')
    setTab('dashboard')
  }

  const exportJSON = () => {
    const data = JSON.stringify({ columns, rows, pvPlanData, proyectosData })
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Sesion_Ruteo_${new Date().getTime()}.json`
    a.click()
    flash('✓ Archivo JSON generado')
  }

  const handlePVPlanUpload = async (file: File) => {
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[]
        
        if (!rows.length) return flash('⚠️ Archivo vacío')
        
        const keys = Object.keys(rows[0])
        const cTit = keys.find(k => k === "TITULO" || k === "TÍTULO") || keys.find(k => k.includes("TITULO") || k.includes("TÍTULO") || k.includes("ISO"))
        const cVeh = keys.find(k => k === "VEHICULO" || k === "VEHÍCULO" || k === "VEH") || keys.find(k => k.includes("VEHICULO") || k.includes("VEHÍCULO"))
        
        if (!cTit) return flash('⚠️ No se detectó columna ISO/Título')
        
        const pvRows = rows.filter(r => {
          const veh = String(r[cVeh || ''] || "").trim().toUpperCase()
          return /^VEH01\s*POST\s*VENTA/.test(veh) || /^VEH01\s*POSTVENTA/.test(veh)
        })
        
        const isos = pvRows.map(r => String(r[cTit] || "").trim().toUpperCase()).filter(iso => iso && iso !== "INICIO" && iso !== "FIN")
        setPvPlanData(isos)
        setPvPlanName(file.name)
        flash(`✓ ${isos.length} ISOs de Postventa cargadas`)
        setTab('duplicates')
      }
      reader.readAsArrayBuffer(file)
    } catch (err) { flash('⚠️ Error al leer el plan') }
  }

  const handleProjectsUpload = async (file: File) => {
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[]
        
        if (!rows.length) return flash('⚠️ Archivo de proyectos vacío')
        
        const isDos = Object.keys(rows[0]).some(k => k === 'VEHÍCULO' || k === 'VEHICULO')
        const formatted = rows.map(r => ({
          ISO: String(r.ISO || r.TITULO || r.TÍTULO || '').trim().toUpperCase(),
          DIRECCIÓN: String(r.DIRECCIÓN || r.DIRECCION || '').trim(),
          VEHÍCULO: r.VEHÍCULO || r.VEHICULO || '',
          _tipo: isDos ? 'dos' : 'uno'
        }))
        
        setProyectosData(formatted)
        setProjectsName(file.name)
        flash(`✓ ${formatted.length} proyectos Leslie cargados`)
        setTab('projects')
      }
      reader.readAsArrayBuffer(file)
    } catch (err) { flash('⚠️ Error al leer proyectos') }
  }

  // ISO mapping for duplicates
  const dashboardIsos = rows.reduce((acc, r) => {
    if (r.ISO) {
      const k = r.ISO.trim().toUpperCase()
      if (!acc[k]) acc[k] = []
      acc[k].push(r)
    }
    return acc
  }, {} as Record<string, any[]>)

  const dupCount = pvPlanData.filter(iso => dashboardIsos[iso] && dashboardIsos[iso].length > 0).length

  // ── Stats ──
  const stats: Stats = {
    total: rows.length,
    gestion: rows.reduce((acc, r) => {
      const g = r['GESTIÓN'] || 'Sin Gestión'
      acc[g] = (acc[g] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  return (
    <PageShell>
      <GlassHeader 
        activeTab={tab}
        onTabChange={setTab}
        badges={{
          dashboard: rows.length || 0,
          duplicates: dupCount > 0 ? dupCount : undefined,
          projects: proyectosData.length > 0 ? proyectosData.length : undefined
        }}
        severities={{
            dashboard: rows.length > 0 ? 'none' : 'medium',
            duplicates: dupCount > 0 ? 'high' : 'none'
        }}
      />

      <div className="flex-1 overflow-hidden relative" style={{ background: TC.bg }}>
        <AnimatePresence mode="wait" initial={false}>
          {tab === 'load' && (
            <motion.div key="load" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} className="absolute inset-0">
              <TabLoad 
                columns={columns} 
                rows={rows} 
                onMergeRows={onMergeRows} 
                onLoadJSON={onLoadJSON} 
                onPVPlanUpload={handlePVPlanUpload}
                onProjectsUpload={handleProjectsUpload}
                pvPlanName={pvPlanName}
                projectsName={projectsName}
                TC={TC}
              />
            </motion.div>
          )}

          {tab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute inset-0">
              <TabDashboard 
                columns={columns} 
                rows={rows} 
                visibleCols={visibleCols} 
                setVisibleCols={setVisibleCols} 
                stats={stats} 
                onUpdateCell={updateCell} 
                onAddRow={addRow} 
                onDeleteRow={deleteRow} 
                onCrearNueva={crearNueva} 
              />
            </motion.div>
          )}

          {tab === 'export' && (
            <motion.div key="export" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="absolute inset-0">
              <TabExport rows={rows} onExportJSON={exportJSON} />
            </motion.div>
          )}

          {tab === 'templates' && (
            <motion.div key="templates" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute inset-0">
              <TabTemplates rows={rows} proyectosData={proyectosData} onNotify={flash} />
            </motion.div>
          )}

          {tab === 'duplicates' && (
            <motion.div key="duplicates" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="absolute inset-0">
              <TabDuplicates pvPlanData={pvPlanData} dashboardIsos={dashboardIsos} TC={TC} />
            </motion.div>
          )}

          {tab === 'projects' && (
            <motion.div key="projects" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="absolute inset-0">
              <TabProjects proyectosData={proyectosData} TC={TC} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-blue-500 text-white font-bold text-xs px-6 py-2.5 rounded-full shadow-2xl z-50 pointer-events-none"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  )
}
