import { NextRequest, NextResponse } from 'next/server'

// ── Shared result shape ─────────────────────────────────────────────────────
export interface PlaceResult {
  placeId: string
  name: string
  address: string
  phone: string | null
  website: string | null
  rating: number | null
  totalRatings: number | null
  types: string[]
  mapsUrl: string | null
  businessStatus: string | null
  lat: number | null
  lng: number | null
}

export type Provider = 'google' | 'yelp' | 'osm'

// ── Key detection ───────────────────────────────────────────────────────────
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY ?? ''
const YELP_KEY   = process.env.YELP_API_KEY ?? ''

function isConfigured(val: string, placeholder: string) {
  return val.trim() !== '' && val.trim() !== placeholder
}

export function activeProvider(): Provider {
  if (isConfigured(GOOGLE_KEY, 'your_google_places_api_key')) return 'google'
  if (isConfigured(YELP_KEY,   'your_yelp_api_key'))           return 'yelp'
  return 'osm'
}

// ── GET — return which provider is active ───────────────────────────────────
export async function GET() {
  return NextResponse.json({ provider: activeProvider() })
}

// ── POST — run a search ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body     = await req.json().catch(() => ({}))
    const query    = typeof body?.query    === 'string' ? body.query.trim()    : ''
    const location = typeof body?.location === 'string' ? body.location.trim() : ''

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

    const provider = activeProvider()
    let results: PlaceResult[] = []

    if (provider === 'google') {
      results = await googleSearch(query, location)
    } else if (provider === 'yelp') {
      results = await yelpSearch(query, location)
    } else {
      results = await osmSearch(query, location)
    }

    return NextResponse.json({ results, total: results.length, source: provider })
  } catch (err: unknown) {
    console.error('Lead search error:', err)
    const raw     = err instanceof Error ? err : null
    const message = raw?.message ?? 'Search failed'
    const code    = (raw as { code?: string })?.code ?? ''
    return NextResponse.json({ error: message, code }, { status: 500 })
  }
}

// ===========================================================================
//  PROVIDER 1 — GOOGLE PLACES
// ===========================================================================
const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place'

function googleStatusError(status: string, message?: string): string {
  switch (status) {
    case 'REQUEST_DENIED':
      return message?.includes('not activated')
        ? 'Places API is not enabled. Go to Google Cloud Console → APIs & Services → Enable "Places API".'
        : message?.includes('billing')
        ? 'Billing is not enabled on your Google Cloud project. Enable billing at console.cloud.google.com.'
        : `API request denied: ${message || 'Check your API key and ensure Places API is enabled.'}`
    case 'INVALID_REQUEST':  return 'Invalid search query. Please try a different term.'
    case 'OVER_QUERY_LIMIT': return 'Google API quota exceeded. Try again shortly.'
    case 'UNKNOWN_ERROR':    return 'Google server error. Please try again.'
    case 'NOT_FOUND':        return 'No results found for that search.'
    default:                 return `Google API returned status: ${status}. ${message ?? ''}`
  }
}

