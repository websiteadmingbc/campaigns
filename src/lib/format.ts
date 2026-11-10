import { formatInTimeZone } from 'date-fns-tz'
import { format, parseISO } from 'date-fns'

export const TZ = 'America/Los_Angeles'

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value.toFixed(digits)}%`
}

/** Format a date string (YYYY-MM-DD or ISO) as MMM D, YYYY in LA time */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  try {
    const date = typeof value === 'string' ? parseISO(value.length === 10 ? `${value}T12:00:00` : value) : value
    return formatInTimeZone(date, TZ, 'MMM d, yyyy')
  } catch {
    return String(value)
  }
}

export function formatDateShort(value: string | Date | null | undefined): string {
  if (!value) return '—'
  try {
    const date = typeof value === 'string' ? parseISO(value.length === 10 ? `${value}T12:00:00` : value) : value
    return formatInTimeZone(date, TZ, 'MMM d')
  } catch {
    return String(value)
  }
}

/** Today's date in America/Los_Angeles as YYYY-MM-DD */
export function todayLA(): string {
  return formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd')
}

export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(0, 10)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[—–]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
}

export function platformToUtmSource(platform: string): string {
  return platform.toLowerCase().replace(/\s+/g, '_')
}

export function suggestUtms(name: string, platform: string) {
  return {
    utm_source: platformToUtmSource(platform),
    utm_medium: platform === 'Print' ? 'print' : platform === 'Google' ? 'cpc' : 'paid_social',
    utm_campaign: slugify(name),
  }
}

/** Re-export format for non-TZ needs */
export { format }
