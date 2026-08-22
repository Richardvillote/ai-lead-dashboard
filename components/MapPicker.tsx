'use client'

/**
 * MapPicker – floating trigger button + full-screen map modal.
 * Clicking anywhere on the map reverse-geocodes the point and fills the
 * location field in the Lead Search page.
 */

import { useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import {
  Map as MapIcon, X, MapPin, Loader2, CheckCircle,
  Navigation, Globe,
} from 'lucide-react'
import type { MapInstance } from './MapPickerMap'

// ── Dynamic import so Leaflet never runs on the server ────────────────────────
const MapPickerMap = dynamic(() => import('./MapPickerMap'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full bg-gray-50 gap-3">
      <Loader2 className="w-9 h-9 text-indigo-500 animate-spin" />
      <p className="text-sm text-gray-400">Loading map…</p>
    </div>
  ),
})

// ── Quick-jump regions ────────────────────────────────────────────────────────
const REGIONS = [
  { label: '🌎 Americas',    lat: 10,  lng: -85,  zoom: 3 },
  { label: '🌍 Europe',      lat: 50,  lng: 15,   zoom: 4 },
  { label: '🌏 Asia',        lat: 35,  lng: 100,  zoom: 3 },
  { label: '🇦🇺 Oceania',    lat: -25, lng: 140,  zoom: 3 },
  { label: '🌍 Africa',      lat: 0,   lng: 25,   zoom: 3 },
  { label: '🇵🇭 Philippines', lat: 12,  lng: 122,  zoom: 6 },
]

// ── Popular cities panel ──────────────────────────────────────────────────────
const POPULAR_CITIES = [
  { name: 'New York, NY',         lat: 40.71,  lng: -74.00,  zoom: 10 },
  { name: 'Los Angeles, CA',      lat: 34.05,  lng: -118.24, zoom: 10 },
  { name: 'Chicago, IL',          lat: 41.88,  lng: -87.63,  zoom: 10 },
  { name: 'Houston, TX',          lat: 29.76,  lng: -95.37,  zoom: 10 },
  { name: 'Miami, FL',            lat: 25.77,  lng: -80.19,  zoom: 10 },
  { name: 'London, UK',           lat: 51.51,  lng: -0.13,   zoom: 10 },
  { name: 'Toronto, Canada',      lat: 43.65,  lng: -79.38,  zoom: 10 },
  { name: 'Sydney, Australia',    lat: -33.87, lng: 151.21,  zoom: 10 },
  { name: 'Manila, Philippines',  lat: 14.60,  lng: 120.98,  zoom: 10 },
  { name: 'Cebu, Philippines',    lat: 10.32,  lng: 123.90,  zoom: 11 },
  { name: 'Dubai, UAE',           lat: 25.20,  lng: 55.27,   zoom: 10 },
  { name: 'Singapore',            lat: 1.35,   lng: 103.82,  zoom: 11 },
  { name: 'Tokyo, Japan',         lat: 35.69,  lng: 139.69,  zoom: 10 },
  { name: 'Paris, France',        lat: 48.86,  lng: 2.35,    zoom: 10 },
  { name: 'Berlin, Germany',      lat: 52.52,  lng: 13.40,   zoom: 10 },
  { name: 'Lagos, Nigeria',       lat: 6.52,   lng: 3.38,    zoom: 10 },
  { name: 'São Paulo, Brazil',    lat: -23.55, lng: -46.63,  zoom: 10 },
  { name: 'Mumbai, India',        lat: 19.08,  lng: 72.88,   zoom: 10 },
]

interface Props {
  /** Called when the user confirms a location. Receive the city string. */
  onSelect: (location: string) => void
}