async function googlePlaceDetails(placeId: string): Promise<Partial<PlaceResult>> {
  const fields = [
    'name', 'formatted_phone_number', 'website', 'formatted_address',
    'rating', 'user_ratings_total', 'types', 'url', 'business_status', 'geometry',
  ].join(',')
  try {
    const res  = await fetch(
      `${PLACES_BASE}/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_KEY}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const data = await res.json()
    if (data.status !== 'OK') return {}
    const r = data.result
    return {
      phone:          r.formatted_phone_number || null,
      website:        r.website || null,
      rating:         r.rating ?? null,
      totalRatings:   r.user_ratings_total ?? null,
      types:          r.types || [],
      mapsUrl:        r.url || null,
      businessStatus: r.business_status || null,
      lat:            r.geometry?.location?.lat ?? null,
      lng:            r.geometry?.location?.lng ?? null,
    }
  } catch { return {} }
}

async function googleSearch(query: string, location: string): Promise<PlaceResult[]> {
  const searchQuery = location ? `${query} in ${location}` : query
  const url = `${PLACES_BASE}/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${GOOGLE_KEY}`

  let data: { status: string; error_message?: string; results?: unknown[] }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    data = await res.json()
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('timeout') || msg.includes('abort')) throw new Error('Request to Google timed out.')
    throw e
  }

  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw Object.assign(new Error(googleStatusError(data.status, data.error_message)), { code: data.status })
  }

  if (!data.results?.length) return []

  const top = (data.results as Array<{
    place_id: string; name: string; formatted_address: string
    rating?: number; user_ratings_total?: number; types?: string[]
    geometry?: { location?: { lat?: number; lng?: number } }
  }>).slice(0, 15)

  return Promise.all(top.map(async place => {
    const d = await googlePlaceDetails(place.place_id)
    return {
      placeId:        place.place_id,
      name:           place.name,
      address:        place.formatted_address,
      phone:          d.phone          ?? null,
      website:        d.website        ?? null,
      rating:         d.rating         ?? place.rating             ?? null,
      totalRatings:   d.totalRatings   ?? place.user_ratings_total ?? null,
      types:          d.types          ?? place.types              ?? [],
      mapsUrl:        d.mapsUrl        ?? null,
      businessStatus: d.businessStatus ?? null,
      lat:            d.lat            ?? place.geometry?.location?.lat ?? null,
      lng:            d.lng            ?? place.geometry?.location?.lng ?? null,
    } satisfies PlaceResult
  }))
}

// ===========================================================================
//  PROVIDER 2 — YELP FUSION  (free 500 req/day, no billing)
// ===========================================================================
interface YelpBusiness {
  id: string; name: string
  phone?: string; display_phone?: string
  url?: string; rating?: number; review_count?: number; is_closed?: boolean
  categories?: { alias: string; title: string }[]
  location?: { display_address?: string[] }
  coordinates?: { latitude?: number; longitude?: number }
}

async function yelpSearch(query: string, location: string): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    term:     query,
    location: location || 'United States',
    limit:    '15',
    sort_by:  'review_count',
  })

  const res = await fetch(`https://api.yelp.com/v3/businesses/search?${params}`, {
    headers: { Authorization: `Bearer ${YELP_KEY}` },
    signal:  AbortSignal.timeout(10000),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const desc = (body as { error?: { description?: string } })?.error?.description ?? ''
    throw new Error(`Yelp API error ${res.status}${desc ? ': ' + desc : ''}`)
  }

  const data = await res.json()
  const businesses: YelpBusiness[] = data.businesses ?? []

  return businesses.map(b => ({
    placeId:        b.id,
    name:           b.name,
    address:        b.location?.display_address?.join(', ') ?? '',
    phone:          b.display_phone || null,
    website:        null,
    rating:         b.rating         ?? null,
    totalRatings:   b.review_count   ?? null,
    types:          b.categories?.map(c => c.title) ?? [],
    mapsUrl:        b.url            || null,
    businessStatus: b.is_closed ? 'CLOSED_PERMANENTLY' : 'OPERATIONAL',
    lat:            b.coordinates?.latitude  ?? null,
    lng:            b.coordinates?.longitude ?? null,
  }))
}

// ===========================================================================
//  PROVIDER 3 — NOMINATIM (OpenStreetMap) — zero API key needed
//
//  ROOT CAUSE NOTE:
//  Nominatim's structured search only accepts `amenity=` as an OSM tag param.
//  Passing `shop=`, `leisure=`, `office=`, `tourism=` causes HTTP 400.
//  Fix: use amenity= only for amenity types; use text search for everything else.
// ===========================================================================

// Only `amenity` is a valid Nominatim structured tag parameter
const AMENITY_MAP: [RegExp, string][] = [
  [/dentist/i,                         'dentist'],
  [/doctor|physician|clinic|medical/i, 'doctors'],
  [/hospital/i,                        'hospital'],
  [/pharmacy|drug\s*store/i,           'pharmacy'],
  [/bank/i,                            'bank'],
  [/restaurant|dining/i,               'restaurant'],
  [/cafe|coffee/i,                     'cafe'],
  [/school/i,                          'school'],
  [/university|college/i,              'university'],
  [/bar|pub/i,                         'bar'],
  [/fast\s*food/i,                     'fast_food'],
  [/child\s*care|daycare|nursery/i,    'childcare'],
  [/church|chapel|worship/i,           'place_of_worship'],
  [/vet|veterinarian/i,                'veterinary'],
  [/fuel|gas\s*station/i,              'fuel'],
  [/atm/i,                             'atm'],
]

function queryToAmenity(q: string): string | null {
  for (const [re, val] of AMENITY_MAP) {
    if (re.test(q)) return val
  }
  return null
}

// OSM classes representing actual businesses (used by text-search filter)
const OSM_BUSINESS_CLASSES = new Set([
  'amenity', 'shop', 'craft', 'office', 'tourism',
  'leisure', 'healthcare', 'emergency', 'club',
])

interface NominatimResult {
  place_id: number
  osm_type: string
  osm_id: number
  lat: string
  lon: string
  class: string
  type: string
  name?: string
  display_name: string
  address: {
    house_number?: string; road?: string; suburb?: string
    city?: string; town?: string; state?: string
    postcode?: string; country?: string
  }
  extratags?: {
    phone?: string; website?: string; email?: string
    'contact:phone'?: string; 'contact:website'?: string
  }
}

function nominatimToResult(r: NominatimResult, amenitySearch: boolean): PlaceResult | null {
  if (!r.name) return null
  // Amenity structured results: must be amenity class (blocks cities/regions)
  if (amenitySearch  && r.class !== 'amenity') return null
  // Text results: only show actual business OSM classes
  if (!amenitySearch && !OSM_BUSINESS_CLASSES.has(r.class)) return null

  const a = r.address
  const addrParts = [
    a.house_number, a.road, a.suburb,
    a.city || a.town, a.state, a.postcode,
  ].filter(Boolean)

  const ext     = r.extratags ?? {}
  const lat     = parseFloat(r.lat)
  const lng     = parseFloat(r.lon)

  return {
    placeId:        `osm_${r.osm_type}_${r.osm_id}`,
    name:           r.name,
    address:        addrParts.length ? addrParts.join(', ') : r.display_name,
    phone:          ext.phone   ?? ext['contact:phone']   ?? null,
    website:        ext.website ?? ext['contact:website'] ?? null,
    rating:         null,
    totalRatings:   null,
    types:          [r.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())],
    mapsUrl:        `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16`,
    businessStatus: null,
    lat,
    lng,
  }
}

