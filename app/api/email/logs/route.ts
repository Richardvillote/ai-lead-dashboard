import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const logs = await prisma.emailLog.findMany({
    orderBy: { sentAt: 'desc' },
    take: 100,
    include: {
      lead: { select: { name: true } },
    },
  })
  return NextResponse.json(logs)
}
