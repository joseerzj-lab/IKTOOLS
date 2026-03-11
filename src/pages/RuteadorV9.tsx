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
        const parsed = saved ? JSON.parse(saved) : ['ISO', 'GESTIÓN', 'ORIGEN', 'DESTINO', 'CORREO REPITES']
        return parsed.filter((c: string) => c !== 'Commerce')
    } catch { return ['ISO', 'GESTIÓN', 'ORIGEN', 'DESTINO', 'CORREO REPITES'] }
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
        const parsed = saved ? new Set<string>(JSON.parse(saved)) : new Set<string>(['ISO', 'GESTIÓN', 'ORIGEN', 'DESTINO', 'CORREO REPITES'])
        parsed.delete('Commerce')
        return parsed
    } catch { return new Set<string>(['ISO', 'GESTIÓN', 'ORIGEN', 'DESTINO', 'CORREO REPITES']) }
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
    const defaultCols = ['ISO', 'GESTIÓN', 'ORIGEN', 'DESTINO', 'CORREO REPITES']
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

  const handleConversionUpload = async (file: File) => {
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames.find(n => n.trim().toLowerCase() === 'plan') || workbook.SheetNames[0]
        const xlRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }) as any[]
        
        if (!xlRows.length) return flash('⚠️ Archivo de conversión vacío')
        
        const headers = Object.keys(xlRows[0] || {})
        const norm2 = (s: string) => s.trim().toLowerCase().replace(/[áàä]/g,'a').replace(/[éèë]/g,'e').replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u')
        const colIni = headers.find(h => norm2(h).includes('veh') && norm2(h).includes('inic'))
        const colFin = headers.find(h => norm2(h).includes('veh') && norm2(h).includes('fin'))
        
        if (!colIni || !colFin) return flash('⚠️ No se detectaron columnas Vehículo Inicial/Vehículo Final')
        
        let mapCount = 0
        const vehMap = new Map<string,string>()
        xlRows.forEach(r => { 
          const ini = String(r[colIni] || '').trim()
          if (ini) {
             vehMap.set(ini.toLowerCase(), String(r[colFin] || '').trim() || ini) 
             mapCount++
          }
        })
        
        let updated = 0
        setRows(prev => {
           const vehCol = columns.find(c => norm2(c).includes('veh'))
           if (!vehCol) {
             flash('⚠️ La tabla no tiene una columna de vehículo a convertir')
             return prev
           }
           return prev.map(r => {
              const v = String(r[vehCol] || '').trim()
              if (v && vehMap.has(v.toLowerCase())) {
                  const newVal = vehMap.get(v.toLowerCase())!
                  if (newVal !== v) {
                      updated++
                      return { ...r, [vehCol]: newVal }
                  }
              }
              return r
           })
        })
        if (updated > 0) {
            flash(`✓ ${updated} vehículos convertidos (${mapCount} reglas)`)
            setTab('dashboard')
        } else {
            flash(`ℹ️ Ningún vehículo coincidió para conversión (${mapCount} reglas)`)
        }
      }
      reader.readAsArrayBuffer(file)
    } catch (err) { flash('⚠️ Error al leer conversión') }
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

  const handleOriginCross = async (file: File) => {
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const xlRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }) as any[]
        
        if (!xlRows.length) return flash('⚠️ Archivo Origin Cross vacío')

        const headers = Object.keys(xlRows[0] || {})
        const cIso = headers.find(h => h.toUpperCase().includes("ISO"))
        const cOri = headers.find(h => h.toUpperCase().includes("RTE") || h.toUpperCase().includes("ORIGEN"))
        
        if (!cIso || !cOri) return flash('⚠️ Faltan columnas ISO o Origen en el archivo Origin Cross')

        const map = new Map<string, string>()
        xlRows.forEach(r => {
          const iso = String(r[cIso] || '').trim().toUpperCase()
          if (iso) map.set(iso, String(r[cOri] || '').trim().toUpperCase())
        })

        let upd = 0
        setRows(prev => prev.map(r => {
          if (r.ORIGEN === 'PENDIENTE' && r.ISO && map.has(r.ISO)) {
            upd++
            return { ...r, ORIGEN: map.get(r.ISO)! }
          }
          return r
        }))

        flash(`✓ ${upd} orígenes cruzados.`)
        if (upd > 0) setTab('dashboard')
      }
      reader.readAsArrayBuffer(file)
    } catch (err) { flash('⚠️ Error al leer archivo de cruce') }
  }

  const handleDestinoCross = async (planFile: File, convFile: File) => {
    try {
      const readExcel = (file: File) => new Promise<any[]>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = e => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer)
            const wb = XLSX.read(data, { type: 'array' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            resolve(XLSX.utils.sheet_to_json(ws, { defval: '' }))
          } catch (err) { reject(err) }
        }
        reader.onerror = reject
        reader.readAsArrayBuffer(file)
      })

      const [rC, rV] = await Promise.all([readExcel(planFile), readExcel(convFile)])
      if (!rC.length || !rV.length) return flash('⚠️ Uno de los archivos está vacío.')

      const kC = Object.keys(rC[0])
      const cTit = kC.find(k => k.toUpperCase() === "TITULO" || k.toUpperCase() === "TÍTULO") || kC.find(k => k.toUpperCase().includes("TITULO") || k.toUpperCase().includes("TÍTULO") || k.toUpperCase().includes("ISO"))
      const cVeh = kC.find(k => k.toUpperCase() === "VEHICULO" || k.toUpperCase() === "VEHÍCULO" || k.toUpperCase() === "VEH") || kC.find(k => k.toUpperCase().includes("VEHICULO") || k.toUpperCase().includes("VEHÍCULO"))

      const kV = Object.keys(rV[0])
      const cIni = kV.find(k => k.toUpperCase().includes("INICIAL") || k.toUpperCase().includes("INI"))
      const cFin = kV.find(k => k.toUpperCase().includes("FINAL") || k.toUpperCase().includes("FIN"))

      if (!cTit || !cVeh) return flash(`⚠️ Plan: no se detectó Título/Vehículo. Cols: ${kC.join(', ')}`)
      if (!cIni || !cFin) return flash(`⚠️ Conversión: no se detectó VEH INICIAL/FINAL. Cols: ${kV.join(', ')}`)

      const mapConv = new Map<string, string>()
      rV.forEach(r => {
        const i = String(r[cIni] || '').trim().toUpperCase()
        if (i) mapConv.set(i, String(r[cFin] || '').trim().toUpperCase() || i)
      })

      const mapFinal = new Map<string, string>()
      rC.forEach(r => {
        const t = String(r[cTit] || '').trim().toUpperCase()
        const v = String(r[cVeh] || '').trim().toUpperCase()
        if (t && v) mapFinal.set(t, mapConv.get(v) || v)
      })

      let upd = 0
      let nf = 0
      setRows(prev => {
        const newRows = [...prev]
        newRows.forEach(m => {
          const k = String(m.ISO || '').trim().toUpperCase()
          if (mapFinal.has(k)) {
            m.DESTINO = mapFinal.get(k)!
            upd++
          } else {
            nf++
          }
        })
        return newRows
      })

      flash(`✓ ${upd} vehículos asignados. ${nf ? `(${nf} sin coincidencia)` : ''}`)
      if (upd > 0) setTab('dashboard')
    } catch (err) {
      flash('⚠️ Error procesando el cruce de destino.')
    }
  }

  const handleRuteoUpload = async (file: File) => {
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const xlRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }) as any[]
        
        if (!xlRows.length) return flash('⚠️ Archivo de Ruteo vacío')
        if (!rows.length) return flash('⚠️ Dashboard vacío. Carga datos primero.')
        
        const isoGestMap = new Map<string, string>()
        rows.forEach(r => {
          if (r.ISO) isoGestMap.set(r.ISO.trim().toUpperCase(), r['GESTIÓN'] || '')
        })
        
        const man = new Date()
        man.setDate(man.getDate() + 1)
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
        const fechaStr = `${String(man.getDate()).padStart(2, '0')}-${months[man.getMonth()]}-${String(man.getFullYear()).slice(2)}`
        
        const keys = Object.keys(xlRows[0] || {})
        const colIdRef = keys.find(k => k.replace(/[\s_]/g, '').toUpperCase().includes('IDREFERENCIA') || k.toUpperCase().includes('ID_REFERENCIA'))
        const colFecha = keys.find(k => k.replace(/[\s_]/g, '').toUpperCase().includes('FECHAPROGRAMADA') || k.toUpperCase().includes('FECHA_PROGRAMADA'))
        const colIso = keys.find(k => k === "ISO" || k.includes("ISO"))
        
        let matched = 0
        const notFound: string[] = []
        
        const output = xlRows.map(r => {
          const rowCopy = { ...r }
          const iso = String(colIso ? r[colIso] : Object.values(r)[0] || '').trim().toUpperCase()
          const gest = isoGestMap.get(iso)
          
          if (gest !== undefined) {
             if (colIdRef) rowCopy[colIdRef] = gest
             else rowCopy['ID_REFERENCIA'] = gest
             matched++
          } else {
             if (iso) notFound.push(iso)
          }
          
          if (colFecha) rowCopy[colFecha] = fechaStr
          else rowCopy['FECHA_PROGRAMADA'] = fechaStr
          
          return rowCopy
        })
        
        const ws = XLSX.utils.json_to_sheet(output)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "RUTEO")
        XLSX.writeFile(wb, "ISOS RUTEO.xlsx")
        
        flash(`✅ Exportado ISOS RUTEO.xlsx (Cruzadas: ${matched})`)
      }
      reader.readAsArrayBuffer(file)
    } catch (err) {
      flash('⚠️ Error al procesar archivo de Ruteo')
    }
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
                onConversionUpload={handleConversionUpload}
                onOriginCross={handleOriginCross}
                onDestinoCross={handleDestinoCross}
                onRuteoUpload={handleRuteoUpload}
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
                onUpdateRows={setRows}
                onNotify={flash}
              />
            </motion.div>
          )}

          {tab === 'export' && (
            <motion.div key="export" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="absolute inset-0">
              <TabExport rows={rows} stats={stats} onExportJSON={exportJSON} />
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
