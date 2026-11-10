import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function cleanEnv(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/^['"]|['"]$/g, '')
}

function normalizeSupabaseUrl(raw: string): string | null {
  if (!raw) return null
  let candidate = raw
  // Allow pasting project host without protocol
  if (!/^https?:\/\//i.test(candidate) && /^[a-z0-9-]+\.supabase\.co$/i.test(candidate)) {
    candidate = `https://${candidate}`
  }
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

const rawUrl = cleanEnv(import.meta.env.VITE_SUPABASE_URL)
const anonKey = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY)
const url = normalizeSupabaseUrl(rawUrl)

export const hasSupabaseConfig = Boolean(url && anonKey && !anonKey.startsWith('sb_secret_'))

if (rawUrl && !url) {
  console.error(
    'VITE_SUPABASE_URL is invalid. Expected something like https://your-project.supabase.co',
    { received: rawUrl },
  )
}

if (anonKey.startsWith('sb_secret_')) {
  console.error(
    'VITE_SUPABASE_ANON_KEY looks like a secret key. Use the publishable/anon key in the browser.',
  )
}

if (!hasSupabaseConfig) {
  console.warn(
    'Missing or invalid Supabase env. For local: copy .env.example to .env. For GitHub Pages: set repository secrets VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then redeploy.',
  )
}

// Always pass a syntactically valid URL so createClient never throws on boot
export const supabase: SupabaseClient = createClient(
  url || 'https://placeholder.supabase.co',
  hasSupabaseConfig ? anonKey : 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
