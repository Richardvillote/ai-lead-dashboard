import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Twilio hits this URL when the admin picks up — it bridges the call to the lead
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const to = searchParams.get('to') || ''
  const name = searchParams.get('name') || 'your lead'

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Connecting you to ${name} now. Please hold.</Say>
  <Dial callerId="${process.env.TWILIO_PHONE_NUMBER}">
    <Number>${to}</Number>
  </Dial>
</Response>`

  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
