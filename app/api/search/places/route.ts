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
//  PROVIDER 1 — GOOGLE PLACES (paginated — up to 60 results, 3 pages × 20)
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

interface GoogleRawResult {
  place_id: string
  name: string
  formatted_address: string
  rating?: number
  user_ratings_total?: number
  types?: string[]
  geometry?: { location?: { lat?: number; lng?: number } }
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
  let url = `${PLACES_BASE}/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${GOOGLE_KEY}`

  const allRaw: GoogleRawResult[] = []

  // ── Paginate through all pages (Google allows max 3 pages = up to 60 results) ──
  for (let page = 0; page < 3; page++) {
    let data: {
      status: string
      error_message?: string
      results?: GoogleRawResult[]
      next_page_token?: string
    }

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      data = await res.json()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('timeout') || msg.includes('abort')) throw new Error('Request to Google timed out.')
      throw e
    }

    if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      // Only throw on first page; subsequent pages just stop
      if (page === 0) {
        throw Object.assign(
          new Error(googleStatusError(data.status, data.error_message)),
          { code: data.status }
        )
      }
      break
    }

    if (data.results?.length) allRaw.push(...data.results)

    // Stop if no more pages
    if (!data.next_page_token) break

    // Google requires a ~2s delay before next_page_token becomes active
    await new Promise(r => setTimeout(r, 2000))
    url = `${PLACES_BASE}/textsearch/json?pagetoken=${encodeURIComponent(data.next_page_token)}&key=${GOOGLE_KEY}`
  }

  if (!allRaw.length) return []

  // ── Fetch full details in parallel batches of 10 ──────────────────────────
  const BATCH_SIZE = 10
  const detailed: PlaceResult[] = []

  for (let i = 0; i < allRaw.length; i += BATCH_SIZE) {
    const batch = allRaw.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(batch.map(async place => {
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
    detailed.push(...batchResults)
  }

  return detailed
}

// ===========================================================================
//  PROVIDER 2 — YELP FUSION (up to 50 results per search)
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
    limit:    '50',       // Yelp max per request
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
//  PROVIDER 3 — OVERPASS API (OpenStreetMap) — 100+ results, no key needed
//
//  Overpass API is the actual database behind OpenStreetMap. Unlike Nominatim
//  (which does text search), Overpass queries all tagged nodes within a radius,
//  returning every matching business — just like Google Maps does spatially.
// ===========================================================================

// Map common search terms to OSM tags
const OSM_TAG_MAP: { pattern: RegExp; tags: { key: string; value: string }[] }[] = [
  // Trades / Crafts
  { pattern: /plumb/i,                    tags: [{ key: 'craft', value: 'plumber' }] },
  { pattern: /electric/i,                 tags: [{ key: 'craft', value: 'electrician' }] },
  { pattern: /carpenter|woodwork/i,       tags: [{ key: 'craft', value: 'carpenter' }] },
  { pattern: /painter|painting/i,         tags: [{ key: 'craft', value: 'painter' }] },
  { pattern: /mason|bricklayer/i,         tags: [{ key: 'craft', value: 'mason' }] },
  { pattern: /hvac|heating|cooling|air.?cond/i, tags: [{ key: 'craft', value: 'hvac' }] },
  { pattern: /welder|welding/i,           tags: [{ key: 'craft', value: 'metal_construction' }] },

  // Food & Drink
  { pattern: /restaurant|dining/i,        tags: [{ key: 'amenity', value: 'restaurant' }] },
  { pattern: /cafe|coffee/i,              tags: [{ key: 'amenity', value: 'cafe' }] },
  { pattern: /fast.?food/i,               tags: [{ key: 'amenity', value: 'fast_food' }] },
  { pattern: /bar|pub/i,                  tags: [{ key: 'amenity', value: 'bar' }] },
  { pattern: /bakery/i,                   tags: [{ key: 'shop', value: 'bakery' }] },

  // Healthcare
  { pattern: /dentist/i,                  tags: [{ key: 'amenity', value: 'dentist' }] },
  { pattern: /doctor|physician|clinic|medical/i, tags: [{ key: 'amenity', value: 'doctors' }] },
  { pattern: /hospital/i,                 tags: [{ key: 'amenity', value: 'hospital' }] },
  { pattern: /pharmacy|drug.?store/i,     tags: [{ key: 'amenity', value: 'pharmacy' }] },
  { pattern: /vet|veterinarian/i,         tags: [{ key: 'amenity', value: 'veterinary' }] },
  { pattern: /optician|eye.?care/i,       tags: [{ key: 'shop', value: 'optician' }] },

  // Finance / Professional
  { pattern: /bank/i,                     tags: [{ key: 'amenity', value: 'bank' }] },
  { pattern: /lawyer|attorney|law.?firm/i, tags: [{ key: 'office', value: 'lawyer' }] },
  { pattern: /accountant|accounting|cpa/i, tags: [{ key: 'office', value: 'accountant' }] },
  { pattern: /insurance/i,                tags: [{ key: 'office', value: 'insurance' }] },
  { pattern: /real.?estate|realt/i,       tags: [{ key: 'office', value: 'real_estate' }] },
  { pattern: /travel.?agenc/i,            tags: [{ key: 'office', value: 'travel_agent' }] },

  // Automotive
  { pattern: /car.?dealer|auto.?dealer/i, tags: [{ key: 'shop', value: 'car' }] },
  { pattern: /car.?repair|auto.?repair|mechanic|garage/i, tags: [{ key: 'shop', value: 'car_repair' }] },
  { pattern: /fuel|gas.?station|petrol/i, tags: [{ key: 'amenity', value: 'fuel' }] },

  // Beauty / Fitness
  { pattern: /hair|salon|barber/i,        tags: [{ key: 'shop', value: 'hairdresser' }] },
  { pattern: /beauty|nail/i,              tags: [{ key: 'shop', value: 'beauty' }] },
  { pattern: /gym|fitness|workout/i,      tags: [{ key: 'leisure', value: 'fitness_centre' }] },
  { pattern: /spa|massage/i,              tags: [{ key: 'leisure', value: 'spa' }] },

  // Retail / Shops
  { pattern: /supermarket|grocery|food.?store/i, tags: [{ key: 'shop', value: 'supermarket' }] },
  { pattern: /clothing|clothes|apparel/i, tags: [{ key: 'shop', value: 'clothes' }] },
  { pattern: /electronics|computer|tech/i, tags: [{ key: 'shop', value: 'electronics' }] },
  { pattern: /hardware/i,                 tags: [{ key: 'shop', value: 'hardware' }] },
  { pattern: /furniture/i,                tags: [{ key: 'shop', value: 'furniture' }] },

  // Education / Tourism
  { pattern: /school/i,                   tags: [{ key: 'amenity', value: 'school' }] },
  { pattern: /university|college/i,       tags: [{ key: 'amenity', value: 'university' }] },
  { pattern: /hotel|motel|lodg/i,         tags: [{ key: 'tourism', value: 'hotel' }] },
  { pattern: /hostel/i,                   tags: [{ key: 'tourism', value: 'hostel' }] },
  { pattern: /museum/i,                   tags: [{ key: 'tourism', value: 'museum' }] },
]

function getOsmTags(query: string): { key: string; value: string }[] {
  for (const entry of OSM_TAG_MAP) {
    if (entry.pattern.test(query)) return entry.tags
  }
  return []
}

// Geocode a location name to lat/lng using Nominatim
async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  if (!location) return null
  try {
    const params = new URLSearchParams({ format: 'json', limit: '1', q: location })
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: { 'User-Agent': 'LeadDashboard/1.0', 'Accept-Language': 'en' },
        signal: AbortSignal.timeout(8000),
      }
    )
    const data = await res.json()
    if (!data?.length) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch { return null }
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

// Query Overpass API — returns all matching businesses within radius (meters)
async function overpassSearch(
  osmTags: { key: string; value: string }[],
  lat: number,
  lng: number,
  radius = 25000  // 25km default radius
): Promise<PlaceResult[]> {
  const tagFilter = osmTags.map(t => `["${t.key}"="${t.value}"]`).join('')

  // Build Overpass QL — node + way within radius, return up to 100
  const query = `
[out:json][timeout:30];
(
  node${tagFilter}(around:${radius},${lat},${lng});
  way${tagFilter}(around:${radius},${lat},${lng});
);
out center 100;
`

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `data=${encodeURIComponent(query)}`,
    signal:  AbortSignal.timeout(30000),
  })

  if (!res.ok) throw new Error(`Overpass API error ${res.status}`)

  const data = await res.json()
  const elements: OverpassElement[] = data.elements ?? []

  return elements
    .filter(e => e.tags?.name)
    .map(e => {
      const eLat    = e.lat  ?? e.center?.lat  ?? null
      const eLng    = e.lon  ?? e.center?.lon  ?? null
      const tags    = e.tags ?? {}

      const addrParts = [
        tags['addr:housenumber'],
        tags['addr:street'],
        tags['addr:city'] || tags['addr:town'],
        tags['addr:state'],
        tags['addr:postcode'],
        tags['addr:country'],
      ].filter(Boolean)

      // Build a readable type label from OSM tags
      const typeLabel = osmTags
        .map(t => tags[t.key])
        .filter(Boolean)[0]
        ?.replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        ?? 'Business'

      return {
        placeId:        `osm_${e.type}_${e.id}`,
        name:           tags.name!,
        address:        addrParts.length ? addrParts.join(', ') : (tags['addr:full'] || ''),
        phone:          tags.phone || tags['contact:phone'] || tags['contact:mobile'] || null,
        website:        tags.website || tags['contact:website'] || null,
        rating:         null,
        totalRatings:   null,
        types:          [typeLabel],
        mapsUrl:        eLat && eLng
          ? `https://www.openstreetmap.org/?mlat=${eLat}&mlon=${eLng}&zoom=16`
          : null,
        businessStatus: null,
        lat:            eLat,
        lng:            eLng,
      } satisfies PlaceResult
    })
}

