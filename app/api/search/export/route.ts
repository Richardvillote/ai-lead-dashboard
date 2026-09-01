import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export const runtime = 'edge'

interface PlaceResult {
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

const TYPE_LABEL: Record<string, string> = {
  restaurant: 'Restaurant', cafe: 'Café', store: 'Store',
  health: 'Health', doctor: 'Doctor', lawyer: 'Lawyer',
  real_estate_agency: 'Real Estate', gym: 'Gym',
  beauty_salon: 'Salon', hair_care: 'Hair Care',
  accounting: 'Accounting', insurance_agency: 'Insurance',
  car_dealer: 'Car Dealer', car_repair: 'Auto Repair',
  electrician: 'Electrician', plumber: 'Plumber',
  painter: 'Painter', general_contractor: 'Contractor',
  moving_company: 'Moving', lodging: 'Hotel',
  school: 'School', university: 'University',
  hospital: 'Hospital', pharmacy: 'Pharmacy',
  bank: 'Bank', finance: 'Finance',
}

function niceType(types: string[]): string {
  for (const t of types) {
    if (TYPE_LABEL[t]) return TYPE_LABEL[t]
  }
  const raw = types.find(t => !['point_of_interest', 'establishment', 'food'].includes(t))
  return raw ? raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Business'
}

export async function POST(req: NextRequest) {
  try {
    const { results, query, location } = await req.json() as {
      results: PlaceResult[]
      query: string
      location: string
    }

    if (!results || results.length === 0) {
      return NextResponse.json({ error: 'No results to export' }, { status: 400 })
    }

    const rows = results.map((p, i) => ({
      '#': i + 1,
      'Business Name': p.name,
      'Business Type': niceType(p.types),
      'Address': p.address,
      'Phone': p.phone || 'N/A',
      'Website': p.website || 'N/A',
      'Rating': p.rating ? `${p.rating}/5` : 'N/A',
      'Total Reviews': p.totalRatings ?? 'N/A',
      'Business Status': p.businessStatus ? p.businessStatus.replace(/_/g, ' ') : 'N/A',
      'Google Maps URL': p.mapsUrl || 'N/A',
      'Latitude': p.lat ?? 'N/A',
      'Longitude': p.lng ?? 'N/A',
    }))

    const ws = XLSX.utils.json_to_sheet(rows)

    const colWidths = Object.keys(rows[0] || {}).map(key => ({
      wch: Math.max(key.length + 2, ...rows.map(r => String(r[key as keyof typeof r] ?? '').length)) + 2,
    }))
    ws['!cols'] = colWidths

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: 0, c: C })
      if (!ws[cellAddr]) continue
      ws[cellAddr].s = { font: { bold: true } }
    }

    const wb = XLSX.utils.book_new()
    const sheetName = `${query}${location ? ` - ${location}` : ''}`.slice(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Lead Search Results')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const date = new Date().toISOString().split('T')[0]
    const safeName = (query || 'leads').replace(/[^a-z0-9]/gi, '-').toLowerCase()

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="lead-search-${safeName}-${date}.xlsx"`,
      },
    })
  } catch (err: unknown) {
    console.error('Search export error:', err)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
