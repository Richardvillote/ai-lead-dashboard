'use client'

import { useEffect, useState } from 'react'
import { Send, Mail, Users, CheckCircle, XCircle, Clock, ChevronDown } from 'lucide-react'
import { STATUS_LABELS, STATUS_ORDER } from '@/lib/utils'

interface Lead {
  id: string
  name: string
  email: string
  status: string
}

interface EmailLog {
  id: string
  subject: string
  recipientEmail: string
  recipientName: string
  status: string
  campaign: string | null
  sentAt: string
  lead: { name: string } | null
}

const TEMPLATES = [
  {
    label: 'Follow-Up',
    subject: 'Following up on your inquiry',
    body: `Hi {{name}},

I wanted to follow up on your recent inquiry and see if you had any questions.

We'd love to help you reach your goals. Feel free to reply to this email or book a quick call — we're happy to chat!

Looking forward to hearing from you.

Best regards,
The Team`,
  },
  {
    label: 'Welcome',
    subject: 'Welcome! Here\'s what happens next',
    body: `Hi {{name}},

Thank you for reaching out to us! We're excited to connect with you.

Here's what to expect:
- We'll review your inquiry within 24 hours
- One of our team members will reach out personally
- We'll schedule a free consultation at your convenience

In the meantime, feel free to reply to this email with any questions.

Warm regards,
The Team`,
  },
  {
    label: 'Special Offer',
    subject: 'Exclusive offer just for you, {{name}}',
    body: `Hi {{name}},

We have an exclusive offer we'd love to share with you.

For a limited time, we're offering a complimentary consultation plus 20% off our services for new clients.

This offer expires soon — reply to this email or click below to claim it.

We look forward to working with you!

Best,
The Team`,
  },
  {
    label: 'Re-engagement',
    subject: 'We miss you, {{name}} — let\'s reconnect',
    body: `Hi {{name}},

We noticed it's been a while since we last connected and wanted to reach out.

If you're still looking for help with your goals, we're here and ready to assist. A lot has changed and we have some exciting new offerings.

Would you be open to a quick 15-minute call? Just reply and we'll set it up.

Best regards,
The Team`,
  },
]

