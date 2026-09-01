import { createClient } from '@supabase/supabase-js'

// Fallback placeholders prevent createClient from throwing during build
// (real values come from env vars at runtime)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseServiceKey)
