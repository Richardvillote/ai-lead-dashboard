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

// ── GET — return which provider is active (used by the UI on load) ──────────
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
    // Bubble up any custom code attached to the error
    const code    = (raw as { code?: string })?.code ?? ''
    return NextResponse.json({ error: message, code }, { status: 500 })
  }
}

// ===========================================================================
//  PROVIDER 1 — GOOGLE PLACES  (best data, needs billing key)
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
    case 'OVER_QUERY_LIMIT': return 'Google API quota exceeded. Try again shortly or check your billing limits.'
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
    const errMsg = googleStatusError(data.status, data.error_message)
    const err = Object.assign(new Error(errMsg), { code: data.status })
    throw err
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
//  PROVIDER 2 — YELP FUSION  (free 500 req/day, no billing needed)
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
    website:        null, // Yelp search doesn't expose business websites
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
//  PROVIDER 3 — OPENSTREETMAP (Overpass + Nominatim) — zero API key needed
// ===========================================================================

// Map common search terms to OSM tags
const OSM_TAG_MAP: [RegExp, string][] = [
  [/plumb/i,                              '["shop"="plumber"]'],
  [/electr/i,                             '["shop"="electrician"]'],
  [/paint/i,                              '["shop"="painter"]'],
  [/hvac|heating|cooling|air\s*con/i,     '["shop"="hvac"]'],
  [/dentist/i,                            '["amenity"="dentist"]'],
  [/doctor|physician|clinic|medical/i,    '["amenity"="doctors"]'],
  [/hospital/i,                           '["amenity"="hospital"]'],
  [/pharmacy|drug\s*store/i,              '["amenity"="pharmacy"]'],
  [/bank/i,                               '["amenity"="bank"]'],
  [/restaurant|dining/i,                  '["amenity"="restaurant"]'],
  [/cafe|coffee/i,                        '["amenity"="cafe"]'],
  [/lawyer|attorney|law\s*firm/i,         '["office"="lawyer"]'],
  [/accountant|accounting|cpa/i,          '["office"="accountant"]'],
  [/real\s*estate|realtor/i,              '["office"="estate_agent"]'],
  [/insurance/i,                          '["office"="insurance"]'],
  [/gym|fitness|crossfit/i,               '["leisure"="fitness_centre"]'],
  [/hair\s*salon|salon/i,                 '["shop"="hairdresser"]'],
  [/barber/i,                             '["shop"="barber"]'],
  [/auto\s*repair|car\s*repair|mechanic/, '["shop"="car_repair"]'],
  [/car\s*dealer/i,                       '["shop"="car"]'],
  [/hotel|motel|lodging/i,               '["tourism"="hotel"]'],
  [/school/i,                             '["amenity"="school"]'],
  [/university|college/i,                 '["amenity"="university"]'],
  [/contractor|construction/i,            '["office"="construction_company"]'],
  [/moving/i,                             '["office"="moving_company"]'],
  [/grocery|supermarket/i,                '["shop"="supermarket"]'],
  [/bakery/i,                             '["shop"="bakery"]'],
  [/vet|veterinarian/i,                   '["amenity"="veterinary"]'],
  [/child\s*care|daycare|nursery/i,       '["amenity"="childcare"]'],
  [/church|chapel|worship/i,              '["amenity"="place_of_worship"]'],
  [/plumber/i,                            '["shop"="plumber"]'],
]

function queryToOsmTag(q: string): string | null {
  for (const [re, tag] of OSM_TAG_MAP) {
    if (re.test(q)) return tag
  }
  return null
}

async function nominatimGeocode(location: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`
    const res  = await fetch(url, {
      headers: { 'User-Agent': 'LeadDashboard/1.0 (lead-finder)' },
      signal:  AbortSignal.timeout(8000),
    })
    const data = await res.json()
    if (!Array.isArray(data) || !data[0]) return null
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
  } catch { return null }
}

interface OsmElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number; lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

function osmToResult(el: OsmElement): PlaceResult | null {
  const tags = el.tags ?? {}
  if (!tags.name) return null

  const addr = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city'],
    tags['addr:state'],
    tags['addr:postcode'],
  ].filter(Boolean).join(', ') || tags['addr:full'] || ''

  const lat = el.lat ?? el.center?.lat ?? null
  const lng = el.lon ?? el.center?.lon ?? null

  const rawType = tags.amenity ?? tags.shop ?? tags.office ?? tags.leisure ?? tags.tourism ?? ''
  const typeLabel = rawType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const mapsUrl = lat && lng
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16`
    : null

  return {
    placeId:        `osm_${el.type}_${el.id}`,
    name:           tags.name,
    address:        addr,
    phone:          tags.phone ?? tags['contact:phone'] ?? null,
    website:        tags.website ?? tags['contact:website'] ?? null,
    rating:         null,
    totalRatings:   null,
    types:          typeLabel ? [typeLabel] : [],
    mapsUrl,
    businessStatus: null,
    lat:            lat ?? null,
    lng:            lng ?? null,
  }
}

async function osmSearch(query: string, location: string): Promise<PlaceResult[]> {
  const RADIUS = 10000 // 10 km

  // Geocode location if provided
  const coords = location ? await nominatimGeocode(location) : null
  const tagFilter = queryToOsmTag(query)

  // Build Overpass query
  let overpassQuery: string

  if (tagFilter && coords) {
    // Best case: known tag + geocoded location
    overpassQuery = `
[out:json][timeout:25];
(
  node${tagFilter}(around:${RADIUS},${coords.lat},${coords.lon});
  way${tagFilter}(around:${RADIUS},${coords.lat},${coords.lon});
);
out body center 20;`

  } else if (coords) {
    // Known location, search by name
    const safe = query.replace(/[^a-zA-Z0-9 ]/g, '').trim()
    overpassQuery = `
[out:json][timeout:25];
(
  node["name"~"${safe}",i](around:${RADIUS},${coords.lat},${coords.lon});
  way["name"~"${safe}",i](around:${RADIUS},${coords.lat},${coords.lon});
);
out body center 20;`

  } else if (tagFilter) {
    // No location but known category — limit to 20 worldwide hits
    overpassQuery = `
[out:json][timeout:20];
(
  node${tagFilter}["name"](if: count_tags() > 3);
  way${tagFilter}["name"](if: count_tags() > 3);
);
out body center 20;`

  } else {
    // No location, unknown category — broad name search
    const safe = query.replace(/[^a-zA-Z0-9 ]/g, '').trim()
    overpassQuery = `
[out:json][timeout:20];
(
  node["name"~"${safe}",i]["amenity"];
  node["name"~"${safe}",i]["shop"];
  node["name"~"${safe}",i]["office"];
);
out body 20;`
  }

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method:  'POST',
    body:    `data=${encodeURIComponent(overpassQuery)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal:  AbortSignal.timeout(30000),
  })

  if (!res.ok) throw new Error(`OpenStreetMap API error ${res.status}`)

  const data = await res.json()
  const elements: OsmElement[] = data.elements ?? []

  return elements
    .map(osmToResult)
    .filter((r): r is PlaceResult => r !== null)
    .slice(0, 15)
}
