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

// ── Friendly messages for every Google Places status code ─────────────────
function googleStatusError(status: string, message?: string): string {
  switch (status) {
    case 'REQUEST_DENIED':
      return message?.includes('not activated')
        ? 'Places API is not enabled. Go to Google Cloud Console → APIs & Services → Enable "Places API".'
        : message?.includes('billing')
        ? 'Billing is not enabled on your Google Cloud project. Enable billing at console.cloud.google.com.'
        : `API request denied: ${message || 'Check that your API key is valid and Places API is enabled.'}`
    case 'INVALID_REQUEST':
      return 'Invalid search query. Please try a different search term.'
    case 'OVER_QUERY_LIMIT':
      return 'Google API quota exceeded. Try again in a moment or check your billing limits.'
    case 'UNKNOWN_ERROR':
      return 'Google server error. Please try again in a few seconds.'
    case 'NOT_FOUND':
      return 'No results found for that search.'
    default:
      return `Google API returned status: ${status}. ${message || ''}`
  }
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

  try {
    const url = `${PLACES_BASE}/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
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
  } catch {
    return {} // silently skip detail fetch failures
  }
}

export async function POST(req: NextRequest) {
  try {
    const { query, location } = await req.json()

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY

    // ── Missing or placeholder key ───────────────────────────────────────
    if (!apiKey || apiKey === 'your_google_places_api_key' || apiKey.trim() === '') {
      return NextResponse.json(
        { error: 'GOOGLE_PLACES_API_KEY is not set in .env', code: 'NO_API_KEY' },
        { status: 503 }
      )
    }

    // ── Build search string ──────────────────────────────────────────────
    const searchQuery = location?.trim()
      ? `${query.trim()} in ${location.trim()}`
      : query.trim()

    const textSearchUrl =
      `${PLACES_BASE}/textsearch/json` +
      `?query=${encodeURIComponent(searchQuery)}` +
      `&key=${apiKey}`

    let searchData: { status: string; error_message?: string; results?: unknown[] }

    try {
      const searchRes = await fetch(textSearchUrl, { signal: AbortSignal.timeout(10000) })
      searchData = await searchRes.json()
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      if (msg.includes('timeout') || msg.includes('abort')) {
        return NextResponse.json(
          { error: 'Request to Google timed out. Check your internet connection and try again.' },
          { status: 504 }
        )
      }
      throw fetchErr
    }

    // ── Handle all non-OK statuses ───────────────────────────────────────
    if (searchData.status && searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
      return NextResponse.json(
        {
          error: googleStatusError(searchData.status, searchData.error_message),
          code: searchData.status,
        },
        { status: searchData.status === 'REQUEST_DENIED' ? 403 : 400 }
      )
    }

    if (!searchData.results || searchData.results.length === 0) {
      return NextResponse.json({ results: [], total: 0 })
    }

    // ── Fetch details for top 15 results in parallel ─────────────────────
    const top = searchData.results.slice(0, 15) as Array<{
      place_id: string
      name: string
      formatted_address: string
      rating?: number
      user_ratings_total?: number
      types?: string[]
      geometry?: { location?: { lat?: number; lng?: number } }
    }>

    const results: PlaceResult[] = await Promise.all(
      top.map(async place => {
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