const NOM_HEADERS = {
  'User-Agent': 'LeadDashboard/1.0 (business-lead-finder)',
  'Accept':     'application/json',
}
const NOM_BASE = {
  format: 'json', limit: '20', addressdetails: '1', extratags: '1', dedupe: '1',
}

async function nominatimFetch(params: URLSearchParams): Promise<NominatimResult[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: NOM_HEADERS, signal: AbortSignal.timeout(12000) }
  )
  if (!res.ok) throw new Error(`OpenStreetMap search error ${res.status}`)
  return res.json()
}

async function osmSearch(query: string, location: string): Promise<PlaceResult[]> {
  const amenity = queryToAmenity(query)
  const seen    = new Set<string>()
  const out: PlaceResult[] = []

  const push = (items: (PlaceResult | null)[]) => {
    for (const p of items) {
      if (p && !seen.has(p.placeId)) { seen.add(p.placeId); out.push(p) }
    }
  }

  // ── Step 1: Structured amenity search (ONLY for amenity types + location) ─
  // amenity= is the ONLY OSM tag Nominatim accepts as a structured parameter.
  // Any other key (shop=, office=, leisure=, tourism=) causes HTTP 400.
  if (amenity && location) {
    const p: Record<string, string> = { ...NOM_BASE, amenity }
    const parts = location.split(',').map(s => s.trim()).filter(Boolean)
    if (parts[0]) p['city']    = parts[0]
    if (parts[1]) p['state']   = parts[1]
    if (parts[2]) p['country'] = parts[2]
    const data = await nominatimFetch(new URLSearchParams(p))
    push(data.map(r => nominatimToResult(r, true)))
  }

  // ── Step 2: Text search — catches non-amenity types & supplements step 1 ──
  // e.g. "plumbers New York" finds "Stanley Lewis Plumbers" by name match
  if (out.length < 10) {
    const q    = location ? `${query} ${location}` : query
    const data = await nominatimFetch(new URLSearchParams({ ...NOM_BASE, q }))
    push(data.map(r => nominatimToResult(r, false)))
  }

  return out.slice(0, 15)
}
