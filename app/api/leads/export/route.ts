import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { appointments: true, calls: true } },
      },
    })

    const headers = [
      'Name', 'Email', 'Phone', 'Service', 'Status',
      'Source', 'Message', 'Notes', 'Appointments', 'Calls', 'Created At',
    ]

    const rows = leads.map(l => [
      l.name,
      l.email,
      l.phone || '',
      l.service || '',
      l.status,
      l.source || '',
      (l.message || '').replace(/\r?\n/g, ' '),
      (l.notes || '').replace(/\r?\n/g, ' '),
      l._count.appointments,
      l._count.calls,
      new Date(l.createdAt).toLocaleString(),
    ])

    const escape = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`
    const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\r\n')

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
