/**
 * SimpliRoute API service for searching ISOs via the SimpliRoute platform.
 * Reuses the same token and CORS proxy pattern from ISOsFaltantesGeo.
 */

const BASE_URL = 'https://api.simpliroute.com'
const TOKEN = 'b388c699ed3bc4ecd2f748383e40b94ff650a8f6'

const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
]

/* ── Generic API GET with CORS fallback ── */
async function apiGet(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const target = new URL(BASE_URL + endpoint)
  Object.entries(params).forEach(([k, v]) => target.searchParams.append(k, v))
  const directUrl = target.toString()

  const attempts = [
    { url: directUrl, headers: { 'Authorization': `Token ${TOKEN}` } },
    ...CORS_PROXIES.map(fn => ({
      url: fn(directUrl),
      headers: { 'Authorization': `Token ${TOKEN}`, 'x-requested-with': 'XMLHttpRequest' },
    })),
  ]

  for (const attempt of attempts) {
    try {
      const r = await fetch(attempt.url, { headers: attempt.headers })
      if (!r.ok) continue
      const data = await r.json()
      return Array.isArray(data) ? data : data.results || data
    } catch {
      // try next proxy
    }
  }
  return null
}

/* ── Extract ALL photo URLs from a visit/detail ── */
function extractAllPhotos(v: any, d: any): string[] {
  const urls: string[] = []

  const extractFromArr = (pics: any) => {
    if (!Array.isArray(pics)) return
    for (const p of pics) {
      if (!p) continue
      if (typeof p === 'string' && p.startsWith('http')) { urls.push(p); continue }
      if (typeof p === 'object') {
        const u = p.url || p.link || p.path || p.image || ''
        if (u && typeof u === 'string') urls.push(u)
      }
    }
  }

  // From detail
  if (d) extractFromArr(d.pictures)
  // From visit
  if (v) extractFromArr(v.pictures)

  return urls
}

/* ── Get photos via dedicated endpoint ── */
async function getVisitPictures(visitId: number): Promise<string[]> {
  try {
    const resp = await apiGet(`/v1/routes/visits/${visitId}/pictures/`)
    if (!resp) return []
    const urls: string[] = []
    if (Array.isArray(resp)) {
      for (const p of resp) {
        if (!p) continue
        if (typeof p === 'string' && p.startsWith('http')) { urls.push(p); continue }
        if (typeof p === 'object') {
          const u = p.url || p.link || p.path || p.image || ''
          if (u && typeof u === 'string') urls.push(u)
        }
      }
    }
    return urls
  } catch {
    return []
  }
}

export interface SimpliRouteResult {
  iso: string
  found: boolean
  parentOrder: string
  estado: string
  comentario: string
  motivo: string
  imageUrl: string
  direccion: string
  // Extra SimpliRoute fields
  conductor: string
  vehiculo: string
  fechaPlanificada: string
  trackingId: string
}

/**
 * Search for a single ISO title across ALL dates using the search parameter.
 * Returns an array of matching results (could be 0 or many).
 */
export async function searchISO(isoTitle: string): Promise<SimpliRouteResult[]> {
  const trimmed = isoTitle.trim()
  if (!trimmed) return []

  // Search visits with the title as search parameter
  const visits = await apiGet('/v1/routes/visits/', { search: trimmed })
  if (!visits || !Array.isArray(visits) || visits.length === 0) {
    return [{
      iso: trimmed, found: false, parentOrder: trimmed,
      estado: '', comentario: '', motivo: '', imageUrl: '', direccion: '',
      conductor: '', vehiculo: '', fechaPlanificada: '', trackingId: '',
    }]
  }

  // Filter to exact title matches (case insensitive)
  const matched = visits.filter((v: any) =>
    String(v.title || '').trim().toLowerCase() === trimmed.toLowerCase()
  )

  if (matched.length === 0) {
    return [{
      iso: trimmed, found: false, parentOrder: trimmed,
      estado: '', comentario: '', motivo: '', imageUrl: '', direccion: '',
      conductor: '', vehiculo: '', fechaPlanificada: '', trackingId: '',
    }]
  }

  const results: SimpliRouteResult[] = []

  for (const v of matched) {
    // Get detail for extra info
    let d: any = {}
    try {
      d = await apiGet(`/v1/plans/visits/${v.id}/detail/`) || {}
    } catch { /* ignore */ }

    // Get photos from inline data
    let photos = extractAllPhotos(v, d)

    // Also try the dedicated pictures endpoint
    if (v.id) {
      const morePhotos = await getVisitPictures(v.id)
      // Merge without duplicates
      for (const url of morePhotos) {
        if (!photos.includes(url)) photos.push(url)
      }
    }

    // Map observation to label
    const obsId = (d.checkout_observation !== undefined ? d.checkout_observation : v.checkout_observation) || ''
    const obsLabel = String(obsId)
    const comments = String((d.checkout_comment !== undefined ? d.checkout_comment : v.checkout_comment) || '')

    // Map status
    const status = v.status
    let estado = ''
    if (status === 3 || status === 'completed') estado = 'Completado'
    else if (status === 4 || status === 'failed') estado = 'No Entregado'
    else if (status === 2 || status === 'in_progress') estado = 'En Ruta'
    else if (status === 1 || status === 'pending') estado = 'Pendiente'
    else estado = String(status || '')

    results.push({
      iso: trimmed,
      found: true,
      parentOrder: String(v.reference || v.title || ''),
      estado,
      comentario: comments,
      motivo: obsLabel,
      imageUrl: photos.join(', '),
      direccion: String(v.address || ''),
      conductor: String(d.driver_name || v.driver_name || ''),
      vehiculo: String(d.vehicle_name || v.vehicle_name || ''),
      fechaPlanificada: String(v.planned_date || ''),
      trackingId: String(v.tracking_id || ''),
    })
  }

  return results
}

/**
 * Search multiple ISOs in parallel (with concurrency limit).
 */
export async function searchMultipleISOs(
  isos: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<SimpliRouteResult[]> {
  const results: SimpliRouteResult[] = []
  const CONCURRENCY = 3

  for (let i = 0; i < isos.length; i += CONCURRENCY) {
    const batch = isos.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(batch.map(iso => searchISO(iso)))
    for (const r of batchResults) results.push(...r)
    onProgress?.(Math.min(i + CONCURRENCY, isos.length), isos.length)
  }

  return results
}
