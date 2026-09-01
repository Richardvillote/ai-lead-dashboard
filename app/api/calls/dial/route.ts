import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTwilioClient, TWILIO_FROM, ADMIN_PHONE } from '@/lib/twilio'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { leadId } = await req.json()

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }

    const { data: lead, error: leadError } = await supabase
      .from('Lead')
      .select('*')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    if (!lead.phone) {
      return NextResponse.json(
        { error: 'This lead has no phone number on file.' },
        { status: 400 }
      )
    }

    const twilioClient = getTwilioClient()

    if (!twilioClient) {
      return NextResponse.json(
        { error: 'Twilio is not configured. Add TWILIO_* env vars.' },
        { status: 503 }
      )
    }

    if (!ADMIN_PHONE) {
      return NextResponse.json(
        { error: 'ADMIN_PHONE_NUMBER is not set in .env' },
        { status: 503 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const encodedPhone = encodeURIComponent(lead.phone)
    const encodedName = encodeURIComponent(lead.name)

    const call = await twilioClient.calls.create({
      to: ADMIN_PHONE,
      from: TWILIO_FROM,
      url: `${appUrl}/api/calls/twiml?to=${encodedPhone}&name=${encodedName}`,
    })

    const { data: callLog, error: callError } = await supabase
      .from('CallLog')
      .insert({
        leadId,
        outcome: 'INITIATED',
        twilioSid: call.sid,
        notes: `Outbound call initiated via dashboard`,
      })
      .select()
      .single()

    if (callError) {
      console.error('Failed to log call:', callError)
    }

    if (lead.status === 'NEW') {
      await supabase
        .from('Lead')
        .update({ status: 'CONTACTED' })
        .eq('id', leadId)
    }

    return NextResponse.json({ success: true, callSid: call.sid, callLogId: callLog?.id })
  } catch (err: unknown) {
    console.error('Dial error:', err)
    const message = err instanceof Error ? err.message : 'Failed to initiate call'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
