import React from 'react'
import { FileDown, FileSpreadsheet, Image as ImageIcon } from 'lucide-react'
import { DropdownMenu } from '../ui/dropdown-menu'
import { exportElementAsImage } from '../../utils/exportUtils'

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
  onNotify?: (msg: string) => void;
}

const TabProjects: React.FC<TabProjectsProps> = ({ proyectosData, TC, onNotify }) => {
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

  const exportToImage = async () => {
    const el = document.getElementById('projects-table')
    if (!el) return
    await exportElementAsImage(el, 'Proyectos_Leslie.png', {
      backgroundColor: TC.bg || '#ffffff',
      onNotify
    })
  }

  const exportToCSV = () => {
    const isDos = proyectosData[0]?._tipo === 'dos'
    let text = isDos ? 'Vehículo\tISO\tDirección\n' : 'ISO\tDirección\n'
    displayRows.forEach(r => {
      text += isDos ? `${r.VEHÍCULO || ''}\t${r.ISO}\t${r.DIRECCIÓN}\n` : `${r.ISO}\t${r.DIRECCIÓN}\n`
    })
    const blob = new Blob(["\uFEFF"+text], {type: 'text/csv;charset=utf-8;'})
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `Proyectos_Leslie.csv`
    link.click()
    onNotify?.('✓ Excel exportado')
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: TC.text }}>
          <span className="text-blue-400">🏗️</span> Proyectos Leslie
        </h3>
        <div className="flex gap-2">
          <DropdownMenu
            options={[
              { label: 'Exportar Imagen (Fondo Blanco)', onClick: exportToImage, Icon: <ImageIcon size={14} /> },
              { label: 'Exportar Datos (CSV)', onClick: exportToCSV, Icon: <FileSpreadsheet size={14} /> }
            ]}
          >
            <FileDown size={14} className="mr-2" /> Exportar
          </DropdownMenu>
          <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400">
            {displayRows.length} Órdenes
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar border rounded-lg" style={{ borderColor: TC.borderSoft }}>
        <table className="w-full text-left border-collapse" id="projects-table">
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
