import { Download, FileJson } from 'lucide-react'
import type { Row } from './types'
import { Card, Btn, Badge } from '../../ui/DS'
import { useTheme, getThemeColors } from '../../context/ThemeContext'
import * as XLSX from 'xlsx'

interface Props {
  rows: Row[]
  onExportJSON: () => void
}

export default function TabExport({ rows, onExportJSON }: Props) {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)

  const handleExportXLSX = () => {
    if (!rows.length) return
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    XLSX.writeFile(wb, `Ruteo_Postventa_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center gap-8" style={{ background: TC.bg }}>
      <div className="max-w-2xl w-full flex flex-col gap-6">
        <Card style={{ padding: 32, textAlign: 'center' }}>
          <div className="text-4xl mb-4">🚀</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: TC.text }}>Exportar Resultados</h2>
          <p className="text-sm mb-6" style={{ color: TC.textFaint }}>
            Descarga la sesión actual para usarla en otras herramientas o guardarla como respaldo.
          </p>
          
          <div className="flex flex-col gap-3">
             <Btn variant="primary" style={{ padding: '16px', fontSize: 14 }} onClick={handleExportXLSX} disabled={!rows.length}>
                <Download size={18} /> Descargar Excel (.xlsx)
             </Btn>
             <Btn onClick={onExportJSON} disabled={!rows.length} style={{ padding: '14px' }}>
                <FileJson size={18} /> Guardar Sesión (.json)
             </Btn>
          </div>

          <div className="mt-8 pt-6 border-t flex items-center justify-between" style={{ borderColor: TC.borderSoft }}>
             <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: TC.textDisabled }}>Resumen de Datos</div>
             <Badge variant="blue">{rows.length} Filas listas</Badge>
          </div>
        </Card>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <Card style={{ padding: 20 }}>
              <div className="text-[11px] font-bold uppercase mb-2" style={{ color: TC.textDisabled }}>Última Exportación</div>
              <div className="text-xs italic" style={{ color: TC.textFaint }}>Aún no exportado en esta sesión</div>
           </Card>
           <Card style={{ padding: 20 }}>
              <div className="text-[11px] font-bold uppercase mb-2" style={{ color: TC.textDisabled }}>Formato de Salida</div>
              <div className="text-xs" style={{ color: TC.textFaint }}>ISO · Commerce · Patente · Estado</div>
           </Card>
        </div>
      </div>
    </div>
  )
}
