import React from 'react'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { Card } from '../../ui/DS'

interface TabDuplicatesProps {
  pvPlanData: string[];
  dashboardIsos: Record<string, any[]>;
  TC: any;
}

const TabDuplicates: React.FC<TabDuplicatesProps> = ({ pvPlanData, dashboardIsos, TC }) => {
  if (!pvPlanData.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
        <div className="text-4xl">🔍</div>
        <p className="text-sm">Carga el archivo Plan en la pestaña "Cargar" para revisar duplicados.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: TC.text }}>
          Revisión de Duplicados (Plan vs Dashboard)
        </h3>
        <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400">
          {pvPlanData.length} ISOs en Plan
        </div>
      </div>

      <div className="flex-1 overflow-auto border rounded-lg" style={{ borderColor: TC.borderSoft }}>
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10" style={{ background: TC.surface3 }}>
            <tr>
              <th className="p-2 text-[10px] font-bold uppercase tracking-wider border-b" style={{ color: TC.textFaint, borderColor: TC.borderSoft }}>ISO</th>
              <th className="p-2 text-[10px] font-bold uppercase tracking-wider border-b text-center" style={{ color: TC.textFaint, borderColor: TC.borderSoft }}>Estado</th>
              <th className="p-2 text-[10px] font-bold uppercase tracking-wider border-b" style={{ color: TC.textFaint, borderColor: TC.borderSoft }}>Gestión Dashboard</th>
            </tr>
          </thead>
          <tbody>
            {pvPlanData.map((iso, idx) => {
              const matches = dashboardIsos[iso] || [];
              const isDup = matches.length > 0;
              
              return (
                <tr key={`${iso}-${idx}`} className={isDup ? "bg-red-500/5" : ""} style={{ borderBottom: `1px solid ${TC.borderSoft}` }}>
                  <td className="p-2 text-[11px] font-mono" style={{ color: TC.text }}>{iso}</td>
                  <td className="p-2 text-center">
                    {isDup ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px] font-bold border border-red-500/30">
                        <AlertTriangle size={10} /> DUPLICADA
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-[9px] font-bold border border-green-500/30">
                        <CheckCircle size={10} /> OK
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-[11px]" style={{ color: isDup ? "#ff7b72" : TC.textFaint }}>
                    {isDup ? matches.map(m => m.GESTIÓN || '—').join(', ') : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default TabDuplicates
