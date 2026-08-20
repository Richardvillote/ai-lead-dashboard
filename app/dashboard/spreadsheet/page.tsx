'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Plus, Trash2, Download, Upload, Search,
  CheckCircle, XCircle, FileSpreadsheet, Save, X,
} from 'lucide-react'
import { STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from '@/lib/utils'

interface Lead {
  id: string
  name: string
  email: string
  phone: string | null
  service: string | null
  status: string
  source: string | null
  notes: string | null
  createdAt: string
  isNew?: boolean   // local-only flag for unsaved rows
  isDirty?: boolean // local-only flag for modified rows
}

type EditableField = 'name' | 'email' | 'phone' | 'service' | 'status' | 'source' | 'notes'

const COLUMNS: { key: EditableField; label: string; width: string; type?: string }[] = [
  { key: 'name',    label: 'Name',    width: 'w-40' },
  { key: 'email',   label: 'Email',   width: 'w-52' },
  { key: 'phone',   label: 'Phone',   width: 'w-36' },
  { key: 'service', label: 'Service', width: 'w-36' },
  { key: 'status',  label: 'Status',  width: 'w-32', type: 'select' },
  { key: 'source',  label: 'Source',  width: 'w-28' },
  { key: 'notes',   label: 'Notes',   width: 'w-48' },
]

const SERVICES = ['Consulting', 'Web Development', 'Marketing', 'SEO', 'Social Media', 'Other']

const BLANK_LEAD = (): Lead => ({
  id: `new-${Date.now()}-${Math.random()}`,
  name: '', email: '', phone: null, service: null,
  status: 'NEW', source: 'manual', notes: null,
  createdAt: new Date().toISOString(),
  isNew: true, isDirty: true,
})

export default function SpreadsheetPage() {
  const [leads, setLeads]     = useState<Lead[]>([])
  const [search, setSearch]   = useState('')
  const [saving, setSaving]   = useState<Record<string, boolean>>({})
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    imported: number; skipped: number; total: number; errors: string[]
  } | null>(null)
  const [activeCell, setActiveCell] = useState<{ id: string; key: EditableField } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(() =>
    fetch('/api/leads')
      .then(r => r.json())
      .then((data: Lead[]) =>
        setLeads(prev => {
          // Keep any unsaved new rows at the bottom
          const newRows = prev.filter(l => l.isNew)
          return [...data, ...newRows]
        })
      ), [])

  useEffect(() => { load() }, [load])

  // ── Cell editing ──────────────────────────────────────────────────────────
  const updateCell = (id: string, key: EditableField, value: string) => {
    setLeads(prev =>
      prev.map(l =>
        l.id === id ? { ...l, [key]: value || null, isDirty: true } : l
      )
    )
  }

  // ── Add blank row ─────────────────────────────────────────────────────────
  const addRow = () => {
    const blank = BLANK_LEAD()
    setLeads(prev => [...prev, blank])
    setTimeout(() => setActiveCell({ id: blank.id, key: 'name' }), 50)
  }

  // ── Save a single row ─────────────────────────────────────────────────────
  const saveRow = async (lead: Lead) => {
    if (!lead.name || !lead.email) {
      showToast('Name and email are required to save', false)
      return
    }
    setSaving(prev => ({ ...prev, [lead.id]: true }))
    try {
      if (lead.isNew) {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: lead.name, email: lead.email,
            phone: lead.phone, service: lead.service,
            notes: lead.notes, source: lead.source || 'manual',
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        showToast(`✅ ${lead.name} saved!`)
      } else {
        const res = await fetch(`/api/leads/${lead.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: lead.name, email: lead.email,
            phone: lead.phone, service: lead.service,
            notes: lead.notes, status: lead.status,
            source: lead.source,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        showToast(`✅ ${lead.name} updated!`)
      }
      await load()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Save failed', false)
    } finally {
      setSaving(prev => ({ ...prev, [lead.id]: false }))
    }
  }

  // ── Save all dirty rows ───────────────────────────────────────────────────
  const saveAll = async () => {
    const dirty = leads.filter(l => l.isDirty)
    if (dirty.length === 0) { showToast('Nothing to save'); return }
    for (const l of dirty) await saveRow(l)
  }

  // ── Delete a row ──────────────────────────────────────────────────────────
  const deleteRow = async (lead: Lead) => {
    if (lead.isNew) {
      setLeads(prev => prev.filter(l => l.id !== lead.id))
      return
    }
    if (!confirm(`Delete ${lead.name}? This cannot be undone.`)) return
    setDeleting(prev => ({ ...prev, [lead.id]: true }))
    await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' })
    setLeads(prev => prev.filter(l => l.id !== lead.id))
    showToast(`🗑 ${lead.name} deleted`)
    setDeleting(prev => ({ ...prev, [lead.id]: false }))
  }

  // ── Discard unsaved new row ───────────────────────────────────────────────
  const discardRow = (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id))
  }

  // ── Import file ───────────────────────────────────────────────────────────
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/leads/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setImportResult(data)
      await load()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Import failed', false)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = leads.filter(l =>
    !search ||
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.email.toLowerCase().includes(search.toLowerCase()) ||
    (l.phone || '').includes(search)
  )

  const dirtyCount = leads.filter(l => l.isDirty).length

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
            Lead Spreadsheet
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {leads.filter(l => !l.isNew).length} leads · click any cell to edit
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-44"
            />
          </div>

          {/* Add row */}
          <button
            onClick={addRow}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Lead
          </button>

          {/* Save all */}
          {dirtyCount > 0 && (
            <button
              onClick={saveAll}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-700 transition-colors animate-pulse"
            >
              <Save className="w-4 h-4" />
              Save {dirtyCount} change{dirtyCount !== 1 ? 's' : ''}
            </button>
          )}

          {/* Import */}
          <label className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:border-indigo-300 hover:text-indigo-700 transition-colors cursor-pointer shadow-sm">
            <Upload className="w-4 h-4" />
            {importing ? 'Importing…' : 'Import'}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImport}
              className="hidden"
            />
          </label>

          {/* Export CSV */}
          <a
            href="/api/leads/export?format=csv"
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:border-indigo-300 hover:text-indigo-700 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> CSV
          </a>

          {/* Export XLSX */}
          <a
            href="/api/leads/export?format=xlsx"
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> Excel
          </a>
        </div>
      </div>

      {/* ── Import Result Banner ── */}
      {importResult && (
        <div className="mb-4 flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-green-800">
              Import complete — {importResult.imported} added, {importResult.skipped} skipped (of {importResult.total} rows)
            </p>
            {importResult.errors.length > 0 && (
              <ul className="mt-1 text-green-700 text-xs list-disc ml-4">
                {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
          <button onClick={() => setImportResult(null)}><X className="w-4 h-4 text-green-600" /></button>
        </div>
      )}

      {/* ── Import Format Hint ── */}
      <div className="mb-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 text-xs text-indigo-700 flex items-center gap-2">
        💡 <span>Import supports <strong>.xlsx, .xls, .csv</strong>. Columns detected automatically: <strong>Name, Email, Phone, Service, Status, Source, Notes</strong>. Duplicates (same email) are skipped.</span>
      </div>

      {/* ── Spreadsheet Table ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-auto flex-1">
        <table className="w-full text-sm border-collapse min-w-max">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <th className="px-3 py-2 text-left font-semibold text-gray-600 text-xs w-8">#</th>
              {COLUMNS.map(col => (
                <th key={col.key} className={`px-3 py-2 text-left font-semibold text-gray-600 text-xs ${col.width}`}>
                  {col.label}
                </th>
              ))}
              <th className="px-3 py-2 text-left font-semibold text-gray-600 text-xs w-28">Created</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead, idx) => (
              <tr
                key={lead.id}
                className={`border-b border-gray-100 transition-colors ${
                  lead.isNew
                    ? 'bg-indigo-50/60'
                    : lead.isDirty
                    ? 'bg-yellow-50/60'
                    : 'hover:bg-gray-50/60'
                }`}
              >
                {/* Row number */}
                <td className="px-3 py-1 text-xs text-gray-400 select-none">{idx + 1}</td>

                {/* Editable columns */}
                {COLUMNS.map(col => (
                  <td key={col.key} className="px-1 py-1">
                    {col.type === 'select' ? (
                      <select
                        value={lead.status}
                        onChange={e => updateCell(lead.id, 'status', e.target.value)}
                        onBlur={() => !lead.isNew && saveRow(lead)}
                        className={`w-full text-xs px-2 py-1.5 rounded-lg border-0 font-medium cursor-pointer outline-none focus:ring-2 focus:ring-indigo-400 ${STATUS_COLORS[lead.status]}`}
                      >
                        {STATUS_ORDER.map(s => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    ) : col.key === 'service' ? (
                      <select
                        value={lead.service || ''}
                        onChange={e => updateCell(lead.id, 'service', e.target.value)}
                        onBlur={() => !lead.isNew && saveRow(lead)}
                        className="w-full text-xs px-2 py-1.5 rounded-lg border border-transparent focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400 outline-none bg-transparent hover:bg-white transition-colors"
                      >
                        <option value="">—</option>
                        {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input
                        type={col.key === 'email' ? 'email' : 'text'}
                        value={lead[col.key] || ''}
                        onChange={e => updateCell(lead.id, col.key, e.target.value)}
                        onFocus={() => setActiveCell({ id: lead.id, key: col.key })}
                        onBlur={() => {
                          setActiveCell(null)
                          if (!lead.isNew && lead.isDirty) saveRow(lead)
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur()
                          }
                          if (e.key === 'Tab') {
                            // natural tab handled by browser
                          }
                        }}
                        placeholder={col.key === 'name' ? 'Full name…' : col.key === 'email' ? 'email@example.com' : ''}
                        className={`w-full text-xs px-2 py-1.5 rounded-lg border outline-none transition-colors ${
                          activeCell?.id === lead.id && activeCell?.key === col.key
                            ? 'border-indigo-400 ring-2 ring-indigo-200 bg-white'
                            : 'border-transparent hover:border-gray-300 bg-transparent hover:bg-white'
                        } ${
                          col.key === 'name' && !lead.name ? 'border-red-300 bg-red-50/50' : ''
                        } ${
                          col.key === 'email' && !lead.email ? 'border-red-300 bg-red-50/50' : ''
                        }`}
                      />
                    )}
                  </td>
                ))}

                {/* Created date */}
                <td className="px-3 py-1 text-xs text-gray-400 whitespace-nowrap">
                  {lead.isNew ? (
                    <span className="text-indigo-500 font-medium">Unsaved</span>
                  ) : (
                    new Date(lead.createdAt).toLocaleDateString()
                  )}
                </td>

                {/* Actions */}
                <td className="px-2 py-1">
                  <div className="flex items-center gap-1">
                    {(lead.isNew || lead.isDirty) && (
                      <button
                        onClick={() => saveRow(lead)}
                        disabled={saving[lead.id]}
                        title="Save"
                        className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                      >
                        {saving[lead.id]
                          ? <span className="text-xs">…</span>
                          : <CheckCircle className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {lead.isNew && (
                      <button
                        onClick={() => discardRow(lead.id)}
                        title="Discard"
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteRow(lead)}
                      disabled={deleting[lead.id]}
                      title="Delete"
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {/* Empty state */}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 3} className="text-center py-16 text-gray-400">
                  <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No leads yet</p>
                  <p className="text-xs mt-1">Click <strong>+ Add Lead</strong> to add your first one, or import a spreadsheet.</p>
                </td>
              </tr>
            )}

            {/* Add row at bottom */}
            <tr>
              <td colSpan={COLUMNS.length + 3} className="px-3 py-2">
                <button
                  onClick={addRow}
                  className="flex items-center gap-2 text-xs text-gray-400 hover:text-indigo-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add row
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.ok
            ? 'bg-gray-900 text-white'
            : 'bg-red-600 text-white'
        }`}>
          {toast.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
