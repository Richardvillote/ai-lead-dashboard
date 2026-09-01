import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 13)
    twoWeeksAgo.setHours(0, 0, 0, 0)

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Fetch all leads (needed for groupBy simulation and daily counts)
    const { data: allLeads, error: allError } = await supabase
      .from('Lead')
      .select('id, status, createdAt')

    if (allError) return NextResponse.json({ error: allError.message }, { status: 500 })

    const leads = allLeads ?? []

    const total = leads.length

    // Count by status manually
    const statusMap: Record<string, number> = {}
    for (const l of leads) {
      const s = String(l.status)
      statusMap[s] = (statusMap[s] || 0) + 1
    }

    // Count recent (last 30 days)
    const recent = leads.filter(l => new Date(l.createdAt) >= thirtyDaysAgo).length

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
    for (const l of leads) {
      if (new Date(l.createdAt) >= twoWeeksAgo) {
        const key = new Date(l.createdAt).toISOString().split('T')[0]
        if (key in dailyCounts) dailyCounts[key]++
      }
    }
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
