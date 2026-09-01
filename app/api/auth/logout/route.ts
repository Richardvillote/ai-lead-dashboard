import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST() {
  const res = NextResponse.json({ success: true })
  res.cookies.set('dash_session', '', {
    httpOnly: true,
    path: '/',
    expires: new Date(0),
  })
  return res
}
