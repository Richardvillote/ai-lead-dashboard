import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'csv' // 'csv' | 'xlsx'

    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { appointments: true, calls: true } },
      },
    })

    const rows = leads.map(l => ({
      Name: l.name,
      Email: l.email,
      Phone: l.phone || '',
      Service: l.service || '',
      Status: l.status,
      Source: l.source || '',
      Message: (l.message || '').replace(/\r?\n/g, ' '),
      Notes: (l.notes || '').replace(/\r?\n/g, ' '),
      Appointments: l._count.appointments,
      Calls: l._count.calls,
      'Created At': new Date(l.createdAt).toLocaleString(),
    }))

    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(rows)

      // Auto-size columns
      const colWidths = Object.keys(rows[0] || {}).map(key => ({
        wch: Math.max(key.length, ...rows.map(r => String(r[key as keyof typeof r] ?? '').length)) + 2,
      }))
      ws['!cols'] = colWidths

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Leads')

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      const date = new Date().toISOString().split('T')[0]

      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="leads-${date}.xlsx"`,
        },
      })
    }

    // Default: CSV
    const headers = Object.keys(rows[0] || {})
    const escape = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`
    const csv = [headers, ...rows.map(r => headers.map(h => escape(r[h as keyof typeof r])))].map(r => r.join(',')).join('\r\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leads-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
