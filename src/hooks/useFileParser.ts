import { useState, useCallback } from 'react'
import type { RouteRow } from '../types/auditoria'

// XLSX is loaded via CDN in index.html as window.XLSX
// No npm package needed — this avoids the xlsx import issue

interface ParseResult {
  rows: RouteRow[]
  hasGeo: boolean
  error: string | null
}

function nm(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function findCol(keys: string[], ...candidates: string[]): string | undefined {
  const exact = keys.find(k => candidates.some(c => nm(k) === nm(c)))
  if (exact) return exact
  return keys.find(k => candidates.some(c => nm(k).includes(nm(c))))
}

function parseRows(rows: Record<string, string>[]): ParseResult {
  if (!rows.length) return { rows: [], hasGeo: false, error: 'Archivo vacío' }

  const keys = Object.keys(rows[0])

  const cTit = findCol(keys, 'Título', 'Titulo', 'titulo', 'title', 'iso', 'titulos')
  const cVeh = findCol(keys, 'Vehículo', 'Vehiculo', 'vehiculo', 'veh', 'vehicle', 'camion', 'truck')
  const cDir = findCol(keys, 'Dirección', 'Direccion', 'direccion', 'dir', 'address', 'domicilio')
  const cLat = findCol(keys, 'Latitud', 'Lat', 'latitude', 'lat', 'y', 'coord_y')
  const cLng = findCol(keys, 'Longitud', 'Lng', 'Lon', 'longitude', 'lng', 'lon', 'x', 'coord_x')
  const cPar = findCol(keys, 'Parada', 'Stop', 'stop', 'orden', 'order', 'secuencia', 'seq', 'numero', 'num', 'n')

  if (!cTit) return { rows: [], hasGeo: false, error: `No se encontró columna Titulo/ISO. Columnas encontradas: ${keys.slice(0, 8).join(' | ')}` }
  if (!cVeh) return { rows: [], hasGeo: false, error: `No se encontró columna Vehículo. Columnas: ${keys.slice(0, 8).join(' | ')}` }
  if (!cDir) return { rows: [], hasGeo: false, error: `No se encontró columna Dirección. Columnas: ${keys.slice(0, 8).join(' | ')}` }

  const parsed: RouteRow[] = rows
    .filter(r => {
      const iso = (r[cTit] || '').trim().toUpperCase()
      return iso && iso !== 'INICIO' && iso !== 'FIN' && iso !== 'INICIO DE RUTA' && iso !== 'FIN DE RUTA'
    })
    .map(r => {
      const dir = (r[cDir] || '').trim()
      const parts = dir.split(',').map((s: string) => s.trim())
      const n = parts.length
      const lat = cLat ? parseFloat(r[cLat]) : NaN
      const lng = cLng ? parseFloat(r[cLng]) : NaN
      const isChile = n >= 1 && parts[n - 1].trim().toUpperCase() === 'CHILE'
      const comunaIdx = isChile ? (n >= 3 ? n - 3 : 0) : (n >= 2 ? n - 2 : 0)
      const provIdx   = isChile ? (n >= 2 ? n - 2 : 0) : (n >= 1 ? n - 1 : 0)

      return {
        iso:       (r[cTit] || '').trim(),
        veh:       (r[cVeh] || '').trim(),
        dir,
        comuna:    parts[comunaIdx] || 'Sin comuna',
        provincia: parts[provIdx] || '',
        lat:       isNaN(lat) ? null : lat,
        lng:       isNaN(lng) ? null : lng,
        parada:    cPar ? (parseInt(r[cPar]) || 0) : 0,
      }
    })

  const hasGeo = parsed.some(r => r.lat !== null && r.lng !== null)
  return { rows: parsed, hasGeo, error: null }
}

export function useFileParser() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const parseFile = useCallback((file: File): Promise<ParseResult> => {
    return new Promise(resolve => {
      setLoading(true)
      setError(null)

      const reader = new FileReader()

      reader.onload = e => {
        try {
          let rawRows: Record<string, string>[]

          if (/\.xlsx?$/i.test(file.name)) {
            // Use window.XLSX loaded via CDN
            const W = (window as any).XLSX
            if (!W) {
              const msg = 'XLSX no disponible. Asegúrate de tener <script src="XLSX CDN"> en index.html'
              setError(msg); setLoading(false)
              resolve({ rows: [], hasGeo: false, error: msg })
              return
            }
            const wb = W.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: 'array' })
            rawRows = W.utils.sheet_to_json(
              wb.Sheets[wb.SheetNames[0]], { defval: '' }
            )
          } else {
            // CSV / TSV — pure JS, no library needed
            const text = e.target!.result as string
            const lines = text.split(/\r?\n/).filter(Boolean)
            if (lines.length < 2) {
              resolve({ rows: [], hasGeo: false, error: 'CSV vacío o sin filas de datos' })
              return
            }
            const sep = (lines[0].match(/\t/g) || []).length > (lines[0].match(/,/g) || []).length ? '\t' : ','
            const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''))
            rawRows = lines.slice(1).map(line => {
              const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''))
              const obj: Record<string, string> = {}
              headers.forEach((h, i) => { obj[h] = vals[i] || '' })
              return obj
            })
          }

          const result = parseRows(rawRows)
          if (result.error) setError(result.error)
          setLoading(false)
          resolve(result)
        } catch (err: any) {
          const msg = `Error al leer archivo: ${err.message}`
          setError(msg); setLoading(false)
          resolve({ rows: [], hasGeo: false, error: msg })
        }
      }

      reader.onerror = () => {
        const msg = 'Error al leer el archivo'
        setError(msg); setLoading(false)
        resolve({ rows: [], hasGeo: false, error: msg })
      }

      if (/\.xlsx?$/i.test(file.name)) reader.readAsArrayBuffer(file)
      else reader.readAsText(file, 'UTF-8')
    })
  }, [])

  return { parseFile, loading, error }
}