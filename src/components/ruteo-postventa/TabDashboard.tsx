import { useState } from 'react'
import { Search, Columns3, Plus, Trash2 } from 'lucide-react'
import type { Row, Stats } from './types'
import { useTheme, getThemeColors } from '../../context/ThemeContext'
import { Btn } from '../../ui/DS'

interface Props {
  columns: string[]
  rows: Row[]
  visibleCols: Set<string>
  setVisibleCols: React.Dispatch<React.SetStateAction<Set<string>>>
  stats: Stats
  onUpdateCell: (rowIdx: number, col: string, value: string) => void
  onAddRow: () => void
  onDeleteRow: (idx: number) => void
  onCrearNueva: () => void
}

export default function TabDashboard({
  columns, rows, visibleCols, setVisibleCols,
  stats, onUpdateCell, onAddRow, onDeleteRow, onCrearNueva
}: Props) {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)

  const [search, setSearch] = useState('')
  const [showVisPanel, setShowVisPanel] = useState(false)

  const getFiltered = () => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(r => columns.some(c => (r[c] || '').toLowerCase().includes(q)))
  }

  const filtered = getFiltered()
  const vCols = columns.filter(c => visibleCols.has(c))

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: TC.bg }}>
      {/* Stats bar */}
      {rows.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 border-b flex-wrap" style={{ borderColor: TC.borderSoft }}>
          <div className="flex items-center gap-1.5">
            <span className="text-yellow-500 font-bold font-mono text-lg">{filtered.length}</span>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: TC.textDisabled }}>ISOs</span>
          </div>
          {Object.entries(stats.gestion).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: TC.bgCard, border: `1px solid ${TC.borderSoft}` }}>
              <span className="text-yellow-500 font-bold font-mono text-sm">{v}</span>
              <span className="text-[9px] uppercase tracking-wider max-w-[70px] truncate" style={{ color: TC.textDisabled }} title={k}>{k}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search + filters */}
      <div className="flex items-center gap-3 px-4 py-2 border-b" style={{ borderColor: TC.borderSoft }}>
        <div className="flex items-center gap-2 flex-1 max-w-[280px] relative">
          <Search size={12} color={TC.textFaint} className="absolute left-2" />
          <input
            type="text"
            className="w-full pl-7 pr-2 py-1.5 rounded text-[11px] outline-none transition-colors focus:ring-1 focus:ring-blue-500/50"
            style={{ background: TC.bgCard, color: TC.text, border: `1px solid ${TC.borderSoft}` }}
            placeholder="Buscar… (Ctrl+F)"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowVisPanel(p => !p)}
          className="text-[10px] font-bold px-2 py-1.5 rounded transition-colors hover:bg-white/10 flex items-center gap-1"
          style={{ color: TC.textFaint, background: showVisPanel ? 'rgba(255,255,255,0.05)' : 'transparent', border: `1px solid ${TC.borderSoft}`, cursor: 'pointer' }}
        >
          <Columns3 size={12} /> Cols
        </button>
      </div>

      {showVisPanel && (
        <div className="flex flex-wrap gap-2.5 px-6 py-4 border-b animate-in fade-in slide-in-from-top-1" style={{ borderColor: TC.borderSoft, background: TC.bgCardAlt }}>
          <div className="w-full text-[10px] font-bold uppercase tracking-widest mb-1 opacity-40">Visibilidad de Columnas</div>
          {columns.map(c => (
            <label
              key={c}
              className="flex items-center gap-2.5 text-sm font-bold px-4 py-2 rounded-xl cursor-pointer transition-all hover:scale-105 active:scale-95"
              style={{
                background: visibleCols.has(c) ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${visibleCols.has(c) ? '#38bdf8' : TC.borderSoft}`,
                color: visibleCols.has(c) ? '#38bdf8' : TC.textFaint,
                boxShadow: visibleCols.has(c) ? '0 0 15px rgba(56, 189, 248, 0.25)' : 'none'
              }}
            >
              <input
                type="checkbox"
                className="accent-blue-500 w-4 h-4"
                checked={visibleCols.has(c)}
                onChange={() => setVisibleCols(p => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n })}
              />
              {c}
            </label>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 p-10 text-center">
            <div className="w-20 h-20 rounded-[2rem] bg-blue-500/5 border-2 border-dashed flex items-center justify-center mb-2" style={{ borderColor: TC.borderSoft }}>
               <Plus size={32} className="text-blue-500/40" />
            </div>
            <div className="max-w-xs">
              <h3 className="text-lg font-bold mb-1" style={{ color: TC.text }}>No hay datos</h3>
              <p className="text-xs mb-6" style={{ color: TC.textFaint }}>Empieza creando una tabla vacía con las columnas por defecto o carga un archivo.</p>
            </div>
            <Btn variant="primary" size="lg" onClick={onCrearNueva} style={{ padding: '12px 32px' }}>
              <Plus size={16} /> Crear Tabla Nueva
            </Btn>
          </div>
        ) : (
          <table className="min-w-full text-[11px] font-mono" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="w-8 p-1.5 text-center sticky top-0 z-10" style={{ background: TC.bgCardAlt, borderBottom: `1px solid ${TC.borderSoft}` }}>#</th>
                {vCols.map(c => (
                  <th key={c} className="text-left p-1.5 text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10 whitespace-nowrap" style={{ background: TC.bgCardAlt, color: TC.textDisabled, borderBottom: `1px solid ${TC.borderSoft}` }}>{c}</th>
                ))}
                <th className="w-6 sticky top-0 z-10" style={{ background: TC.bgCardAlt, borderBottom: `1px solid ${TC.borderSoft}` }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, ri) => (
                <tr key={ri} className="hover:bg-white/[.02] transition-colors group">
                  <td className="p-1 text-center text-[9px]" style={{ color: TC.textDisabled, borderBottom: `1px solid ${TC.borderSoft}` }}>{ri + 1}</td>
                  {vCols.map(c => (
                    <td key={c} className="p-0" style={{ borderBottom: `1px solid ${TC.borderSoft}` }}>
                      <input
                        type="text"
                        className="w-full px-2 py-1.5 text-[11px] font-mono bg-transparent outline-none transition-colors focus:bg-blue-500/10"
                        style={{ color: TC.text, border: 'none' }}
                        value={r[c] || ''}
                        onChange={e => onUpdateCell(ri, c, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="p-0" style={{ borderBottom: `1px solid ${TC.borderSoft}` }}>
                    <button
                      onClick={() => onDeleteRow(ri)}
                      className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px' }}
                      title="Eliminar fila"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={vCols.length + 2} className="p-0">
                  <button
                    onClick={onAddRow}
                    className="w-full text-left px-3 py-2 text-[11px] font-semibold transition-colors hover:bg-blue-500/5 hover:text-blue-400 flex items-center gap-1"
                    style={{ color: TC.textFaint, background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    <Plus size={12} /> Nueva fila
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom bar */}
      {rows.length > 0 && (
         <div className="flex items-center gap-3 px-4 py-1.5 text-[10px]" style={{ background: TC.bgCardAlt, borderTop: `1px solid ${TC.borderSoft}`, flexShrink: 0 }}>
            <span style={{ color: TC.textSub }}>Total: <strong className="text-yellow-500 font-mono">{rows.length}</strong></span>
            <span style={{ color: TC.textDisabled }}>|</span>
            <span style={{ color: TC.textSub }}>Vista: <strong className="text-yellow-500 font-mono">{filtered.length}</strong></span>
         </div>
      )}
    </div>
  )
}
