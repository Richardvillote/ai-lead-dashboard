'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Search, MapPin, Phone, Globe, Star, SearchCheck,
  Plus, CheckCircle, Loader2, AlertCircle, ExternalLink,
  Download, Save, X, ChevronDown, ChevronUp, FileSpreadsheet,
  Navigation, Zap, DatabaseZap,
} from 'lucide-react'
import MapPicker from '@/components/MapPicker'

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
type Provider  = 'google' | 'yelp' | 'osm' | ''

// ── Provider badge ───────────────────────────────────────────────────────────
const PROVIDER_META: Record<string, { label: string; icon: string; color: string; tip: string }> = {
  google: {
    label: 'Google Maps',
    icon:  '🗺️',
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    tip:   'Full details — name, phone, website, rating',
  },
  yelp: {
    label: 'Yelp',
    icon:  '⭐',
    color: 'text-red-700 bg-red-50 border-red-200',
    tip:   'Name, phone, address, rating — no website (Yelp limitation)',
  },
  osm: {
    label: 'OpenStreetMap',
    icon:  '🌍',
    color: 'text-green-700 bg-green-50 border-green-200',
    tip:   'Free & open — data completeness varies by region',
  },
}

function ProviderBadge({ provider, showTip = false }: { provider: Provider; showTip?: boolean }) {
  if (!provider) return null
  const m = PROVIDER_META[provider]
  if (!m) return null
  return (
    <span
      title={showTip ? m.tip : undefined}
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${m.color}`}
    >
      <span>{m.icon}</span>
      {m.label}
    </span>
  )
}

// ── Provider setup info panel (shown before first search) ────────────────────
function ProviderInfoPanel({ provider }: { provider: Provider }) {
  if (!provider) return null

  if (provider === 'google') {
    return (
      <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 mb-5">
        <Zap className="w-3.5 h-3.5 shrink-0" />
        <span><strong>Google Maps</strong> is your active provider — best data quality. ✅</span>
      </div>
    )
  }

  if (provider === 'yelp') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 text-sm">
        <div className="flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Using Yelp (free) · Google key not set</p>
            <p className="text-amber-700 mt-1 text-xs">
              Results include name, phone, address and rating. Website URLs are not available via Yelp&apos;s free API.
              For full details, add a <strong>Google Places API key</strong> to your <code className="bg-amber-100 px-1 rounded">.env</code>.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer"
                className="text-xs underline text-amber-700 font-medium">
                → Get Google key (billing req.)
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // OSM
  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-5 text-sm">
      <div className="flex gap-2 items-start">
        <span className="text-lg shrink-0">🌍</span>
        <div>
          <p className="font-semibold text-green-800">Using OpenStreetMap — no API key needed!</p>
          <p className="text-green-700 mt-1 text-xs">
            Results are free and unlimited. Data quality varies by area.
            For richer results (phone, website, ratings) add a free <strong>Yelp key</strong> or a <strong>Google key</strong>.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <a href="https://www.yelp.com/developers/v3/manage_app" target="_blank" rel="noreferrer"
              className="text-xs underline text-green-700 font-medium">
              → Get Yelp key (free, 500/day)
            </a>
            <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer"
              className="text-xs underline text-green-700 font-medium">
              → Get Google key (billing req.)
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Google-specific error panel ──────────────────────────────────────────────
function GoogleErrorPanel({ code, message }: { code?: string; message: string }) {
  const isNoKey   = code === 'NO_API_KEY'   || message.includes('not set')
  const isDenied  = code === 'REQUEST_DENIED'  || message.includes('denied') || message.includes('not activated') || message.includes('billing')
  const isQuota   = code === 'OVER_QUERY_LIMIT'

  if (isNoKey || isDenied) {
    return (
      <div className="mb-5 bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="w-full">
            <p className="font-semibold text-amber-800 mb-1">
              {isNoKey ? 'Google Places API Key Required' : 'Google API Access Problem'}
            </p>
            <p className="text-sm text-amber-700 mb-3">{isNoKey ? 'You need a Google Places API key to search businesses.' : message}</p>
            <div className="bg-amber-100 rounded-xl p-4 text-sm text-amber-800 space-y-2">
              <p className="font-medium">📋 Setup steps (5 minutes):</p>
              <ol className="list-decimal ml-4 space-y-1.5">
                <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="underline font-medium">console.cloud.google.com</a></li>
                <li>Create or select a project</li>
                <li>Go to <strong>APIs &amp; Services</strong> → <strong>Library</strong> → search <strong>&quot;Places API&quot;</strong> → <strong>Enable</strong></li>
                <li>Go to <strong>Credentials</strong> → <strong>+ Create Credentials</strong> → <strong>API Key</strong></li>
                <li>Set in your <code className="bg-amber-200 px-1 rounded">.env</code>:
                  <code className="bg-amber-200 px-1.5 py-0.5 rounded text-xs block mt-1">GOOGLE_PLACES_API_KEY=paste_your_key_here</code>
                </li>
                <li>Restart the dev server</li>
              </ol>
              <p className="text-xs text-amber-600 mt-2 border-t border-amber-200 pt-2">
                💡 Google gives <strong>$200 free credit / month</strong> — enough for thousands of searches. Billing must be enabled even for free usage.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isQuota) {
    return (
      <div className="mb-5 bg-orange-50 border border-orange-200 rounded-2xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-orange-800">API Quota Exceeded</p>
          <p className="text-sm text-orange-700 mt-1">You&apos;ve hit Google&apos;s rate limit. Wait a moment and try again, or check your billing plan.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-5 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  )
}

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

// ── Main Page ────────────────────────────────────────────────────────────────
export default function LeadSearchPage() {
  const [query, setQuery]         = useState('')
  const [location, setLocation]   = useState('')
  const [results, setResults]     = useState<PlaceResult[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [searched, setSearched]   = useState(false)
  const [saveStates, setSaveStates]  = useState<Record<string, SaveState>>({})
  const [savedIds, setSavedIds]      = useState<Set<string>>(new Set())
  const [savingAll, setSavingAll]    = useState(false)
  const [allSaved, setAllSaved]      = useState(false)
  const [expanded, setExpanded]      = useState<Set<string>>(new Set())
  const [totalSaved, setTotalSaved]  = useState(0)
  const [exporting, setExporting]    = useState(false)
  const [downloadDone, setDownloadDone] = useState(false)
  const [source, setSource]          = useState<Provider>('')    // which provider returned results
  const [activeProvider, setActiveProvider] = useState<Provider>('') // fetched on mount

  const queryRef = useRef<HTMLInputElement>(null)

  // Location detection state
  const [locLoading, setLocLoading] = useState(false)
  const [locError, setLocError]     = useState('')
  const [showLocTip, setShowLocTip] = useState(false)

  // Fetch which provider is active on page load
  useEffect(() => {
    fetch('/api/search/places')
      .then(r => r.json())
      .then(d => { if (d.provider) setActiveProvider(d.provider as Provider) })
      .catch(() => {})
  }, [])

  // ── Detect current location ────────────────────────────────────────────────
  const detectLocation = () => {
    setLocError('')
    setShowLocTip(false)
    if (!navigator.geolocation) { setLocError('Geolocation is not supported by your browser.'); return }

    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=10`,
            { headers: { 'Accept-Language': 'en' } }
          )
          const data = await res.json()
          const a = data.address || {}
          const city    = a.city || a.town || a.village || a.county || ''
          const state   = a.state || ''
          const country = a.country_code?.toUpperCase() !== 'US' ? (a.country || '') : ''
          const parts   = [city, state, country].filter(Boolean)
          setLocation(parts.join(', ') || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`)
        } catch {
          setLocation(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`)
        } finally { setLocLoading(false) }
      },
      err => {
        setLocLoading(false)
        if (err.code === 1) setLocError('Location access denied. Please allow it in your browser.')
        else if (err.code === 2) setLocError('Location unavailable. Check your device settings.')
        else setLocError('Could not get your location. Try again.')
      },
      { timeout: 10000, maximumAge: 60000 }
    )
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  const doSearch = async (q = query, loc = location) => {
    if (!q.trim()) { queryRef.current?.focus(); return }
    setLoading(true); setError(''); setErrorCode(''); setResults([])
    setSearched(true); setSaveStates({}); setSavedIds(new Set())
    setAllSaved(false); setTotalSaved(0); setSource(''); setDownloadDone(false)
    try {
      const res  = await fetch('/api/search/places', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query: q, location: loc }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorCode(data.code || ''); throw new Error(data.error || 'Search failed') }
      setResults(data.results || [])
      if (data.source) setSource(data.source as Provider)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally { setLoading(false) }
  }

  // ── Save single lead ───────────────────────────────────────────────────────
  const saveLead = async (place: PlaceResult): Promise<boolean> => {
    setSaveStates(p => ({ ...p, [place.placeId]: 'saving' }))
    try {
      const res = await fetch('/api/leads', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    place.name,
          email:   '',
          phone:   place.phone || '',
          service: niceType(place.types),
          message: [
            place.address,
            place.website ? `Website: ${place.website}` : null,
            place.mapsUrl  ? `Maps: ${place.mapsUrl}` : null,
            place.rating   ? `Rating: ${place.rating}/5 (${place.totalRatings} reviews)` : null,
          ].filter(Boolean).join('\n'),
          source: `${source || 'search'}_search`,
          notes:  place.website || place.mapsUrl || '',
        }),
      })
      if (!res.ok) {
        const body = await res.json()
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
    } catch {
      setSaveStates(p => ({ ...p, [place.placeId]: 'error' }))
      return false
    }
  }

  // ── Save all ───────────────────────────────────────────────────────────────
  const saveAll = async () => {
    const unsaved = results.filter(r => !savedIds.has(r.placeId))
    if (unsaved.length === 0) return
    setSavingAll(true)
    await Promise.all(unsaved.map(saveLead))
    setSavingAll(false); setAllSaved(true)
  }

  // ── Export results to Excel ────────────────────────────────────────────────
  const getLeads = async () => {
    if (results.length === 0) return
    setExporting(true)
    try {
      const res = await fetch('/api/search/export', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ results, query, location }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      const date = new Date().toISOString().split('T')[0]
      const safe = (query || 'leads').replace(/[^a-z0-9]/gi, '-').toLowerCase()
      a.href = url; a.download = `lead-search-${safe}-${date}.xlsx`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      setDownloadDone(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally { setExporting(false) }
  }

  const toggleExpand = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const unsavedCount = results.filter(r => !savedIds.has(r.placeId)).length

  const showGoogleError =
    error && source === 'google' && (
      errorCode === 'NO_API_KEY' || errorCode === 'REQUEST_DENIED' || errorCode === 'OVER_QUERY_LIMIT' ||
      error.includes('not set') || error.includes('denied') || error.includes('billing') ||
      error.includes('not activated') || error.includes('Places API')
    )

  const mapsUrlLabel = source === 'yelp' ? 'View on Yelp' : source === 'osm' ? 'View on OpenStreetMap' : 'Open in Google Maps'

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <SearchCheck className="w-6 h-6 text-indigo-600" />
            Lead Search
          </h1>
          {activeProvider && <ProviderBadge provider={activeProvider} showTip />}
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Search for any business type · save to your leads database · export to Excel
        </p>
      </div>

      {/* ── Provider info panel (before first search) ────────────────────────── */}
      {!searched && <ProviderInfoPanel provider={activeProvider} />}

      {/* ── Search Box ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">

          {/* Business type input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              ref={queryRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Business type  e.g. plumbing, dentists, law firms…"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Location input with GPS button */}
          <div className="sm:w-56 relative">
            <button
              type="button"
              onClick={() => setShowLocTip(v => !v)}
              title="Detect my location"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-gray-400 hover:text-indigo-600 transition-colors"
            >
              {locLoading
                ? <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                : <MapPin className="w-4 h-4" />}
            </button>

            <input
              value={location}
              onChange={e => { setLocation(e.target.value); setShowLocTip(false) }}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="City or area  e.g. New York"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {showLocTip && (
              <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={locLoading}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors disabled:opacity-60"
                >
                  <Navigation className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>
                    <span className="font-medium block">Use my current location</span>
                    <span className="text-xs text-gray-400">Auto-detect via GPS</span>
                  </span>
                </button>
                <div className="border-t border-gray-100">
                  {(['New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Miami, FL'] as const).map(city => (
                    <button key={city} type="button" onClick={() => { setLocation(city); setShowLocTip(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors text-left">
                      <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                      {city}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 🗺️ Map picker — click to open world map and pick a location */}
          <MapPicker
            onSelect={(city) => {
              setLocation(city)
              setShowLocTip(false)
            }}
          />

          <button
            onClick={() => { setShowLocTip(false); doSearch() }}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 whitespace-nowrap text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        {locError && (
          <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {locError}
          </p>
        )}

        {/* Quick search chips */}
        <div className="mt-4">
          <p className="text-xs text-gray-400 mb-2">Quick searches:</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_SEARCHES.map(qs => (
              <button key={qs}
                onClick={() => { setQuery(qs); setShowLocTip(false); doSearch(qs, location) }}
                className="px-3 py-1.5 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 text-gray-600 text-xs rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors font-medium"
              >
                {qs}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Error Panels ─────────────────────────────────────────────────────── */}
      {error && showGoogleError && <GoogleErrorPanel code={errorCode} message={error} />}
      {error && !showGoogleError && (
        <div className="mb-5 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Results Header ────────────────────────────────────────────────────── */}
      {results.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-semibold text-gray-900 text-lg">{results.length} businesses found</h2>
              {source && <ProviderBadge provider={source} showTip />}
              {totalSaved > 0 && (
                <span className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-medium">
                  ✅ {totalSaved} saved to leads
                </span>
              )}
              {query && (
                <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-medium">
                  🔍 {query}{location ? ` · ${location}` : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Get Leads → export to Excel */}
              <button onClick={getLeads} disabled={exporting}
                className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-60 shadow-sm">
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                {exporting ? 'Exporting…' : `Get Leads (${results.length})`}
              </button>

              {unsavedCount > 0 && (
                <button onClick={saveAll} disabled={savingAll}
                  className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60">
                  {savingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {savingAll ? 'Saving…' : 'Save All to Leads'}
                </button>
              )}

              {totalSaved > 0 && (
                <a href="/api/leads/export?format=xlsx"
                  className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-2.5 rounded-xl text-xs font-medium hover:bg-gray-200 transition-colors">
                  <Download className="w-3.5 h-3.5" />
                  Download Saved
                </a>
              )}

              {allSaved && unsavedCount === 0 && (
                <span className="flex items-center gap-1 text-green-700 text-sm font-medium">
                  <CheckCircle className="w-4 h-4" /> All saved!
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-3">
            💡 <strong>Get Leads</strong> downloads all {results.length} results as Excel.
            &nbsp;· <strong>Save All to Leads</strong> adds them to your database for follow-up.
            {source === 'yelp' && ' · Website URLs not available via Yelp — add a Google key for full details.'}
            {source === 'osm'  && ' · Data from OpenStreetMap — completeness varies by region.'}
          </p>
        </div>
      )}

      {/* ── "Also add to Leads" banner after download ──────────────────────── */}
      {downloadDone && !allSaved && results.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <DatabaseZap className="w-5 h-5 text-indigo-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-indigo-900">
                Downloaded! ✅ &nbsp;Add these {results.filter(r => !savedIds.has(r.placeId)).length} businesses to your Leads database?
              </p>
              <p className="text-xs text-indigo-600 mt-0.5">One click — they&apos;ll appear in your Leads list for follow-up.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={saveAll}
              disabled={savingAll}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-60 shadow-sm"
            >
              {savingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseZap className="w-4 h-4" />}
              {savingAll ? 'Adding...' : 'Yes, Add All'}
            </button>
            <button
              onClick={() => setDownloadDone(false)}
              className="p-2 text-indigo-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-indigo-100"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Already-saved confirmation banner ──────────────────────────────────── */}
      {downloadDone && allSaved && results.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-2xl px-5 py-3">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
            <p className="text-sm font-semibold">
              All {totalSaved} leads downloaded &amp; saved to your database! 🎉
            </p>
          </div>
          <button onClick={() => setDownloadDone(false)} className="text-green-400 hover:text-green-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Results Grid ──────────────────────────────────────────────────────── */}
      {results.length > 0 && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {results.map(place => {
            const state      = saveStates[place.placeId] || 'idle'
            const isExpanded = expanded.has(place.placeId)
            const type       = niceType(place.types)

            return (
              <div key={place.placeId}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                  state === 'saved'
                    ? 'border-green-200 ring-1 ring-green-200'
                    : 'border-gray-100 hover:border-indigo-200 hover:shadow-md'
                }`}
              >
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">{place.name}</h3>
                      <span className="inline-block mt-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{type}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {state === 'saved' && <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />}
                      {place.businessStatus === 'CLOSED_PERMANENTLY' && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Closed</span>
                      )}
                    </div>
                  </div>

                  <StarRating rating={place.rating} total={place.totalRatings} />

                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-start gap-2 text-xs text-gray-600">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <span className={isExpanded ? '' : 'line-clamp-1'}>{place.address || 'Address not available'}</span>
                    </div>

                    {place.phone ? (
                      <div className="flex items-center gap-2 text-xs text-gray-700">
                        <Phone className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        <a href={`tel:${place.phone}`} className="hover:text-indigo-600 font-medium">{place.phone}</a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span>No phone listed</span>
                      </div>
                    )}

                    {place.website ? (
                      <div className="flex items-center gap-2 text-xs">
                        <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <a href={place.website} target="_blank" rel="noreferrer"
                          className="text-indigo-600 hover:underline truncate max-w-[180px]">
                          {place.website.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                        <ExternalLink className="w-3 h-3 text-indigo-400" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Globe className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {source === 'yelp' ? 'Website not available via Yelp' : 'No website listed'}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-gray-400 italic">
                      <span className="w-3.5 h-3.5 shrink-0 text-center">@</span>
                      <span>Email not available — add manually after saving</span>
                    </div>
                  </div>

                  <button onClick={() => toggleExpand(place.placeId)}
                    className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 transition-colors">
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {isExpanded ? 'Show less' : 'More details'}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5 text-xs text-gray-500">
                      {place.mapsUrl && (
                        <a href={place.mapsUrl} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 text-indigo-600 hover:underline">
                          <MapPin className="w-3.5 h-3.5" />
                          {mapsUrlLabel}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {place.lat && place.lng && (
                        <p className="text-gray-400">📍 {place.lat.toFixed(5)}, {place.lng.toFixed(5)}</p>
                      )}
                      {place.businessStatus && place.businessStatus !== 'OPERATIONAL' && (
                        <p className="text-orange-600">⚠️ Status: {place.businessStatus.replace(/_/g, ' ')}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {place.types
                          .filter(t => !['point_of_interest', 'establishment'].includes(t))
                          .slice(0, 5)
                          .map(t => (
                            <span key={t} className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-xs">
                              {t.replace(/_/g, ' ')}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-4 pb-4">
                  {state === 'saved' ? (
                    <div className="w-full flex items-center justify-center gap-2 bg-green-50 text-green-700 py-2 rounded-xl text-xs font-medium">
                      <CheckCircle className="w-3.5 h-3.5" /> Saved to Leads
                    </div>
                  ) : state === 'error' ? (
                    <button onClick={() => saveLead(place)}
                      className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 py-2 rounded-xl text-xs font-medium hover:bg-red-100 transition-colors">
                      <X className="w-3.5 h-3.5" /> Failed — Retry
                    </button>
                  ) : (
                    <button onClick={() => saveLead(place)} disabled={state === 'saving'}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60">
                      {state === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      {state === 'saving' ? 'Saving…' : 'Save as Lead'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Loading / Empty States ────────────────────────────────────────────── */}
      {loading && (
        <div className="text-center py-20">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">
            Searching {activeProvider ? PROVIDER_META[activeProvider]?.label : ''}…
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {activeProvider === 'google'
              ? 'Fetching all pages from Google — up to 60 results…'
              : activeProvider === 'yelp'
              ? 'Fetching up to 50 results from Yelp…'
              : 'Scanning the area via OpenStreetMap — 100+ results possible…'}
          </p>
        </div>
      )}

      {searched && !loading && results.length === 0 && !error && (
        <div className="text-center py-20 text-gray-400">
          <SearchCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No businesses found</p>
          <p className="text-sm mt-1">Try a different search term or add a location</p>
        </div>
      )}

      {!searched && !loading && (
        <div className="text-center py-20 text-gray-300">
          <SearchCheck className="w-12 h-12 mx-auto mb-4 text-indigo-200" />
          <p className="text-gray-500 font-medium text-lg">Find your next leads</p>
          <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
            Search any type of business — <strong>plumbing</strong>, <strong>dentists</strong>, <strong>law firms</strong>…
            <br />
            Click <span className="text-emerald-600 font-semibold">Get Leads</span> to download all results as Excel.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 text-xs px-4 py-2 rounded-full">
            <Navigation className="w-3.5 h-3.5" />
            Tip: Click <strong className="mx-1">🗺️ Map</strong> to pick your target area on a world map
          </div>
        </div>
      )}
    </div>
  )
}
