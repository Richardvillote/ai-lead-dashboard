import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 13)
    twoWeeksAgo.setHours(0, 0, 0, 0)

    const [total, byStatus, recent, recentLeads] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.groupBy({ by: ['status'], _count: true }),
      prisma.lead.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.lead.findMany({
        where: { createdAt: { gte: twoWeeksAgo } },
        select: { createdAt: true },
      }),
    ])

    const statusMap: Record<string, number> = {}
    byStatus.forEach((s) => { statusMap[s.status] = s._count })

    const closed = statusMap['CLOSED'] || 0
    const conversionRate = total > 0 ? Math.round((closed / total) * 100) : 0

    // Build daily lead counts for last 14 days
    const dailyCounts: Record<string, number> = {}
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      dailyCounts[key] = 0
    }
    recentLeads.forEach(l => {
      const key = new Date(l.createdAt).toISOString().split('T')[0]
      if (key in dailyCounts) dailyCounts[key]++
    })
    const dailyLeads = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }))

    return NextResponse.json({
      total,
      recent,
      conversionRate,
      byStatus: statusMap,
      new: statusMap['NEW'] || 0,
      contacted: statusMap['CONTACTED'] || 0,
      qualified: statusMap['QUALIFIED'] || 0,
      closed,
      dailyLeads,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
