import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { compress, decompress } from 'lz-string'
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
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[99999] px-6 py-2.5 rounded-2xl flex items-center gap-2 border shadow-2xl backdrop-blur-xl"
      style={{
        background: type === 'err' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
        color: type === 'err' ? '#f87171' : '#4ade80',
        borderColor: type === 'err' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)',
      }}
    >
      <span className="text-lg">{type === 'ok' ? '✓' : '⚠️'}</span>
      <span className="text-xs font-bold uppercase tracking-wider">{msg}</span>
    </motion.div>
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
  const isoMap = new Map<string, SummaryRow>()

  // 1. Process Conflicts (Geo)
  for (const c of conflicts) {
    const isRes = resolvedConflicts.has(c.iso)
    const isFlg = flaggedConflicts.has(c.iso)
    isoMap.set(c.iso, {
      iso: c.iso, veh: c.veh, dir: c.dir,
      obs: 'Comuna Incorrecta',
      detalle: `${c.comunaDireccion} → ${c.comunaReal}`,
      tipo: 'geo',
      status: isRes ? 'resuelto' : isFlg ? 'alerta' : 'pendiente',
      geoISO: c.iso,
      aKey: null,
      riskLevel: null,
    })
  }

  // 2. Process Risk (Off-Route) and Merge
  for (const [veh, vdata] of Object.entries(riskResults)) {
    for (const r of vdata.results) {
      if (r.riskLevel === 'low') continue
      const aKey = `${veh}|${r.key}`
      const isResRisk = resolvedRisk.has(aKey)
      const isFlgRisk = flaggedRisk.has(aKey)
      
      for (const isoRow of (r.isos ?? [])) {
        const existing = isoMap.get(isoRow.iso)
        if (existing) {
          // Merge
          existing.tipo = 'ambos'
          existing.obs  = 'FR + CI'
          existing.detalle = `${existing.detalle} | FR: ${r.comuna}`
          existing.aKey = aKey
          existing.riskLevel = r.riskLevel
          
          // Logic: if it was resuelto for Geo but pending for Risk, it's pending overall
          const isGeoRes = resolvedConflicts.has(isoRow.iso)
          const isGeoFlg = flaggedConflicts.has(isoRow.iso)
          
          if (isGeoFlg || isFlgRisk) existing.status = 'alerta'
          else if (isGeoRes && isResRisk) existing.status = 'resuelto'
          else existing.status = 'pendiente'
        } else {
          isoMap.set(isoRow.iso, {
            iso: isoRow.iso, veh,
            dir: isoRow.dir || '',
            obs: 'Fuera de Ruta',
            detalle: `${r.comuna} · ${Math.round(r.riskScore * 100)}% riesgo`,
            tipo: 'fuera',
            status: isResRisk ? 'resuelto' : isFlgRisk ? 'alerta' : 'pendiente',
            geoISO: null,
            aKey,
            riskLevel: r.riskLevel,
          })
        }
      }
    }
  }

  const rows = Array.from(isoMap.values())
  const order: Record<string, number> = { alerta: 0, pendiente: 1, resuelto: 2 }
  return rows.sort((a, b) => (order[a.status] || 0) - (order[b.status] || 0))
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
  const [routeData, setRouteData]     = useState<RouteRow[]>(() => {
    try {
      const saved = localStorage.getItem('aud-route-v2')
      if (saved) return JSON.parse(decompress(saved) || '[]')
      const old = localStorage.getItem('aud-route')
      return old ? JSON.parse(old) : []
    } catch { return [] }
  })
  const [conflicts, setConflicts]     = useState<ComunaConflict[]>([])
  const [riskResults, setRiskResults] = useState<Record<string, RiskResult>>({})
  const [routeMapVeh, setRouteMapVeh] = useState<string | null>(null)
  const [dragging, setDragging]       = useState(false)

  const [resolvedConflicts, setResolvedConflicts] = useState<Set<string>>(() => {
    try {
      const s = localStorage.getItem('aud-res-conf-v2')
      return s ? new Set(JSON.parse(s)) : new Set()
    } catch { return new Set() }
  })
  const [flaggedConflicts,  setFlaggedConflicts]  = useState<Set<string>>(() => {
    try {
      const s = localStorage.getItem('aud-flg-conf-v2')
      return s ? new Set(JSON.parse(s)) : new Set()
    } catch { return new Set() }
  })
  const [resolvedRisk,      setResolvedRisk]      = useState<Set<string>>(() => {
    try {
      const s = localStorage.getItem('aud-res-risk-v2')
      return s ? new Set(JSON.parse(s)) : new Set()
    } catch { return new Set() }
  })
  const [flaggedRisk,       setFlaggedRisk]       = useState<Set<string>>(() => {
    try {
      const s = localStorage.getItem('aud-flg-risk-v2')
      return s ? new Set(JSON.parse(s)) : new Set()
    } catch { return new Set() }
  })
  const [excludedVehicles, setExcludedVehicles] = useState<Set<string>>(() => {
    try {
      const s = localStorage.getItem('aud-excl-veh-v2')
      return s ? new Set(JSON.parse(s)) : new Set()
    } catch { return new Set() }
  })

  const { toast, showToast } = useToast()

  // ── Persistence ──────────────────────────────────────────────────
  useEffect(() => {
    if (routeData.length > 0) {
      localStorage.setItem('aud-route-v2', compress(JSON.stringify(routeData)))
      localStorage.removeItem('aud-route')
    } else {
      localStorage.removeItem('aud-route-v2')
    }
  }, [routeData])

  useEffect(() => { localStorage.setItem('aud-res-conf-v2', JSON.stringify([...resolvedConflicts])) }, [resolvedConflicts])
  useEffect(() => { localStorage.setItem('aud-flg-conf-v2', JSON.stringify([...flaggedConflicts])) }, [flaggedConflicts])
  useEffect(() => { localStorage.setItem('aud-res-risk-v2', JSON.stringify([...resolvedRisk])) }, [resolvedRisk])
  useEffect(() => { localStorage.setItem('aud-flg-risk-v2', JSON.stringify([...flaggedRisk])) }, [flaggedRisk])
  useEffect(() => { localStorage.setItem('aud-excl-veh-v2', JSON.stringify([...excludedVehicles])) }, [excludedVehicles])

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
      'tab-alertas': summarySev,
      'tab-mapa':    offRouteSev,
      'tab-geo':     communeSev,
      'tab-resumen': summarySev,
    } satisfies Partial<Record<typeof activeTab, 'high' | 'medium' | 'none'>>
  }, [riskResults, conflicts, resolvedConflicts, flaggedConflicts, excludedVehicles])

  const handleFile = useCallback(async (file: File) => {
    const result = await parseFile(file)
    if (result.error) { showToast(result.error, 'err'); return }

    setRouteData(result.rows)
    setConflicts([])
    setRiskResults({})
    setResolvedRisk(new Set())
    setFlaggedRisk(new Set())
    setExcludedVehicles(new Set())
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

  const summaryRows = useMemo(() => {
    const allRows = buildSummaryRows(conflicts, riskResults, resolvedConflicts, flaggedConflicts, resolvedRisk, flaggedRisk)
    return allRows.filter(r => !excludedVehicles.has(r.veh))
  }, [conflicts, riskResults, resolvedConflicts, flaggedConflicts, resolvedRisk, flaggedRisk, excludedVehicles])

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

    const geoAlertsCount = conflicts.filter(c => !excludedVehicles.has(c.veh) && !resolvedConflicts.has(c.iso)).length;

    return {
      'tab-vehiculos': routeData.length || undefined,
      'tab-mapa':      offRouteISOs.size || undefined,
      'tab-geo':       geoAlertsCount || undefined,
      'tab-resumen':   summaryRows.filter(r => r.status !== 'resuelto').length || undefined,
    }
  }, [routeData, riskResults, conflicts, resolvedConflicts, summaryRows, excludedVehicles])

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
    // If resolve=true, clear ALL flags for this ISO
    if (resolve) {
      setFlaggedConflicts(s => { const n = new Set(s); n.delete(iso); return n })
      if (aKey) setFlaggedRisk(s => { const n = new Set(s); n.delete(aKey); return n })
    }

    // Update Resolved sets
    if (tipo === 'geo' || tipo === 'ambos') {
      setResolvedConflicts(s => { const n = new Set(s); resolve ? n.add(iso) : n.delete(iso); return n })
    }
    if ((tipo === 'fuera' || tipo === 'ambos') && aKey) {
      setResolvedRisk(s => { const n = new Set(s); resolve ? n.add(aKey) : n.delete(aKey); return n })
    }
    showToast(resolve ? '✓ Resuelto' : '↩ Reabierto')
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
    showToast(`✓ ${isos.length} alertas resueltas`)
  }, [showToast])

  const handleFlagAll = useCallback((isos: string[], aKeys: (string | null)[]) => {
    setFlaggedConflicts(prev => {
      const next = new Set(prev)
      isos.forEach(iso => next.add(iso))
      return next
    })
    setResolvedConflicts(prev => {
      const next = new Set(prev)
      isos.forEach(iso => next.delete(iso))
      return next
    })
    setFlaggedRisk(prev => {
      const next = new Set(prev)
      aKeys.forEach(k => { if (k) next.add(k) })
      return next
    })
    setResolvedRisk(prev => {
      const next = new Set(prev)
      aKeys.forEach(k => { if (k) next.delete(k) })
      return next
    })
    showToast(`⚠ ${isos.length} alertas marcadas`)
  }, [showToast])

  const handleSummaryFlag = useCallback((iso: string, aKey: string | null, tipo: string, flag: boolean) => {
    // If flag=true, clear ALL resolutions for this ISO
    if (flag) {
      setResolvedConflicts(s => { const n = new Set(s); n.delete(iso); return n })
      if (aKey) setResolvedRisk(s => { const n = new Set(s); n.delete(aKey); return n })
    }

    // Update Flagged sets
    if (tipo === 'geo' || tipo === 'ambos') {
      setFlaggedConflicts(s => { const n = new Set(s); flag ? n.add(iso) : n.delete(iso); return n })
    }
    if ((tipo === 'fuera' || tipo === 'ambos') && aKey) {
      setFlaggedRisk(s => { const n = new Set(s); flag ? n.add(aKey) : n.delete(aKey); return n })
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
                  excludedVehicles={excludedVehicles}
                  onToggleExclude={veh => {
                    setExcludedVehicles(prev => {
                      const n = new Set(prev)
                      if (n.has(veh)) n.delete(veh)
                      else n.add(veh)
                      return n
                    })
                    showToast(excludedVehicles.has(veh) ? `✓ ${veh} incluido` : `✕ ${veh} excluido`)
                  }}
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
                  onFlagAll={handleFlagAll}
                  onOpenRouteMap={veh => { setRouteMapVeh(veh) }}
                  hasData={!!routeData.length}
                  isReady={comunasReady}
                  onRunAnalysis={handleGeoAnalysis}
                  excludedVehicles={excludedVehicles}
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
            onFlagAll={handleFlagAll}
            hasData={!!routeData.length}
            isReady={comunasReady}
            onRunAnalysis={handleGeoAnalysis}
            excludedVehicles={excludedVehicles}
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