import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { leadId, duration, outcome, notes } = body
    const callLog = await prisma.callLog.create({
      data: { leadId, duration, outcome, notes },
    })
    return NextResponse.json(callLog, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to log call' }, { status: 500 })
  }
}