export default function EmailMarketingPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose')

  // Compose state
  const [recipientMode, setRecipientMode] = useState<'all' | 'status' | 'individual'>('all')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [campaign, setCampaign] = useState('')
  const [template, setTemplate] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const [showLeadPicker, setShowLeadPicker] = useState(false)

  useEffect(() => {
    fetch('/api/leads').then(r => r.json()).then(setLeads)
    fetch('/api/email/logs').then(r => r.json()).then(setLogs)
  }, [])

  const reloadLogs = () =>
    fetch('/api/email/logs').then(r => r.json()).then(setLogs)

  const applyTemplate = (label: string) => {
    const t = TEMPLATES.find(t => t.label === label)
    if (!t) return
    setSubject(t.subject)
    setBody(t.body)
    setTemplate(label)
  }

  const recipientCount = () => {
    if (recipientMode === 'all') return leads.length
    if (recipientMode === 'status')
      return statusFilter === 'ALL'
        ? leads.length
        : leads.filter(l => l.status === statusFilter).length
    return selectedIds.length
  }

  const toggleLead = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSend = async () => {
    setError('')
    setResult(null)

    if (!subject.trim() || !body.trim()) {
      setError('Subject and body are required.')
      return
    }
    if (recipientMode === 'individual' && selectedIds.length === 0) {
      setError('Please select at least one recipient.')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          body,
          campaign: campaign || undefined,
          sendToAll: recipientMode !== 'individual',
          statusFilter: recipientMode === 'status' ? statusFilter : 'ALL',
          recipientIds: recipientMode === 'individual' ? selectedIds : [],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResult(data)
      reloadLogs()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Email Marketing</h1>
        <p className="text-sm text-gray-500 mt-1">
          Compose and send emails directly to your leads
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['compose', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${
              activeTab === tab
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
            }`}
          >
            {tab === 'compose' ? '✉️ Compose' : '📋 Sent History'}
          </button>
        ))}
      </div>

      {/* ── COMPOSE TAB ── */}
      {activeTab === 'compose' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Compose Form */}
          <div className="lg:col-span-2 space-y-4">

            {/* Template picker */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                📄 Start from a Template (optional)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TEMPLATES.map(t => (
                  <button
                    key={t.label}
                    onClick={() => applyTemplate(t.label)}
                    className={`py-2 px-3 text-xs rounded-xl font-medium border transition-colors ${
                      template === t.label
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Tip: Use <code className="bg-gray-100 px-1 rounded">{'{{name}}'}</code> to personalise with each lead's name.
              </p>
            </div>

            {/* Subject & campaign */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Subject Line *
                </label>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Following up on your inquiry"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Campaign Tag <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  value={campaign}
                  onChange={e => setCampaign(e.target.value)}
                  placeholder="e.g. August Follow-Up"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Email body */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Body *
              </label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your email message here…"
                rows={12}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
              />
            </div>

            {/* Error / result */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">
                <XCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
            {result && (
              <div className="flex items-center gap-3 bg-green-50 text-green-800 px-4 py-3 rounded-xl text-sm">
                <CheckCircle className="w-5 h-5 shrink-0" />
                <span>
                  <strong>{result.sent}</strong> email{result.sent !== 1 ? 's' : ''} sent successfully
                  {result.failed > 0 && (
                    <span className="text-red-600 ml-2">({result.failed} failed)</span>
                  )}
                </span>
              </div>
            )}

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm"
            >
              {sending ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Sending to {recipientCount()} recipient{recipientCount() !== 1 ? 's' : ''}…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send to {recipientCount()} recipient{recipientCount() !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>

          {/* Right: Recipients */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                Recipients
              </h3>

              {/* Mode select */}
              <div className="space-y-2 mb-4">
                {[
                  { value: 'all', label: `All Leads (${leads.length})` },
                  { value: 'status', label: 'By Status' },
                  { value: 'individual', label: 'Pick Manually' },
                ].map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recipientMode"
                      value={opt.value}
                      checked={recipientMode === opt.value}
                      onChange={() => setRecipientMode(opt.value as 'all' | 'status' | 'individual')}
                      className="accent-indigo-600"
                    />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>

              {/* Status filter */}
              {recipientMode === 'status' && (
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Filter by Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ALL">All Statuses</option>
                    {STATUS_ORDER.map(s => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    {recipientCount()} lead{recipientCount() !== 1 ? 's' : ''} selected
                  </p>
                </div>
              )}

              {/* Manual picker */}
              {recipientMode === 'individual' && (
                <div>
                  <button
                    onClick={() => setShowLeadPicker(p => !p)}
                    className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-indigo-300 transition-colors mb-2"
                  >
                    <span>
                      {selectedIds.length === 0
                        ? 'Select leads…'
                        : `${selectedIds.length} selected`}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showLeadPicker ? 'rotate-180' : ''}`} />
                  </button>
                  {showLeadPicker && (
                    <div className="border border-gray-200 rounded-xl max-h-56 overflow-y-auto">
                      {leads.map(lead => (
                        <label
                          key={lead.id}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b border-gray-50 last:border-0"
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(lead.id)}
                            onChange={() => toggleLead(lead.id)}
                            className="accent-indigo-600"
                          />
                          <div>
                            <div className="text-xs font-medium text-gray-800">{lead.name}</div>
                            <div className="text-xs text-gray-400">{lead.email}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Summary pill */}
              <div className="mt-4 bg-indigo-50 rounded-xl px-3 py-2 flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="text-xs text-indigo-800 font-medium">
                  {recipientCount()} email{recipientCount() !== 1 ? 's' : ''} will be sent
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Sent Emails</h2>
            <span className="text-sm text-gray-400">{logs.length} total</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Recipient</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Subject</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Campaign</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Sent At</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{log.recipientName}</div>
                    <div className="text-xs text-gray-400">{log.recipientEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{log.subject}</td>
                  <td className="px-4 py-3 text-gray-500">{log.campaign || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      log.status === 'SENT'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(log.sentAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400">
                    No emails sent yet. Compose your first campaign above!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
