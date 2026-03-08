import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { RouteRow } from '../types/auditoria'

interface ParseResult {
  rows: RouteRow[]
  hasGeo: boolean
  error: string | null
}

// Normaliza un string para comparación de columnas
function nm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// Encuentra la primera columna que coincida con los candidatos dados
function findCol(keys: string[], ...candidates: string[]): string | undefined {
  // exact match primero
  const exact = keys.find(k => candidates.some(c => nm(k) === nm(c)))
  if (exact) return exact
  // partial match
  return keys.find(k => candidates.some(c => nm(k).includes(nm(c))))
}

// Parsea filas crudas en RouteRow[]
function parseRows(rows: Record<string, string>[]): ParseResult {
  if (!rows.length) return { rows: [], hasGeo: false, error: 'Archivo vacío' }

  const keys = Object.keys(rows[0])

  const cTit  = findCol(keys, 'Título', 'Titulo', 'titulo', 'iso')
  const cVeh  = findCol(keys, 'Vehículo', 'Vehiculo', 'vehiculo', 'veh')
  const cDir  = findCol(keys, 'Dirección', 'Direccion', 'direccion', 'dir', 'address')
  const cLat  = findCol(keys, 'Latitud', 'Lat', 'latitude', 'lat', 'y')
  const cLng  = findCol(keys, 'Longitud', 'Lng', 'Lon', 'longitude', 'lng', 'lon', 'x')
  const cPar  = findCol(keys, 'Parada', 'Stop', 'stop', 'orden', 'order', 'secuencia', 'seq', 'numero', 'num')

  if (!cTit) return { rows: [], hasGeo: false, error: `No se encontró columna Titulo. Cols: ${keys.slice(0, 6).join(' | ')}` }
  if (!cVeh) return { rows: [], hasGeo: false, error: 'No se encontró columna Vehiculo.' }
  if (!cDir) return { rows: [], hasGeo: false, error: 'No se encontró columna Direccion.' }

  const parsed: RouteRow[] = rows
    .filter(r => {
      const iso = (r[cTit] || '').trim().toUpperCase()
      return iso && iso !== 'INICIO' && iso !== 'FIN'
    })
    .map(r => {
      const dir = (r[cDir] || '').trim()
      const parts = dir.split(',').map(s => s.trim())
      const n = parts.length
      const lat = cLat ? parseFloat(r[cLat]) : NaN
      const lng = cLng ? parseFloat(r[cLng]) : NaN
      const isChile = n >= 1 && parts[n - 1].trim().toUpperCase() === 'CHILE'
      const comunaIdx = isChile ? (n >= 3 ? n - 3 : 0) : (n >= 2 ? n - 2 : 0)
      const provIdx   = isChile ? (n >= 2 ? n - 2 : 0) : (n >= 1 ? n - 1 : 0)

      return {
        iso:      (r[cTit] || '').trim(),
        veh:      (r[cVeh] || '').trim(),
        dir,
        comuna:   parts[comunaIdx] || 'Sin comuna',
        provincia: parts[provIdx] || '',
        lat:      isNaN(lat) ? null : lat,
        lng:      isNaN(lng) ? null : lng,
        parada:   cPar ? (parseInt(r[cPar]) || 0) : 0,
      }
    })

  const hasGeo = parsed.some(r => r.lat !== null && r.lng !== null)
  return { rows: parsed, hasGeo, error: null }
}

// ── Hook principal ────────────────────────────────────────────
export function useFileParser() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const parseFile = useCallback(
    (file: File): Promise<ParseResult> => {
      return new Promise(resolve => {
        setLoading(true)
        setError(null)

        const reader = new FileReader()

        reader.onload = e => {
          try {
            let rawRows: Record<string, string>[]

            if (/\.xlsx?$/i.test(file.name)) {
              const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: 'array' })
              rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(
                wb.Sheets[wb.SheetNames[0]],
                { defval: '' }
              )
            } else {
              // CSV / TSV
              const text = e.target!.result as string
              const lines = text.split(/\r?\n/).filter(Boolean)
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
            setError(msg)
            setLoading(false)
            resolve({ rows: [], hasGeo: false, error: msg })
          }
        }

        if (/\.xlsx?$/i.test(file.name)) reader.readAsArrayBuffer(file)
        else reader.readAsText(file, 'UTF-8')
      })
    },
    []
  )

  return { parseFile, loading, error }
}
