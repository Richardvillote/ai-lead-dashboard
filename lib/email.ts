import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendLeadNotification(lead: {
  name: string
  email: string
  phone?: string | null
  service?: string | null
  message?: string | null
}) {
  try {
    const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev'
    const toEmail = process.env.EMAIL_TO || ''
    if (!toEmail) return

    await resend.emails.send({
      from: `Lead Dashboard <${fromEmail}>`,
      to: toEmail,
      subject: `New Lead: ${lead.name}`,
      html: `
        <h2>New Lead Received!</h2>
        <table style="border-collapse:collapse;width:100%">
          <tr><td><strong>Name:</strong></td><td>${lead.name}</td></tr>
          <tr><td><strong>Email:</strong></td><td>${lead.email}</td></tr>
          <tr><td><strong>Phone:</strong></td><td>${lead.phone || 'N/A'}</td></tr>
          <tr><td><strong>Service:</strong></td><td>${lead.service || 'N/A'}</td></tr>
          <tr><td><strong>Message:</strong></td><td>${lead.message || 'N/A'}</td></tr>
        </table>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard">View in Dashboard</a></p>
      `,
    })
  } catch (error) {
    console.error('Email send failed:', error)
  }
}
