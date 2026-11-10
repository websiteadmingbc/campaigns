import type { DailyMetric, Lead, MetricTotals } from './types'

export function sumMetrics(rows: Pick<DailyMetric, 'impressions' | 'clicks' | 'spend' | 'leads'>[]): MetricTotals {
  const impressions = rows.reduce((s, r) => s + (r.impressions || 0), 0)
  const clicks = rows.reduce((s, r) => s + (r.clicks || 0), 0)
  const spend = rows.reduce((s, r) => s + Number(r.spend || 0), 0)
  const leads = rows.reduce((s, r) => s + (r.leads || 0), 0)
  return {
    impressions,
    clicks,
    spend,
    leads,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpl: leads > 0 ? spend / leads : 0,
  }
}

export function rowComputed(row: Pick<DailyMetric, 'impressions' | 'clicks' | 'spend' | 'leads'>) {
  const impressions = row.impressions || 0
  const clicks = row.clicks || 0
  const spend = Number(row.spend || 0)
  const leads = row.leads || 0
  return {
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpl: leads > 0 ? spend / leads : 0,
  }
}

export function wonRevenue(leads: Lead[]): number {
  return leads
    .filter((l) => l.status === 'Won')
    .reduce((s, l) => s + Number(l.won_value ?? l.estimated_value ?? 0), 0)
}

export function roi(won: number, spend: number): number | null {
  if (spend <= 0) return null
  return ((won - spend) / spend) * 100
}

export type BudgetPacing = 'on_track' | 'over' | 'under' | 'unknown'

export function budgetPacing(
  spendToDate: number,
  budgetTotal: number | null,
  startDate: string | null,
  endDate: string | null,
  today: string,
): { label: string; status: BudgetPacing; expectedSpend: number | null; pacePct: number | null } {
  if (!budgetTotal || !startDate || !endDate) {
    return { label: 'No budget set', status: 'unknown', expectedSpend: null, pacePct: null }
  }

  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  const now = new Date(`${today}T12:00:00`)
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
  const elapsed = Math.min(
    totalDays,
    Math.max(0, Math.round((now.getTime() - start.getTime()) / 86400000) + 1),
  )
  const expectedSpend = (budgetTotal / totalDays) * elapsed
  const pacePct = expectedSpend > 0 ? (spendToDate / expectedSpend) * 100 : null

  if (pacePct == null) return { label: 'Unknown', status: 'unknown', expectedSpend, pacePct }
  if (pacePct > 110) return { label: 'Over pace', status: 'over', expectedSpend, pacePct }
  if (pacePct < 90) return { label: 'Under pace', status: 'under', expectedSpend, pacePct }
  return { label: 'On track', status: 'on_track', expectedSpend, pacePct }
}

export function dayProgress(
  startDate: string | null,
  endDate: string | null,
  durationDays: number,
  today: string,
): { day: number; total: number; pct: number } {
  const total = durationDays || 1
  if (!startDate) return { day: 0, total, pct: 0 }
  const start = new Date(`${startDate}T12:00:00`)
  const now = new Date(`${today}T12:00:00`)
  const end = endDate ? new Date(`${endDate}T12:00:00`) : null
  if (now < start) return { day: 0, total, pct: 0 }
  if (end && now > end) return { day: total, total, pct: 100 }
  const day = Math.min(total, Math.round((now.getTime() - start.getTime()) / 86400000) + 1)
  return { day, total, pct: Math.min(100, (day / total) * 100) }
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}