// ── Nominatim fallback (used when no location given or Overpass unavailable) ─
const NOM_HEADERS = {
  'User-Agent': 'LeadDashboard/1.0 (business-lead-finder)',
  'Accept':     'application/json',
}

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
    phone?: string; website?: string
    'contact:phone'?: string; 'contact:website'?: string
  }
}

const OSM_BUSINESS_CLASSES = new Set([
  'amenity', 'shop', 'craft', 'office', 'tourism', 'leisure', 'healthcare', 'emergency', 'club',
])

function nominatimToResult(r: NominatimResult): PlaceResult | null {
  if (!r.name) return null
  if (!OSM_BUSINESS_CLASSES.has(r.class)) return null

  const a     = r.address
  const ext   = r.extratags ?? {}
  const lat   = parseFloat(r.lat)
  const lng   = parseFloat(r.lon)

  const addrParts = [
    a.house_number, a.road, a.suburb,
    a.city || a.town, a.state, a.postcode,
  ].filter(Boolean)

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

async function osmSearch(query: string, location: string): Promise<PlaceResult[]> {
  const osmTags = getOsmTags(query)

  // ── Primary: Overpass API (returns 100+ results spatially like Google Maps) ─
  if (osmTags.length > 0) {
    const coords = location
      ? await geocodeLocation(location)
      : null   // No location = skip Overpass (needs a center point)

    if (coords) {
      try {
        const results = await overpassSearch(osmTags, coords.lat, coords.lng)
        if (results.length > 0) return results
      } catch (e) {
        console.warn('Overpass search failed, falling back to Nominatim:', e)
      }
    }
  }

  // ── Fallback: Nominatim text search ───────────────────────────────────────
  const q      = location ? `${query} ${location}` : query
  const params = new URLSearchParams({
    format: 'json', limit: '50', addressdetails: '1', extratags: '1', dedupe: '1', q,
  })

  const seen = new Set<string>()
  const out: PlaceResult[] = []

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      { headers: NOM_HEADERS, signal: AbortSignal.timeout(12000) }
    )
    if (res.ok) {
      const data: NominatimResult[] = await res.json()
      for (const r of data) {
        const p = nominatimToResult(r)
        if (p && !seen.has(p.placeId)) { seen.add(p.placeId); out.push(p) }
      }
    }
  } catch { /* silent fallback failure */ }

  return out
}
