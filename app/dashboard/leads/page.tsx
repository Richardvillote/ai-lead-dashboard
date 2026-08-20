'use client'

import { useEffect, useState } from 'react'
import { Search, Trash2, Phone, Mail, Pencil, Download, PhoneCall, PhoneOff, CheckCircle } from 'lucide-react'
import {
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_ORDER,
  scoreLead,
  scoreLabel,
} from '@/lib/utils'

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

const SERVICES = [
  'Consulting',
  'Web Development',
  'Marketing',
  'SEO',
  'Social Media',
  'Other',
]

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  // Add appointment
  const [showAddAppt, setShowAddAppt] = useState(false)
  const [apptForm, setApptForm] = useState({
    title: '',
    scheduledAt: '',
    type: 'CALL',
    duration: 30,
    notes: '',
  })

  // Edit lead
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    service: '',
    notes: '',
  })
  const [editSaving, setEditSaving] = useState(false)

  // Calling state
  const [callModal, setCallModal] = useState<{
    lead: Lead
    status: 'idle' | 'calling' | 'success' | 'error'
    message: string
  } | null>(null)

  const load = () =>
    fetch('/api/leads').then(r => r.json()).then(setLeads)

  useEffect(() => { load() }, [])

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    load()
    if (selectedLead?.id === id)
      setSelectedLead(prev => (prev ? { ...prev, status } : null))
  }

  const deleteLead = async (id: string) => {
    if (!confirm('Delete this lead? This cannot be undone.')) return
    await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    load()
    if (selectedLead?.id === id) setSelectedLead(null)
  }

  const addAppointment = async () => {
    if (!selectedLead || !apptForm.title || !apptForm.scheduledAt) return
    await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...apptForm, leadId: selectedLead.id }),
    })
    setShowAddAppt(false)
    setApptForm({ title: '', scheduledAt: '', type: 'CALL', duration: 30, notes: '' })
    load()
  }

  const logCall = async (leadId: string) => {
    const outcome = prompt(
      'Call outcome? (ANSWERED / VOICEMAIL / NO_ANSWER)',
      'ANSWERED'
    )
    if (!outcome) return
    await fetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, outcome: outcome.toUpperCase(), notes: '' }),
    })
    load()
  }

  const dialLead = async (lead: Lead) => {
    if (!lead.phone) {
      alert('This lead has no phone number. Edit the lead to add one first.')
      return
    }
    setCallModal({ lead, status: 'calling', message: 'Initiating call via Twilio…' })
    try {
      const res = await fetch('/api/calls/dial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Call failed')
      setCallModal({
        lead,
        status: 'success',
        message: `✅ Your phone is ringing! Pick up to be connected to ${lead.name}.`,
      })
      load()
    } catch (e: unknown) {
      setCallModal({
        lead,
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to initiate call',
      })
    }
  }

  const openEdit = (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditLead(lead)
    setEditForm({
      name: lead.name,
      email: lead.email,
      phone: lead.phone || '',
      service: lead.service || '',
      notes: lead.notes || '',
    })
  }

  const saveEdit = async () => {
    if (!editLead) return
    setEditSaving(true)
    await fetch(`/api/leads/${editLead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setEditSaving(false)
    setEditLead(null)
    load()
    if (selectedLead?.id === editLead.id)
      setSelectedLead(prev => (prev ? { ...prev, ...editForm } : null))
  }

  const exportCSV = () => {
    window.location.href = '/api/leads/export'
  }

  const filtered = leads.filter(l => {
    const matchSearch =
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'ALL' || l.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="flex gap-6 h-full">
      {/* Lead List */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
            <p className="text-sm text-gray-500">{leads.length} total leads</p>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:border-indigo-300 hover:text-indigo-700 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          {['ALL', ...STATUS_ORDER].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                filterStatus === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
              }`}
            >
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
                <th className="text-left px-4 py-3 font-medium text-gray-600">Score</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Service</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => {
                const score = scoreLead(lead)
                const { label, color } = scoreLabel(score)
                return (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={`border-b border-gray-50 cursor-pointer hover:bg-indigo-50/40 transition-colors ${
                      selectedLead?.id === lead.id ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {lead.name}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
                          {label}
                        </span>
                        <span className="text-xs text-gray-400">{score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{lead.email}</td>
                    <td className="px-4 py-3 text-gray-500">{lead.service || '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={lead.status}
                        onChange={e => {
                          e.stopPropagation()
                          updateStatus(lead.id, e.target.value)
                        }}
                        onClick={e => e.stopPropagation()}
                        className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${STATUS_COLORS[lead.status]}`}
                      >
                        {STATUS_ORDER.map(s => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={e => openEdit(lead, e)}
                          className="text-gray-400 hover:text-indigo-600 p-1 rounded-lg hover:bg-indigo-50 transition-colors"
                          title="Edit lead"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteLead(lead.id) }}
                          className="text-gray-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                          title="Delete lead"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    No leads found
                  </td>
                </tr>
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
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[selectedLead.status]}`}>
                  {STATUS_LABELS[selectedLead.status]}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${scoreLabel(scoreLead(selectedLead)).color}`}>
                  {scoreLabel(scoreLead(selectedLead)).label}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedLead(null)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
          </div>

          <div className="space-y-2 text-sm mb-4">
            <div className="flex items-center gap-2 text-gray-600">
              <Mail className="w-4 h-4 shrink-0" />
              <span className="truncate">{selectedLead.email}</span>
            </div>
            {selectedLead.phone && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="w-4 h-4 shrink-0" />
                {selectedLead.phone}
              </div>
            )}
            {selectedLead.service && (
              <div className="text-gray-600">
                🎯 Service: <span className="font-medium">{selectedLead.service}</span>
              </div>
            )}
            {selectedLead.message && (
              <div className="text-gray-500 text-xs bg-gray-50 p-3 rounded-xl">
                {selectedLead.message}
              </div>
            )}
            {selectedLead.notes && (
              <div className="text-indigo-700 text-xs bg-indigo-50 p-3 rounded-xl">
                📝 {selectedLead.notes}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => dialLead(selectedLead)}
              className="flex items-center justify-center gap-1.5 bg-green-600 text-white py-2 px-3 rounded-xl text-xs font-medium hover:bg-green-700 transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Call Now
            </button>
            <button
              onClick={() => logCall(selectedLead.id)}
              className="flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 py-2 px-3 rounded-xl text-xs font-medium hover:bg-gray-200 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              Log Call
            </button>
            <button
              onClick={() => {
                window.location.href = `/dashboard/email?leadId=${selectedLead.id}`
              }}
              className="flex items-center justify-center gap-1.5 bg-indigo-50 text-indigo-700 py-2 px-3 rounded-xl text-xs font-medium hover:bg-indigo-100 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              Send Email
            </button>
            <button
              onClick={() => setShowAddAppt(true)}
              className="flex items-center justify-center gap-1.5 bg-purple-50 text-purple-700 py-2 px-3 rounded-xl text-xs font-medium hover:bg-purple-100 transition-colors"
            >
              Schedule
            </button>
          </div>

          {selectedLead.appointments.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-gray-700 uppercase mb-2">
                Appointments
              </h3>
              <div className="space-y-2">
                {selectedLead.appointments.map(a => (
                  <div key={a.id} className="bg-indigo-50 rounded-xl p-3 text-xs">
                    <div className="font-medium text-indigo-800">{a.title}</div>
                    <div className="text-indigo-600">
                      {new Date(a.scheduledAt).toLocaleString()} · {a.type}
                    </div>
                    <div className="text-indigo-500">{a.status}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedLead.calls.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-700 uppercase mb-2">
                Call History
              </h3>
              <div className="space-y-2">
                {selectedLead.calls.map(c => (
                  <div key={c.id} className="bg-gray-50 rounded-xl p-3 text-xs">
                    <div className="font-medium text-gray-700">
                      {c.outcome || 'Called'}
                    </div>
                    <div className="text-gray-500">
                      {new Date(c.calledAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add Appointment Modal ── */}
      {showAddAppt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-4">Schedule Appointment</h3>
            <div className="space-y-3">
              <input
                placeholder="Title (e.g. Discovery Call)"
                value={apptForm.title}
                onChange={e => setApptForm({ ...apptForm, title: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="datetime-local"
                value={apptForm.scheduledAt}
                onChange={e => setApptForm({ ...apptForm, scheduledAt: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={apptForm.type}
                onChange={e => setApptForm({ ...apptForm, type: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="CALL">Phone Call</option>
                <option value="MEETING">In-Person Meeting</option>
                <option value="DEMO">Product Demo</option>
              </select>
              <input
                type="number"
                placeholder="Duration (minutes)"
                value={apptForm.duration}
                onChange={e =>
                  setApptForm({ ...apptForm, duration: Number(e.target.value) })
                }
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={addAppointment}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-indigo-700"
              >
                Save
              </button>
              <button
                onClick={() => setShowAddAppt(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-sm font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Call Modal ── */}
      {callModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl text-center">
            <div className="mb-4">
              {callModal.status === 'calling' && (
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <PhoneCall className="w-8 h-8 text-green-600 animate-pulse" />
                </div>
              )}
              {callModal.status === 'success' && (
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              )}
              {callModal.status === 'error' && (
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <PhoneOff className="w-8 h-8 text-red-500" />
                </div>
              )}
              <h3 className="font-bold text-gray-900 text-lg mb-1">
                {callModal.status === 'calling' && `Calling ${callModal.lead.name}…`}
                {callModal.status === 'success' && 'Call Initiated!'}
                {callModal.status === 'error' && 'Call Failed'}
              </h3>
              {callModal.lead.phone && (
                <p className="text-sm text-gray-500 mb-2">{callModal.lead.phone}</p>
              )}
              <p className={`text-sm ${callModal.status === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
                {callModal.message}
              </p>
              {callModal.status === 'success' && (
                <p className="text-xs text-gray-400 mt-2">
                  This call has been logged automatically.
                </p>
              )}
              {callModal.status === 'error' && (
                <p className="text-xs text-gray-400 mt-2">
                  Make sure TWILIO_* env vars are set in your .env file.
                </p>
              )}
            </div>
            <div className="flex gap-3">
              {callModal.status === 'error' && (
                <button
                  onClick={() => dialLead(callModal.lead)}
                  className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-green-700"
                >
                  Retry
                </button>
              )}
              <button
                onClick={() => setCallModal(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-sm font-medium hover:bg-gray-200"
              >
                {callModal.status === 'calling' ? 'Cancel' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Lead Modal ── */}
      {editLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[480px] shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-1">Edit Lead</h3>
            <p className="text-sm text-gray-500 mb-5">
              Update contact details and notes
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Full Name
                </label>
                <input
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Phone
                </label>
                <input
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="Optional"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Service
                </label>
                <select
                  value={editForm.service}
                  onChange={e => setEditForm({ ...editForm, service: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">None</option>
                  {SERVICES.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Internal Notes
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Add private notes about this lead…"
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={saveEdit}
                disabled={editSaving || !editForm.name || !editForm.email}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditLead(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
