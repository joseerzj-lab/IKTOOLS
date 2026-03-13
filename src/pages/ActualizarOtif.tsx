import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { Upload, Clipboard, BarChart3 } from 'lucide-react'
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
  const [fileName, setFileName] = useState('')
  const [pivot, setPivot] = useState<PivotData>({})
  const [estados, setEstados] = useState<string[]>([])
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
        const estadosSet = new Set<string>()

        filtered.forEach(row => {
          const parentOrder = String(row['ParentOrder'] || '').trim()
          const estado = String(row['Estado'] || '').trim()
          const lpn = String(row['LPN'] || '').trim()

          if (!parentOrder || !estado) return

          estadosSet.add(estado)

          if (!pivotObj[parentOrder]) {
            pivotObj[parentOrder] = {}
          }
          if (!pivotObj[parentOrder][estado]) {
            pivotObj[parentOrder][estado] = 0
          }
          
          if (lpn !== '') {
            pivotObj[parentOrder][estado]++
          }
        })

        estadosSet.add('Planificado En Simpliroute')
        const finalEstados = Array.from(estadosSet).sort()
        
        setEstados(finalEstados)
        setPivot(pivotObj)
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

  const sortedParentOrders = Object.keys(pivot).sort()

  const copyTable = () => {
    const tempTable = document.createElement('table')
    tempTable.style.borderCollapse = 'collapse'
    tempTable.style.fontFamily = 'Aptos, sans-serif'
    
    const thead = document.createElement('thead')
    const trHead = document.createElement('tr')
    
    const thStyle = "border: 1px solid black; font-weight: bold; font-family: Aptos, sans-serif; font-size: 12pt; padding: 4px; text-align: center; color: black; background-color: transparent;"
    const tdStyle = "border: 1px solid black; font-family: Aptos, sans-serif; font-size: 11pt; padding: 4px; text-align: center; color: black; background-color: transparent;"
    const tdStyleLeft = "border: 1px solid black; font-family: Aptos, sans-serif; font-size: 11pt; padding: 4px; text-align: left; color: black; background-color: transparent;"
    
    trHead.innerHTML = `<th style="${thStyle}">ParentOrder</th>` + estados.map(est => `<th style="${thStyle}">${est}</th>`).join('') + `<th style="${thStyle}">Total general</th>`
    thead.appendChild(trHead)
    tempTable.appendChild(thead)
    
    const tbody = document.createElement('tbody')
    sortedParentOrders.forEach(po => {
      const tr = document.createElement('tr')
      let totalFila = 0
      
      const tds = estados.map(est => {
        const count = pivot[po]?.[est] || 0
        totalFila += count
        return `<td style="${tdStyle}">${count}</td>`
      }).join('')
      
      tr.innerHTML = `<td style="${tdStyleLeft}">${po}</td>` + tds + `<td style="${tdStyle}">${totalFila}</td>`
      tbody.appendChild(tr)
    })
    tempTable.appendChild(tbody)
    
    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.appendChild(tempTable)
    document.body.appendChild(container)
    
    const range = document.createRange()
    range.selectNode(tempTable)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    
    try {
      document.execCommand('copy')
      flash('📋 Tabla copiada correctamente')
    } catch (err) {
      flash('❌ Error al copiar')
    }
    window.getSelection()?.removeAllRanges()
    document.body.removeChild(container)
  }

  return (
    <PageShell>
      <GlassHeader 
        appName="Actualizar OTIF"
        icon={<BarChart3 size={20} />}
        tabs={OTIF_TABS}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as any)}
        badges={{}}
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
              </Card>
            </div>
          )}

          {activeTab === 'resultados' && (
            <div className="h-full flex items-center justify-center">
              <Card style={{ padding: 60, textAlign: 'center', maxWidth: 400, width: '100%' }}>
                <div className="w-16 h-16 rounded-3xl bg-green-500/10 text-green-500 flex items-center justify-center mx-auto mb-6">
                  <Clipboard size={32} />
                </div>
                <h2 className="text-xl font-bold mb-2" style={{ color: TC.text }}>¡Datos Procesados!</h2>
                <p className="text-sm mb-8" style={{ color: TC.textMuted }}>
                  Se han calculado las métricas OTIF para {sortedParentOrders.length} ParentOrders.
                </p>
                
                <Btn onClick={copyTable} disabled={!sortedParentOrders.length} style={{ width: '100%', fontSize: '0.875rem', padding: '1rem 0' }}>
                  <Clipboard size={18} style={{ marginRight: '0.5rem' }} /> Copiar Tabla Completa
                </Btn>
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
