import React from 'react'

interface ProjectRow {
  ISO: string;
  DIRECCIÓN: string;
  VEHÍCULO?: string;
  _tipo: 'uno' | 'dos';
  [key: string]: any;
}

interface TabProjectsProps {
  proyectosData: ProjectRow[];
  TC: any;
}

const TabProjects: React.FC<TabProjectsProps> = ({ proyectosData, TC }) => {
  if (!proyectosData.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
        <div className="text-4xl">🏗️</div>
        <p className="text-sm">Carga el archivo de Proyectos en la pestaña "Cargar".</p>
      </div>
    )
  }

  const isDos = proyectosData[0]?._tipo === 'dos';
  const displayRows = proyectosData.filter(r => {
    const iso = (r.ISO || "").trim().toUpperCase();
    return iso !== 'INICIO' && iso !== 'FIN';
  });

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: TC.text }}>
          <span className="text-blue-400">🏗️</span> Proyectos Leslie
        </h3>
        <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400">
          {displayRows.length} Órdenes
        </div>
      </div>

      <div className="flex-1 overflow-auto border rounded-lg" style={{ borderColor: TC.borderSoft }}>
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10" style={{ background: TC.surface3 }}>
            <tr>
              {isDos && <th className="p-2 text-[10px] font-bold uppercase tracking-wider border-b" style={{ color: TC.textFaint, borderColor: TC.borderSoft }}>Vehículo</th>}
              <th className="p-2 text-[10px] font-bold uppercase tracking-wider border-b" style={{ color: TC.textFaint, borderColor: TC.borderSoft }}>ISO</th>
              <th className="p-2 text-[10px] font-bold uppercase tracking-wider border-b" style={{ color: TC.textFaint, borderColor: TC.borderSoft }}>Dirección</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: `1px solid ${TC.borderSoft}` }}>
                {isDos && <td className="p-2 text-[11px]" style={{ color: TC.text }}>{row.VEHÍCULO || '—'}</td>}
                <td className="p-2 text-[11px] font-mono" style={{ color: TC.text }}>{row.ISO}</td>
                <td className="p-2 text-[11px]" style={{ color: TC.textFaint }}>{row.DIRECCIÓN}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default TabProjects
