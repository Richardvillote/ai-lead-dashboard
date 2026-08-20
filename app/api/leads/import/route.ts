import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'

// Expected columns (case-insensitive, flexible)
const FIELD_MAP: Record<string, string> = {
  name: 'name', fullname: 'name', 'full name': 'name', contact: 'name',
  email: 'email', 'email address': 'email', 'e-mail': 'email',
  phone: 'phone', 'phone number': 'phone', mobile: 'phone', tel: 'phone',
  service: 'service', 'service interested': 'service', 'interested in': 'service',
  message: 'message', notes: 'notes', note: 'notes',
  status: 'status', source: 'source',
}

function normaliseKey(raw: string): string {
  return FIELD_MAP[raw.trim().toLowerCase()] || ''
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop()?.toLowerCase()

    let rows: Record<string, string>[] = []

    if (ext === 'xlsx' || ext === 'xls') {
      const wb = XLSX.read(buffer, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
    } else if (ext === 'csv') {
      const wb = XLSX.read(buffer, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload .xlsx, .xls, or .csv' },
        { status: 400 }
      )
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 })
    }

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    for (const [i, raw] of rows.entries()) {
      // Normalise keys
      const row: Record<string, string> = {}
      for (const [k, v] of Object.entries(raw)) {
        const mapped = normaliseKey(k)
        if (mapped) row[mapped] = String(v).trim()
      }

      const name = row.name
      const email = row.email

      if (!name || !email) {
        errors.push(`Row ${i + 2}: missing name or email — skipped`)
        skipped++
        continue
      }

      // Skip if email already exists
      const existing = await prisma.lead.findFirst({ where: { email } })
      if (existing) {
        skipped++
        continue
      }

      const validStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED']
      const status = validStatuses.includes((row.status || '').toUpperCase())
        ? row.status.toUpperCase()
        : 'NEW'

      await prisma.lead.create({
        data: {
          name,
          email,
          phone: row.phone || null,
          service: row.service || null,
          message: row.message || null,
          notes: row.notes || null,
          status,
          source: row.source || 'import',
        },
      })
      imported++
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: rows.length,
      errors: errors.slice(0, 10),
    })
  } catch (err: unknown) {
    console.error('Import error:', err)
    const message = err instanceof Error ? err.message : 'Import failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
