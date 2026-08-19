import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const [total, byStatus, recent] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.groupBy({ by: ['status'], _count: true }),
      prisma.lead.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
    ])

    const statusMap: Record<string, number> = {}
    byStatus.forEach((s) => { statusMap[s.status] = s._count })

    const closed = statusMap['CLOSED'] || 0
    const conversionRate = total > 0 ? Math.round((closed / total) * 100) : 0

    return NextResponse.json({
      total,
      recent,
      conversionRate,
      byStatus: statusMap,
      new: statusMap['NEW'] || 0,
      contacted: statusMap['CONTACTED'] || 0,
      qualified: statusMap['QUALIFIED'] || 0,
      closed,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
