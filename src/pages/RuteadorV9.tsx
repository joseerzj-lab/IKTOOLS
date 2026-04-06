import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
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
import { compress, decompress } from 'lz-string'

const AUTHORIZED_COLS = ['ISO', 'GESTIÓN', 'ORIGEN', 'DESTINO', 'VEH', 'CORREO REPITES', 'COMENTARIO_RAW']

const normalizeHeader = (h: string) => 
  h.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")

const mapNormalizedRows = (rows: any[]) => {
  if (!rows.length) return []
  return rows.map(row => {
    const r: any = {
      _ikid: Math.random().toString(36).substring(2, 11) + Date.now().toString(36)
    }
    for (const k in row) {
      const normK = normalizeHeader(k)
      if (AUTHORIZED_COLS.includes(normK)) {
        r[normK] = String(row[k] || "").trim().toUpperCase()
      }
    }
    return r
  })
}

const reorderCols = (cols: string[]) => {
  const fixed = ['ISO', 'GESTIÓN', 'ORIGEN', 'DESTINO']
  const rest = cols.filter(c => !fixed.includes(c))
  return [...fixed.filter(f => cols.includes(f)), ...rest]
}

export default function RuteadorV9() {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)

  // ── State ──
  const [tab, setTab] = useState<TabKey>('load')
  const [columns, setColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('r9-cols')
      const parsed = saved ? JSON.parse(saved) : AUTHORIZED_COLS
      return reorderCols(parsed.filter((c: string) => AUTHORIZED_COLS.includes(c)))
    } catch { return AUTHORIZED_COLS }
  })
  const [rows, setRows] = useState<Row[]>(() => {
    try {
        const saved = localStorage.getItem('r9-rows-v2')
        if (saved) {
           return JSON.parse(decompress(saved) || '[]')
        }
        // Fallback for old non-compressed data
        const old = localStorage.getItem('r9-rows')
        return old ? JSON.parse(old) : []
    } catch { return [] }
  })
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('r9-vis')
      return saved ? new Set(JSON.parse(saved)) : new Set(columns)
    } catch { return new Set(columns) }
  })
  const [toast, setToast] = useState('')

  // ── Undo history ──
  const MAX_HISTORY = 30
  const rowsHistoryRef = useRef<Row[][]>([])
  const setRowsWithHistory = useCallback((updater: Row[] | ((prev: Row[]) => Row[])) => {
    setRows(prev => {
      // Push current state to history before changing
      rowsHistoryRef.current = [...rowsHistoryRef.current.slice(-(MAX_HISTORY - 1)), prev]
      return typeof updater === 'function' ? updater(prev) : updater
    })
  }, [])

  const undo = useCallback(() => {
    if (rowsHistoryRef.current.length === 0) return false
    const prev = rowsHistoryRef.current.pop()!
    setRows(prev) // Direct setRows — don't push to history
    return true
  }, [])

  // ── Filter state (lifted from TabDashboard so it persists across tabs) ──
  const [search, setSearch] = useState('')
  const [colFilters, setColFilters] = useState<Record<string, Set<string>>>(() => {
    try {
      const saved = localStorage.getItem('r9-colFilters')
      if (saved) {
        const parsed = JSON.parse(saved)
        const result: Record<string, Set<string>> = {}
        for (const [k, v] of Object.entries(parsed)) {
          result[k] = new Set(v as string[])
        }
        return result
      }
      return {}
    } catch { return {} }
  })
  const [sortCol, setSortCol] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(() => {
    try {
      const saved = localStorage.getItem('r9-sortCol')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  const filteredRows = useMemo(() => {
    let result = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(r => columns.some(c => (r[c] || '').toLowerCase().includes(q)))
    }
    Object.entries(colFilters).forEach(([col, allowedValues]) => {
      if (allowedValues.size > 0) {
        result = result.filter(r => allowedValues.has(r[col] || ''))
      }
    })
    if (sortCol) {
      result = [...result].sort((a, b) => {
        const valA = (a[sortCol.col] || '').toLowerCase()
        const valB = (b[sortCol.col] || '').toLowerCase()
        if (valA < valB) return sortCol.dir === 'asc' ? -1 : 1
        if (valA > valB) return sortCol.dir === 'asc' ? 1 : -1
        return 0
      })
    }
    return result
  }, [rows, columns, search, colFilters, sortCol])

  // Lost functionality state
  const [pvPlanData, setPvPlanData] = useState<string[]>([])
  const [pvPlanName, setPvPlanName] = useState('')
  const [proyectosData, setProyectosData] = useState<any[]>([])
  const [projectsName, setProjectsName] = useState('')
  const [showShortcuts, setShowShortcuts] = useState(false)

  // ── Persistence (debounced for rows) ──
  useEffect(() => { localStorage.setItem('r9-cols', JSON.stringify(columns)) }, [columns])
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (rows.length > 0) {
        localStorage.setItem('r9-rows-v2', compress(JSON.stringify(rows)))
        localStorage.removeItem('r9-rows') // Clean up old uncompressed key
      } else {
        localStorage.removeItem('r9-rows-v2')
      }
    }, 500)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [rows])
  useEffect(() => { localStorage.setItem('r9-vis', JSON.stringify([...visibleCols])) }, [visibleCols])
  useEffect(() => {
    // Serialize colFilters (Set → Array for JSON)
    const serializable: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(colFilters)) {
      serializable[k] = [...v]
    }
    localStorage.setItem('r9-colFilters', JSON.stringify(serializable))
  }, [colFilters])
  useEffect(() => {
    localStorage.setItem('r9-sortCol', JSON.stringify(sortCol))
  }, [sortCol])

  // ── Helpers ──
  const flash = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }, [])

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '?' || e.key === '/')) {
        e.preventDefault()
        setShowShortcuts(p => !p)
      }
      // Alt+Z → Undo
      if (e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (undo()) {
          flash('↩ Deshacer')
        } else {
          flash('ℹ️ Sin más cambios para deshacer')
        }
      }
      if (e.key === 'Escape') setShowShortcuts(false)
    }
    window.addEventListener('keydown', handleDown)
    return () => window.removeEventListener('keydown', handleDown)
  }, [undo, flash])

  const onMergeRows = (newCols: string[], newRows: Row[], source: string) => {
    const cleanNewCols = newCols.filter(c => AUTHORIZED_COLS.includes(c))
    const mergedCols = [...new Set([...columns, ...cleanNewCols])]
    
    // Final sanitization of incoming row objects to remove any "hidden" keys
    const sanitizedRows = newRows.map(row => {
      const clean: any = { _ikid: row._ikid || (Math.random().toString(36).substring(2, 11) + Date.now().toString(36)), _SOURCE: row._SOURCE || source }
      AUTHORIZED_COLS.forEach(c => { clean[c] = (row[c] || '').toString().trim().toUpperCase() })
      // Special logic for DESTINO as per user request: always empty on load
      clean.DESTINO = ''
      return clean as Row
    })

    setColumns(reorderCols(mergedCols))
    setRowsWithHistory(prev => [...prev, ...sanitizedRows])
    
    // Ensure new columns are visible
    setVisibleCols(prev => {
      const next = new Set(prev)
      newCols.forEach(c => next.add(c))
      return next
    })

    flash(`✓ ${newRows.length} filas agregadas desde ${source}`)
  }

  const onLoadJSON = (cols: string[], loadedRows: Row[]) => {
    const cleanCols = cols.filter(c => AUTHORIZED_COLS.includes(c))
    const cleanRows = loadedRows.map(row => {
        const clean: any = { _ikid: row._ikid }
        AUTHORIZED_COLS.forEach(c => { clean[c] = row[c] || '' })
        return clean as Row
    })
    setColumns(reorderCols(cleanCols))
    setRowsWithHistory(cleanRows)
    setVisibleCols(new Set(reorderCols(cleanCols)))
    flash('✓ Sesión cargada correctamente')
  }

  const updateCell = (id: string, col: string, val: string) => {
    setRowsWithHistory(prev => {
      const idx = prev.findIndex(r => r._ikid === id)
      if (idx === -1) return prev
      const next = [...prev]
      next[idx] = { ...next[idx], [col]: val }
      return next
    })
  }

  const addRow = () => {
    const newRow: Row = {
      _ikid: Math.random().toString(36).substring(2, 11) + Date.now().toString(36)
    }
    columns.forEach(c => newRow[c] = '')
    setRowsWithHistory(prev => [...prev, newRow])
  }

  const deleteRow = (id: string) => {
    setRowsWithHistory(prev => prev.filter(r => r._ikid !== id))
  }

  const crearNueva = () => {
    const defaultCols = ['ISO', 'GESTIÓN', 'ORIGEN', 'DESTINO', 'CORREO REPITES']
    setColumns(reorderCols(defaultCols))
    setVisibleCols(new Set(reorderCols(defaultCols)))
    
    // Add one empty row so the table structure is visible
    const newRow: Row = {
      _ikid: Math.random().toString(36).substring(2, 11) + Date.now().toString(36)
    }
    defaultCols.forEach(c => newRow[c] = '')
    setRowsWithHistory([newRow])
    
    flash('✓ Nueva tabla creada')
  }

  const clearDashboard = () => {
    if (rows.length === 0) return
    if (window.confirm('¿Estás seguro de que deseas borrar todos los datos del dashboard?')) {
      setRowsWithHistory([])
      flash('✓ Dashboard limpiado')
    }
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
        const xlRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }) as any[]
        
        if (!xlRows.length) return flash('⚠️ Archivo vacío')
        
        const normRows = mapNormalizedRows(xlRows)
        const keys = Object.keys(normRows[0])
        const cTit = keys.find(k => k === "TITULO") || keys.find(k => k.includes("TITULO") || k.includes("ISO"))
        const cVeh = keys.find(k => k === "VEHICULO" || k === "VEH") || keys.find(k => k.includes("VEHICULO"))
        
        if (!cTit) return flash('⚠️ No se detectó columna ISO/Título')
        
        const pvRows = normRows.filter(r => {
          const veh = String(r[cVeh || ''] || "")
          return /^VEH01\s*POST\s*VENTA/.test(veh) || /^VEH01\s*POSTVENTA/.test(veh)
        })
        
        const isos = pvRows.map(r => String(r[cTit] || "")).filter(iso => iso && iso !== "INICIO" && iso !== "FIN")

        setPvPlanData(isos)
        setPvPlanName(file.name)
        flash(`✓ ${isos.length} ISOs de Postventa cargadas para revisión de duplicados`)
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
        const xlRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }) as any[]
        
        if (!xlRows.length) return flash('⚠️ Archivo de proyectos vacío')
        
        const normRows = mapNormalizedRows(xlRows)
        const keys = Object.keys(normRows[0])
        
        // --- Mejor detección de columnas ---
        const cTit = keys.find(k => 
          k === "TITULO" || k === "TÍTULO" || k === "ISO" || k === "ORDEN" || k === "PEDIDO" ||
          k.includes("TITULO") || k.includes("TÍTULO") || k.includes("ISO") || k.includes("ORDEN") || k.includes("PEDIDO")
        )
        const cDir = keys.find(k => 
          k === "DIRECCION" || k === "DIRECCIÓN" || k === "DOMICILIO" || k === "UBICACION" || k === "UBICACIÓN" || k === "DESTINO" ||
          k.includes("DIRECCI") || k.includes("DOMICILIO") || k.includes("UBICACI") || k.includes("DESTINO")
        )
        const cCond = keys.find(k => 
          k === "CONDUCTOR" || k === "CHOFER" || k === "CHOFER/CONDUCTOR" || k === "TRANSPORTE" || k === "DRIVER" ||
          k.includes("CONDUCTOR") || k.includes("CHOFER") || k.includes("DRIVER") || k.includes("TRANS")
        )

        // Fallback: si no detecta, usar una lógica de posicion si las columnas críticas faltan
        let detectTit = cTit;
        let detectDir = cDir;
        if (!detectTit) {
          detectTit = keys[0]; // Asumimos la primera columna como fallback (ej. ORDEN)
        }
        if (!detectDir) {
          // Buscamos algo que parezca una dirección en las primeras 5 columnas
          detectDir = keys.find((_, idx) => idx > 0 && idx < 5) || keys[1];
        }

        if (!detectTit || !detectDir) return flash(`⚠️ Columnas no detectadas. Cols: ${keys.join(', ')}`)

        // --- Lógica de Filtrado de Chóferes Leslie ---
        const hasLeslieKeyword = (val: string) => {
          const u = String(val || "").toUpperCase();
          return u.includes("FRANCISCO") || u.includes("LESLIE") || u.includes("PROYECTO") || u.includes("COMODIN");
        };

        const hasAdicional = normRows.some(r => {
          const cond = String(r[cCond || ''] || "");
          return cond.includes("ADICIONAL") || cond.includes("COMODIN") || cond.includes("EXTERNO");
        });

        let formatted: any[] = []
        
        // Filtramos solo las filas que corresponden a Leslie (driver name filter)
        const leslieRows = normRows.filter(r => {
          const cond = String(r[cCond || ''] || "");
          const iso = String(r[detectTit || ''] || "").trim().toUpperCase();
          if (iso === 'INICIO' || iso === 'FIN' || !iso || iso === 'ISO') return false;
          return hasLeslieKeyword(cond);
        });

        if (leslieRows.length === 0) {
           return flash('⚠️ No se detectaron conductores de Leslie en el archivo (Francisco, Leslie, Proyecto).');
        }

        formatted = leslieRows.map(r => {
          const cond = String(r[cCond || ''] || "").toUpperCase();
          const isExtra = cond.includes("ADICIONAL") || cond.includes("COMODIN") || cond.includes("EXTERNO") || cond.includes("PROYECTOC");
          const veh = isExtra ? "VEH98 Adicional" : "VEH98";
          
          return {
            _tipo: hasAdicional ? 'dos' : 'uno',
            'VEHÍCULO': veh,
            ISO: String(r[detectTit || ''] || "").trim(),
            DIRECCIÓN: String(r[detectDir || ''] || "").trim()
          }
        });
        
        setProyectosData(formatted)
        setProjectsName(file.name)
        flash(`✓ ${formatted.length} proyectos Leslie cargados (Detec: ${detectTit}/${detectDir})`)
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
        setRowsWithHistory(prev => prev.map(r => {
          if (r.ORIGEN === 'PENDIENTE' && r.ISO && map.has(r.ISO)) {
            upd++
            return { ...r, ORIGEN: map.get(r.ISO)! }
          }
          return r
        }))

        flash(`✓ ${upd} orígenes cruzados.`)
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
      setRowsWithHistory(prev => {
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
    } catch (err) {
      flash('⚠️ Error procesando el cruce de destino.')
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

      <div className="flex-1 overflow-hidden relative" style={{ background: theme === 'landscape' ? 'transparent' : TC.bg }}>
        <AnimatePresence mode="wait" initial={false}>
          {tab === 'load' && (
            <motion.div key="load" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} className="absolute inset-0 flex flex-col h-full">
              <TabLoad 
                rows={rows} 
                onMergeRows={onMergeRows} 
                onLoadJSON={onLoadJSON} 
                onPVPlanUpload={handlePVPlanUpload}
                onProjectsUpload={handleProjectsUpload}
                onOriginCross={handleOriginCross}
                onDestinoCross={handleDestinoCross}
                pvPlanName={pvPlanName}
                projectsName={projectsName}
                TC={TC}
                onExportJSON={exportJSON}
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
                onUpdateRows={setRowsWithHistory}
                onNotify={flash}
                onClearAll={clearDashboard}
                search={search}
                setSearch={setSearch}
                colFilters={colFilters}
                setColFilters={setColFilters}
                sortCol={sortCol}
                setSortCol={setSortCol}
                onExportJSON={exportJSON}
              />
            </motion.div>
          )}

          {tab === 'export' && (
            <motion.div key="export" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="absolute inset-0">
              <TabExport rows={rows} filteredRows={filteredRows} stats={stats} onExportJSON={exportJSON} />
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

        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowShortcuts(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-lg rounded-3xl p-8 border shadow-2xl overflow-hidden relative"
              style={{ background: TC.bgCard, borderColor: TC.borderSoft }}
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 p-4 opacity-50 cursor-pointer" onClick={() => setShowShortcuts(false)}>✕</div>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: TC.text }}>
                <span className="text-2xl">⌨️</span> Atajos de Teclado
              </h2>
              
              <div className="grid grid-cols-1 gap-4">
                {[
                  { k: 'Alt + Z', d: 'Deshacer último cambio' },
                  { k: 'Ctrl + ?', d: 'Abrir/Cerrar esta guía' },
                  { k: 'Ctrl + C', d: 'Copiar selección de tabla (Tabular)' },
                  { k: 'Ctrl + V', d: 'Pegar datos en tabla (Distribuye automáticamente)' },
                  { k: 'Arrows', d: 'Navegar por las celdas de la tabla' },
                  { k: 'Enter', d: 'Bajar a la siguiente celda' },
                  { k: 'Shift + Arrows', d: 'Expandir selección de celdas' },
                  { k: 'Esc', d: 'Cerrar modales o limpiar selección' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-dashed" style={{ borderColor: TC.borderSoft }}>
                    <span className="text-xs" style={{ color: TC.textSub }}>{s.d}</span>
                    <span className="px-2 py-1 rounded bg-black/20 font-mono text-[10px] font-bold border border-white/10" style={{ color: TC.text }}>{s.k}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-[10px] leading-relaxed italic" style={{ color: TC.textFaint }}>
                  💡 Tip: Puedes arrastrar el mouse sobre la tabla para seleccionar múltiples celdas y borrarlas todas con la tecla Suprimir.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  )
}
