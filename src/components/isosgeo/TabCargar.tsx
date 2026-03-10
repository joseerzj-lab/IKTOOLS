import { Upload, Loader2, MapPin } from 'lucide-react'
import { Btn } from '../../ui/DS'
import type { BaseStats, ResStats } from '../../types/isosgeo'

interface Props {
  token: string
  setToken: (t: string) => void
  fecha: string
  setFecha: (f: string) => void
  baseName: string
  baseStats: BaseStats | null
  handleFile: (e: React.ChangeEvent<HTMLInputElement>) => void
  loading: boolean
  progress: number
  status: string
  resStats: ResStats | null
  iniciarAnalisis: () => void
  baseDataReady: boolean
  TC: any
}

export default function TabCargar({
  token, setToken, fecha, setFecha, baseName, baseStats,
  handleFile, loading, progress, status, resStats, iniciarAnalisis, baseDataReady, TC
}: Props) {
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ── Settings Sidebar ── */}
      <div style={{ width: 300, background: TC.bgCardAlt, borderRight: `1px solid ${TC.borderSoft}`, flexShrink: 0, overflowY: 'auto', padding: 16 }} className="flex flex-col gap-4">
        <div>
          <div className="text-[11px] font-bold mb-1" style={{ color: TC.textSub }}>Token SimpliRoute</div>
          <input 
            type="text" 
            className="w-full p-2 rounded text-[11px] font-mono" 
            style={{ background: TC.bg, color: TC.text, border: `1px solid ${TC.borderSoft}`, outline: 'none' }} 
            value={token} 
            onChange={e=>setToken(e.target.value)} 
          />
        </div>
        
        <div>
          <div className="text-[11px] font-bold mb-1" style={{ color: TC.textSub }}>Fecha de consulta</div>
          <input 
            type="date" 
            className="w-full p-2 rounded text-[11px]" 
            style={{ background: TC.bg, color: TC.text, border: `1px solid ${TC.borderSoft}`, outline: 'none' }} 
            value={fecha} 
            onChange={e=>setFecha(e.target.value)} 
          />
        </div>
        
        <div>
          <div className="text-[11px] font-bold mb-1" style={{ color: TC.textSub }}>Archivo Base</div>
          <label className="flex items-center gap-2 w-full p-2 rounded cursor-pointer transition-colors" 
                 style={{ border: `1px dashed ${TC.borderSoft}`, background: TC.bg }}>
            <Upload size={14} color={TC.textFaint} />
            <span className="text-[11px] truncate flex-1" style={{ color: TC.textFaint }}>
              {baseName || 'Subir XLSX/CSV...'}
            </span>
            <input type="file" accept=".xlsx,.csv,.tsv" className="hidden" onChange={handleFile} />
          </label>
          {baseStats && (
            <div className="text-[9px] mt-1 text-right" style={{ color: TC.textDisabled }}>
              {baseStats.total} filas · {baseStats.ikea} IKEA
            </div>
          )}
        </div>

        {/* Progress Action */}
        <div className="mt-2">
          {progress > 0 && (
            <div className="w-full h-1.5 rounded-full overflow-hidden mb-2" style={{ background: TC.borderSoft }}>
              <div className="h-full bg-rose-500 transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
            </div>
          )}
          
          {status && (
            <div className="text-[10px] flex items-center gap-2 mb-2" style={{ color: TC.textSub }}>
              {loading && <Loader2 size={12} className="animate-spin" />}
              {status}
            </div>
          )}
          
          <Btn 
            variant="primary" 
            style={{ width: '100%', background: baseDataReady && !loading ? '#e11d48' : undefined, color: 'white', borderColor: '#e11d48' }} 
            onClick={iniciarAnalisis} 
            disabled={loading || !baseDataReady}
          >
            ▶ Iniciar Análisis
          </Btn>
        </div>

        {/* Mini Stats after run */}
        {resStats && (
          <div className="flex gap-2 mt-4">
            <div className="flex-1 rounded p-2 text-center" style={{ background: TC.bgCard, border: `1px solid ${TC.borderSoft}` }}>
              <div className="text-lg font-bold font-mono text-orange-400">{resStats.total}</div>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: TC.textDisabled }}>Sin conductor</div>
            </div>
            <div className="flex-1 rounded p-2 text-center" style={{ background: TC.bgCard, border: `1px solid ${TC.borderSoft}` }}>
              <div className="text-lg font-bold font-mono text-rose-400">{resStats.dups}</div>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: TC.textDisabled }}>Duplicadas</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Main Area Preview ── */}
      <div className="flex-1 flex flex-col p-4 overflow-y-auto" style={{ background: TC.bg }}>
        {!baseDataReady ? (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: TC.textDisabled }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2" style={{ background: 'rgba(225,29,72,0.1)' }}>
              <MapPin size={32} color="#fb7185" strokeWidth={1.5} />
            </div>
            <div className="text-sm font-semibold" style={{ color: TC.textSub }}>Preparar Análisis</div>
            <div className="text-[11px] text-center max-w-[320px]" style={{ color: TC.textFaint }}>
              Carga el archivo base, configura el token de SimpliRoute y la fecha, luego haz clic en Iniciar Análisis.
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
             <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2 bg-green-500/10 text-green-500">
              <Upload size={32} strokeWidth={1.5} />
            </div>
            <div className="text-sm font-semibold" style={{ color: TC.textSub }}>Base de Datos Cargada</div>
             <div className="text-[11px] text-center max-w-[320px]" style={{ color: TC.textFaint }}>
              {baseStats?.total} registros listos para cruzar con SimpliRoute. Presiona "Iniciar Análisis" para comenzar.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
