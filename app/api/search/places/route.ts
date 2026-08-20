import { NextRequest, NextResponse } from 'next/server'

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place'

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

async function getDetails(placeId: string, apiKey: string): Promise<Partial<PlaceResult>> {
  const fields = [
    'name',
    'formatted_phone_number',
    'website',
    'formatted_address',
    'rating',
    'user_ratings_total',
    'types',
    'url',
    'business_status',
    'geometry',
  ].join(',')

  const url = `${PLACES_BASE}/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`
  const res = await fetch(url)
  const data = await res.json()

  if (data.status !== 'OK') return {}

  const r = data.result
  return {
    phone: r.formatted_phone_number || null,
    website: r.website || null,
    rating: r.rating ?? null,
    totalRatings: r.user_ratings_total ?? null,
    types: r.types || [],
    mapsUrl: r.url || null,
    businessStatus: r.business_status || null,
    lat: r.geometry?.location?.lat ?? null,
    lng: r.geometry?.location?.lng ?? null,
  }
}

export async function POST(req: NextRequest) {
  try {
    const { query, location } = await req.json()

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_PLACES_API_KEY is not set in .env' },
        { status: 503 }
      )
    }

    // Build search string
    const searchQuery = location
      ? `${query} in ${location}`
      : query

    const textSearchUrl = `${PLACES_BASE}/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${apiKey}`
    const searchRes = await fetch(textSearchUrl)
    const searchData = await searchRes.json()

    if (searchData.status === 'REQUEST_DENIED') {
      return NextResponse.json(
        { error: `Google API error: ${searchData.error_message || 'Request denied. Check your API key.'}` },
        { status: 403 }
      )
    }

    if (!searchData.results || searchData.results.length === 0) {
      return NextResponse.json({ results: [], total: 0 })
    }

    // Take top 15 results then fetch details in parallel
    const top = searchData.results.slice(0, 15)

    const results: PlaceResult[] = await Promise.all(
      top.map(async (place: {
        place_id: string
        name: string
        formatted_address: string
        rating?: number
        user_ratings_total?: number
        types?: string[]
        geometry?: { location?: { lat?: number; lng?: number } }
      }) => {
        const details = await getDetails(place.place_id, apiKey)
        return {
          placeId: place.place_id,
          name: place.name,
          address: place.formatted_address,
          phone: details.phone ?? null,
          website: details.website ?? null,
          rating: details.rating ?? place.rating ?? null,
          totalRatings: details.totalRatings ?? place.user_ratings_total ?? null,
          types: details.types ?? place.types ?? [],
          mapsUrl: details.mapsUrl ?? null,
          businessStatus: details.businessStatus ?? null,
          lat: details.lat ?? place.geometry?.location?.lat ?? null,
          lng: details.lng ?? place.geometry?.location?.lng ?? null,
        } satisfies PlaceResult
      })
    )

    return NextResponse.json({ results, total: results.length })
  } catch (err: unknown) {
    console.error('Places search error:', err)
    const message = err instanceof Error ? err.message : 'Search failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
