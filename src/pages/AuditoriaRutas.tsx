import { useState, useMemo, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { TabId, RouteRow, ComunaConflict, RiskResult, SummaryRow } from '../types/auditoria'
import { useFileParser } from '../hooks/useFileParser'
import { useRiskAnalysis } from '../hooks/useRiskAnalysis'
import { useConflictAnalysis } from '../hooks/useConflictAnalysis'
import { useComunas } from '../hooks/useComunas'
import GlassHeader, { GlassHeaderTab } from '../components/ui/GlassHeader'

const AUDITORIA_TABS: GlassHeaderTab[] = [
  { id: 'tab-plan',      label: 'Cargar Plan',   icon: '📥', badgeVariant: 'green'  },
  { id: 'tab-vehiculos', label: 'Route Plan',    icon: '📋', badgeVariant: 'blue'   },
  { id: 'tab-mapa',      label: 'Off-Route',     icon: '⚠️', badgeVariant: 'orange' },
  { id: 'tab-geo',       label: 'Wrong Commune', icon: '📍', badgeVariant: 'red'    },
  { id: 'tab-resumen',   label: 'Summary',       icon: '📊', badgeVariant: 'orange' },
  { id: 'tab-export',    label: 'Exportar',      icon: '🚀', badgeVariant: 'blue'   },
]
import TabRoutePlan from '../components/auditoria/TabRoutePlan'
import TabOffRoute from '../components/auditoria/TabOffRoute'
import TabWrongCommune from '../components/auditoria/TabWrongCommune'
import TabAlertas from '../components/auditoria/TabAlertas'
import TabSummary from '../components/auditoria/TabSummary'
import TabExport from '../components/auditoria/TabExport'
import RouteMapModal from '../components/auditoria/RouteMapModal'
import TabPlanCarga from '../components/auditoria/TabPlanCarga'
import { useTheme, getThemeColors } from '../context/ThemeContext'

// ── Toast ─────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: 'ok' | 'err' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      style={{
        position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 99999, padding: '8px 18px', borderRadius: 20,
        fontSize: 12, fontWeight: 700,
        background: type === 'err' ? 'rgba(248,81,73,.15)' : 'rgba(63,185,80,.12)',
        color: type === 'err' ? '#ff7b72' : '#3fb950',
        border: `1px solid ${type === 'err' ? 'rgba(248,81,73,.35)' : 'rgba(63,185,80,.3)'}`,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 20px rgba(0,0,0,.4)',
      }}
    >{msg}</motion.div>
  )
}

// ── buildSummaryRows ──────────────────────────────────────────────
function buildSummaryRows(
  conflicts: ComunaConflict[],
  riskResults: Record<string, RiskResult>,
  resolvedConflicts: Set<string>,
  flaggedConflicts: Set<string>,
  resolvedRisk: Set<string>,
  flaggedRisk: Set<string>,
): SummaryRow[] {
  const geoMap: Record<string, ComunaConflict> = {}
  for (const c of conflicts) geoMap[c.iso] = c

  const fueraMap: Record<string, {
    iso: string; veh: string; dir: string; detalle: string
    aKey: string; riskLevel: 'low' | 'medium' | 'high'; _riskScore: number
  }> = {}

  for (const [veh, vdata] of Object.entries(riskResults)) {
    for (const r of vdata.results) {
      if (r.riskLevel !== 'high' && r.riskLevel !== 'medium') continue
      const aKey = `${veh}|${r.key}`
      for (const isoRow of (r.isos ?? [])) {
        if (!fueraMap[isoRow.iso] || r.riskScore > (fueraMap[isoRow.iso]._riskScore || 0)) {
          fueraMap[isoRow.iso] = {
            iso: isoRow.iso, veh,
            dir: isoRow.dir || '',
            detalle: `${r.comuna} · ${Math.round(r.riskScore * 100)}% riesgo${r.riskLevel === 'medium' ? ' (moderado)' : ''}`,
            aKey, riskLevel: r.riskLevel, _riskScore: r.riskScore,
          }
        }
      }
    }
  }

  const allKeys = new Set([...Object.keys(geoMap), ...Object.keys(fueraMap)])
  const rows: SummaryRow[] = []

  for (const iso of allKeys) {
    const geo   = geoMap[iso]
    const fuera = fueraMap[iso]

    const geoResolved  = geo   ? resolvedConflicts.has(iso)   : false
    const geoFlagged   = geo   ? flaggedConflicts.has(iso)    : false
    const anomResolved = fuera ? resolvedRisk.has(fuera.aKey) : false
    const anomFlagged  = fuera ? flaggedRisk.has(fuera.aKey)  : false

    if (geo) {
      rows.push({
        iso, veh: geo.veh, dir: geo.dir,
        obs: 'Comuna Incorrecta',
        detalle: `${geo.comunaDireccion} → ${geo.comunaReal}`,
        tipo: 'geo',
        status: geoResolved ? 'revisado' : (geoFlagged || true) ? 'alerta' : 'pendiente',
        geoISO: iso,
        aKey: null,
        riskLevel: null,
      })
    }

    if (fuera) {
      rows.push({
        iso, veh: fuera.veh, dir: fuera.dir,
        obs: 'Fuera de Ruta',
        detalle: fuera.detalle,
        tipo: 'fuera',
        status: anomResolved ? 'revisado' : (anomFlagged || true) ? 'alerta' : 'pendiente',
        geoISO: null,
        aKey: fuera.aKey,
        riskLevel: fuera.riskLevel,
      })
    }
  }

  const order: Record<string, number> = { alerta: 0, pendiente: 1, revisado: 2, aprobado: 2 }
  rows.sort((a, b) => (order[a.status] || 0) - (order[b.status] || 0))
  return rows
}

