import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { Upload, Clipboard, BarChart3, Search } from 'lucide-react'
import { useTheme, getThemeColors } from '../context/ThemeContext'
import { PageShell, Card, Btn } from '../ui/DS'
import GlassHeader, { GlassHeaderTab } from '../components/ui/GlassHeader'

const OTIF_TABS: GlassHeaderTab[] = [
  { id: 'carga',      label: 'Cargar Datos', icon: '📥', badgeVariant: 'blue'   },
  { id: 'resultados', label: 'OTIF Proyectado', icon: '📊', badgeVariant: 'green'  },
]

type PivotData = Record<string, Record<string, number>>

export default function ActualizarOtif() {
  const { theme, isDark } = useTheme()
  const TC = getThemeColors(theme)

  const [activeTab, setActiveTab] = useState<'carga' | 'resultados'>('carga')
  const [data, setData] = useState<any[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [pivot, setPivot] = useState<PivotData>({})
  const [estados] = useState<string[]>([
    'En Ruta', 
    'Pendiente', 
    'Planificado', 
    'Planificado en Simpliroute', 
    'Terminado'
  ])
  const [filterQ, setFilterQ] = useState('')
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(false)

  const flash = useCallback((msg: string) => { 
    setToast(msg)
    setTimeout(() => setToast(''), 2500) 
  }, [])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setLoading(true)
    setFileName(file.name)
    const reader = new FileReader()
    
    reader.onload = (ev) => {
      try {
        const bstr = ev.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[]

        const filtered = jsonData.filter(row => {
          const commerce = String(row['Commerce'] || '').trim().toLowerCase()
          return commerce === 'ikea'
        })

        if (filtered.length === 0) {
          flash('⚠️ No se encontraron registros de IKEA')
          setLoading(false)
          return
        }

        const pivotObj: PivotData = {}

        filtered.forEach(row => {
          const parentOrder = String(row['ParentOrder'] || '').trim()
          const estado = String(row['Estado'] || 'Sin Estado').trim()
          const lpn = String(row['LPN'] || '').trim()

          if (!parentOrder) return

          if (!pivotObj[parentOrder]) {
            pivotObj[parentOrder] = {}
            // Initialize all standard statuses to 0
            estados.forEach(est => pivotObj[parentOrder][est] = 0)
          }
          
          // Only increment if it's one of our standard statuses and LPN is present
          if (lpn !== '' && estados.includes(estado)) {
            pivotObj[parentOrder][estado]++
          }
        })

        setPivot(pivotObj)
        setData(filtered)
        flash(`✓ ${filtered.length} filas procesadas correctamente`)
        setActiveTab('resultados')
      } catch (err) {
        flash('❌ Error al procesar el archivo')
      } finally {
        setLoading(false)
      }
    }
    
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  const copyTable = () => {
    const table = document.getElementById('otif-result-table')
    if (!table) return

    const range = document.createRange()
    range.selectNode(table)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    
    try {
      document.execCommand('copy')
      flash('📋 Tabla copiada al portapapeles')
    } catch (err) {
      flash('❌ Error al copiar')
    }
    window.getSelection()?.removeAllRanges()
  }

  const sortedParentOrders = Object.keys(pivot).sort().filter(po => 
    !filterQ || po.toLowerCase().includes(filterQ.toLowerCase())
  )

  return (
    <PageShell>
      <GlassHeader 
        appName="Actualizar OTIF"
        appDesc="Proyectado · IKEA Ops"
        icon={<BarChart3 size={20} />}
        tabs={OTIF_TABS}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as any)}
        badges={{
          resultados: (Object.keys(pivot).length || 0) as any
        }}
      />

      <div className="flex-1 overflow-hidden relative" style={{ background: TC.bg }}>
        <div className="h-full overflow-y-auto p-6">
          
          {activeTab === 'carga' && (
            <div className="max-w-xl mx-auto py-12">
              <Card style={{ padding: 40, textAlign: 'center' }}>
                <div className="w-16 h-16 rounded-3xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto mb-6">
                  <Upload size={32} />
                </div>
                <h2 className="text-xl font-bold mb-2" style={{ color: TC.text }}>Cargar Reporte OTIF</h2>
                <p className="text-sm mb-8" style={{ color: TC.textMuted }}>
                  Sube tu archivo CSV para procesar los datos de ParentOrder y LPN de IKEA.
                </p>

                <label className="flex flex-col items-center justify-center gap-4 p-10 rounded-2xl border-2 border-dashed transition-all hover:bg-blue-500/5 cursor-pointer" 
                       style={{ borderColor: TC.border, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                  <div className="text-blue-500 font-bold text-sm">
                    {loading ? 'Procesando...' : fileName || 'Seleccionar archivo CSV'}
                  </div>
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={loading} />
                </label>

                {data && (
                  <div className="mt-6">
                    <Btn variant="primary" onClick={() => setActiveTab('resultados')}>Ver Resultados</Btn>
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'resultados' && (
            <div className="h-full flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                   <Search size={14} color={TC.textFaint} className="absolute left-3 top-1/2 -translate-y-1/2" />
                   <input 
                     type="text" 
                     className="w-full pl-9 pr-4 py-2 rounded-xl text-xs transition-all focus:ring-2 focus:ring-blue-500/20" 
                     style={{ background: TC.bgCard, color: TC.text, border: `1px solid ${TC.borderSoft}` }} 
                     placeholder="Buscar ParentOrder..." 
                     value={filterQ} 
                     onChange={e => setFilterQ(e.target.value)}
                   />
                </div>
                <Btn onClick={copyTable} disabled={!sortedParentOrders.length}>
                   <Clipboard size={14} /> <span className="text-[10px]">Copiar Tabla</span>
                </Btn>
              </div>

              <Card style={{ padding: 0, overflow: 'hidden', flex: 1, border: `1px solid ${TC.borderSoft}` }}>
                <div className="overflow-auto h-full custom-scrollbar">
                  <table id="otif-result-table" className="w-full text-xs font-mono" style={{ borderCollapse: 'collapse', minWidth: '600px' }}>
                    <thead>
                      <tr className="sticky top-0 z-10 shadow-sm">
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-wider" 
                            style={{ background: TC.headerBg, color: TC.textDisabled, borderBottom: `1px solid ${TC.borderSoft}`, borderRight: `1px solid ${TC.borderSoft}` }}>
                          ParentOrder
                        </th>
                        {estados.map(est => (
                          <th key={est} className="text-center p-4 text-[10px] font-bold uppercase tracking-wider" 
                              style={{ background: TC.headerBg, color: TC.textDisabled, borderBottom: `1px solid ${TC.borderSoft}`, borderRight: `1px solid ${TC.borderSoft}` }}>
                            {est}
                          </th>
                        ))}
                        <th className="text-center p-4 text-[10px] font-bold uppercase tracking-wider" 
                            style={{ background: TC.headerBg, color: TC.textDisabled, borderBottom: `1px solid ${TC.borderSoft}` }}>
                          Total General
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedParentOrders.map((po) => {
                        let rowTotal = 0;
                        return (
                          <tr key={po} className="hover:bg-blue-500/5 transition-colors border-b" style={{ borderColor: TC.borderSoft }}>
                            <td className="p-4 font-bold" style={{ color: TC.text, borderRight: `1px solid ${TC.borderSoft}` }}>{po}</td>
                            {estados.map(est => {
                              const count = pivot[po][est] || 0;
                              rowTotal += count;
                              return (
                                <td key={est} className="p-4 text-center" style={{ color: TC.textSub, borderRight: `1px solid ${TC.borderSoft}` }}>
                                  {count || <span className="opacity-20">0</span>}
                                </td>
                              );
                            })}
                            <td className="p-4 text-center font-bold" style={{ color: TC.text }}>{rowTotal}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-blue-600 text-white font-bold text-xs px-8 py-3 rounded-full shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4">
          {toast}
        </div>
      )}
    </PageShell>
  )
}
