import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'

// ── Column header → internal field mapping (case-insensitive) ──────────────
// Covers both manually-created spreadsheets AND the "Get Leads" search export.
const FIELD_MAP: Record<string, string> = {
  // Name / Business Name
  name: 'name', fullname: 'name', 'full name': 'name', contact: 'name',
  'business name': 'name', business: 'name', company: 'name', 'company name': 'name',

  // Email
  email: 'email', 'email address': 'email', 'e-mail': 'email',

  // Phone
  phone: 'phone', 'phone number': 'phone', mobile: 'phone',
  tel: 'phone', telephone: 'phone', 'contact number': 'phone',

  // Service / Type
  service: 'service', 'service interested': 'service', 'interested in': 'service',
  'business type': 'service', type: 'service', category: 'service', industry: 'service',

  // Message / Address
  message: 'message', address: 'message', location: 'message',

  // Notes / Website / Maps URL
  notes: 'notes', note: 'notes', website: 'notes', url: 'notes',
  'website url': 'notes', 'maps url': 'notes', 'google maps url': 'notes',
  'maps link': 'notes', link: 'notes',

  // Status / Source
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
      // ── Normalise column keys ────────────────────────────────────────────
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

      // ── Deduplication ───────────────────────────────────────────────────
      // Check by email (if provided) OR by name+phone combination
      let duplicate = false

      if (row.email) {
        const byEmail = await prisma.lead.findFirst({ where: { email: row.email } })
        if (byEmail) duplicate = true
      } else if (row.phone) {
        const byPhone = await prisma.lead.findFirst({ where: { phone: row.phone, name } })
        if (byPhone) duplicate = true
      } else {
        const byName = await prisma.lead.findFirst({ where: { name } })
        if (byName) duplicate = true
      }

      if (duplicate) {
        skipped++
        continue
      }

      // ── Status normalisation ────────────────────────────────────────────
      const rawStatus = (row.status ?? '').toUpperCase()
      const status    = VALID_STATUSES.has(rawStatus) ? rawStatus : 'NEW'

      // ── Create lead ─────────────────────────────────────────────────────
      await prisma.lead.create({
        data: {
          name,
          email:   row.email   || '',
          phone:   row.phone   || null,
          service: row.service || null,
          message: row.message || null,
          notes:   row.notes   || null,
          status,
          source:  row.source  || 'excel_import',
        },
      })
      imported++
    }

    return NextResponse.json({
      success:  true,
      imported,
      skipped,
      total:    rawRows.length,
      errors:   errors.slice(0, 10),
    })
  } catch (err: unknown) {
    console.error('Import error:', err)
    const message = err instanceof Error ? err.message : 'Import failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
