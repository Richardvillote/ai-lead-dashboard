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
