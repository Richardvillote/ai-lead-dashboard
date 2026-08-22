'use client'

/**
 * MapPickerMap – pure Leaflet map rendered inside the MapPicker modal.
 * Must be loaded via next/dynamic with ssr:false because Leaflet requires `window`.
 */

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap, Marker } from 'leaflet'

export interface MapInstance {
  flyTo: (latlng: [number, number], zoom: number) => void
  placeMarker: (lat: number, lng: number) => void
}

interface Props {
  onLocationSelect: (city: string) => void
  onMapReady: (instance: MapInstance) => void
  onGeocoding: (loading: boolean) => void
}

export default function MapPickerMap({ onLocationSelect, onMapReady, onGeocoding }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<LeafletMap | null>(null)
  const markerRef    = useRef<Marker | null>(null)

  // Keep callbacks in a ref so the async Leaflet handlers always use the latest versions
  const cbRef = useRef({ onLocationSelect, onMapReady, onGeocoding })
  useEffect(() => { cbRef.current = { onLocationSelect, onMapReady, onGeocoding } })

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // ── Inject Leaflet CSS from CDN (once) ────────────────────────────────────
    if (!document.getElementById('leaflet-css')) {
      const link    = document.createElement('link')
      link.id       = 'leaflet-css'
      link.rel      = 'stylesheet'
      link.href     = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    let cancelled = false

    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current) return

      // ── Custom circular marker (no image files needed) ─────────────────────
      const icon = L.divIcon({
        html: `<div style="
          width:20px;height:20px;
          background:#4f46e5;
          border-radius:50%;
          border:3px solid white;
          box-shadow:0 2px 10px rgba(79,70,229,0.55);
        "></div>`,
        iconSize:   [20, 20],
        iconAnchor: [10, 10],
        className:  '',
      })

      // ── Initialise map ─────────────────────────────────────────────────────
      const map = L.map(containerRef.current!, {
        center:        [20, 0],
        zoom:          2,
        minZoom:       2,
        worldCopyJump: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
        maxZoom:     19,
      }).addTo(map)

      // ── Helper: place / move marker ────────────────────────────────────────
      const placeMarker = (lat: number, lng: number) => {
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng])
        } else {
          markerRef.current = L.marker([lat, lng], { icon }).addTo(map)
        }
      }

      // ── Helper: reverse geocode via Nominatim ──────────────────────────────
      const reverseGeocode = async (lat: number, lng: number) => {
        cbRef.current.onGeocoding(true)
        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
            { headers: { 'Accept-Language': 'en' } }
          )
          const data = await res.json()
          const a    = data.address || {}
          const city = a.city || a.town || a.village || a.county || ''
          const isUS = a.country_code?.toUpperCase() === 'US'
          const secondary = isUS ? (a.state || '') : (a.country || '')
          const parts = [city, secondary].filter(Boolean)
          cbRef.current.onLocationSelect(
            parts.join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
          )
        } catch {
          cbRef.current.onLocationSelect(`${lat.toFixed(4)}, ${lng.toFixed(4)}`)
        } finally {
          cbRef.current.onGeocoding(false)
        }
      }

      // ── Map click handler ──────────────────────────────────────────────────
      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        const { lat, lng } = e.latlng
        placeMarker(lat, lng)
        reverseGeocode(lat, lng)
      })

      mapRef.current = map

      // Expose flyTo + placeMarker to parent
      cbRef.current.onMapReady({
        flyTo: (latlng, zoom) =>
          map.flyTo(latlng, zoom, { duration: 1.2 } as Parameters<typeof map.flyTo>[2]),
        placeMarker,
      })
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current  = null
      markerRef.current = null
    }
  }, []) // initialise once only

  return <div ref={containerRef} className="w-full h-full" />
}
