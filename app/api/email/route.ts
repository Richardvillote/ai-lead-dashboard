import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getTransporter } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  try {
    const { subject, body, recipientIds, sendToAll, statusFilter, campaign } =
      await req.json()

    if (!subject || !body) {
      return NextResponse.json(
        { error: 'Subject and body are required' },
        { status: 400 }
      )
    }

    // Determine recipients
    let leads: { id: string; name: string; email: string }[] = []

    if (sendToAll) {
      const where = statusFilter && statusFilter !== 'ALL'
        ? { status: statusFilter }
        : {}
      leads = await prisma.lead.findMany({
        where,
        select: { id: true, name: true, email: true },
      })
    } else if (recipientIds && recipientIds.length > 0) {
      leads = await prisma.lead.findMany({
        where: { id: { in: recipientIds } },
        select: { id: true, name: true, email: true },
      })
    }

    if (leads.length === 0) {
      return NextResponse.json({ error: 'No recipients found' }, { status: 400 })
    }

    const transporter = getTransporter()
    const fromName = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Your Business'
    const fromEmail = process.env.EMAIL_USER || ''

    const results = await Promise.allSettled(
      leads.map(async (lead) => {
        // Personalise body — replace {{name}} placeholder
        const personalised = body.replace(/\{\{name\}\}/g, lead.name)

        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: lead.email,
          subject,
          html: buildHtml(fromName, subject, personalised),
          text: personalised,
        })

        await prisma.emailLog.create({
          data: {
            leadId: lead.id,
            subject,
            body: personalised,
            recipientEmail: lead.email,
            recipientName: lead.name,
            status: 'SENT',
            campaign: campaign || null,
          },
        })
      })
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return NextResponse.json({ success: true, sent, failed, total: leads.length })
  } catch (err: unknown) {
    console.error('Email send error:', err)
    const message = err instanceof Error ? err.message : 'Failed to send emails'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function buildHtml(businessName: string, subject: string, body: string) {
  const bodyHtml = body
    .split('\n')
    .map(line => (line.trim() ? `<p style="margin:0 0 12px;">${line}</p>` : '<br/>'))
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:40px 20px;">
    <tr><td>
      <table width="600" align="center" cellpadding="0" cellspacing="0"
        style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#4f46e5;padding:28px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${businessName}</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 20px;color:#111827;font-size:18px;">${subject}</h2>
            <div style="color:#374151;font-size:15px;line-height:1.7;">${bodyHtml}</div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              © ${new Date().getFullYear()} ${businessName}. You received this because you reached out to us.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
