import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

export const runtime = 'edge'

const FIELD_MAP: Record<string, string> = {
  name: 'name', fullname: 'name', 'full name': 'name', contact: 'name',
  'business name': 'name', business: 'name', company: 'name', 'company name': 'name',
  email: 'email', 'email address': 'email', 'e-mail': 'email',
  phone: 'phone', 'phone number': 'phone', mobile: 'phone',
  tel: 'phone', telephone: 'phone', 'contact number': 'phone',
  service: 'service', 'service interested': 'service', 'interested in': 'service',
  'business type': 'service', type: 'service', category: 'service', industry: 'service',
  message: 'message', address: 'message', location: 'message',
  notes: 'notes', note: 'notes', website: 'notes', url: 'notes',
  'website url': 'notes', 'maps url': 'notes', 'google maps url': 'notes',
  'maps link': 'notes', link: 'notes',
  status: 'status',
  source: 'source',
}

function mapKey(raw: string): string {
  return FIELD_MAP[raw.trim().toLowerCase()] ?? ''
}

const VALID_STATUSES = new Set(['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED'])

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload .xlsx, .xls, or .csv' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb     = XLSX.read(buffer, { type: 'buffer' })
    const ws     = wb.Sheets[wb.SheetNames[0]]
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 })
    }

    let imported = 0
    let skipped  = 0
    const errors: string[] = []

    for (const [i, raw] of rawRows.entries()) {
      const row: Record<string, string> = {}
      for (const [k, v] of Object.entries(raw)) {
        const mapped = mapKey(k)
        if (mapped) row[mapped] = String(v ?? '').trim()
      }

      const name = row.name
      if (!name) {
        errors.push(`Row ${i + 2}: missing name — skipped`)
        skipped++
        continue
      }

      let duplicate = false

      if (row.email) {
        const { data: byEmail } = await supabase
          .from('Lead').select('id').eq('email', row.email).maybeSingle()
        if (byEmail) duplicate = true
      } else if (row.phone) {
        const { data: byPhone } = await supabase
          .from('Lead').select('id').eq('phone', row.phone).eq('name', name).maybeSingle()
        if (byPhone) duplicate = true
      } else {
        const { data: byName } = await supabase
          .from('Lead').select('id').eq('name', name).maybeSingle()
        if (byName) duplicate = true
      }

      if (duplicate) { skipped++; continue }

      const rawStatus = (row.status ?? '').toUpperCase()
      const status    = VALID_STATUSES.has(rawStatus) ? rawStatus : 'NEW'

      const { error } = await supabase.from('Lead').insert({
        name,
        email:   row.email   || '',
        phone:   row.phone   || null,
        service: row.service || null,
        message: row.message || null,
        notes:   row.notes   || null,
        status,
        source:  row.source  || 'excel_import',
      })

      if (error) {
        errors.push(`Row ${i + 2}: ${error.message}`)
        skipped++
        continue
      }
      imported++
    }

    return NextResponse.json({
      success: true, imported, skipped,
      total:   rawRows.length,
      errors:  errors.slice(0, 10),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Import failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
