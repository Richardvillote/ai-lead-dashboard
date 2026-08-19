'use client'

import { useEffect, useState } from 'react'
import { Phone } from 'lucide-react'

interface CallEntry {
  id: string
  calledAt: string
  outcome: string | null
  duration: number | null
  notes: string | null
  leadName: string
  leadEmail: string
}

interface LeadWithCalls {
  id: string
  name: string
  email: string
  calls: {
    id: string
    calledAt: string
    outcome: string | null
    duration: number | null
    notes: string | null
  }[]
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallEntry[]>([])

  useEffect(() => {
    fetch('/api/leads').then(r => r.json()).then((leads: LeadWithCalls[]) => {
      const allCalls = leads.flatMap((l) =>
        (l.calls || []).map((c) => ({ ...c, leadName: l.name, leadEmail: l.email }))
      ).sort((a, b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime())
      setCalls(allCalls)
    })
  }, [])

  const OUTCOME_COLORS: Record<string, string> = {
    ANSWERED: 'bg-green-50 text-green-700',
    VOICEMAIL: 'bg-yellow-50 text-yellow-700',
    NO_ANSWER: 'bg-red-50 text-red-700',
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Call Logs</h1>
        <p className="text-sm text-gray-500">{calls.length} total calls logged</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Lead</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date &amp; Time</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Outcome</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Duration</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.leadName}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(c.calledAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${OUTCOME_COLORS[c.outcome || ''] || 'bg-gray-50 text-gray-700'}`}>
                    {c.outcome || 'N/A'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{c.duration ? `${Math.floor(c.duration / 60)}m ${c.duration % 60}s` : '—'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{c.notes || '—'}</td>
              </tr>
            ))}
            {calls.length === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">
                <Phone className="w-8 h-8 mx-auto mb-2 opacity-40" />
                No calls logged yet
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
