export function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  CONTACTED: 'bg-yellow-100 text-yellow-800',
  QUALIFIED: 'bg-purple-100 text-purple-800',
  CLOSED: 'bg-green-100 text-green-800',
}

export const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  CLOSED: 'Closed',
}

export const STATUS_ORDER = ['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED']

// ── Lead Scoring ─────────────────────────────────────────────────────────────
// Rule-based scoring (0–100). Higher = more likely to convert.
export function scoreLead(lead: {
  phone?: string | null
  message?: string | null
  service?: string | null
  status: string
  appointments?: unknown[]
  calls?: unknown[]
  createdAt: string
}): number {
  let score = 0

  // Contact completeness
  if (lead.phone) score += 15

  // Message quality
  if (lead.message) {
    score += lead.message.length > 80 ? 20 : lead.message.length > 20 ? 12 : 6
  }

  // Service intent
  if (lead.service) score += 10

  // Status progression (further along = hotter)
  const statusScores: Record<string, number> = {
    NEW: 5,
    CONTACTED: 15,
    QUALIFIED: 28,
    CLOSED: 40,
  }
  score += statusScores[lead.status] || 0

  // Engagement activity
  if ((lead.appointments?.length ?? 0) > 0) score += 8
  if ((lead.calls?.length ?? 0) > 0) score += 7

  // Recency bonus (< 3 days old)
  const daysSince = (Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince < 3) score += 10
  else if (daysSince < 7) score += 5

  return Math.min(score, 100)
}

export function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 65) return { label: '🔥 Hot', color: 'bg-red-100 text-red-700' }
  if (score >= 35) return { label: '🌡 Warm', color: 'bg-orange-100 text-orange-700' }
  return { label: '❄️ Cold', color: 'bg-blue-100 text-blue-700' }
}
