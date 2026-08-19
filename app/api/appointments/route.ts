import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const appointments = await prisma.appointment.findMany({
      orderBy: { scheduledAt: 'asc' },
      include: { lead: { select: { name: true, email: true, phone: true } } },
    })
    return NextResponse.json(appointments)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { leadId, title, scheduledAt, duration, type, notes } = body
    const appointment = await prisma.appointment.create({
      data: { leadId, title, scheduledAt: new Date(scheduledAt), duration, type, notes },
      include: { lead: { select: { name: true, email: true } } },
    })
    return NextResponse.json(appointment, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create appointment' }, { status: 500 })
  }
}
