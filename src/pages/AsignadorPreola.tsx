import { useState, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import { useTheme, getThemeColors } from '../context/ThemeContext';
import { PageShell } from '../ui/DS';
import GlassHeader, { GlassHeaderTab } from '../components/ui/GlassHeader';

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
  "9634": { maxPos: 40, maxVol: 6, lineales: ["VALPO-1", "VALPO-2", "VALPO-3", "VALPO-4", "VALPO-5"] },
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
// ─────────────────────────────────────────────────────────
function runAssignment(rows: any[], params: any) {
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
    const p = params[fac] || DEFAULT_PARAMS[fac] || {
      maxPos: 60,
      maxVol: 6,
      lineales: [`${fac}1`, `${fac}2`],
    };
    const lineales = p.lineales.length > 0 ? p.lineales : [`${fac}1`];
    const maxPos = Number(p.maxPos) || 60;
    const maxVol = Number(p.maxVol) || 6;

    // Ordenar: ROUTE_TO ASC, ID_ORDEN ASC
    const sorted = [...orders].sort((a, b) => {
      const rtA = String(a.ROUTE_TO ?? a.route_to ?? "");
      const rtB = String(b.ROUTE_TO ?? b.route_to ?? "");
      if (rtA < rtB) return -1;
      if (rtA > rtB) return 1;
      const idA = String(a.ID_ORDEN ?? a.id_orden ?? "");
      const idB = String(b.ID_ORDEN ?? b.id_orden ?? "");
      return idA < idB ? -1 : idA > idB ? 1 : 0;
    });

    const linealStats: Record<string, any> = {};
    lineales.forEach((l: string) => { linealStats[l] = { count: 0, vol: 0, overflow: false }; });

    let cumVol = 0;
    sorted.forEach((order, idx) => {
      const pos = idx + 1;
      const vol = parseFloat(order.VOLUMEN_M3 ?? order.volumen_m3 ?? 0) || 0;
      cumVol += vol;

      const byPosNum = maxPos > 0 ? Math.ceil(pos / maxPos) : 1;
      const byVolNum = maxVol > 0 && cumVol > 0 ? Math.ceil(cumVol / maxVol) : 1;
      let linealNum = Math.max(byPosNum, byVolNum); // 1-based

      const overflow = linealNum > lineales.length;
      if (linealNum > lineales.length) linealNum = lineales.length;
      if (linealNum < 1) linealNum = 1;

      const linealName = lineales[linealNum - 1];
      const orderId = String(order.ID_ORDEN ?? order.id_orden ?? "");
      assignmentMap[orderId] = linealName;
      linealStats[linealName].count++;
      linealStats[linealName].vol += vol;
      if (overflow) linealStats[linealName].overflow = true;
    });

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
        overVol: s.vol > maxVol,
        overflow: s.overflow,
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

const HEADER_TABS: GlassHeaderTab[] = [
  { id: 'params', label: 'Parámetros', icon: '⚙️', badgeVariant: 'blue' },
  { id: 'results', label: 'Resultados', icon: '📊', badgeVariant: 'green' },
]

// ─────────────────────────────────────────────────────────
//  COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────
export default function AsignadorPreola() {
  const { theme } = useTheme();
  const TC = getThemeColors(theme);

  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [colHeaders, setColHeaders] = useState<string[]>([]);
  const [params, setParams] = useState<any>(deepClone(DEFAULT_PARAMS));
  const [results, setResults] = useState<any>(null);
  const [dragging, setDragging] = useState(false);
  const [expandedFacs, setExpandedFacs] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState("params");

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

  // Lista de facilities a mostrar (detectados si hay archivo, todos los defaults si no)
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
    const result = runAssignment(rows, effectiveParams);
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
    // Sin encabezados: solo [ID_ORDEN, LINEAL]
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

  const addLineal = (fac: string) => {
    setParams((prev: any) => {
      const current = prev[fac] || defaultForFac(fac);
      const n = current.lineales.length + 1;
      return { ...prev, [fac]: { ...current, lineales: [...current.lineales, `${fac}${n}`] } };
    });
  };

  const removeLineal = (fac: string) => {
    setParams((prev: any) => {
      const current = prev[fac] || defaultForFac(fac);
      if (current.lineales.length <= 1) return prev;
      return { ...prev, [fac]: { ...current, lineales: current.lineales.slice(0, -1) } };
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
        onTabChange={(id) => setActiveTab(id)}
      />

      <div className="flex-1 overflow-hidden" style={{ background: TC.bg }}>
        <div 
          className="h-full overflow-y-auto p-5"
          style={{ fontFamily: "'IBM Plex Mono', 'Consolas', monospace" }}
        >
          {/* Omitimos su Header manual en favor de GlassHeader, pero dejamos el UI inner idéntico */}
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
              {/* Upload */}
              <div
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  dragging
                    ? "border-yellow-400 bg-yellow-400/5"
                    : "border-gray-700 hover:border-gray-500 bg-gray-900"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById("preola-file-input")?.click()}
              >
                <input
                  id="preola-file-input"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])}
                />
                <div className="text-2xl mb-2">
                  {file ? "✅" : "📂"}
                </div>
                {file ? (
                  <div>
                    <p className="text-green-400 text-xs font-bold truncate">{file.name}</p>
                    <p className="text-gray-500 text-xs mt-1">
                      {detectedFacilities.length} facilities detectados
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-300 text-sm font-semibold">Subir PREOLA</p>
                    <p className="text-gray-500 text-xs mt-1">Arrastra o haz clic · .xlsx</p>
                  </div>
                )}
              </div>

              {/* Run */}
              {rows.length > 0 && (
                <button
                  onClick={handleRun}
                  className="w-full py-3 bg-yellow-400 text-gray-900 font-bold rounded-xl hover:bg-yellow-300 transition-colors text-sm tracking-wide shadow-lg shadow-yellow-400/10"
                >
                  ▶ EJECUTAR ASIGNACIÓN
                </button>
              )}

              {/* Downloads */}
              {results && (
                <div className="space-y-2">
                  <button
                    onClick={handleDownloadPreola}
                    className="w-full py-2.5 bg-green-600/20 border border-green-600/40 text-green-400 font-semibold rounded-lg hover:bg-green-600/30 transition-colors text-xs tracking-wide"
                  >
                    ⬇ PREOLA_ASIGNADO.xlsx
                  </button>
                  <button
                    onClick={handleDownloadAsignacion}
                    className="w-full py-2.5 bg-gray-800 border border-gray-700 text-gray-300 font-semibold rounded-lg hover:bg-gray-700 transition-colors text-xs tracking-wide"
                  >
                    ⬇ preola.xlsx (sin headers)
                  </button>
                </div>
              )}

              {/* Summary stats cards */}
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
              {/* Ocultamos las pestañas nativas de ellos en favor del GlassHeader ya usado arriba, pero ruteamos la vista aquí */}
              {/* {activeTab === "..."} */}

              {/* ── TAB PARÁMETROS ── */}
              {activeTab === "params" && (
                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                    <span className="text-xs text-gray-400 tracking-widest uppercase">
                      {facilityList.length} facilities configurados
                    </span>
                    <span className="text-xs text-gray-600">
                      Click en un facility para editar
                    </span>
                  </div>
                  <div className="divide-y divide-gray-800 max-h-[520px] overflow-y-auto custom-scrollbar">
                    {facilityList.map((fac) => {
                      const p = effectiveParams[fac] || defaultForFac(fac);
                      const isOpen = expandedFacs[fac];
                      const isDetected = detectedFacilities.includes(fac);
                      return (
                        <div key={fac}>
                          {/* Row header */}
                          <button
                            onClick={() => toggleFac(fac)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/60 transition-colors group"
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`font-mono font-bold text-sm ${
                                  isDetected ? "text-yellow-400" : "text-gray-500"
                                }`}
                              >
                                {fac}
                              </span>
                              {isDetected && (
                                <span className="text-[10px] bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 px-1.5 py-0.5 rounded">
                                  EN ARCHIVO
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                {p.lineales.length} lineal{p.lineales.length !== 1 ? "es" : ""} ·{" "}
                                Max {p.maxPos} ISO · Max {p.maxVol} m³
                              </span>
                            </div>
                            <span className="text-gray-600 text-xs group-hover:text-gray-400">
                              {isOpen ? "▲" : "▼"}
                            </span>
                          </button>

                          {/* Expanded edit panel */}
                          {isOpen && (
                            <div className="px-4 pb-4 bg-gray-950/50 border-t border-gray-800">
                              <div className="grid grid-cols-2 gap-3 mt-3">
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
                              </div>

                              {/* Lineales */}
                              <div className="mt-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-500 tracking-widest uppercase">
                                    Lineales ({p.lineales.length})
                                  </span>
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={() => addLineal(fac)}
                                      className="text-[11px] bg-blue-500/10 border border-blue-500/30 text-blue-400 px-2 py-1 rounded hover:bg-blue-500/20 transition-colors"
                                    >
                                      + Agregar
                                    </button>
                                    <button
                                      onClick={() => removeLineal(fac)}
                                      className="text-[11px] bg-red-500/10 border border-red-500/30 text-red-400 px-2 py-1 rounded hover:bg-red-500/20 transition-colors"
                                    >
                                      − Eliminar
                                    </button>
                                    <button
                                      onClick={() => resetFac(fac)}
                                      className="text-[11px] bg-gray-700/50 border border-gray-700 text-gray-400 px-2 py-1 rounded hover:bg-gray-700 transition-colors"
                                    >
                                      ↺ Reset
                                    </button>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {p.lineales.map((l: string, i: number) => (
                                    <div key={i} className="flex flex-col items-center gap-0.5">
                                      <span className="text-[9px] text-gray-600">L{i + 1}</span>
                                      <input
                                        value={l}
                                        onChange={(e) => updateLinealName(fac, i, e.target.value)}
                                        className="border border-gray-700 bg-gray-900 rounded px-2 py-1.5 text-xs font-mono w-20 text-center focus:outline-none focus:border-yellow-400/60 focus:ring-1 focus:ring-yellow-400/20 text-gray-200"
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
                </div>
              )}

              {/* ── TAB RESULTADOS ── */}
              {activeTab === "results" && results && (
                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-800">
                    <span className="text-xs text-gray-400 tracking-widest uppercase">
                      Resumen por Lineal
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-[520px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-950 border-b border-gray-800">
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
                </div>
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
  const colors: Record<string, string> = {
    yellow: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
    blue:   "text-blue-400   border-blue-400/20   bg-blue-400/5",
    green:  "text-green-400  border-green-400/20  bg-green-400/5",
    red:    "text-red-400    border-red-400/20    bg-red-400/5",
  };
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${colors[color] || colors.yellow}`}>
      <div className={`text-lg font-bold font-mono ${colors[color]?.split(" ")[0]}`}>
        {value}
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">{label}</div>
    </div>
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
        className="w-full border border-gray-700 bg-gray-900 rounded-lg px-3 py-1.5 text-sm font-mono text-gray-200 focus:outline-none focus:border-yellow-400/60 focus:ring-1 focus:ring-yellow-400/20"
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
          className={`h-full rounded-full transition-all ${ over ? "bg-red-500" : pct > 80 ? "bg-yellow-400" : "bg-green-500" }`}
        />
      </div>
      <span className={`text-[10px] font-mono w-8 text-right ${over ? "text-red-400" : "text-gray-500"}`}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}
