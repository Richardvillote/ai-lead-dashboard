import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendLeadNotification } from '@/lib/email'

export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        appointments: { orderBy: { scheduledAt: 'asc' } },
        calls: { orderBy: { calledAt: 'desc' } },
      },
    })
    return NextResponse.json(leads)
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

    const lead = await prisma.lead.create({
      data: {
        name,
        email:   email   || '',
        phone:   phone   || null,
        service: service || null,
        message: message || null,
        source:  source  || 'website',
        notes:   notes   || null,
        status: 'NEW',
      },
    })

    // Send email notification (non-blocking)
    sendLeadNotification(lead)

    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}
