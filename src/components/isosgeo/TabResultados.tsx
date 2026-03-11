import { Clipboard, MapPin } from 'lucide-react'
import { Btn } from '../../ui/DS'
import type { GeoRow } from '../../types/isosgeo'
import TableModal from '../reporte-rutas/TableModal'

interface Props {
  results: GeoRow[]
  copiar: () => void
  TC: any
}

export default function TabResultados({ results, copiar, TC }: Props) {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-4" style={{ background: TC.bg }}>
      {/* ── Toolbar ── */}
      {results.length > 0 && (
        <div className="flex justify-end mb-4 flex-shrink-0">
          <Btn onClick={copiar} size="sm">
            <Clipboard size={14} /> Copiar Simple
          </Btn>
        </div>
      )}

      {/* ── Table Area ── */}
      {results.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: TC.textDisabled }}>
          <MapPin size={36} strokeWidth={1} />
          <div className="text-sm font-semibold" style={{ color: TC.textSub }}>Sin resultados</div>
          <div className="text-[11px] text-center max-w-[320px]" style={{ color: TC.textFaint }}>
            Aún no se ha ejecutado el análisis. Ve a la pestaña de carga e inicia el cruce.
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden" style={{ background: TC.bgCard, borderRadius: 8, border: `1px solid ${TC.borderSoft}` }}>
          <TableModal
            isOpen={true}
            isInline={true}
            onClose={() => {}}
            title="Resultados del Cruce"
            subtitle={`${results.length} registros procesados`}
            data={results.map(r => ({
              'ISO': r.ISO,
              'Patente': r.PATENTE,
              'Estado': r.ESTADO,
              'Vehículo Simpli': r.VEHICULO,
              'Análisis': r.ANALISIS || '',
              '_dup': r._dup
            }))}
            columns={['ISO', 'Patente', 'Estado', 'Vehículo Simpli', 'Análisis']}
            TC={TC}
            isConflictModal={false}
          />
        </div>
      )}
    </div>
  )
}
