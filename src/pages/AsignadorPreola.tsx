import { useState, useCallback, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { useTheme, getThemeColors } from '../context/ThemeContext';
import GlassHeader, { GlassHeaderTab } from '../components/ui/GlassHeader';
import { PageShell, Card, Btn, T, C } from '../ui/DS';

// ─────────────────────────────────────────────────────────
//  PARÁMETROS POR DEFECTO (basados en lineales_config SQL)
// ─────────────────────────────────────────────────────────
const DEFAULT_PARAMS: Record<string, any> = {
  "150":  { maxPos: 60, maxVol: 6, lineales: ["1501", "1502"] },
  "594":  { maxPos: 60, maxVol: 8, lineales: ["5941", "5942"] },
  "636":  { maxPos: 60, maxVol: 8, lineales: ["6361", "6362"] },
  "7017": { maxPos: 60, maxVol: 6, lineales: ["70171", "70172"] },
  "7030": { maxPos: 60, maxVol: 6, lineales: ["70301", "70302"] },
  "9625": { maxPos: 60, maxVol: 6, lineales: ["96251", "96252"] },
  "9626": { maxPos: 60, maxVol: 6, lineales: ["96261", "96262"] },
  "9628": { maxPos: 60, maxVol: 6, lineales: ["96281", "96282"] },
  "9629": { maxPos: 60, maxVol: 6, lineales: ["96291", "96292"] },
  "9630": { maxPos: 60, maxVol: 6, lineales: ["96301", "96302"] },
  "9631": { maxPos: 60, maxVol: 6, lineales: ["96311", "96312"] },
  "9632": { maxPos: 60, maxVol: 6, lineales: ["96321", "96322"] },
  "9633": { maxPos: 60, maxVol: 6, lineales: ["96331", "96332"] },
  "9634": { maxPos: 40, maxVol: 6, lineales: ["VAL1", "VAL2", "VAL3", "VAL4", "VAL5"] },
  "9764": { maxPos: 60, maxVol: 6, lineales: ["97641", "97642"] },
  "9765": { maxPos: 60, maxVol: 6, lineales: ["97651", "97652"] },
  "9767": { maxPos: 60, maxVol: 6, lineales: ["97671", "97672"] },
  "9839": { maxPos: 60, maxVol: 6, lineales: ["98391", "98392"] },
  "9898": { maxPos: 60, maxVol: 6, lineales: ["CLEXP"] },
  "9919": { maxPos: 60, maxVol: 6, lineales: ["99191", "99192"] },
  "9982": { maxPos: 60, maxVol: 6, lineales: ["99821", "99822"] },
  "9987": { maxPos: 60, maxVol: 6, lineales: ["99871", "99872"] },
  "9988": { maxPos: 60, maxVol: 6, lineales: ["99881", "99882"] },
  "9989": { maxPos: 60, maxVol: 6, lineales: ["99891", "99892"] },
};

// ─────────────────────────────────────────────────────────
//  ALGORITMO DE ASIGNACIÓN
//  Modo: "maxISOs" → ordena vol ASC para meter más órdenes
//        "maxM3"   → ordena vol DESC para maximizar m³
//  Overflow: greedy de mínimo m³ acumulado (balanceo real)
// ─────────────────────────────────────────────────────────
function runAssignment(rows: any[], params: any, mode: "maxISOs" | "maxM3") {
  // Agrupar por FACILITY
  const byFacility: Record<string, any[]> = {};
  rows.forEach((row) => {
    const fac = String(row.FACILITY ?? row.facility ?? "").trim();
    if (!fac) return;
    if (!byFacility[fac]) byFacility[fac] = [];
    byFacility[fac].push(row);
  });

  const assignmentMap: Record<string, string> = {};
  const summaryData: any[] = [];

  Object.entries(byFacility).forEach(([fac, orders]) => {
    const p = params[fac] || DEFAULT_PARAMS[fac] || {};
    const lineales: string[] = p.lineales && p.lineales.length > 0 ? p.lineales : [`${fac}1`];
    const maxPos = Number(p.maxPos) || 60;
    const maxVol = Number(p.maxVol) || 6;
    const N = lineales.length;

    // ── Fase 1: ordenar según modo ─────────────────────
    // Base: ROUTE_TO ASC, ID_ORDEN ASC (mantiene agrupación de rutas)
    // Luego dentro de cada "slot" se prioriza por volumen según modo.
    const sorted = [...orders].sort((a, b) => {
      const rtA = String(a.ROUTE_TO ?? a.route_to ?? "");
      const rtB = String(b.ROUTE_TO ?? b.route_to ?? "");
      if (rtA < rtB) return -1;
      if (rtA > rtB) return 1;
      // Dentro de la misma ruta, ordenar por volumen según modo
      const volA = parseFloat(a.VOLUMEN_M3 ?? a.volumen_m3 ?? 0) || 0;
      const volB = parseFloat(b.VOLUMEN_M3 ?? b.volumen_m3 ?? 0) || 0;
      if (mode === "maxISOs") return volA - volB; // volumen ASC → caben más órdenes pequeñas
      if (mode === "maxM3")   return volB - volA; // volumen DESC → maximizar m³ usados
      return 0;
    });

    // ── Inicializar stats por lineal ───────────────────
    const linealStats: Record<string, { count: number; vol: number; overflow: boolean }> = {};
    lineales.forEach((l: string) => { linealStats[l] = { count: 0, vol: 0, overflow: false }; });

    // ── Fase 2: asignación secuencial (llenado lineal) ─
    let currentIdx = 0;
    const overflowOrders: { order: any; vol: number; orderId: string }[] = [];

    for (const order of sorted) {
      const vol = parseFloat(order.VOLUMEN_M3 ?? order.volumen_m3 ?? 0) || 0;
      const orderId = String(order.ID_ORDEN ?? order.id_orden ?? "");
      let assigned = false;

      // Intentar desde el lineal actual hacia adelante
      while (currentIdx < N) {
        const lName = lineales[currentIdx];
        const st = linealStats[lName];
        const fits = (st.count + 1) <= maxPos && (st.vol + vol) <= maxVol + 0.0001;
        if (fits) {
          assignmentMap[orderId] = lName;
          st.count++;
          st.vol += vol;
          assigned = true;
          break;
        } else {
          // Lineal lleno → avanzar
          currentIdx++;
        }
      }

      if (!assigned) {
        overflowOrders.push({ order, vol, orderId });
      }
    }

    // ── Fase 3: Overflow balanceado por m³ (greedy) ───
    // Asignar cada orden overflow al lineal con MENOS m³ en ese momento.
    // Esto garantiza que al terminar, todos los lineales tengan m³ similares.
    if (overflowOrders.length > 0) {
      overflowOrders.forEach(({ vol, orderId }) => {
        // Encontrar lineal con menor m³ acumulado
        let minVol = Infinity;
        let minIdx = 0;
        for (let i = 0; i < N; i++) {
          const st = linealStats[lineales[i]];
          if (st.vol < minVol) {
            minVol = st.vol;
            minIdx = i;
          }
        }
        const lName = lineales[minIdx];
        const st = linealStats[lName];
        assignmentMap[orderId] = lName;
        st.count++;
        st.vol += vol;
        st.overflow = true;
      });
    }

    // ── Construir summary ──────────────────────────────
    lineales.forEach((l: string) => {
      const s = linealStats[l];
      summaryData.push({
        facility: fac,
        lineal: l,
        isos: s.count,
        vol: s.vol,
        maxPos,
        maxVol,
        overPos: s.count > maxPos,
        overVol: s.vol > maxVol + 0.0001,
        overflow: s.overflow || s.count > maxPos || s.vol > maxVol + 0.0001,
      });
    });
  });

  return { assignmentMap, summaryData };
}

// ─────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────
function deepClone(obj: any) {
  return JSON.parse(JSON.stringify(obj));
}

function defaultForFac(fac: string) {
  return DEFAULT_PARAMS[fac]
    ? deepClone(DEFAULT_PARAMS[fac])
    : { maxPos: 60, maxVol: 6, lineales: [`${fac}1`, `${fac}2`] };
}

/** Genera un array de nombres de lineales detectando el prefijo del patrón existente */
function generateLinealNames(fac: string, count: number, existing: string[]): string[] {
  // Detectar prefijo desde los nombres existentes (ej: "VAL" de "VAL1", "VAL5")
  let autoPrefix = fac;
  if (existing.length > 0) {
    const lastName = existing[existing.length - 1];
    const match = lastName.match(/^(.*?)(\d+)$/);
    if (match) autoPrefix = match[1]; // ej: "VAL" de "VAL5"
  }

  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    // Preservar nombre custom si ya existía, si no, generar con el prefijo detectado
    names.push(existing[i] !== undefined ? existing[i] : `${autoPrefix}${i + 1}`);
  }
  return names;
}

