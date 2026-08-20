'use client'

import { useState, useRef } from 'react'
import {
  Search, MapPin, Phone, Globe, Star, Building2,
  Plus, CheckCircle, Loader2, AlertCircle, ExternalLink,
  Download, Save, X, ChevronDown, ChevronUp,
} from 'lucide-react'

interface PlaceResult {
  placeId: string
  name: string
  address: string
  phone: string | null
  website: string | null
  rating: number | null
  totalRatings: number | null
  types: string[]
  mapsUrl: string | null
  businessStatus: string | null
  lat: number | null
  lng: number | null
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const TYPE_LABEL: Record<string, string> = {
  restaurant: 'Restaurant', cafe: 'Café', store: 'Store',
  health: 'Health', doctor: 'Doctor', lawyer: 'Lawyer',
  real_estate_agency: 'Real Estate', gym: 'Gym',
  beauty_salon: 'Salon', hair_care: 'Hair Care',
  accounting: 'Accounting', insurance_agency: 'Insurance',
  car_dealer: 'Car Dealer', car_repair: 'Auto Repair',
  electrician: 'Electrician', plumber: 'Plumber',
  painter: 'Painter', general_contractor: 'Contractor',
  moving_company: 'Moving', lodging: 'Hotel',
  school: 'School', university: 'University',
  hospital: 'Hospital', pharmacy: 'Pharmacy',
  bank: 'Bank', finance: 'Finance',
}

function niceType(types: string[]): string {
  for (const t of types) {
    if (TYPE_LABEL[t]) return TYPE_LABEL[t]
  }
  const raw = types.find(t => !['point_of_interest', 'establishment', 'food'].includes(t))
  return raw ? raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Business'
}

function StarRating({ rating, total }: { rating: number | null; total: number | null }) {
  if (!rating) return null
  return (
    <div className="flex items-center gap-1">
      <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
      <span className="text-xs font-semibold text-gray-700">{rating.toFixed(1)}</span>
      {total && <span className="text-xs text-gray-400">({total.toLocaleString()})</span>}
    </div>
  )
}

const QUICK_SEARCHES = [
  'Plumbers', 'Electricians', 'Real Estate Agents', 'Dentists',
  'Law Firms', 'Restaurants', 'Auto Repair Shops', 'Hair Salons',
  'Gyms', 'Accountants', 'Contractors', 'Insurance Agents',
]

export default function BusinessSearchPage() {
  const [query, setQuery]       = useState('')
  const [location, setLocation] = useState('')
  const [results, setResults]   = useState<PlaceResult[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [searched, setSearched] = useState(false)
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({})
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savingAll, setSavingAll] = useState(false)
  const [allSaved, setAllSaved] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [totalSaved, setTotalSaved] = useState(0)
  const queryRef = useRef<HTMLInputElement>(null)

  const doSearch = async (q = query, loc = location) => {
    if (!q.trim()) { queryRef.current?.focus(); return }
    setLoading(true)
    setError('')
    setResults([])
    setSearched(true)
    setSaveStates({})
    setSavedIds(new Set())
    setAllSaved(false)
    try {
      const res = await fetch('/api/search/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, location: loc }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setResults(data.results || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const saveLead = async (place: PlaceResult): Promise<boolean> => {
    setSaveStates(p => ({ ...p, [place.placeId]: 'saving' }))
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: place.name,
          email: '',           // Google Places doesn't provide emails
          phone: place.phone || '',
          service: niceType(place.types),
          message: [
            place.address,
            place.website ? `Website: ${place.website}` : null,
            place.mapsUrl  ? `Maps: ${place.mapsUrl}` : null,
            place.rating   ? `Rating: ${place.rating}/5 (${place.totalRatings} reviews)` : null,
          ].filter(Boolean).join('\n'),
          source: 'google_search',
          notes: place.website || place.mapsUrl || '',
        }),
      })
      // 201 = created, 200 = ok
      if (res.status === 409 || !res.ok) {
        const body = await res.json()
        // If it's a duplicate email error it's ok, treat as saved
        if (body.error?.toLowerCase().includes('unique')) {
          setSaveStates(p => ({ ...p, [place.placeId]: 'saved' }))
          setSavedIds(p => new Set([...p, place.placeId]))
          return true
        }
        throw new Error(body.error || 'Save failed')
      }
      setSaveStates(p => ({ ...p, [place.placeId]: 'saved' }))
      setSavedIds(p => new Set([...p, place.placeId]))
      setTotalSaved(n => n + 1)
      return true
    } catch (e: unknown) {
      setSaveStates(p => ({ ...p, [place.placeId]: 'error' }))
      return false
    }
  }

  const saveAll = async () => {
    const unsaved = results.filter(r => !savedIds.has(r.placeId))
    if (unsaved.length === 0) return
    setSavingAll(true)
    await Promise.all(unsaved.map(saveLead))
    setSavingAll(false)
    setAllSaved(true)
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const unsavedCount = results.filter(r => !savedIds.has(r.placeId)).length

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-indigo-600" />
          Business Lead Finder
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Search Google Maps for businesses · save them as leads instantly
        </p>
      </div>

      {/* Search Box */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Business type */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={queryRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Type of business  e.g. plumbers, dentists, law firms…"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Location */}
          <div className="sm:w-56 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="City or area (optional)"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={() => doSearch()}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 whitespace-nowrap text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        {/* Quick search chips */}
        <div className="mt-4">
          <p className="text-xs text-gray-400 mb-2">Quick searches:</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_SEARCHES.map(qs => (
              <button
                key={qs}
                onClick={() => { setQuery(qs); doSearch(qs, location) }}
                className="px-3 py-1.5 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 text-gray-600 text-xs rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors font-medium"
              >
                {qs}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* API key notice */}
      {error?.includes('GOOGLE_PLACES_API_KEY') || error?.includes('not set') ? (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 mb-2">Google Places API Key Required</p>
              <ol className="text-sm text-amber-700 space-y-1 list-decimal ml-4">
                <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="underline">console.cloud.google.com</a></li>
                <li>Create a project → Enable <strong>Places API</strong></li>
                <li>Go to <strong>Credentials</strong> → Create API Key</li>
                <li>Open <code className="bg-amber-100 px-1 rounded">.env</code> and set: <code className="bg-amber-100 px-1 rounded">GOOGLE_PLACES_API_KEY=your_key_here</code></li>
                <li>Restart the dev server</li>
              </ol>
              <p className="text-xs text-amber-600 mt-2">💡 Google gives $200 free credit/month — enough for thousands of searches.</p>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="mb-5 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Results header */}
      {results.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-gray-900">
              {results.length} businesses found
            </h2>
            {totalSaved > 0 && (
              <span className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-medium">
                ✅ {totalSaved} saved to spreadsheet
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Export saved as Excel */}
            {totalSaved > 0 && (
              <a
                href="/api/leads/export?format=xlsx"
                className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-medium hover:bg-emerald-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download Excel
              </a>
            )}
            {/* Save all */}
            {unsavedCount > 0 && (
              <button
                onClick={saveAll}
                disabled={savingAll}
                className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {savingAll
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Save className="w-3.5 h-3.5" />}
                {savingAll ? 'Saving…' : `Save All ${unsavedCount} to Spreadsheet`}
              </button>
            )}
            {allSaved && unsavedCount === 0 && (
              <span className="flex items-center gap-1 text-green-700 text-sm font-medium">
                <CheckCircle className="w-4 h-4" /> All saved!
              </span>
            )}
          </div>
        </div>
      )}

      {/* Results Grid */}
      {results.length > 0 && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {results.map(place => {
            const state = saveStates[place.placeId] || 'idle'
            const isExpanded = expanded.has(place.placeId)
            const type = niceType(place.types)

            return (
              <div
                key={place.placeId}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                  state === 'saved'
                    ? 'border-green-200 ring-1 ring-green-200'
                    : 'border-gray-100 hover:border-indigo-200 hover:shadow-md'
                }`}
              >
                {/* Card header */}
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">
                        {place.name}
                      </h3>
                      <span className="inline-block mt-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                        {type}
                      </span>
                    </div>
                    {state === 'saved' && (
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                    )}
                    {place.businessStatus === 'CLOSED_PERMANENTLY' && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Closed</span>
                    )}
                  </div>

                  {/* Rating */}
                  <StarRating rating={place.rating} total={place.totalRatings} />

                  {/* Info rows */}
                  <div className="mt-3 space-y-1.5">
                    {/* Address */}
                    <div className="flex items-start gap-2 text-xs text-gray-600">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <span className={isExpanded ? '' : 'line-clamp-1'}>{place.address}</span>
                    </div>

                    {/* Phone */}
                    {place.phone ? (
                      <div className="flex items-center gap-2 text-xs text-gray-700">
                        <Phone className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        <a href={`tel:${place.phone}`} className="hover:text-indigo-600 font-medium">
                          {place.phone}
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span>No phone listed</span>
                      </div>
                    )}

                    {/* Website */}
                    {place.website ? (
                      <div className="flex items-center gap-2 text-xs">
                        <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <a
                          href={place.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline truncate max-w-[180px]"
                        >
                          {place.website.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                        <ExternalLink className="w-3 h-3 text-indigo-400" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Globe className="w-3.5 h-3.5 shrink-0" />
                        <span>No website listed</span>
                      </div>
                    )}

                    {/* Note about email */}
                    <div className="flex items-center gap-2 text-xs text-gray-400 italic">
                      <span className="w-3.5 h-3.5 shrink-0 text-center">@</span>
                      <span>Email not available via Google (add manually)</span>
                    </div>
                  </div>

                  {/* Expand toggle */}
                  <button
                    onClick={() => toggleExpand(place.placeId)}
                    className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {isExpanded ? 'Show less' : 'More details'}
                  </button>

                  {/* Expanded: Maps link + coordinates */}
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5 text-xs text-gray-500">
                      {place.mapsUrl && (
                        <a
                          href={place.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-indigo-600 hover:underline"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          Open in Google Maps
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {place.lat && place.lng && (
                        <p className="text-gray-400">
                          📍 {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
                        </p>
                      )}
                      {place.businessStatus && place.businessStatus !== 'OPERATIONAL' && (
                        <p className="text-orange-600">⚠️ Status: {place.businessStatus.replace(/_/g, ' ')}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {place.types.filter(t => !['point_of_interest','establishment'].includes(t)).slice(0, 5).map(t => (
                          <span key={t} className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-xs">
                            {t.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card footer / save button */}
                <div className="px-4 pb-4">
                  {state === 'saved' ? (
                    <div className="w-full flex items-center justify-center gap-2 bg-green-50 text-green-700 py-2 rounded-xl text-xs font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Saved to Spreadsheet
                    </div>
                  ) : state === 'error' ? (
                    <button
                      onClick={() => saveLead(place)}
                      className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 py-2 rounded-xl text-xs font-medium hover:bg-red-100 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Failed — Retry
                    </button>
                  ) : (
                    <button
                      onClick={() => saveLead(place)}
                      disabled={state === 'saving'}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
                    >
                      {state === 'saving'
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Plus className="w-3.5 h-3.5" />}
                      {state === 'saving' ? 'Saving…' : 'Save as Lead'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty / loading state */}
      {loading && (
        <div className="text-center py-20">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Searching Google Maps…</p>
          <p className="text-sm text-gray-400 mt-1">Fetching business details for up to 15 results</p>
        </div>
      )}

      {searched && !loading && results.length === 0 && !error && (
        <div className="text-center py-20 text-gray-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No businesses found</p>
          <p className="text-sm mt-1">Try a different search term or location</p>
        </div>
      )}

      {!searched && !loading && (
        <div className="text-center py-20 text-gray-300">
          <Search className="w-12 h-12 mx-auto mb-4" />
          <p className="text-gray-500 font-medium text-lg">Find your next leads</p>
          <p className="text-sm text-gray-400 mt-2">
            Search any type of business on Google Maps.<br />
            Save them directly to your lead spreadsheet with one click.
          </p>
        </div>
      )}
    </div>
  )
}
