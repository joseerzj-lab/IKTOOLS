/**
 * SimpliRoute API service for searching ISOs via the SimpliRoute platform.
 * Reuses the same token and CORS proxy pattern from ISOsFaltantesGeo.
 *
 * Optimizations:
 *  - detail + pictures fetched in parallel (Promise.all)
 *  - higher concurrency (5 ISOs at once)
 *  - working CORS proxy is remembered for the session
 */

const BASE_URL = 'https://api.simpliroute.com'
const TOKEN = 'b388c699ed3bc4ecd2f748383e40b94ff650a8f6'

const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
]

/** Remembers which method worked last so subsequent calls skip failed ones */
let lastWorkingMethod: number | null = null

/* ── Generic API GET with CORS fallback ── */
async function apiGet(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const target = new URL(BASE_URL + endpoint)
  Object.entries(params).forEach(([k, v]) => target.searchParams.append(k, v))
  const directUrl = target.toString()

  const allAttempts = [
    { url: directUrl, headers: { 'Authorization': `Token ${TOKEN}` } as Record<string, string> },
    ...CORS_PROXIES.map(fn => ({
      url: fn(directUrl),
      headers: { 'Authorization': `Token ${TOKEN}`, 'x-requested-with': 'XMLHttpRequest' } as Record<string, string>,
    })),
  ]

  // Try the last working method first
  const orderedAttempts = lastWorkingMethod !== null
    ? [allAttempts[lastWorkingMethod], ...allAttempts.filter((_, i) => i !== lastWorkingMethod)]
    : allAttempts

  for (let i = 0; i < orderedAttempts.length; i++) {
    const attempt = orderedAttempts[i]
    try {
      const r = await fetch(attempt.url, { headers: attempt.headers })
      if (!r.ok) continue
      const data = await r.json()
      // Remember which method worked
      lastWorkingMethod = allAttempts.indexOf(attempt)
      return Array.isArray(data) ? data : data.results || data
    } catch {
      // try next
    }
  }
  return null
}

/* ── Extract ALL photo URLs from arrays ── */
function extractPhotosFromArr(pics: any): string[] {
  const urls: string[] = []
  if (!Array.isArray(pics)) return urls
  for (const p of pics) {
    if (!p) continue
    if (typeof p === 'string' && p.startsWith('http')) { urls.push(p); continue }
    if (typeof p === 'object') {
      const u = p.url || p.link || p.path || p.image || ''
      if (u && typeof u === 'string' && u.startsWith('http')) urls.push(u)
    }
  }
  return urls
}

export interface SimpliRouteResult {
  iso: string
  found: boolean
  // Columns matching reference code
  idReferencia: string
  fechaPlanificada: string
  conductor: string
  vehiculo: string
  titulo: string
  direccion: string
  latitud: string
  longitud: string
  carga: string
  carga2: string
  fotoUrl: string
  // Extra
  estado: string
  comentario: string
  motivo: string
  trackingId: string
  // Legacy compat
  parentOrder: string
  imageUrl: string
}

/** Map status code to human label */
function mapStatus(status: any): string {
  if (status === 3 || status === 'completed') return 'Completado'
  if (status === 4 || status === 'failed') return 'No Entregado'
  if (status === 2 || status === 'in_progress') return 'En Ruta'
  if (status === 1 || status === 'pending') return 'Pendiente'
  return String(status || '')
}

/**
 * Search for a single ISO title using the search parameter.
 * Detail + pictures are fetched in PARALLEL for speed.
 */
export async function searchISO(isoTitle: string): Promise<SimpliRouteResult[]> {
  const trimmed = isoTitle.trim()
  if (!trimmed) return []

  const notFound = (): SimpliRouteResult => ({
    iso: trimmed, found: false,
    idReferencia: '', fechaPlanificada: '', conductor: '', vehiculo: '',
    titulo: trimmed, direccion: '', latitud: '', longitud: '',
    carga: '', carga2: '', fotoUrl: '',
    estado: '', comentario: '', motivo: '', trackingId: '',
    parentOrder: trimmed, imageUrl: '',
  })

  // Buscar desde el 01-01 del año actual (igual que script GAS de referencia)
  const startOfYear = `${new Date().getFullYear()}-01-01`

  const visits = await apiGet('/v1/routes/visits/', {
    search: trimmed,
    planned_date__gte: startOfYear,
  })
  if (!visits || !Array.isArray(visits) || visits.length === 0) return [notFound()]

  // Match por título exacto O por referencia exacta (cubre todos los registros de la ISO)
  const trimmedLower = trimmed.toLowerCase()
  const matched = visits.filter((v: any) =>
    String(v.title || '').trim().toLowerCase() === trimmedLower ||
    String(v.reference || '').trim().toLowerCase() === trimmedLower
  )
  if (matched.length === 0) return [notFound()]

  const results: SimpliRouteResult[] = []

  for (const v of matched) {
    // Fetch detail AND pictures in PARALLEL for speed
    const [d, extraPics] = await Promise.all([
      apiGet(`/v1/plans/visits/${v.id}/detail/`).catch(() => ({})) || {},
      v.id ? apiGet(`/v1/routes/visits/${v.id}/pictures/`).catch(() => []) : Promise.resolve([]),
    ])

    // Merge photos from all sources (no duplicates)
    const photoSet = new Set<string>()
    for (const u of extractPhotosFromArr(d?.pictures)) photoSet.add(u)
    for (const u of extractPhotosFromArr(v?.pictures)) photoSet.add(u)
    for (const u of extractPhotosFromArr(extraPics)) photoSet.add(u)
    const allPhotos = [...photoSet]

    const obsId = (d?.checkout_observation !== undefined ? d.checkout_observation : v.checkout_observation) || ''
    const comments = String((d?.checkout_comment !== undefined ? d.checkout_comment : v.checkout_comment) || '')

    results.push({
      iso: trimmed,
      found: true,
      idReferencia: String(v.reference || ''),
      fechaPlanificada: String(v.planned_date || ''),
      conductor: String(d?.driver_name || v.driver_name || ''),
      vehiculo: String(d?.vehicle_name || v.vehicle_name || ''),
      titulo: String(v.title || ''),
      direccion: String(v.address || ''),
      latitud: String(v.latitude ?? ''),
      longitud: String(v.longitude ?? ''),
      carga: String(v.load ?? ''),
      carga2: String(v.load_2 ?? ''),
      fotoUrl: allPhotos.join(', '),
      estado: mapStatus(v.status),
      comentario: comments,
      motivo: String(obsId),
      trackingId: String(v.tracking_id || ''),
      parentOrder: String(v.reference || v.title || ''),
      imageUrl: allPhotos.join(', '),
    })
  }

  return results
}

/**
 * Search multiple ISOs with concurrency limit of 5.
 */
export async function searchMultipleISOs(
  isos: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<SimpliRouteResult[]> {
  const results: SimpliRouteResult[] = []
  const CONCURRENCY = 5

  for (let i = 0; i < isos.length; i += CONCURRENCY) {
    const batch = isos.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(batch.map(iso => searchISO(iso)))
    for (const r of batchResults) results.push(...r)
    onProgress?.(Math.min(i + CONCURRENCY, isos.length), isos.length)
  }

  return results
}
