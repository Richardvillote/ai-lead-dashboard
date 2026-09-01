import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET() {
  const { data: logs, error } = await supabase
    .from('EmailLog')
    .select('*, Lead(name)')
    .order('sentAt', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Shape to match Prisma include format (lead instead of Lead)
  const shaped = (logs ?? []).map((log: Record<string, unknown>) => ({
    ...log,
    lead: log.Lead ?? null,
  }))

  return NextResponse.json(shaped)
}
