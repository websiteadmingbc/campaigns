import type { ReactNode } from 'react'
import type { CampaignStatus } from '../lib/types'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--color-ink-muted)]">
      <div className="h-8 w-8 rounded-full border-2 border-[var(--color-border)] border-t-[var(--accent)] animate-spin" />
      <p className="text-sm animate-pulse-soft">{label}</p>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="card-surface px-6 py-12 text-center animate-fade-up">
      <h3 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h3>
      {description && <p className="mt-2 text-sm text-[var(--color-ink-muted)] max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 font-medium underline focus-ring">
          Try again
        </button>
      )}
    </div>
  )
}

export function StatusBadge({ status }: { status: CampaignStatus }) {
  const cls =
    status === 'Draft'
      ? 'status-draft'
      : status === 'Scheduled'
        ? 'status-scheduled'
        : status === 'Active'
          ? 'status-active'
          : status === 'Paused'
            ? 'status-paused'
            : 'status-completed'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  )
}

export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="card-surface p-4 sm:p-5 animate-fade-up">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-ink)]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{hint}</p>}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--color-ink)]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
    </div>
  )
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed focus-ring'
  const variants = {
    primary: 'bg-accent text-[var(--accent-foreground)] hover:brightness-95',
    secondary: 'bg-white border border-[var(--color-border)] text-[var(--color-ink)] hover:bg-[var(--color-surface)]',
    ghost: 'bg-transparent text-[var(--color-ink)] hover:bg-black/5',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }
  return (
    <button type="button" className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function Input({
  label,
  error,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-[var(--color-ink)]">{label}</span>}
      <input
        className={`w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus-ring ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  )
}

export function TextArea({
  label,
  error,
  className = '',
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-[var(--color-ink)]">{label}</span>}
      <textarea
        className={`w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus-ring min-h-[88px] ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  )
}

export function Select({
  label,
  error,
  children,
  className = '',
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-[var(--color-ink)]">{label}</span>}
      <select
        className={`w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus-ring ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  )
}
