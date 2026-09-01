// Lazy init — client only created when credentials are present and actually used
export function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) return null
  // Dynamic import avoids Twilio SDK crashing on build/edge environments
  const twilio = require('twilio')
  return twilio(accountSid, authToken)
}

export const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER || ''
export const ADMIN_PHONE = process.env.ADMIN_PHONE_NUMBER || ''

// Keep backward compat alias
export const twilioClient = null // set at runtime via getTwilioClient()