export default function MapPicker({ onSelect }: Props) {
  const [open, setOpen]                   = useState(false)
  const [selectedCity, setSelectedCity]   = useState('')
  const [geocoding, setGeocoding]         = useState(false)
  const mapInstanceRef                    = useRef<MapInstance | null>(null)

  // ── Stable callbacks (passed to the Leaflet child) ────────────────────────
  const handleLocationSelect = useCallback((city: string) => setSelectedCity(city), [])
  const handleGeocoding      = useCallback((v: boolean)   => setGeocoding(v), [])
  const handleMapReady       = useCallback((inst: MapInstance) => {
    mapInstanceRef.current = inst
  }, [])

  // ── Fly map to a preset location ──────────────────────────────────────────
  const flyTo = (lat: number, lng: number, zoom: number) => {
    mapInstanceRef.current?.flyTo([lat, lng], zoom)
  }

  // ── Pick a popular city (no geocode needed) ────────────────────────────────
  const pickCity = (city: typeof POPULAR_CITIES[number]) => {
    flyTo(city.lat, city.lng, city.zoom)
    mapInstanceRef.current?.placeMarker(city.lat, city.lng)
    setSelectedCity(city.name)
  }

  // ── Confirm selection ─────────────────────────────────────────────────────
  const handleUse = () => {
    if (selectedCity) {
      onSelect(selectedCity)
      setOpen(false)
      setSelectedCity('')
    }
  }

  const handleClose = () => {
    setOpen(false)
    setSelectedCity('')
  }

  // ── Trigger button (rendered inline) ──────────────────────────────────────
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Pick location on map"
        className="flex items-center gap-1.5 px-3 py-3 text-sm text-gray-600 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 border border-gray-200 hover:border-indigo-300 rounded-xl transition-colors font-medium whitespace-nowrap shrink-0"
      >
        <MapIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Map</span>
      </button>

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden"
               style={{ height: 'min(90vh, 640px)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Globe className="w-5 h-5 text-indigo-600" />
                <h2 className="font-bold text-gray-900 text-base">Pick a Location</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full hidden sm:inline">
                  Click anywhere on the map
                </span>
              </div>
              <button
                onClick={handleClose}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close map"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick region jump */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 overflow-x-auto shrink-0 scrollbar-hide">
              <span className="text-xs text-gray-400 shrink-0 font-medium">Jump:</span>
              {REGIONS.map(r => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => flyTo(r.lat, r.lng, r.zoom)}
                  className="text-xs px-3 py-1.5 rounded-full bg-gray-100 hover:bg-indigo-100 hover:text-indigo-700 text-gray-600 transition-colors whitespace-nowrap font-medium"
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Map + cities sidebar */}
            <div className="flex flex-1 min-h-0 overflow-hidden">

              {/* Interactive map */}
              <div className="flex-1 relative">
                <MapPickerMap
                  onLocationSelect={handleLocationSelect}
                  onMapReady={handleMapReady}
                  onGeocoding={handleGeocoding}
                />

                {/* Hint overlay (only while nothing selected) */}
                {!selectedCity && !geocoding && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
                    <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full px-4 py-2 text-xs text-gray-500 shadow-md whitespace-nowrap">
                      👆 Click anywhere to select that city
                    </div>
                  </div>
                )}

                {/* Geocoding spinner overlay */}
                {geocoding && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
                    <div className="bg-white/90 backdrop-blur-sm border border-indigo-200 rounded-full px-4 py-2 text-xs text-indigo-600 shadow-md flex items-center gap-2 whitespace-nowrap">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Finding location…
                    </div>
                  </div>
                )}
              </div>

              {/* Popular cities sidebar (hidden on very small screens) */}
              <div className="hidden sm:flex flex-col w-48 border-l border-gray-100 bg-gray-50/50 overflow-y-auto shrink-0">
                <div className="p-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                    Popular Cities
                  </p>
                  <div className="space-y-0.5">
                    {POPULAR_CITIES.map(city => (
                      <button
                        key={city.name}
                        type="button"
                        onClick={() => pickCity(city)}
                        className={`w-full text-left text-xs px-2.5 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                          selectedCity === city.name
                            ? 'bg-indigo-100 text-indigo-700 font-semibold'
                            : 'hover:bg-white hover:shadow-sm text-gray-600'
                        }`}
                      >
                        <MapPin className={`w-3 h-3 shrink-0 ${selectedCity === city.name ? 'text-indigo-500' : 'text-gray-400'}`} />
                        <span className="leading-tight">{city.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer confirmation bar */}
            <div
              className={`px-5 py-3.5 border-t shrink-0 transition-all duration-200 ${
                selectedCity
                  ? 'bg-indigo-50 border-indigo-200'
                  : 'bg-white border-gray-100'
              }`}
            >
              {selectedCity ? (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="text-sm font-semibold text-indigo-900 truncate">{selectedCity}</span>
                    <span className="text-xs text-indigo-400 hidden sm:inline">selected</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedCity('')}
                      className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={handleUse}
                      className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
                    >
                      <Navigation className="w-4 h-4" />
                      Use This Location
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center">
                  Click the map or choose a city from the list · you can also type a location manually
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
