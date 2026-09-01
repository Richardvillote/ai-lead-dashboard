import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET() {
  try {
    const { data: appointments, error } = await supabase
      .from('Appointment')
      .select('*, Lead(name, email, phone)')
      .order('scheduledAt', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Shape to match Prisma include format (lead instead of Lead)
    const shaped = (appointments ?? []).map((a: Record<string, unknown>) => ({
      ...a,
      lead: a.Lead ?? null,
    }))

    return NextResponse.json(shaped)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { leadId, title, scheduledAt, duration, type, notes } = body

    const { data: appointment, error } = await supabase
      .from('Appointment')
      .insert({ leadId, title, scheduledAt, duration, type, notes })
      .select('*, Lead(name, email)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const shaped = { ...appointment, lead: appointment.Lead ?? null }
    return NextResponse.json(shaped, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create appointment' }, { status: 500 })
  }
}
