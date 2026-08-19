'use client'

import { useEffect, useState } from 'react'
import { Search, Trash2, Phone, Mail } from 'lucide-react'
import { STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from '@/lib/utils'

interface Appointment {
  id: string
  scheduledAt: string
  type: string
  status: string
  title: string
}

interface CallRecord {
  id: string
  calledAt: string
  outcome: string | null
  duration: number | null
}

interface Lead {
  id: string
  name: string
  email: string
  phone: string | null
  service: string | null
  message: string | null
  status: string
  notes: string | null
  createdAt: string
  appointments: Appointment[]
  calls: CallRecord[]
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showAddAppt, setShowAddAppt] = useState(false)
  const [apptForm, setApptForm] = useState({ title: '', scheduledAt: '', type: 'CALL', duration: 30, notes: '' })

  const load = () => fetch('/api/leads').then(r => r.json()).then(setLeads)
  useEffect(() => { load() }, [])

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    load()
    if (selectedLead?.id === id) setSelectedLead(prev => prev ? { ...prev, status } : null)
  }

  const deleteLead = async (id: string) => {
    if (!confirm('Delete this lead?')) return
    await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    load()
    if (selectedLead?.id === id) setSelectedLead(null)
  }

  const addAppointment = async () => {
    if (!selectedLead) return
    await fetch('/api/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...apptForm, leadId: selectedLead.id }) })
    setShowAddAppt(false)
    setApptForm({ title: '', scheduledAt: '', type: 'CALL', duration: 30, notes: '' })
    load()
  }

  const logCall = async (leadId: string) => {
    const outcome = prompt('Call outcome? (ANSWERED / VOICEMAIL / NO_ANSWER)')
    if (!outcome) return
    await fetch('/api/calls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId, outcome, notes: '' }) })
    load()
  }

  const filtered = leads.filter(l => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.email.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'ALL' || l.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="flex gap-6 h-full">
      {/* Lead List */}
      <div className="flex-1">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
            <p className="text-sm text-gray-500">{leads.length} total leads</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search leads..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          {['ALL', ...STATUS_ORDER].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${filterStatus === s ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
              {s === 'ALL' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Lead Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Service</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => (
                <tr key={lead.id} onClick={() => setSelectedLead(lead)}
                  className={`border-b border-gray-50 cursor-pointer hover:bg-indigo-50/50 transition-colors ${selectedLead?.id === lead.id ? 'bg-indigo-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{lead.name}</td>
                  <td className="px-4 py-3 text-gray-500">{lead.email}</td>
                  <td className="px-4 py-3 text-gray-500">{lead.service || '—'}</td>
                  <td className="px-4 py-3">
                    <select value={lead.status} onChange={e => { e.stopPropagation(); updateStatus(lead.id, e.target.value) }}
                      className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${STATUS_COLORS[lead.status]}`}
                      onClick={e => e.stopPropagation()}>
                      {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{new Date(lead.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button onClick={e => { e.stopPropagation(); deleteLead(lead.id) }}
                      className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No leads found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lead Detail Panel */}
      {selectedLead && (
        <div className="w-80 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-fit sticky top-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="font-bold text-gray-900">{selectedLead.name}</h2>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[selectedLead.status]}`}>
                {STATUS_LABELS[selectedLead.status]}
              </span>
            </div>
            <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-gray-600">x</button>
          </div>

          <div className="space-y-2 text-sm mb-4">
            <div className="flex items-center gap-2 text-gray-600"><Mail className="w-4 h-4" />{selectedLead.email}</div>
            {selectedLead.phone && <div className="flex items-center gap-2 text-gray-600"><Phone className="w-4 h-4" />{selectedLead.phone}</div>}
            {selectedLead.service && <div className="text-gray-600">Service: {selectedLead.service}</div>}
            {selectedLead.message && <div className="text-gray-500 text-xs bg-gray-50 p-3 rounded-xl">{selectedLead.message}</div>}
          </div>

          <div className="flex gap-2 mb-4">
            <button onClick={() => logCall(selectedLead.id)}
              className="flex-1 bg-green-50 text-green-700 py-2 px-3 rounded-xl text-xs font-medium hover:bg-green-100 transition-colors">
              Log Call
            </button>
            <button onClick={() => setShowAddAppt(true)}
              className="flex-1 bg-indigo-50 text-indigo-700 py-2 px-3 rounded-xl text-xs font-medium hover:bg-indigo-100 transition-colors">
              Schedule
            </button>
          </div>

          {/* Appointments */}
          {selectedLead.appointments.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-gray-700 uppercase mb-2">Appointments</h3>
              <div className="space-y-2">
                {selectedLead.appointments.map(a => (
                  <div key={a.id} className="bg-indigo-50 rounded-xl p-3 text-xs">
                    <div className="font-medium text-indigo-800">{a.title}</div>
                    <div className="text-indigo-600">{new Date(a.scheduledAt).toLocaleString()} · {a.type}</div>
                    <div className="text-indigo-500">{a.status}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calls */}
          {selectedLead.calls.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-700 uppercase mb-2">Call History</h3>
              <div className="space-y-2">
                {selectedLead.calls.map(c => (
                  <div key={c.id} className="bg-gray-50 rounded-xl p-3 text-xs">
                    <div className="font-medium text-gray-700">{c.outcome || 'Called'}</div>
                    <div className="text-gray-500">{new Date(c.calledAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Appointment Modal */}
          {showAddAppt && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl">
                <h3 className="font-bold text-gray-900 mb-4">Schedule Appointment</h3>
                <div className="space-y-3">
                  <input placeholder="Title (e.g., Discovery Call)" value={apptForm.title} onChange={e => setApptForm({ ...apptForm, title: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input type="datetime-local" value={apptForm.scheduledAt} onChange={e => setApptForm({ ...apptForm, scheduledAt: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  <select value={apptForm.type} onChange={e => setApptForm({ ...apptForm, type: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="CALL">Phone Call</option>
                    <option value="MEETING">In-Person Meeting</option>
                    <option value="DEMO">Product Demo</option>
                  </select>
                  <input type="number" placeholder="Duration (minutes)" value={apptForm.duration} onChange={e => setApptForm({ ...apptForm, duration: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={addAppointment} className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-indigo-700">Save</button>
                  <button onClick={() => setShowAddAppt(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
