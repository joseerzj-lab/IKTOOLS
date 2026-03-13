import React, { useState } from 'react'
import { Copy, CheckCircle2 } from 'lucide-react'
import { Card, Btn } from '../../ui/DS'
import { useTheme, getThemeColors } from '../../context/ThemeContext'
import { Row } from './types'

interface ProjectRow {
  ISO: string;
  DIRECCIÓN: string;
  VEHÍCULO?: string;
  _tipo: 'uno' | 'dos';
  [key: string]: any;
}

interface Props {
  rows: Row[];
  proyectosData: ProjectRow[];
  onNotify: (msg: string) => void;
}

const TabTemplates: React.FC<Props> = ({ rows, proyectosData, onNotify }) => {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const buildHTMLTable = (data: any[], cols: string[], clean = false) => {
    const tableStyle = "border-collapse:collapse;font-family:Aptos,Calibri,Arial,sans-serif;font-size:12pt;width:100%;"
    const thStyle = clean 
      ? "border:1px solid black;padding:6px 10px;font-weight:bold;text-align:center;background:none;color:#000000;"
      : "border:1px solid black;padding:6px 10px;font-weight:bold;text-align:center;background:#0051BA;color:#FFDA1A;"
    const tdStyle = clean
      ? "border:1px solid black;padding:5px 10px;text-align:center;color:#000000;background:none;"
      : "border:1px solid black;padding:5px 10px;text-align:center;color:#000000;background:#ffffff;"

    let html = `<table style="${tableStyle}"><thead><tr>`
    cols.forEach(c => { html += `<th style="${thStyle}">${c}</th>` })
    html += `</tr></thead><tbody>`
    
    data.forEach(r => {
      html += `<tr>`
      cols.forEach(c => {
        html += `<td style="${tdStyle}">${r[c] || ''}</td>`
      })
      html += `</tr>`
    })
    
    html += `</tbody></table>`
    return html
  }

  const copyAsHTML = (html: string, plainText: string) => {
    const container = document.createElement('div')
    container.innerHTML = html
    container.style.position = 'fixed'
    container.style.left = '-9999px'
    document.body.appendChild(container)

    const blobHTML = new Blob([html], { type: 'text/html' })
    const blobText = new Blob([plainText], { type: 'text/plain' })
    
    const data = [new ClipboardItem({
      'text/html': blobHTML,
      'text/plain': blobText
    })]

    navigator.clipboard.write(data).then(() => {
      document.body.removeChild(container)
    }).catch(_err => {
      // Fallback for older browsers
      const range = document.createRange()
      range.selectNodeContents(container)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      document.execCommand('copy')
      selection?.removeAllRanges()
      document.body.removeChild(container)
    })
  }

  const handleCopy = (id: string) => {
    let html = ''
    let plain = ''
    let title = ''

    if (id === 'repites') {
      const data = rows.filter(r => String(r['CORREO REPITES']).toUpperCase() === 'SI')
      if (!data.length) return onNotify('⚠️ No hay filas con CORREO REPITES = SI')
      
      const intro = `<p style="font-family:Aptos,sans-serif;font-size:12pt;margin-bottom:12px;">Buenas tardes @Despacho Ecommerce WH comparto repites</p>`
      const table = buildHTMLTable(data, ['ISO', 'GESTIÓN', 'ORIGEN', 'DESTINO'])
      html = intro + table
      plain = `Buenas tardes @Despacho Ecommerce WH comparto repites\n\n${data.map(r => `${r.ISO}\t${r.GESTIÓN}\t${r.ORIGEN}\t${r.DESTINO}`).join('\n')}`
      title = 'Repites'
    } 
    else if (id === 'pv') {
      const isPV = (v: any) => {
        const u = String(v || '').trim().toUpperCase()
        return u.includes('POST VENTA') || u.includes('POSTVENTA')
      }
      const data = rows.filter(r => isPV(r.DESTINO))
      if (!data.length) return onNotify('⚠️ Sin datos de POST VENTA en columna DESTINO')
      
      const vehsPV = [...new Set(data.map(r => String(r.DESTINO || '').trim()).filter(Boolean))]
      const numVeh = vehsPV.length || 1
      const vehWord = numVeh === 1 ? '1 veh' : `${numVeh} veh`
      const vehRequestMsg = `<p style="font-family:Aptos,sans-serif;font-size:12pt;margin-top:12px;font-weight:bold;">se solicitan ${numVeh} vehiculos para cumplir con la programacion de postventa de mañana.</p>`
      
      const intro = `<p style="font-family:Aptos,sans-serif;font-size:12pt;margin-bottom:12px;">Buenas tardes Wilfredo Rugel, Favor su ayuda gestionando ${vehWord}, para cumplir con la programación de post venta, @Despacho Ecommerce WH favor su ayuda gestionando los siguientes movimientos para armar las rutas:</p>`
      const table = buildHTMLTable(data, ['ISO', 'GESTIÓN', 'ORIGEN', 'DESTINO'])
      html = intro + table + vehRequestMsg
      plain = `Buenas tardes Wilfredo Rugel...\n\n${data.map(r => `${r.ISO}\t${r.GESTIÓN}\t${r.ORIGEN}\t${r.DESTINO}`).join('\n')}\n\nse solicitan ${numVeh} vehiculos para cumplir con la programacion de postventa de mañana.`
      title = 'Post Venta'
    }
    else if (id === 'leslie') {
      if (!proyectosData.length) return onNotify('⚠️ Sin datos de Proyectos Leslie')
      const displayRows = proyectosData.filter(r => {
        const iso = (r.ISO || "").trim().toUpperCase();
        // User asked to remove rows with type "Inicio" or "Fin"
        // Also check "TIPO ISO" or similar just in case but ISO usually carries it
        const tipoIso = (r['TIPO ISO'] || r['TIPO_ISO'] || "").trim().toUpperCase();
        return iso !== 'INICIO' && iso !== 'FIN' && tipoIso !== 'INICIO' && tipoIso !== 'FIN';
      })
      
      const man = new Date(); man.setDate(man.getDate() + 1)
      const manStr = man.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
      
      const isDos = proyectosData[0]?._tipo === 'dos'
      const cols = isDos ? ['VEHÍCULO', 'ISO', 'DIRECCIÓN'] : ['ISO', 'DIRECCIÓN']
      
      // Calculate unique vehicles for Leslie
      const uniqueVehLeslie = [...new Set(displayRows.map(r => String(r['VEHÍCULO'] || r['VEHICULO'] || '').trim()).filter(Boolean))]
      const countVehLeslie = uniqueVehLeslie.length
      const leslieRequestMsg = countVehLeslie === 2 
        ? `<p style="font-family:Aptos,sans-serif;font-size:12pt;margin-top:12px;font-weight:bold;">@W se solicitan 2 vehiculos para cumplir con la programacion de proyectos de mañana.</p>`
        : ''

      const intro = `<p style="font-family:Aptos,sans-serif;font-size:12pt;margin-bottom:12px;line-height:1.6;">Hej Team!,<br><br>@Despacho Ecommerce WH Comparto las órdenes correspondientes al flujo de proyectos B2C que realizamos con Transportes Leslie, el día ${manStr}. Por favor, solicito su ayuda para procesar estas órdenes y ubicarlas en el andén 2A (Nave 4) para Transportes Leslie, diferenciadas de los envío retiro.</p>`
      const table = buildHTMLTable(displayRows, cols)
      html = intro + table + leslieRequestMsg
      plain = `Hej Team!...\n\n${displayRows.map(r => `${r.ISO}\t${r.DIRECCIÓN}`).join('\n')}${countVehLeslie === 2 ? '\n\n@W se solicitan 2 vehiculos para cumplir con la programacion de proyectos de mañana.' : ''}`
      title = 'Leslie'
    }
    else if (id === 'ruteo_pm') {
      const intro = `<p style="font-family:Aptos,sans-serif;font-size:12pt;margin-bottom:12px;">Buenas tardes, comparto ruteos PM</p>`
      
      // 1. Repites
      const dataRepites = rows.filter(r => String(r['CORREO REPITES']).toUpperCase() === 'SI')
      let sectionRepites = ''
      if (dataRepites.length) {
        sectionRepites = `<p style="font-family:Aptos,sans-serif;font-size:12pt;margin-top:16px;margin-bottom:8px;font-weight:bold;">Repites</p>` 
          + buildHTMLTable(dataRepites, ['ISO', 'GESTIÓN', 'ORIGEN', 'DESTINO'], true)
      }

      // 2. Postventa
      const isPV = (v: any) => {
        const u = String(v || '').trim().toUpperCase()
        return u.includes('POST VENTA') || u.includes('POSTVENTA')
      }
      const dataPV = rows.filter(r => isPV(r.DESTINO))
      let sectionPV = ''
      if (dataPV.length) {
        sectionPV = `<p style="font-family:Aptos,sans-serif;font-size:12pt;margin-top:16px;margin-bottom:8px;font-weight:bold;">Postventa</p>`
          + buildHTMLTable(dataPV, ['ISO', 'GESTIÓN', 'ORIGEN', 'DESTINO'], true)
      }

      // 3. K8
      const isK8 = (r: Row) => {
        const comm = String(r.COMENTARIO || '').toUpperCase()
        const gest = String(r.GESTIÓN || '').toUpperCase()
        return comm.includes('K8') || gest.includes('K8')
      }
      const dataK8 = rows.filter(isK8)
      let sectionK8 = ''
      if (dataK8.length) {
        sectionK8 = `<p style="font-family:Aptos,sans-serif;font-size:12pt;margin-top:16px;margin-bottom:8px;font-weight:bold;">K8</p>`
          + buildHTMLTable(dataK8, ['ISO', 'GESTIÓN', 'ORIGEN', 'DESTINO'], true)
      }

      // 4. Proyectos
      // Logic for driver "Francisco Javier diaz zamora" -> VEH98
      // Logic for "Proyecto_cocinas" -> VEH98 ADICIONAL
      // Exclude "Inicio"/"Fin"
      const dataProy = rows.filter(r => {
        const cond = String(r.CONDUCTOR || '').trim()
        const iso = String(r.ISO || '').trim().toUpperCase()
        if (iso === 'INICIO' || iso === 'FIN') return false
        return cond === 'Francisco Javier diaz zamora' || cond === 'Proyecto_cocinas'
      }).map(r => {
        const cond = String(r.CONDUCTOR || '').trim()
        return {
          ...r,
          DESTINO: cond === 'Francisco Javier diaz zamora' ? 'VEH98' : 'VEH98 ADICIONAL'
        }
      })
      
      let sectionProy = ''
      if (dataProy.length) {
        sectionProy = `<p style="font-family:Aptos,sans-serif;font-size:12pt;margin-top:16px;margin-bottom:8px;font-weight:bold;">Proyectos</p>`
          + buildHTMLTable(dataProy, ['ISO', 'DESTINO'], true)
      }

      html = intro + sectionRepites + sectionPV + sectionK8 + sectionProy
      plain = `Buenas tardes, comparto ruteos PM\n\nRepites...\nPostventa...\nK8...\nProyectos...`
      title = 'Ruteo PM'
    }

    copyAsHTML(html, plain)
    setCopiedId(id)
    onNotify(`✓ Plantilla ${title} copiada`)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const templates = [
    { id: 'ruteo_pm', label: '📦 RUTEO PM', desc: 'Resumen completo Repites, PV, K8 y Proyectos', color: '#f59e0b' },
    { id: 'repites', label: '🔄 REPITES', desc: 'Para re-intentos de entrega', color: '#3b82f6' },
    { id: 'pv', label: '🚚 POST VENTA', desc: 'Gestión con Wilfredo Rugel', color: '#8b5cf6' },
    { id: 'leslie', label: '🏗️ LESLIE', desc: 'Proyectos B2C Leslie', color: '#10b981' },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-8" style={{ background: TC.bg }}>
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {templates.map(t => (
            <Card key={t.id} style={{ padding: 0, overflow: 'hidden' }}>
              <div className="p-6 flex flex-col h-full border-t-4 transition-all hover:scale-[1.02]" style={{ borderColor: t.color }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold" style={{ color: TC.text }}>{t.label}</h3>
                  {copiedId === t.id ? (
                    <CheckCircle2 size={18} className="text-green-500" />
                  ) : (
                    <Btn onClick={() => handleCopy(t.id)} size="sm">
                      <Copy size={13} /> <span className="text-[10px]">Copiar HTML</span>
                    </Btn>
                  )}
                </div>
                <p className="text-[11px]" style={{ color: TC.textFaint }}>{t.desc}</p>
              </div>
            </Card>
          ))}
        </div>

        <Card style={{ padding: 24 }}>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">💡</div>
            <div>
              <h4 className="text-sm font-bold mb-1" style={{ color: TC.text }}>Instrucciones de Uso</h4>
              <p className="text-xs leading-relaxed" style={{ color: TC.textFaint }}>
                Estas plantillas están diseñadas para ser pegadas directamente en <strong>Outlook</strong>. 
                Al hacer clic en "Copiar HTML", se genera una tabla con formato <strong>Aptos 12pt</strong> 
                que mantiene los colores institucionales y el diseño original.
                <br/><br/>
                • <strong>REPITES:</strong> Filtra automáticamente las filas marcadas con "SI" en la columna "CORREO REPITES".<br/>
                • <strong>POST VENTA:</strong> Detecta vehículos de Post Venta en la columna "DESTINO".<br/>
                • <strong>LESLIE:</strong> Utiliza los datos cargados en el módulo de Proyectos Leslie.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default TabTemplates
