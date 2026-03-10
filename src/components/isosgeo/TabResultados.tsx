import { Clipboard, MapPin } from 'lucide-react'
import { Btn } from '../../ui/DS'
import type { GeoRow } from '../../types/isosgeo'

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
        <div className="flex justify-end mb-4">
          <Btn onClick={copiar} size="sm">
            <Clipboard size={14} /> Copiar tabla
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
        <div style={{ background: TC.bgCard, borderRadius: 8, border: `1px solid ${TC.borderSoft}`, overflow: 'hidden' }}>
          <table className="w-full text-[11px] font-mono" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['ISO', 'Patente', 'Estado', 'Vehículo Simpli', 'Análisis'].map(h => (
                  <th key={h} className="text-left p-2 text-[10px] font-bold uppercase tracking-wider sticky top-0" 
                      style={{ background: TC.bgCardAlt, color: TC.textDisabled, borderBottom: `1px solid ${TC.borderSoft}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className={`hover:bg-white/[.02] ${r._dup ? 'bg-rose-500/10' : ''}`} style={{ transition: 'background 0.1s' }}>
                  <td className="p-2 font-bold" style={{ color: TC.text, borderBottom: `1px solid ${TC.borderSoft}` }}>{r.ISO}</td>
                  <td className="p-2" style={{ color: TC.text, borderBottom: `1px solid ${TC.borderSoft}` }}>{r.PATENTE}</td>
                  <td className="p-2" style={{ color: TC.text, borderBottom: `1px solid ${TC.borderSoft}` }}>{r.ESTADO}</td>
                  <td className="p-2" style={{ color: TC.text, borderBottom: `1px solid ${TC.borderSoft}` }}>{r.VEHICULO}</td>
                  <td className="p-2" style={{ borderBottom: `1px solid ${TC.borderSoft}` }}>
                    {r.ANALISIS && (
                      <span className="bg-rose-500/15 text-rose-400 text-[9px] font-bold px-2 py-0.5 rounded border border-rose-500/20">
                        ⚠ {r.ANALISIS}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
