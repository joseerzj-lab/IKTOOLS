import { useState, useMemo, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { TabId, RouteRow, ComunaConflict, RiskResult, SummaryRow } from '../types/auditoria'
import { useFileParser } from '../hooks/useFileParser'
import { useRiskAnalysis } from '../hooks/useRiskAnalysis'
import { useConflictAnalysis } from '../hooks/useConflictAnalysis'
import { useComunas } from '../hooks/useComunas'
import GlassHeader from '../components/auditoria/GlassHeader'
import TabRoutePlan from '../components/auditoria/TabRoutePlan'
import TabOffRoute from '../components/auditoria/TabOffRoute'
import TabWrongCommune from '../components/auditoria/TabWrongCommune'
import TabSummary from '../components/auditoria/TabSummary'
import TabExport from '../components/auditoria/TabExport'
import RouteMapModal from '../components/auditoria/RouteMapModal'

// ── Toast ─────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: 'ok' | 'err' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-semibold shadow-xl"
      style={{
        background: type === 'err' ? 'rgba(248,81,73,.15)' : 'rgba(63,185,80,.12)',
        color: type === 'err' ? '#ff7b72' : '#3fb950',
        border: `1px solid ${type === 'err' ? 'rgba(248,81,73,.35)' : 'rgba(63,185,80,.3)'}`,
        backdropFilter: 'blur(12px)',
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
            iso: isoRow.iso,
            veh,
            dir: isoRow.dir || '',
            detalle: `${r.comuna} · ${Math.round(r.riskScore * 100)}% riesgo${r.riskLevel === 'medium' ? ' (moderado)' : ''}`,
            aKey,
            riskLevel: r.riskLevel,
            _riskScore: r.riskScore,
          }
        }
      }
    }
  }

  const allKeys: Record<string, 1> = {}
  for (const iso of Object.keys(geoMap)) allKeys[iso] = 1
  for (const iso of Object.keys(fueraMap)) allKeys[iso] = 1

  const rows: SummaryRow[] = []
  for (const iso of Object.keys(allKeys)) {
    const geo   = geoMap[iso]
    const fuera = fueraMap[iso]
    const both  = !!(geo && fuera)

    const geoResolved  = geo   ? resolvedConflicts.has(iso)   : false
    const geoFlagged   = geo   ? flaggedConflicts.has(iso)    : false
    const anomResolved = fuera ? resolvedRisk.has(fuera.aKey) : false
    const anomFlagged  = fuera ? flaggedRisk.has(fuera.aKey)  : false

    const geoStatus   = geoResolved ? 'resuelto' : geoFlagged ? 'alerta' : 'pendiente'
    const fueraStatus = anomResolved ? 'resuelto' : anomFlagged ? 'alerta' : 'pendiente'

    let status: SummaryRow['status'], tipo: SummaryRow['tipo'], obs: string, detalle: string

    if (both) {
      status  = (geoStatus === 'resuelto' && fueraStatus === 'resuelto') ? 'resuelto'
              : (geoStatus === 'alerta'   && fueraStatus === 'alerta')   ? 'alerta' : 'pendiente'
      tipo    = 'ambos'
      obs     = 'Fuera de Ruta + CI'
      detalle = `CI: ${geo.comunaDireccion} → ${geo.comunaReal}  |  FR: ${fuera.detalle}`
    } else if (geo) {
      status  = geoStatus as SummaryRow['status']
      tipo    = 'geo'
      obs     = 'Comuna Incorrecta'
      detalle = `${geo.comunaDireccion} → ${geo.comunaReal}`
    } else {
      status  = fueraStatus as SummaryRow['status']
      tipo    = 'fuera'
      obs     = 'Fuera de Ruta'
      detalle = fuera!.detalle
    }

    rows.push({
      iso,
      veh:       (geo || fuera!).veh,
      dir:       geo?.dir ?? fuera?.dir ?? '',
      obs,
      detalle,
      tipo,
      status,
      geoISO:    geo   ? iso        : null,
      aKey:      fuera ? fuera.aKey : null,
      riskLevel: fuera ? fuera.riskLevel : null,
    })
  }

  const order: Record<string, number> = { pendiente: 0, alerta: 1, resuelto: 2, aprobado: 2 }
  rows.sort((a, b) => (order[a.status] || 0) - (order[b.status] || 0))
  return rows
}

