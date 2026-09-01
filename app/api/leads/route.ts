import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendLeadNotification } from '@/lib/email'

export const runtime = 'edge'

export async function GET() {
  try {
    const { data: leads, error } = await supabase
      .from('Lead')
      .select('*, Appointment(*), CallLog(*)')
      .order('createdAt', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Rename to match Prisma field names for frontend compatibility
    const shaped = (leads ?? []).map((l: Record<string, unknown>) => ({
      ...l,
      appointments: l.Appointment ?? [],
      calls: l.CallLog ?? [],
    }))

    return NextResponse.json(shaped)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, phone, service, message, source, notes } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const { data: lead, error } = await supabase
      .from('Lead')
      .insert({
        name,
        email:   email   || '',
        phone:   phone   || null,
        service: service || null,
        message: message || null,
        source:  source  || 'website',
        notes:   notes   || null,
        status: 'NEW',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Send email notification (non-blocking)
    sendLeadNotification(lead)

    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}
