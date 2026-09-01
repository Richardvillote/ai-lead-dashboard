import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { leadId, duration, outcome, notes } = body
    const { data: callLog, error } = await supabase
      .from('CallLog')
      .insert({ leadId, duration, outcome, notes })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(callLog, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to log call' }, { status: 500 })
  }
}
