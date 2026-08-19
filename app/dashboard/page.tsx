'use client'

import { useEffect, useState } from 'react'
import { Users, TrendingUp, Calendar, ArrowUp } from 'lucide-react'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'

interface DailyData {
  date: string
  count: number
}

interface Stats {
  total: number
  recent: number
  conversionRate: number
  byStatus: Record<string, number>
  new: number
  contacted: number
  qualified: number
  closed: number
  dailyLeads: DailyData[]
}

interface Lead {
  id: string
  name: string
  email: string
  status: string
  service: string | null
  createdAt: string
}

function LineChart({ data }: { data: DailyData[] }) {
  if (!data || data.length < 2) return null

  const W = 400
  const H = 80
  const PAD = 6
  const max = Math.max(...data.map(d => d.count), 1)

  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2)
    const y = PAD + (1 - d.count / max) * (H - PAD * 2)
    return [x, y] as [number, number]
  })

  const linePts = pts.map(([x, y]) => `${x},${y}`).join(' ')
  const areaPts =
    `${pts[0][0]},${H} ` + linePts + ` ${pts[pts.length - 1][0]},${H}`

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' })

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-20"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <polygon points={areaPts} fill="url(#lineGrad)" />
        {/* Line */}
        <polyline
          points={linePts}
          fill="none"
          stroke="#6366f1"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dots for non-zero days */}
        {pts.map(([x, y], i) =>
          data[i].count > 0 ? (
            <circle key={i} cx={x} cy={y} r="3.5" fill="#6366f1" />
          ) : null
        )}
      </svg>
      <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
        <span>{fmtDate(data[0].date)}</span>
        <span>{fmtDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats)
    fetch('/api/leads')
      .then(r => r.json())
      .then((d: Lead[]) => setLeads(d.slice(0, 6)))
  }, [])

  const statCards = stats
    ? [
        {
          label: 'Total Leads',
          value: stats.total,
          icon: Users,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          change: `+${stats.recent} this month`,
        },
        {
          label: 'Conversion Rate',
          value: `${stats.conversionRate}%`,
          icon: TrendingUp,
          color: 'text-green-600',
          bg: 'bg-green-50',
          change: `${stats.closed} closed`,
        },
        {
          label: 'Qualified Leads',
          value: stats.qualified,
          icon: ArrowUp,
          color: 'text-purple-600',
          bg: 'bg-purple-50',
          change: `${stats.new} new`,
        },
        {
          label: 'New This Month',
          value: stats.recent,
          icon: Calendar,
          color: 'text-orange-600',
          bg: 'bg-orange-50',
          change: 'last 30 days',
        },
      ]
    : []

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-500 text-sm mt-1">
          Track your leads and conversion performance
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, bg, change }) => (
          <div
            key={label}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
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
        {!stats &&
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm animate-pulse h-36"
            />
          ))}
      </div>

      {/* Chart + Pipeline row */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Line Chart */}
        <div className="col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Leads Over Time</h2>
              <p className="text-xs text-gray-400 mt-0.5">Last 14 days</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-indigo-600">
                {stats?.dailyLeads
                  ? stats.dailyLeads.reduce((a, b) => a + b.count, 0)
                  : '—'}
              </div>
              <div className="text-xs text-gray-400">new leads</div>
            </div>
          </div>
          {stats?.dailyLeads ? (
            <LineChart data={stats.dailyLeads} />
          ) : (
            <div className="h-20 bg-gray-50 rounded-xl animate-pulse" />
          )}
        </div>

        {/* Pipeline */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Lead Pipeline</h2>
          {stats ? (
            ['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED'].map(status => {
              const count = stats.byStatus[status] || 0
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
              return (
                <div key={status} className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">
                      {STATUS_LABELS[status]}
                    </span>
                    <span className="text-gray-500">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-indigo-500 rounded-full transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })
          ) : (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Leads */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-gray-900">Recent Leads</h2>
          <a
            href="/dashboard/leads"
            className="text-indigo-600 text-sm hover:underline"
          >
            View all →
          </a>
        </div>
        <div className="divide-y divide-gray-50">
          {leads.map(lead => (
            <div
              key={lead.id}
              className="flex items-center justify-between py-3"
            >
              <div>
                <div className="font-medium text-sm text-gray-900">
                  {lead.name}
                </div>
                <div className="text-xs text-gray-400">
                  {lead.service || lead.email}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {new Date(lead.createdAt).toLocaleDateString()}
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[lead.status]}`}
                >
                  {STATUS_LABELS[lead.status]}
                </span>
              </div>
            </div>
          ))}
          {leads.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-8">
              No leads yet. Share your landing page to get started!
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
