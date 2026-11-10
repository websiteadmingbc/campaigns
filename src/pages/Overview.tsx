import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Plus } from 'lucide-react'
import { Button, EmptyState, ErrorMessage, KpiCard, LoadingState, PageHeader, StatusBadge } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { fetchCampaigns, fetchLeads, fetchMetrics } from '../lib/api'
import { formatCurrency, formatDate, formatNumber, formatPercent } from '../lib/format'
import { roi, sumMetrics, wonRevenue } from '../lib/metrics'
import type { Campaign, DailyMetric, Lead } from '../lib/types'

export function OverviewPage() {
  const { isAdmin } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [metrics, setMetrics] = useState<DailyMetric[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [c, m, l] = await Promise.all([fetchCampaigns(false), fetchMetrics(), fetchLeads()])
      setCampaigns(c)
      setMetrics(m)
      setLeads(l)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overview')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const active = useMemo(() => campaigns.filter((c) => c.status === 'Active'), [campaigns])
  const activeIds = useMemo(() => new Set(active.map((c) => c.id)), [active])
  const activeMetrics = useMemo(
    () => metrics.filter((m) => activeIds.has(m.campaign_id)),
    [metrics, activeIds],
  )
  const activeLeads = useMemo(() => leads.filter((l) => activeIds.has(l.campaign_id)), [leads, activeIds])

  const totals = useMemo(() => sumMetrics(activeMetrics), [activeMetrics])
  const budgetTotal = useMemo(
    () => active.reduce((s, c) => s + Number(c.budget_total || 0), 0),
    [active],
  )
  const won = useMemo(() => wonRevenue(activeLeads), [activeLeads])
  const roiValue = roi(won, totals.spend)

  const spendChart = useMemo(() => {
    const byDate = new Map<string, number>()
    for (const row of activeMetrics) {
      byDate.set(row.date, (byDate.get(row.date) || 0) + Number(row.spend || 0))
    }
    const dates = [...byDate.keys()].sort()
    let cumulative = 0
    return dates.map((date) => {
      cumulative += byDate.get(date) || 0
      return {
        date,
        label: formatDate(date).replace(/, \d{4}$/, ''),
        spend: Math.round(cumulative * 100) / 100,
        budget: budgetTotal || null,
      }
    })
  }, [activeMetrics, budgetTotal])

  if (loading) return <LoadingState label="Loading overview…" />

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Active campaigns at a glance"
        actions={
          isAdmin ? (
            <Link to="/campaigns/new">
              <Button>
                <Plus size={16} />
                New campaign
              </Button>
            </Link>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} onRetry={load} />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <KpiCard
          label="Spend vs budget"
          value={formatCurrency(totals.spend)}
          hint={budgetTotal ? `of ${formatCurrency(budgetTotal)}` : 'No budget set'}
        />
        <KpiCard label="Impressions" value={formatNumber(totals.impressions)} />
        <KpiCard label="Clicks" value={formatNumber(totals.clicks)} hint={`CTR ${formatPercent(totals.ctr)}`} />
        <KpiCard label="Leads" value={formatNumber(totals.leads)} hint={`CPL ${formatCurrency(totals.cpl)}`} />
        <KpiCard label="Won revenue" value={formatCurrency(won)} />
        <KpiCard
          label="ROI"
          value={roiValue == null ? '—' : formatPercent(roiValue, 0)}
          hint="Won revenue vs spend"
        />
      </div>

      <section className="card-surface p-4 sm:p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Cumulative spend vs budget</h2>
        {spendChart.length === 0 ? (
          <EmptyState
            title="No metrics yet"
            description="Enter daily metrics to see spend pacing over time."
            action={
              isAdmin ? (
                <Link to="/daily-entry">
                  <Button>Enter metrics</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spendChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e1da" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.date ? formatDate(payload[0].payload.date) : ''
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="spend"
                  name="Cumulative spend"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                />
                {budgetTotal > 0 && (
                  <Line
                    type="monotone"
                    dataKey="budget"
                    name="Total budget"
                    stroke="#6b7280"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Campaigns</h2>
          <span className="text-xs text-[var(--color-ink-muted)]">{campaigns.length} total</span>
        </div>

        {campaigns.length === 0 ? (
          <EmptyState
            title="No campaigns yet"
            description="Create your first campaign to start tracking."
            action={
              isAdmin ? (
                <Link to="/campaigns/new">
                  <Button>Create campaign</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="card-surface overflow-hidden">
            <ul className="divide-y divide-[var(--color-border)]">
              {campaigns.map((c) => {
                const cMetrics = sumMetrics(metrics.filter((m) => m.campaign_id === c.id))
                return (
                  <li key={c.id}>
                    <Link
                      to={`/campaigns/${c.id}`}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3.5 hover:bg-[var(--color-surface)] transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium truncate">{c.name}</p>
                          <StatusBadge status={c.status} />
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                          {c.platform}
                          {c.start_date ? ` · ${formatDate(c.start_date)}` : ''}
                          {c.end_date ? ` – ${formatDate(c.end_date)}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-[var(--color-ink-muted)]">
                        {c.daily_budget != null && (
                          <span className="font-medium text-[var(--color-ink)]">
                            {formatCurrency(Number(c.daily_budget))}/day
                          </span>
                        )}
                        <span>Spend {formatCurrency(cMetrics.spend)}</span>
                        <span>Leads {formatNumber(cMetrics.leads)}</span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
