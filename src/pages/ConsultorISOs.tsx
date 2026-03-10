import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getThemeColors, useTheme } from '../context/ThemeContext'
import { PageShell } from '../ui/DS'
import GlassHeader, { GlassHeaderTab } from '../components/ui/GlassHeader'
import TabCargarArchivo from '../components/consultor/TabCargarArchivo'
import TabConsultar from '../components/consultor/TabConsultar'
import TabResultados, { ISORow } from '../components/consultor/TabResultados'

const ISO_TABS: GlassHeaderTab[] = [
  { id: 'tab-cargar',     label: 'Base Recibida', icon: '📥', badgeVariant: 'blue'   },
  { id: 'tab-consultar',  label: 'Consulta',      icon: '🔍', badgeVariant: 'orange' },
  { id: 'tab-resultados', label: 'Match',         icon: '✅', badgeVariant: 'green'  },
]

/* ── helpers ── */
function detectSep(line: string) {
  const sc = (line.match(/;/g) || []).length
  const cc = (line.match(/,/g) || []).length
  return sc > cc ? ';' : ','
}

function parseRow(line: string, sep: string) {
  const r: string[] = []; let cur = ''; let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') inQ = !inQ
    else if (c === sep && !inQ) { r.push(cur); cur = '' }
    else cur += c
  }
  r.push(cur); return r
}



export default function ConsultorISOs() {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)

  const [activeTab, setActiveTab] = useState<string>('tab-cargar')

  const [allData, setAllData] = useState<Map<string, any>>(new Map())
  const [fileStats, setFileStats] = useState<{ total: number; ikea: number } | null>(null)
  const [fileName, setFileName] = useState('')
  const [isoInput, setIsoInput] = useState('')
  const [results, setResults] = useState<ISORow[]>([])
  const [toast, setToast] = useState('')

  const flash = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }, [])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const firstLine = text.split('\n')[0]
      const sep = detectSep(firstLine)
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) return
      const headers = parseRow(lines[0], sep).map(h => h.trim().replace(/^"|"$/g, ''))
      const idx = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase())
      const iCommerce = idx('commerce'), iParent = idx('parentorder'), iEstado = idx('estado'), iCom = idx('comentarionoentrega'), iMot = idx('motivonoentrega')
      if (iCommerce === -1 || iParent === -1) {
        flash('⚠ Error: Faltan columnas Commerce o ParentOrder')
        return
      }

      const map = new Map<string, any>()
      let ikeaCount = 0
      for (let i = 1; i < lines.length; i++) {
        const cols = parseRow(lines[i], sep).map(c => c.trim().replace(/^"|"$/g, ''))
        if ((cols[iCommerce] || '').toUpperCase().trim() !== 'IKEA') continue
        ikeaCount++
        const key = (cols[iParent] || '').trim().toLowerCase()
        map.set(key, {
          parentOrder: cols[iParent] || '',
          estado: iEstado !== -1 ? (cols[iEstado] || '') : '',
          comentario: iCom !== -1 ? (cols[iCom] || '') : '',
          motivo: iMot !== -1 ? (cols[iMot] || '') : ''
        })
      }
      setAllData(map)
      setFileStats({ total: lines.length - 1, ikea: ikeaCount })
      setFileName(file.name)
      flash('✓ Archivo cargado correctamente')
      setActiveTab('tab-consultar')
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  const consultar = () => {
    if (!isoInput.trim() || !allData.size) return
    const isos = isoInput.split(/[\n\r,;\t ]+/).map(s => s.trim()).filter(Boolean)
    const res: ISORow[] = isos.map(iso => {
      const row = allData.get(iso.toLowerCase())
      if (row) return { iso, found: true, ...row }
      return { iso, found: false, parentOrder: iso, estado: '', comentario: '', motivo: '' }
    })
    setResults(res)
    setActiveTab('tab-resultados')
  }

  const copiarTabla = () => {
    if (!results.length) return
    const headers = ['ISO', 'Estado', 'Comentario No Entrega', 'Motivo No Entrega']
    let tsv = headers.join('\t') + '\n'
    results.forEach(r => {
      tsv += [r.iso + (!r.found ? ' [NO HALLADO]' : ''), r.estado, r.comentario, r.motivo].join('\t') + '\n'
    })
    navigator.clipboard?.writeText(tsv).then(() => flash('✓ Tabla copiada al portapapeles'))
  }

  const clearData = () => {
    setAllData(new Map())
    setFileStats(null)
    setFileName('')
    setIsoInput('')
    setResults([])
    setActiveTab('tab-cargar')
  }

  const clearConsultar = () => {
    setIsoInput('')
    setResults([])
  }

  return (
    <PageShell>
      <GlassHeader 
        appName="Consultor ISOs"
        appDesc="Matcher & Data Look-up"
        icon="🔍"
        tabs={ISO_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        badges={{
          'tab-consultar': isoInput.trim() ? isoInput.split(/[\n\r,;\t ]+/).filter(Boolean).length : 0,
          'tab-resultados': results.length || 0,
        }}
      />

      <div className="flex-1 overflow-hidden relative" style={{ background: TC.bg }}>
        <AnimatePresence mode="wait">
          {activeTab === 'tab-cargar' && (
            <motion.div
              key="tab-cargar"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 overflow-y-auto"
            >
              <TabCargarArchivo fileStats={fileStats} fileName={fileName} onFile={handleFile} onClear={clearData} />
            </motion.div>
          )}

          {activeTab === 'tab-consultar' && (
            <motion.div
              key="tab-consultar"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 overflow-y-auto"
            >
              <TabConsultar isoInput={isoInput} onInputChange={setIsoInput} onConsultar={consultar} onClear={clearConsultar} hasData={allData.size > 0} />
            </motion.div>
          )}

          {activeTab === 'tab-resultados' && (
            <motion.div
              key="tab-resultados"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 overflow-y-auto"
            >
              <TabResultados results={results} onCopiar={copiarTabla} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-green-500 text-black font-bold text-xs px-8 py-3 rounded-full shadow-2xl z-50 pointer-events-none"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  )
}