// ── useToast ──────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ msg, type })
    timer.current = setTimeout(() => setToast(null), 3000)
  }, [])
  return { toast, showToast }
}

// ── Main page ─────────────────────────────────────────────────────
export default function AuditoriaRutas() {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)

  const [activeTab, setActiveTab]     = useState<TabId>('tab-plan')
  const [routeData, setRouteData]     = useState<RouteRow[]>([])
  const [conflicts, setConflicts]     = useState<ComunaConflict[]>([])
  const [riskResults, setRiskResults] = useState<Record<string, RiskResult>>({})
  const [routeMapVeh, setRouteMapVeh] = useState<string | null>(null)
  const [dragging, setDragging]       = useState(false)

  const [resolvedConflicts, setResolvedConflicts] = useState<Set<string>>(new Set())
  const [flaggedConflicts,  setFlaggedConflicts]  = useState<Set<string>>(new Set())
  const [resolvedRisk,      setResolvedRisk]      = useState<Set<string>>(new Set())
  const [flaggedRisk,       setFlaggedRisk]       = useState<Set<string>>(new Set())

  const { toast, showToast } = useToast()

  const { parseFile, loading: parsing } = useFileParser()
  const { runAnalysis: runRisk }        = useRiskAnalysis()
  const { runAnalysis: runConflict }    = useConflictAnalysis()
  const { ready: comunasReady, getAdjMap } = useComunas()

  // ── Tab severity levels (color the active pill) ───────────────
  const severities = useMemo(() => {
    // Off-Route severity
    const allRiskResults = Object.values(riskResults).flatMap(v => v.results)
    const offRouteSev: 'high' | 'medium' | 'none' =
      allRiskResults.some(r => r.riskLevel === 'high')   ? 'high' :
      allRiskResults.some(r => r.riskLevel === 'medium') ? 'medium' : 'none'

    // Wrong Commune severity
    const pendingConflicts = conflicts.filter(c => !resolvedConflicts.has(c.iso))
    const communeSev: 'high' | 'medium' | 'none' =
      flaggedConflicts.size > 0    ? 'high' :
      pendingConflicts.length > 0  ? 'medium' : 'none'

    // Summary severity (worst of both)
    const summarySev: 'high' | 'medium' | 'none' =
      offRouteSev === 'high' || communeSev === 'high' ? 'high' :
      offRouteSev === 'medium' || communeSev === 'medium' ? 'medium' : 'none'

    return {
      'tab-alertas': summarySev, // Alertas usa la severidad combinada
      'tab-mapa':    offRouteSev,
      'tab-geo':     communeSev,
      'tab-resumen': summarySev,
    } satisfies Partial<Record<typeof activeTab, 'high' | 'medium' | 'none'>>
  }, [riskResults, conflicts, resolvedConflicts, flaggedConflicts])

  const handleFile = useCallback(async (file: File) => {
    const result = await parseFile(file)
    if (result.error) { showToast(result.error, 'err'); return }

    setRouteData(result.rows)
    setConflicts([])
    setRiskResults({})
    setResolvedConflicts(new Set())
    setFlaggedConflicts(new Set())
    setResolvedRisk(new Set())
    setFlaggedRisk(new Set())
    showToast(`✓ ${result.rows.length} ISOs cargadas${result.hasGeo ? ' · con GPS' : ''}`)

    // Switch to Route Plan tab after loading
    setActiveTab('tab-vehiculos')

    setTimeout(() => {
      if (!comunasReady) {
        showToast('comunas_data.js no disponible — análisis geo desactivado', 'err')
        return
      }
      const adjMap = getAdjMap()
      const riskR  = runRisk(result.rows, new Set(), adjMap)
      setRiskResults(riskR)
      if (result.hasGeo) {
        const confR = runConflict(result.rows)
        setConflicts(confR)
        if (confR.length) showToast(`${confR.length} conflictos geo detectados`)
      }
    }, 200)
  }, [comunasReady, getAdjMap, parseFile, runRisk, runConflict, showToast])

  const handleGeoAnalysis = useCallback(() => {
    if (!routeData.length) { showToast('Carga un archivo primero', 'err'); return }
    if (!comunasReady)     { showToast('comunas_data.js aún no disponible', 'err'); return }
    const confR = runConflict(routeData)
    setConflicts(confR)
    showToast(confR.length ? `${confR.length} conflictos detectados` : '✓ Sin conflictos de comuna')
  }, [routeData, comunasReady, runConflict, showToast])

  const summaryRows = useMemo(() =>
    buildSummaryRows(conflicts, riskResults, resolvedConflicts, flaggedConflicts, resolvedRisk, flaggedRisk),
    [conflicts, riskResults, resolvedConflicts, flaggedConflicts, resolvedRisk, flaggedRisk]
  )

  const badges: Partial<Record<TabId, number>> = useMemo(() => {
    // Off-Route count: unique ISOs in results with risk >= medium
    const offRouteISOs = new Set<string>();
    Object.values(riskResults).forEach(v => {
      v.results.forEach(r => {
        if (r.riskLevel === 'high' || r.riskLevel === 'medium') {
          r.isos?.forEach(isoRow => offRouteISOs.add(isoRow.iso));
        }
      });
    });

    const geoAlertsCount = conflicts.filter(c => !resolvedConflicts.has(c.iso)).length;

    return {
      'tab-vehiculos': routeData.length || undefined,
      'tab-mapa':      offRouteISOs.size || undefined,
      'tab-geo':       geoAlertsCount || undefined,
      'tab-resumen':   summaryRows.filter(r => r.status !== 'revisado').length || undefined,
    }
  }, [routeData, riskResults, conflicts, resolvedConflicts, summaryRows])

  const toggleResolveConflict = useCallback((iso: string) => {
    setResolvedConflicts(prev => {
      const n = new Set(prev)
      if (n.has(iso)) n.delete(iso)
      else { n.add(iso); setFlaggedConflicts(f => { const ff = new Set(f); ff.delete(iso); return ff }) }
      return n
    })
  }, [])

  const toggleFlagConflict = useCallback((iso: string) => {
    setFlaggedConflicts(prev => {
      const n = new Set(prev)
      if (n.has(iso)) n.delete(iso)
      else { n.add(iso); setResolvedConflicts(r => { const rr = new Set(r); rr.delete(iso); return rr }) }
      return n
    })
  }, [])

  const toggleResolveRisk = useCallback((aKey: string) => {
    setResolvedRisk(prev => {
      const n = new Set(prev)
      if (n.has(aKey)) n.delete(aKey)
      else { n.add(aKey); setFlaggedRisk(f => { const ff = new Set(f); ff.delete(aKey); return ff }) }
      return n
    })
  }, [])

  const toggleFlagRisk = useCallback((aKey: string) => {
    setFlaggedRisk(prev => {
      const n = new Set(prev)
      if (n.has(aKey)) n.delete(aKey)
      else { n.add(aKey); setResolvedRisk(r => { const rr = new Set(r); rr.delete(aKey); return rr }) }
      return n
    })
  }, [])

  const handleSummaryResolve = useCallback((iso: string, aKey: string | null, tipo: string, resolve: boolean) => {
    if (tipo === 'geo' || tipo === 'ambos') {
      setResolvedConflicts(s => { const n = new Set(s); resolve ? n.add(iso) : n.delete(iso); return n })
      if (resolve) setFlaggedConflicts(s => { const n = new Set(s); n.delete(iso); return n })
    }
    if ((tipo === 'fuera' || tipo === 'ambos') && aKey) {
      setResolvedRisk(s => { const n = new Set(s); resolve ? n.add(aKey) : n.delete(aKey); return n })
      if (resolve) setFlaggedRisk(s => { const n = new Set(s); n.delete(aKey); return n })
    }
    showToast(resolve ? '✓ Revisado' : '↩ Reabierto')
  }, [showToast])

  const handleResolveAll = useCallback((isos: string[], aKeys: (string | null)[]) => {
    setResolvedConflicts(prev => {
      const next = new Set(prev)
      isos.forEach(iso => next.add(iso))
      return next
    })
    setFlaggedConflicts(prev => {
      const next = new Set(prev)
      isos.forEach(iso => next.delete(iso))
      return next
    })
    setResolvedRisk(prev => {
      const next = new Set(prev)
      aKeys.forEach(k => { if (k) next.add(k) })
      return next
    })
    setFlaggedRisk(prev => {
      const next = new Set(prev)
      aKeys.forEach(k => { if (k) next.delete(k) })
      return next
    })
    showToast(`✓ ${isos.length} alertas revisadas`)
  }, [showToast])

  const handleSummaryFlag = useCallback((iso: string, aKey: string | null, tipo: string, flag: boolean) => {
    // Sync flags globally if user wants one check to flag all
    if (tipo === 'geo' || tipo === 'ambos') {
      setFlaggedConflicts(s => { const n = new Set(s); flag ? n.add(iso) : n.delete(iso); return n })
      if (flag) setResolvedConflicts(s => { const n = new Set(s); n.delete(iso); return n })
    }
    if ((tipo === 'fuera' || tipo === 'ambos') && aKey) {
      setFlaggedRisk(s => { const n = new Set(s); flag ? n.add(aKey) : n.delete(aKey); return n })
      if (flag) setResolvedRisk(s => { const n = new Set(s); n.delete(aKey); return n })
    }
    showToast(flag ? '⚠ Alerta marcada' : '✕ Alerta removida')
  }, [showToast])

  const handleClear = useCallback(() => {
    setRouteData([])
    setConflicts([])
    setRiskResults({})
    setResolvedConflicts(new Set())
    setFlaggedConflicts(new Set())
    setResolvedRisk(new Set())
    setFlaggedRisk(new Set())
    setRouteMapVeh(null)
    setActiveTab('tab-plan')
  }, [])

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: theme === 'landscape' ? 'transparent' : TC.bg, color: TC.text, fontFamily: '"Inter", system-ui, sans-serif', userSelect: 'none', transition: 'background 0.25s, color 0.25s' }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
    >
      <GlassHeader 
        appName="AUDITORÍA DE RUTAS"
        icon="🔍"
        tabs={AUDITORIA_TABS}
        activeTab={activeTab} 
        onTabChange={(id) => setActiveTab(id as TabId)} 
        badges={badges as Record<string, number>} 
        severities={severities as Record<string, "none" | "high" | "medium">} 
      />

      {/* Drag overlay */}
      {dragging && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', background: 'rgba(0,81,186,0.15)', border: '2px dashed rgba(0,81,186,0.6)' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#7bb8ff' }}>Suelta el archivo aquí</div>
        </div>
      )}

      {/* Tab content area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* Non-map tabs: animated */}
        <AnimatePresence mode="wait" initial={false}>
          {activeTab !== 'tab-geo' && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              style={{ position: 'absolute', inset: 0, background: TC.bg }}
            >
              {activeTab === 'tab-plan' && (
                <TabPlanCarga
                  routeData={routeData}
                  parsing={parsing}
                  onFile={handleFile}
                  onClear={handleClear}
                />
              )}
              {activeTab === 'tab-vehiculos' && (
                <TabRoutePlan
                  routeData={routeData}
                  riskResults={riskResults}
                  resolvedRisk={resolvedRisk}
                  onResolveRisk={(aKey, resolve) => {
                    setResolvedRisk(s => { const n = new Set(s); resolve ? n.add(aKey) : n.delete(aKey); return n })
                    showToast(resolve ? '✓ Aprobado' : '↩ Reabierto')
                  }}
                  onOpenRouteMap={veh => { setRouteMapVeh(veh) }}
                />
              )}
              {activeTab === 'tab-mapa' && (
                <TabOffRoute
                  routeData={routeData}
                  riskResults={riskResults}
                  resolvedRisk={resolvedRisk}
                  flaggedRisk={flaggedRisk}
                  onToggleResolve={toggleResolveRisk}
                  onToggleFlag={toggleFlagRisk}
                  onResolveAll={handleResolveAll}
                  onOpenRouteMap={veh => { setRouteMapVeh(veh) }}
                  hasData={!!routeData.length}
                  isReady={comunasReady}
                />
              )}
              {activeTab === 'tab-alertas' && (
                <TabAlertas
                  routeData={routeData}
                  riskResults={riskResults}
                  conflicts={conflicts}
                  resolvedRisk={resolvedRisk}
                  flaggedRisk={flaggedRisk}
                  resolvedConflicts={resolvedConflicts}
                  flaggedConflicts={flaggedConflicts}
                  onToggleResolveRisk={toggleResolveRisk}
                  onToggleFlagRisk={toggleFlagRisk}
                  onToggleResolveConflict={toggleResolveConflict}
                  onToggleFlagConflict={toggleFlagConflict}
                  onResolveAll={handleResolveAll}
                  onOpenRouteMap={veh => { setRouteMapVeh(veh) }}
                  hasData={!!routeData.length}
                  isReady={comunasReady}
                  onRunGeoAnalysis={handleGeoAnalysis}
                />
              )}
              {activeTab === 'tab-resumen' && (
                <TabSummary
                  rows={summaryRows}
                  onResolve={handleSummaryResolve}
                  onFlag={handleSummaryFlag}
                  resolvedConflicts={resolvedConflicts}
                  flaggedConflicts={flaggedConflicts}
                  resolvedRisk={resolvedRisk}
                  flaggedRisk={flaggedRisk}
                />
              )}
              {activeTab === 'tab-export' && (
                <TabExport
                  routeData={routeData}
                  conflicts={conflicts}
                  riskResults={riskResults}
                  summaryRows={summaryRows}
                  resolvedConflicts={resolvedConflicts}
                  flaggedConflicts={flaggedConflicts}
                  resolvedRisk={resolvedRisk}
                  flaggedRisk={flaggedRisk}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* TabWrongCommune — ALWAYS mounted, never unmounts (Leaflet stays alive).
            Uses opacity/pointerEvents to hide/show instead of mounting/unmounting.
            This is the KEY fix for the map disappearing bug. */}
        <div
          style={{
            position: 'absolute', inset: 0,
            opacity: activeTab === 'tab-geo' ? 1 : 0,
            pointerEvents: activeTab === 'tab-geo' ? 'auto' : 'none',
            transition: 'opacity 0.1s',
            zIndex: activeTab === 'tab-geo' ? 1 : 0,
          }}
        >
          <TabWrongCommune
            routeData={routeData}
            conflicts={conflicts}
            resolvedConflicts={resolvedConflicts}
            flaggedConflicts={flaggedConflicts}
            onToggleResolve={toggleResolveConflict}
            onToggleFlag={toggleFlagConflict}
            onResolveAll={handleResolveAll}
            hasData={!!routeData.length}
            isReady={comunasReady}
            onRunAnalysis={handleGeoAnalysis}
            isVisible={activeTab === 'tab-geo'}
          />
        </div>
      </div>

      {/* Route map modal — uses vanilla Leaflet, no react-leaflet */}
      {routeMapVeh && (
        <RouteMapModal
          veh={routeMapVeh}
          routeData={routeData}
          riskResults={riskResults}
          conflicts={conflicts}
          onClose={() => setRouteMapVeh(null)}
        />
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast key="toast" msg={toast.msg} type={toast.type} />}
      </AnimatePresence>
    </div>
  )
}