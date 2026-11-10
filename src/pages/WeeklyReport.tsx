import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Copy, Printer } from 'lucide-react'
import { Button, EmptyState, ErrorMessage, LoadingState, PageHeader } from '../components/ui'
import { fetchCampaign, fetchLeads, fetchMetrics, fetchWeeklyNotes } from '../lib/api'
import { formatCurrency, formatDate, formatNumber, formatPercent } from '../lib/format'
import { percentChange, sumMetrics } from '../lib/metrics'
import type { Campaign, DailyMetric, Lead, WeeklyNote } from '../lib/types'
import { inWeek, weekRangeLabel } from '../lib/weeks'

export function WeeklyReportPage() {
  const { id, weekStart } = useParams<{ id: string; weekStart: string }>()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [metrics, setMetrics] = useState<DailyMetric[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [note, setNote] = useState<WeeklyNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      if (!id || !weekStart) return
      setLoading(true)
      setError(null)
      try {
        const [c, m, l, notes] = await Promise.all([
          fetchCampaign(id),
          fetchMetrics(id),
          fetchLeads(id),
          fetchWeeklyNotes(id),
        ])
        setCampaign(c)
        setMetrics(m)
        setLeads(l)
        setNote(notes.find((n) => n.week_start === weekStart) || null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, weekStart])

  const range = weekStart ? weekRangeLabel(weekStart) : null

  const weekMetrics = useMemo(
    () => (weekStart ? metrics.filter((m) => inWeek(m.date, weekStart)) : []),
    [metrics, weekStart],
  )

  const priorWeekStart = useMemo(() => {
    if (!weekStart) return null
    const d = new Date(`${weekStart}T12:00:00`)
    d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  }, [weekStart])

  const priorMetrics = useMemo(
    () => (priorWeekStart ? metrics.filter((m) => inWeek(m.date, priorWeekStart)) : []),
    [metrics, priorWeekStart],
  )

  const totals = useMemo(() => sumMetrics(weekMetrics), [weekMetrics])
  const priorTotals = useMemo(() => sumMetrics(priorMetrics), [priorMetrics])

  const weekLeads = useMemo(
    () => (weekStart ? leads.filter((l) => inWeek(l.date, weekStart)) : []),
    [leads, weekStart],
  )

  const bestDay = useMemo(() => {
    if (!weekMetrics.length) return null
    return [...weekMetrics].sort((a, b) => {
      if (b.leads !== a.leads) return b.leads - a.leads
      return Number(b.clicks) - Number(a.clicks)
    })[0]
  }, [weekMetrics])

  function copyShareLink() {
    const url = window.location.href
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) return <LoadingState label="Loading weekly report…" />
  if (!campaign || !weekStart || !range) {
    return <ErrorMessage message={error || 'Report not found'} />
  }

  const changes = {
    spend: percentChange(totals.spend, priorTotals.spend),
    clicks: percentChange(totals.clicks, priorTotals.clicks),
    leads: percentChange(totals.leads, priorTotals.leads),
    impressions: percentChange(totals.impressions, priorTotals.impressions),
  }

  function changeLabel(value: number | null) {
    if (value == null) return 'n/a vs prior'
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(0)}% vs prior week`
  }

  return (
    <div className="print-report">
      <PageHeader
        title="Weekly report"
        subtitle={`${campaign.name} · ${formatDate(range.start)} – ${formatDate(range.end)}`}
        actions={
          <>
            <Button variant="secondary" onClick={copyShareLink}>
              <Copy size={16} />
              {copied ? 'Copied!' : 'Copy share link'}
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={16} />
              Print
            </Button>
            <Link to={`/campaigns/${campaign.id}`}>
              <Button variant="ghost">Back</Button>
            </Link>
          </>
        }
      />

      {error && (
        <div className="mb-4 no-print">
          <ErrorMessage message={error} />
        </div>
      )}

      <div className="print-only mb-6">
        <p className="text-sm text-[var(--color-ink-muted)]">Great Britton Construction · Campaign Tracker</p>
        <h1 className="text-2xl font-semibold">{campaign.name}</h1>
        <p>
          Week of {formatDate(range.start)} – {formatDate(range.end)} · {campaign.platform}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 print-break">
        {[
          { label: 'Spend', value: formatCurrency(totals.spend), change: changes.spend },
          { label: 'Impressions', value: formatNumber(totals.impressions), change: changes.impressions },
          { label: 'Clicks', value: formatNumber(totals.clicks), change: changes.clicks },
          { label: 'Leads', value: formatNumber(totals.leads), change: changes.leads },
        ].map((kpi) => (
          <div key={kpi.label} className="card-surface p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">{kpi.label}</p>
            <p className="mt-1 text-xl font-semibold">{kpi.value}</p>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{changeLabel(kpi.change)}</p>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6 print-break">
        <div className="card-surface p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">Cost per lead</p>
          <p className="mt-1 text-xl font-semibold">{formatCurrency(totals.cpl)}</p>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">CTR {formatPercent(totals.ctr)} · CPC {formatCurrency(totals.cpc)}</p>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">Best day</p>
          {bestDay ? (
            <>
              <p className="mt-1 text-xl font-semibold">{formatDate(bestDay.date)}</p>
              <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                {bestDay.leads} leads · {bestDay.clicks} clicks · {formatCurrency(Number(bestDay.spend))} spend
              </p>
            </>
          ) : (
            <p className="mt-1 text-[var(--color-ink-muted)]">No metrics this week</p>
          )}
        </div>
      </div>

      <section className="card-surface p-4 sm:p-6 mb-6 print-break">
        <h2 className="text-lg font-semibold mb-3">New leads this week</h2>
        {weekLeads.length === 0 ? (
          <EmptyState title="No new leads" description="Leads logged this week will show here." />
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
              <tr>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Project</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Est. value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {weekLeads.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDate(l.date)}</td>
                  <td className="py-2 pr-3 font-medium">{l.name}</td>
                  <td className="py-2 pr-3">{l.project_type || '—'}</td>
                  <td className="py-2 pr-3">{l.status}</td>
                  <td className="py-2">{formatCurrency(l.estimated_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card-surface p-4 sm:p-6 print-break space-y-4">
        <h2 className="text-lg font-semibold">Notes</h2>
        <div>
          <h3 className="text-sm font-medium text-[var(--color-ink-muted)]">Summary</h3>
          <p className="mt-1 whitespace-pre-wrap">{note?.summary || '—'}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-[var(--color-ink-muted)]">What worked</h3>
          <p className="mt-1 whitespace-pre-wrap">{note?.what_worked || '—'}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-[var(--color-ink-muted)]">Next steps</h3>
          <p className="mt-1 whitespace-pre-wrap">{note?.next_steps || '—'}</p>
        </div>
      </section>
    </div>
  )
}