const HEADER_TABS: GlassHeaderTab[] = [
  { id: 'params', label: 'Parámetros', icon: '⚙️', badgeVariant: 'blue' },
  { id: 'results', label: 'Resultados', icon: '📊', badgeVariant: 'green' },
];

// ─────────────────────────────────────────────────────────
//  COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────
export default function AsignadorPreola() {
  const { theme } = useTheme();
  const TC = getThemeColors(theme);

  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [colHeaders, setColHeaders] = useState<string[]>([]);
  const [params, setParams] = useState<any>(() => {
    try {
      const c = localStorage.getItem("preola_params_v5");
      return c ? JSON.parse(c) : deepClone(DEFAULT_PARAMS);
    } catch { return deepClone(DEFAULT_PARAMS); }
  });
  const [results, setResults] = useState<any>(null);
  const [dragging, setDragging] = useState(false);
  const [expandedFacs, setExpandedFacs] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"params" | "results">("params");

  // Único parámetro global de optimización
  const [globalMode, setGlobalMode] = useState<"maxISOs" | "maxM3">(
    () => (localStorage.getItem("preola_mode") as "maxISOs" | "maxM3") || "maxISOs"
  );

  useEffect(() => { localStorage.setItem("preola_params_v5", JSON.stringify(params)); }, [params]);
  useEffect(() => { localStorage.setItem("preola_mode", globalMode); }, [globalMode]);

  // Facilities presentes en el archivo cargado
  const detectedFacilities = useMemo(() => {
    if (!rows.length) return [];
    const facs = [
      ...new Set(
        rows.map((r) => String(r.FACILITY ?? r.facility ?? "").trim()).filter(Boolean)
      ),
    ];
    return facs.sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  }, [rows]);

  // Params efectivos: merge estado editable con defaults para facs detectados
  const effectiveParams = useMemo(() => {
    const p = deepClone(params);
    detectedFacilities.forEach((fac) => {
      if (!p[fac]) p[fac] = defaultForFac(fac);
    });
    return p;
  }, [params, detectedFacilities]);

  // Lista de facilities a mostrar
  const facilityList = detectedFacilities.length > 0
    ? detectedFacilities
    : Object.keys(DEFAULT_PARAMS).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));

  // ── Parse Excel ──────────────────────────────────────────
  const parseFile = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
      if (json.length > 0) {
        setColHeaders(Object.keys(json[0]));
        setRows(json);
        setResults(null);
        setActiveTab("params");
      }
    };
    reader.readAsArrayBuffer(f);
    setFile(f);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) parseFile(f);
    },
    [parseFile]
  );

  // ── Ejecución ────────────────────────────────────────────
  const handleRun = () => {
    const result = runAssignment(rows, effectiveParams, globalMode);
    setResults(result);
    setActiveTab("results");
  };

  // ── Descargas ────────────────────────────────────────────
  const handleDownloadPreola = () => {
    if (!results) return;
    const updated = rows.map((row) => {
      const id = String(row.ID_ORDEN ?? row.id_orden ?? "");
      const asignado = results.assignmentMap[id];
      return { ...row, ROUTE_TO: asignado !== undefined ? asignado : row.ROUTE_TO };
    });
    const ws = XLSX.utils.json_to_sheet(updated, { header: colHeaders });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Página1_1");
    XLSX.writeFile(wb, "PREOLA_ASIGNADO.xlsx");
  };

  const handleDownloadAsignacion = () => {
    if (!results) return;
    const aoa = Object.entries(results.assignmentMap).map(([id, lineal]) => [id, lineal]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "preola.xlsx");
  };

  // ── Edición de parámetros ────────────────────────────────
  const updateParam = (fac: string, field: string, value: any) => {
    setParams((prev: any) => {
      const current = prev[fac] || defaultForFac(fac);
      return { ...prev, [fac]: { ...current, [field]: value } };
    });
  };

  const updateLinealName = (fac: string, idx: number, value: string) => {
    setParams((prev: any) => {
      const current = prev[fac] || defaultForFac(fac);
      const lineales = [...current.lineales];
      lineales[idx] = value;
      return { ...prev, [fac]: { ...current, lineales } };
    });
  };

  /** Cambia la CANTIDAD de lineales regenerando el array */
  const updateLinealCount = (fac: string, count: number) => {
    if (count < 1 || count > 20) return;
    setParams((prev: any) => {
      const current = prev[fac] || defaultForFac(fac);
      const newLineales = generateLinealNames(fac, count, current.lineales);
      return { ...prev, [fac]: { ...current, lineales: newLineales } };
    });
  };

  /** Cambia el PREFIJO de todos los lineales del facility en masa */
  const updatePrefix = (fac: string, prefix: string) => {
    if (!prefix.trim()) return;
    setParams((prev: any) => {
      const current = prev[fac] || defaultForFac(fac);
      const newLineales = current.lineales.map((_: string, i: number) => `${prefix.trim()}${i + 1}`);
      return { ...prev, [fac]: { ...current, lineales: newLineales } };
    });
  };

  const resetFac = (fac: string) => {
    setParams((prev: any) => ({ ...prev, [fac]: defaultForFac(fac) }));
  };

  const toggleFac = (fac: string) =>
    setExpandedFacs((prev) => ({ ...prev, [fac]: !prev[fac] }));

  // ── Métricas del resumen ─────────────────────────────────
  const summaryStats = useMemo(() => {
    if (!results) return null;
    const total = Object.keys(results.assignmentMap).length;
    const overflows = results.summaryData.filter((r: any) => r.overflow || r.overPos || r.overVol).length;
    const activeLineales = results.summaryData.filter((r: any) => r.isos > 0).length;
    return { total, overflows, activeLineales };
  }, [results]);

  // ────────────────────────────────────────────────────────
  //  RENDER
  // ────────────────────────────────────────────────────────
  return (
    <PageShell>
      <GlassHeader
        appName="Asignador PREOLA"
        icon="📦"
        tabs={HEADER_TABS}
        activeTab={activeTab}
        onTabChange={(id: string) => setActiveTab(id as "params" | "results")}
        badges={{
          params: detectedFacilities.length || 0,
          results: (results && results.summaryData) ? results.summaryData.filter((r: any) => r.isos > 0).length : 0
        }}
        severities={{
          results: (results && results.summaryData.some((r: any) => r.overflow)) ? 'high' : 'none'
        }}
      />

      <div className="flex-1 overflow-hidden" style={{ background: TC.bg }}>
        <div
          className="h-full overflow-y-auto p-5"
          style={{ fontFamily: "'IBM Plex Mono', 'Consolas', monospace" }}
        >
          {file && (
            <div className="text-right mb-4">
              <div className="text-xs text-gray-400">{file.name}</div>
              <div className="text-xs text-yellow-400 font-bold">
                {rows.length.toLocaleString()} órdenes
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
            {/* ── COLUMNA IZQUIERDA ── */}
            <div className="xl:col-span-1 space-y-4">
              {/* Upload Card */}
              <Card
                onClick={() => document.getElementById("preola-file-input")?.click()}
                style={{
                  padding: '24px', textAlign: 'center', cursor: 'pointer',
                  border: dragging ? `2px dashed ${C.blue}` : `1px dashed ${C.border}`,
                  background: dragging ? 'rgba(56,139,253,0.05)' : undefined,
                  transition: 'all 0.2s'
                }}
                onDragOver={(e: any) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <input
                  id="preola-file-input"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])}
                />
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>
                  {file ? "✅" : "📂"}
                </div>
                {file ? (
                  <div>
                    <p style={{ color: C.green, fontSize: T.xs, fontWeight: 900, wordBreak: 'break-all' }}>{file.name}</p>
                    <p style={{ color: C.textMuted, fontSize: '10px', marginTop: '4px', textTransform: 'uppercase' }}>
                      {detectedFacilities.length} facilities detectados
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={{ color: C.text, fontSize: T.base, fontWeight: 800 }}>Subir PREOLA</p>
                    <p style={{ color: C.textFaint, fontSize: '11px', marginTop: '4px' }}>Arrastra o haz clic · .xlsx</p>
                  </div>
                )}
              </Card>

              {/* Run */}
              {rows.length > 0 && (
                <Btn
                  variant="primary"
                  onClick={handleRun}
                  style={{
                    width: '100%', padding: '14px', fontSize: '14px', fontWeight: 900,
                    background: 'linear-gradient(135deg, #ffda1a, #e6c200)',
                    color: '#000',
                    boxShadow: '0 8px 24px rgba(255, 218, 26, 0.2)'
                  }}
                >
                  ▶ EJECUTAR ASIGNACIÓN
                </Btn>
              )}

              {/* Downloads */}
              {results && (
                <div className="space-y-2">
                  <Btn
                    variant="ghost"
                    onClick={handleDownloadPreola}
                    style={{ width: '100%', borderColor: C.green, color: C.green, fontSize: '12px', fontWeight: 'bold' }}
                  >
                    ⬇ PREOLA_ASIGNADO.xlsx
                  </Btn>
                  <Btn
                    variant="ghost"
                    onClick={handleDownloadAsignacion}
                    style={{ width: '100%', fontSize: '12px', fontWeight: 'bold' }}
                  >
                    ⬇ preola.xlsx (sin headers)
                  </Btn>
                </div>
              )}

              {/* Summary stats */}
              {summaryStats && (
                <div className="space-y-2">
                  <StatCard label="Órdenes asignadas" value={summaryStats.total} color="yellow" />
                  <StatCard label="Lineales activos" value={summaryStats.activeLineales} color="blue" />
                  <StatCard
                    label="Lineales con overflow"
                    value={summaryStats.overflows}
                    color={summaryStats.overflows > 0 ? "red" : "green"}
                  />
                </div>
              )}
            </div>

            {/* ── COLUMNA DERECHA ── */}
            <div className="xl:col-span-3 space-y-4">

              {/* ── TAB PARÁMETROS ── */}
              {activeTab === "params" && (
                <>
                  {/* Selector único de modo */}
                  <Card style={{ marginBottom: '16px', padding: '16px' }}>
                    <div style={{ color: TC.textFaint, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 'bold' }}>
                      Estrategia de Optimización
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Botón Maximizar ISOs */}
                      <button
                        onClick={() => setGlobalMode("maxISOs")}
                        style={{
                          padding: '14px 12px',
                          borderRadius: '8px',
                          border: globalMode === "maxISOs"
                            ? `2px solid ${C.blue}`
                            : `1px solid ${TC.borderSoft}`,
                          background: globalMode === "maxISOs"
                            ? `${C.blue}15`
                            : TC.bgCard,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ fontSize: '18px', marginBottom: '4px' }}>📦</div>
                        <div style={{ fontWeight: 'bold', fontSize: '12px', color: globalMode === "maxISOs" ? C.blue : TC.text }}>
                          Maximizar ISOs
                        </div>
                        <div style={{ fontSize: '10px', color: TC.textFaint, marginTop: '2px', lineHeight: '1.4' }}>
                          Órdenes pequeñas primero. Llena la mayor cantidad de ISOs posibles.
                        </div>
                      </button>

                      {/* Botón Maximizar m³ */}
                      <button
                        onClick={() => setGlobalMode("maxM3")}
                        style={{
                          padding: '14px 12px',
                          borderRadius: '8px',
                          border: globalMode === "maxM3"
                            ? `2px solid ${C.orange}`
                            : `1px solid ${TC.borderSoft}`,
                          background: globalMode === "maxM3"
                            ? `${C.orange}15`
                            : TC.bgCard,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ fontSize: '18px', marginBottom: '4px' }}>📐</div>
                        <div style={{ fontWeight: 'bold', fontSize: '12px', color: globalMode === "maxM3" ? C.orange : TC.text }}>
                          Maximizar m³
                        </div>
                        <div style={{ fontSize: '10px', color: TC.textFaint, marginTop: '2px', lineHeight: '1.4' }}>
                          Órdenes grandes primero. Aprovecha el volumen total disponible.
                        </div>
                      </button>
                    </div>

                    {/* Nota sobre overflow */}
                    <div style={{
                      marginTop: '12px', padding: '8px 12px', borderRadius: '6px',
                      background: 'rgba(227,179,65,0.08)', border: '1px solid rgba(227,179,65,0.25)',
                      fontSize: '10px', color: TC.textMuted, lineHeight: '1.5'
                    }}>
                      ⚡ <strong>Overflow automático:</strong> cuando los lineales se llenan, los excedentes se distribuyen entre todos los lineales del facility priorizando el de menor m³ acumulado — garantizando un balance justo.
                    </div>
                  </Card>

                  {/* Lista de facilities */}
                  <Card style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${TC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: TC.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        {facilityList.length} facilities configurados
                      </span>
                      <span style={{ fontSize: '12px', color: TC.textFaint }}>
                        Click en un facility para editar
                      </span>
                    </div>
                    <div className="divide-y max-h-[520px] overflow-y-auto custom-scrollbar" style={{ borderColor: TC.border }}>
                      {facilityList.map((fac) => {
                        const p = effectiveParams[fac] || defaultForFac(fac);
                        const isOpen = expandedFacs[fac];
                        const isDetected = detectedFacilities.includes(fac);
                        const linealCount = p.lineales.length;

                        return (
                          <div key={fac}>
                            {/* Row header */}
                            <button
                              onClick={() => toggleFac(fac)}
                              style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.2s', borderBottom: `1px solid ${TC.border}` }}
                              onMouseOver={(e) => e.currentTarget.style.background = TC.bgHover}
                              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <div className="flex items-center gap-3">
                                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px', color: isDetected ? C.orange : TC.textMuted }}>
                                  {fac}
                                </span>
                                {isDetected && (
                                  <span style={{ fontSize: '10px', background: `${C.orange}20`, color: C.orange, border: `1px solid ${C.orange}40`, padding: '2px 6px', borderRadius: '4px' }}>
                                    EN ARCHIVO
                                  </span>
                                )}
                                {/* Pill de lineales con nombre del facility + número */}
                                <div className="flex gap-1">
                                  {p.lineales.map((_l: string, li: number) => (
                                    <span
                                      key={li}
                                      style={{
                                        fontSize: '9px', fontFamily: 'monospace',
                                        background: `${C.blue}15`, color: C.blue,
                                        border: `1px solid ${C.blue}30`,
                                        padding: '1px 5px', borderRadius: '3px'
                                      }}
                                    >
                                      {fac} {li + 1}
                                    </span>
                                  ))}
                                </div>
                                <span style={{ fontSize: '12px', color: TC.textFaint }}>
                                  Max {p.maxPos} ISO · Max {p.maxVol} m³
                                </span>
                              </div>
                              <span style={{ color: TC.textFaint, fontSize: '12px' }}>
                                {isOpen ? "▲" : "▼"}
                              </span>
                            </button>

                            {/* Expanded edit panel */}
                            {isOpen && (
                              <div style={{ padding: '0 16px 16px 16px', background: TC.bgCardAlt, borderBottom: `1px solid ${TC.border}` }}>
                                <div className="grid grid-cols-3 gap-3 mt-3">
                                  <ParamInput
                                    label="Max ISOs por lineal"
                                    value={p.maxPos}
                                    type="number"
                                    onChange={(v: any) => updateParam(fac, "maxPos", Number(v))}
                                  />
                                  <ParamInput
                                    label="Max Volumen m³ por lineal"
                                    value={p.maxVol}
                                    type="number"
                                    step="0.1"
                                    onChange={(v: any) => updateParam(fac, "maxVol", Number(v))}
                                  />
                                  {/* Nuevo: cantidad de lineales */}
                                  <div>
                                    <label className="text-[10px] text-gray-500 block mb-1 tracking-wider uppercase">
                                      Cantidad de lineales
                                    </label>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => updateLinealCount(fac, linealCount - 1)}
                                        disabled={linealCount <= 1}
                                        style={{
                                          width: '28px', height: '32px', borderRadius: '6px',
                                          border: `1px solid ${TC.borderSoft}`,
                                          background: linealCount <= 1 ? TC.bgCardAlt : `${C.red}20`,
                                          color: linealCount <= 1 ? TC.textFaint : C.red,
                                          cursor: linealCount <= 1 ? 'not-allowed' : 'pointer',
                                          fontSize: '16px', fontWeight: 'bold',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          flexShrink: 0
                                        }}
                                      >−</button>
                                      <input
                                        type="number"
                                        min={1}
                                        max={20}
                                        value={linealCount}
                                        onChange={(e) => updateLinealCount(fac, Number(e.target.value))}
                                        style={{
                                          width: '44px', textAlign: 'center',
                                          border: `1px solid ${TC.borderSoft}`, background: TC.bgCard,
                                          borderRadius: '6px', padding: '4px 6px',
                                          fontSize: '14px', fontFamily: 'monospace',
                                          color: TC.text, fontWeight: 'bold', outline: 'none'
                                        }}
                                      />
                                      <button
                                        onClick={() => updateLinealCount(fac, linealCount + 1)}
                                        disabled={linealCount >= 20}
                                        style={{
                                          width: '28px', height: '32px', borderRadius: '6px',
                                          border: `1px solid ${TC.borderSoft}`,
                                          background: linealCount >= 20 ? TC.bgCardAlt : `${C.blue}20`,
                                          color: linealCount >= 20 ? TC.textFaint : C.blue,
                                          cursor: linealCount >= 20 ? 'not-allowed' : 'pointer',
                                          fontSize: '16px', fontWeight: 'bold',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          flexShrink: 0
                                        }}
                                      >+</button>
                                    </div>
                                  </div>
                                </div>

                                {/* Prefijo global + lineales individuales */}
                                <div className="mt-4">
                                  {/* Prefijo */}
                                  <div className="flex items-center gap-3 mb-3">
                                    <div style={{ flex: '0 0 auto' }}>
                                      <label className="text-[10px] text-gray-500 block mb-1 tracking-wider uppercase">
                                        Prefijo de lineales
                                      </label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="text"
                                          defaultValue={(() => {
                                            const first = p.lineales[0] || '';
                                            const m = first.match(/^(.*?)(\d+)$/);
                                            return m ? m[1] : fac;
                                          })()}
                                          onBlur={(e) => updatePrefix(fac, e.target.value)}
                                          onKeyDown={(e) => { if (e.key === 'Enter') { updatePrefix(fac, (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).blur(); } }}
                                          placeholder={fac}
                                          style={{
                                            width: '72px', border: `1px solid ${TC.borderSoft}`,
                                            background: TC.bgCard, borderRadius: '6px',
                                            padding: '4px 8px', fontSize: '13px',
                                            fontFamily: 'monospace', fontWeight: 'bold',
                                            color: C.orange, outline: 'none', textAlign: 'center'
                                          }}
                                        />
                                        <span style={{ fontSize: '10px', color: TC.textFaint }}>+ N</span>
                                        <button
                                          onClick={(e) => {
                                            const inp = (e.currentTarget.closest('div')!.querySelector('input') as HTMLInputElement);
                                            updatePrefix(fac, inp.value);
                                          }}
                                          style={{
                                            fontSize: '10px', background: `${C.orange}20`,
                                            border: `1px solid ${C.orange}40`, color: C.orange,
                                            padding: '3px 8px', borderRadius: '4px', cursor: 'pointer'
                                          }}
                                        >
                                          Aplicar
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between mb-2">
                                    <span style={{ fontSize: '10px', color: TC.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                      Nombres de Lineales
                                    </span>
                                    <button
                                      onClick={() => resetFac(fac)}
                                      style={{ fontSize: '11px', background: `${TC.textFaint}20`, border: `1px solid ${TC.textFaint}40`, color: TC.textFaint, padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                      ↺ Reset
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {p.lineales.map((l: string, i: number) => (
                                      <div key={i} className="flex flex-col items-center gap-0.5">
                                        {/* Etiqueta estilo "FACILITY N" */}
                                        <span style={{
                                          fontSize: '9px', color: C.blue,
                                          fontFamily: 'monospace', fontWeight: 'bold',
                                          background: `${C.blue}15`, padding: '1px 5px',
                                          borderRadius: '3px', letterSpacing: '0.05em'
                                        }}>
                                          {fac} {i + 1}
                                        </span>
                                        <input
                                          value={l}
                                          onChange={(e) => updateLinealName(fac, i, e.target.value)}
                                          style={{
                                            border: `1px solid ${TC.borderSoft}`, background: TC.bgCard,
                                            borderRadius: '4px', padding: '4px 8px',
                                            fontSize: '12px', fontFamily: 'monospace',
                                            width: '80px', textAlign: 'center',
                                            color: TC.text, outline: 'none'
                                          }}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </>
              )}

              {/* ── TAB RESULTADOS ── */}
              {activeTab === "results" && results && (
                <Card style={{ padding: 0 }}>
                  <div className="px-4 py-3 border-b border-gray-800/50 background-white/5 backdrop-blur-md flex items-center justify-between">
                    <span className="text-xs text-gray-400 tracking-widest uppercase font-bold">
                      Resumen por Lineal
                    </span>
                    <span style={{
                      fontSize: '10px', padding: '2px 8px', borderRadius: '4px',
                      background: globalMode === "maxISOs" ? `${C.blue}20` : `${C.orange}20`,
                      color: globalMode === "maxISOs" ? C.blue : C.orange,
                      border: `1px solid ${globalMode === "maxISOs" ? C.blue : C.orange}40`,
                      fontWeight: 'bold'
                    }}>
                      {globalMode === "maxISOs" ? "📦 Modo: Maximizar ISOs" : "📐 Modo: Maximizar m³"}
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-[520px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white/5 backdrop-blur-md border-b border-gray-800/50">
                        <tr>
                          {["Facility", "Lineal", "ISOs", "Máx ISO", "Vol m³", "Máx Vol", "Ocup. ISO", "Ocup. Vol", "Estado"].map((h) => (
                            <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-500 tracking-widest uppercase text-[10px] whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/50">
                        {results.summaryData
                          .filter((r: any) => r.isos > 0)
                          .map((row: any, i: number) => {
                            const pctPos = Math.min((row.isos / row.maxPos) * 100, 100);
                            const pctVol = Math.min((row.vol / row.maxVol) * 100, 100);
                            const hasIssue = row.overPos || row.overVol;
                            return (
                              <tr
                                key={i}
                                className={hasIssue ? "bg-red-950/30" : "hover:bg-gray-800/30 transition-colors"}
                              >
                                <td className="px-3 py-2.5 font-mono font-bold text-yellow-400">{row.facility}</td>
                                <td className="px-3 py-2.5 font-mono text-gray-200 font-semibold">{row.lineal}</td>
                                <td className={`px-3 py-2.5 font-bold ${row.overPos ? "text-red-400" : "text-white"}`}>
                                  {row.isos}
                                </td>
                                <td className="px-3 py-2.5 text-gray-600">{row.maxPos}</td>
                                <td className={`px-3 py-2.5 font-bold ${row.overVol ? "text-red-400" : "text-white"}`}>
                                  {row.vol.toFixed(3)}
                                </td>
                                <td className="px-3 py-2.5 text-gray-600">{row.maxVol}</td>
                                <td className="px-3 py-2.5 w-24">
                                  <MiniBar pct={pctPos} over={row.overPos} />
                                </td>
                                <td className="px-3 py-2.5 w-24">
                                  <MiniBar pct={pctVol} over={row.overVol} />
                                </td>
                                <td className="px-3 py-2.5">
                                  {hasIssue ? (
                                    <span className="bg-red-500/10 border border-red-500/30 text-red-400 px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap">
                                      ⚠ Overflow
                                    </span>
                                  ) : (
                                    <span className="bg-green-500/10 border border-green-500/30 text-green-400 px-2 py-0.5 rounded-full text-[10px]">
                                      ✓ OK
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

// ─────────────────────────────────────────────────────────
//  SUB-COMPONENTES
// ─────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string, value: string | number, color: string }) {
  const colorMap: Record<string, string> = {
    yellow: '#e3b341',
    blue:   C.blue,
    green:  C.green,
    red:    C.red,
  };
  const clr = colorMap[color] || C.text;
  return (
    <Card style={{ padding: '10px 14px', border: `1px solid ${clr}30` }}>
      <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', color: clr }}>
        {value}
      </div>
      <div style={{ fontSize: '10px', color: 'rgba(156,163,175,1)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {label}
      </div>
    </Card>
  );
}

function ParamInput({ label, value, type = "text", step, onChange }: any) {
  return (
    <div>
      <label className="text-[10px] text-gray-500 block mb-1 tracking-wider uppercase">
        {label}
      </label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-white/10 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-1.5 text-sm font-mono text-gray-200 focus:outline-none focus:border-yellow-400/60 focus:ring-1 focus:ring-yellow-400/20 transition-all"
      />
    </div>
  );
}

function MiniBar({ pct, over }: { pct: number, over: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
        <div
          style={{ width: `${Math.min(pct, 100)}%` }}
          className={`h-full rounded-full transition-all ${over ? "bg-red-500" : pct > 80 ? "bg-yellow-400" : "bg-green-500"}`}
        />
      </div>
      <span className={`text-[10px] font-mono w-8 text-right ${over ? "text-red-400" : "text-gray-500"}`}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}
