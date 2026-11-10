import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button, ErrorMessage, Input, LoadingState } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'

export function LoginPage() {
  const { session, loading, configMissing, signInWithMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState />
      </div>
    )
  }

  if (session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signInWithMagicLink(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4 no-print">
        <ThemeToggle className="text-[var(--color-ink)]" />
      </div>

      <div className="w-full max-w-md login-card p-6 sm:p-8 animate-fade-up">
        <div className="mb-6 text-center">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="Great Britton Construction"
            className="mx-auto mb-4 h-16 w-auto max-w-[280px] rounded-md object-contain"
          />
          <h1 className="login-title text-2xl font-semibold">Campaign Tracker</h1>
          <p className="login-muted mt-1 text-sm">
            Sign in with your email — no password needed.
          </p>
        </div>

        {configMissing && (
          <ErrorMessage message="Supabase is not configured. Locally: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env. On the live site: add those as GitHub Actions secrets (URL must be https://….supabase.co, key must be publishable/anon — not sb_secret_), then redeploy." />
        )}

        {!configMissing && sent ? (
          <div className="rounded-xl border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-black/25 px-4 py-4 text-sm text-[#f5f0e8]">
            <p className="font-medium">Check your email</p>
            <p className="mt-1 login-muted">
              We sent a magic link to <strong className="text-[#f8f4ee]">{email}</strong>. Open it on this
              device to sign in.
            </p>
          </div>
        ) : (
          !configMissing && (
            <form onSubmit={onSubmit} className="space-y-4">
              {error && <ErrorMessage message={error} />}
              <Input
                label="Email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <Button type="submit" className="w-full" disabled={submitting || !email.trim()}>
                {submitting ? 'Sending…' : 'Send magic link'}
              </Button>
            </form>
          )
        )}
      </div>
    </div>
  )
}