// ── useToast hook — fixes the useRef/showToast error ─────────────
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
  const [activeTab, setActiveTab]     = useState<TabId>('tab-vehiculos')
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
    setActiveTab('tab-vehiculos')
    showToast(`OK: ${result.rows.length} ISOs cargadas${result.hasGeo ? ' · con georeferencia' : ''}`)

    setTimeout(() => {
      if (!comunasReady) {
        showToast('comunas_data.js no disponible — análisis geográfico desactivado', 'err')
        return
      }
      const adjMap = getAdjMap()
      const riskR  = runRisk(result.rows, new Set(), adjMap)
      setRiskResults(riskR)
      if (result.hasGeo) {
        const confR = runConflict(result.rows)
        setConflicts(confR)
      }
    }, 200)
  }, [comunasReady, getAdjMap, parseFile, runRisk, runConflict, showToast])

  const handleGeoAnalysis = useCallback(() => {
    if (!routeData.length) { showToast('Carga un archivo primero', 'err'); return }
    if (!comunasReady)     { showToast('comunas_data.js aún no disponible', 'err'); return }
    const confR = runConflict(routeData)
    setConflicts(confR)
    showToast(`${confR.length} conflictos detectados`)
  }, [routeData, comunasReady, runConflict, showToast])

  const summaryRows = useMemo(() =>
    buildSummaryRows(conflicts, riskResults, resolvedConflicts, flaggedConflicts, resolvedRisk, flaggedRisk),
    [conflicts, riskResults, resolvedConflicts, flaggedConflicts, resolvedRisk, flaggedRisk]
  )

  const badges: Partial<Record<TabId, number>> = useMemo(() => ({
    'tab-vehiculos': routeData.length || undefined,
    'tab-mapa':      Object.values(riskResults).flatMap(v => v.results).filter(r => r.riskLevel !== 'low').length || undefined,
    'tab-geo':       conflicts.filter(c => !resolvedConflicts.has(c.iso)).length || undefined,
    'tab-resumen':   summaryRows.filter(r => r.status === 'pendiente').length || undefined,
  }), [routeData, riskResults, conflicts, resolvedConflicts, summaryRows])

  const toggleResolveConflict = useCallback((iso: string) => {
    setResolvedConflicts(prev => {
      const n = new Set(prev)
      if (n.has(iso)) { n.delete(iso) }
      else { n.add(iso); setFlaggedConflicts(f => { const ff = new Set(f); ff.delete(iso); return ff }) }
      return n
    })
  }, [])

  const toggleFlagConflict = useCallback((iso: string) => {
    setFlaggedConflicts(prev => {
      const n = new Set(prev)
      if (n.has(iso)) { n.delete(iso) }
      else { n.add(iso); setResolvedConflicts(r => { const rr = new Set(r); rr.delete(iso); return rr }) }
      return n
    })
  }, [])

  const toggleResolveRisk = useCallback((aKey: string) => {
    setResolvedRisk(prev => {
      const n = new Set(prev)
      if (n.has(aKey)) { n.delete(aKey) }
      else { n.add(aKey); setFlaggedRisk(f => { const ff = new Set(f); ff.delete(aKey); return ff }) }
      return n
    })
  }, [])

  const toggleFlagRisk = useCallback((aKey: string) => {
    setFlaggedRisk(prev => {
      const n = new Set(prev)
      if (n.has(aKey)) { n.delete(aKey) }
      else { n.add(aKey); setResolvedRisk(r => { const rr = new Set(r); rr.delete(aKey); return rr }) }
      return n
    })
  }, [])

  const handleSummaryResolve = useCallback((iso: string, aKey: string | null, tipo: string, resolve: boolean) => {
    if (tipo === 'geo' || tipo === 'ambos') {
      setResolvedConflicts(s => { const n = new Set(s); resolve ? n.add(iso) : n.delete(iso); return n })
    }
    if ((tipo === 'fuera' || tipo === 'ambos') && aKey) {
      setResolvedRisk(s => { const n = new Set(s); resolve ? n.add(aKey) : n.delete(aKey); return n })
    }
    showToast(resolve ? 'Resuelto' : 'Reabierto')
  }, [showToast])

  const handleSummaryFlag = useCallback((iso: string, aKey: string | null, tipo: string, flag: boolean) => {
    if (tipo === 'geo' || tipo === 'ambos') {
      setFlaggedConflicts(s => { const n = new Set(s); flag ? n.add(iso) : n.delete(iso); return n })
    }
    if ((tipo === 'fuera' || tipo === 'ambos') && aKey) {
      setFlaggedRisk(s => { const n = new Set(s); flag ? n.add(aKey) : n.delete(aKey); return n })
    }
    showToast(flag ? 'Alerta marcada' : 'Alerta removida')
  }, [showToast])

  return (
    <div
      className="flex flex-col h-screen overflow-hidden select-none"
      style={{ background: 'rgb(13,17,23)', color: '#e6edf3', fontFamily: '"Inter", system-ui, sans-serif' }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault(); setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
      }}
    >
      <GlassHeader activeTab={activeTab} onTabChange={setActiveTab} badges={badges} />

      {/* Drag overlay */}
      {dragging && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(0,81,186,0.15)', border: '2px dashed rgba(0,81,186,0.6)' }}>
          <div className="text-2xl font-bold text-blue-300">Suelta el archivo aquí</div>
        </div>
      )}

      {/* Upload bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 flex-shrink-0">
        <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold
                          bg-blue-500/15 text-blue-300 border border-blue-500/25 hover:bg-blue-500/25 transition-colors">
          📂 {routeData.length ? 'Cambiar archivo' : 'Cargar archivo (XLSX / CSV)'}
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.tsv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
          />
        </label>
        {parsing && <span className="text-xs text-gray-500 animate-pulse">Procesando…</span>}
        {!comunasReady && (
          <span className="text-[10px] text-orange-400 font-semibold">
            ⚠ comunas_data.js no encontrado — análisis geo desactivado
          </span>
        )}
      </div>

      {/* Tab content — all tabs stay mounted, only visibility changes.
          This prevents Leaflet maps from unmounting/remounting on tab switch. */}
      <div className="flex-1 overflow-hidden relative">

        {/* Tabs that don't have maps: animate normally */}
        <AnimatePresence mode="wait" initial={false}>
          {(activeTab === 'tab-vehiculos' || activeTab === 'tab-mapa' ||
            activeTab === 'tab-resumen' || activeTab === 'tab-export') && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.12 }}
              className="absolute inset-0"
            >
              {activeTab === 'tab-vehiculos' && (
                <TabRoutePlan
                  routeData={routeData}
                  riskResults={riskResults}
                  resolvedRisk={resolvedRisk}
                  onResolveRisk={(aKey, resolve) => {
                    setResolvedRisk(s => { const n = new Set(s); resolve ? n.add(aKey) : n.delete(aKey); return n })
                  }}
                  onOpenRouteMap={setRouteMapVeh}
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
                  onOpenRouteMap={setRouteMapVeh}
                  hasData={!!routeData.length}
                  isReady={comunasReady}
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
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* TabWrongCommune stays always mounted — Leaflet map must not unmount.
            Hidden via pointer-events+opacity when not active instead of unmounting. */}
        <div
          className="absolute inset-0"
          style={{
            opacity: activeTab === 'tab-geo' ? 1 : 0,
            pointerEvents: activeTab === 'tab-geo' ? 'auto' : 'none',
            transition: 'opacity 0.12s',
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
            hasData={!!routeData.length}
            isReady={comunasReady}
            onRunAnalysis={handleGeoAnalysis}
          />
        </div>

      </div>

      {/* Route map modal */}
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