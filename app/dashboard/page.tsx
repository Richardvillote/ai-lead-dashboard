'use client'

import { useEffect, useState } from 'react'
import { Users, TrendingUp, Calendar, ArrowUp } from 'lucide-react'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'

interface Stats {
  total: number
  recent: number
  conversionRate: number
  byStatus: Record<string, number>
  new: number
  contacted: number
  qualified: number
  closed: number
}

interface Lead {
  id: string
  name: string
  email: string
  status: string
  service: string | null
  createdAt: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats)
    fetch('/api/leads').then(r => r.json()).then((d: Lead[]) => setLeads(d.slice(0, 5)))
  }, [])

  const statCards = stats ? [
    { label: 'Total Leads', value: stats.total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', change: `+${stats.recent} this month` },
    { label: 'Conversion Rate', value: `${stats.conversionRate}%`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', change: `${stats.closed} closed` },
    { label: 'Qualified Leads', value: stats.qualified, icon: ArrowUp, color: 'text-purple-600', bg: 'bg-purple-50', change: `${stats.new} new` },
    { label: 'New This Month', value: stats.recent, icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50', change: 'last 30 days' },
  ] : []

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-500 text-sm mt-1">Track your leads and conversion performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, bg, change }) => (
          <div key={label} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className={`${bg} p-2 rounded-xl`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
            <div className="text-sm font-medium text-gray-700">{label}</div>
            <div className="text-xs text-gray-400 mt-1">{change}</div>
          </div>
        ))}
      </div>

      {/* Funnel + Recent Leads */}
      <div className="grid grid-cols-2 gap-6">
        {/* Pipeline Funnel */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Lead Pipeline</h2>
          {stats && ['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED'].map(status => {
            const count = stats.byStatus[status] || 0
            const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
            return (
              <div key={status} className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 font-medium">{STATUS_LABELS[status]}</span>
                  <span className="text-gray-500">{count} leads</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div className="h-2 bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
          {!stats && <p className="text-gray-400 text-sm">Loading...</p>}
        </div>

        {/* Recent Leads */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-900">Recent Leads</h2>
            <a href="/dashboard/leads" className="text-indigo-600 text-sm hover:underline">View all</a>
          </div>
          <div className="space-y-3">
            {leads.map(lead => (
              <div key={lead.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <div className="font-medium text-sm text-gray-900">{lead.name}</div>
                  <div className="text-xs text-gray-400">{lead.service || lead.email}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[lead.status]}`}>
                  {STATUS_LABELS[lead.status]}
                </span>
              </div>
            ))}
            {leads.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No leads yet</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
