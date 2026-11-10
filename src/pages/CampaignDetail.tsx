import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
import { Archive, Copy, Pencil } from 'lucide-react'
import { AdVisualUpload } from '../components/AdVisualUpload'
import {
  Button,
  EmptyState,
  ErrorMessage,
  Input,
  LoadingState,
  PageHeader,
  StatusBadge,
  TextArea,
} from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import {
  archiveCampaign,
  createLead,
  deleteAdVisual,
  duplicateCampaign,
  fetchAdVisuals,
  fetchCampaign,
  fetchLeads,
  fetchMetrics,
  fetchWeeklyNotes,
  updateLead,
  uploadAdVisual,
  upsertWeeklyNote,
} from '../lib/api'
import { formatCurrency, formatDate, formatNumber, formatPercent, todayLA } from '../lib/format'
import { budgetPacing, dayProgress, rowComputed, sumMetrics, wonRevenue } from '../lib/metrics'
import type { AdVisual, Campaign, DailyMetric, Lead, LeadStatus, WeeklyNote } from '../lib/types'
import { LEAD_STATUSES } from '../lib/types'
import { campaignWeeks, weekRangeLabel } from '../lib/weeks'

type Tab = 'metrics' | 'leads' | 'visuals' | 'reports'

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAdmin, user } = useAuth()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [metrics, setMetrics] = useState<DailyMetric[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [visuals, setVisuals] = useState<AdVisual[]>([])
  const [notes, setNotes] = useState<WeeklyNote[]>([])
  const [tab, setTab] = useState<Tab>('metrics')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [leadForm, setLeadForm] = useState({
    name: '',
    date: todayLA(),
    contact_method: '',
    project_type: '',
    estimated_value: '',
    status: 'New' as LeadStatus,
  })

  const [editingNoteWeek, setEditingNoteWeek] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState({ summary: '', what_worked: '', next_steps: '' })

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [c, m, l, v, n] = await Promise.all([
        fetchCampaign(id),
        fetchMetrics(id),
        fetchLeads(id),
        fetchAdVisuals(id),
        fetchWeeklyNotes(id),
      ])
      setCampaign(c)
      setMetrics(m)
      setLeads(l)
      setVisuals(v)
      setNotes(n)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  const totals = useMemo(() => sumMetrics(metrics), [metrics])
  const won = useMemo(() => wonRevenue(leads), [leads])
  const today = todayLA()
  const progress = campaign
    ? dayProgress(campaign.start_date, campaign.end_date, campaign.duration_days, today)
    : null
  const pacing = campaign
    ? budgetPacing(totals.spend, campaign.budget_total, campaign.start_date, campaign.end_date, today)
    : null

  const chartData = useMemo(
    () =>
      metrics.map((m) => ({
        date: m.date,
        label: formatDate(m.date).replace(/, \d{4}$/, ''),
        spend: Number(m.spend),
        clicks: m.clicks,
        leads: m.leads,
      })),
    [metrics],
  )

  const weeks = useMemo(
    () => (campaign ? campaignWeeks(campaign.start_date, campaign.end_date, today) : []),
    [campaign, today],
  )

  async function handleArchive() {
    if (!campaign || !confirm('Archive this campaign? It will be hidden from the main list.')) return
    setBusy(true)
    try {
      await archiveCampaign(campaign.id)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleDuplicate() {
    if (!campaign || !user) return
    setBusy(true)
    try {
      const copy = await duplicateCampaign(campaign, user.id)
      navigate(`/campaigns/${copy.id}/edit`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duplicate failed')
    } finally {
      setBusy(false)
    }
  }

  async function onAddLead(e: FormEvent) {
    e.preventDefault()
    if (!campaign || !leadForm.name.trim()) return
    setBusy(true)
    try {
      const lead = await createLead({
        campaign_id: campaign.id,
        name: leadForm.name.trim(),
        date: leadForm.date,
        contact_method: leadForm.contact_method || null,
        project_type: leadForm.project_type || null,
        estimated_value: leadForm.estimated_value === '' ? null : Number(leadForm.estimated_value),
        status: leadForm.status,
        won_value: null,
        notes: null,
      })
      setLeads((prev) => [lead, ...prev])
      setLeadForm({
        name: '',
        date: todayLA(),
        contact_method: '',
        project_type: '',
        estimated_value: '',
        status: 'New',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add lead')
    } finally {
      setBusy(false)
    }
  }

  async function saveNote(weekStart: string) {
    if (!campaign || !user) return
    setBusy(true)
    try {
      const saved = await upsertWeeklyNote({
        campaign_id: campaign.id,
        week_start: weekStart,
        summary: noteDraft.summary || null,
        what_worked: noteDraft.what_worked || null,
        next_steps: noteDraft.next_steps || null,
        created_by: user.id,
      })
      setNotes((prev) => {
        const others = prev.filter((n) => n.week_start !== weekStart)
        return [saved, ...others].sort((a, b) => b.week_start.localeCompare(a.week_start))
      })
      setEditingNoteWeek(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState label="Loading campaign…" />
  if (!campaign) return <ErrorMessage message={error || 'Campaign not found'} onRetry={load} />

  const pacingColor =
    pacing?.status === 'over'
      ? 'text-[var(--color-danger)]'
      : pacing?.status === 'under'
        ? 'text-[var(--color-warning)]'
        : pacing?.status === 'on_track'
          ? 'text-[var(--color-success)]'
          : 'text-[var(--color-ink-muted)]'

  const tabs: { id: Tab; label: string }[] = [
    { id: 'metrics', label: 'Metrics' },
    { id: 'leads', label: 'Leads' },
    { id: 'visuals', label: 'Ad visuals' },
    { id: 'reports', label: 'Weekly reports' },
  ]

  return (
    <div>
      <PageHeader
        title={campaign.name}
        subtitle={`${campaign.platform}${campaign.start_date ? ` · ${formatDate(campaign.start_date)}` : ''}${
          campaign.end_date ? ` – ${formatDate(campaign.end_date)}` : ''
        }`}
        actions={
          isAdmin ? (
            <>
              <Link to={`/campaigns/${campaign.id}/edit`}>
                <Button variant="secondary">
                  <Pencil size={16} />
                  Edit
                </Button>
              </Link>
              <Button variant="secondary" onClick={handleDuplicate} disabled={busy}>
                <Copy size={16} />
                Duplicate
              </Button>
              <Button variant="ghost" onClick={handleArchive} disabled={busy}>
                <Archive size={16} />
                Archive
              </Button>
            </>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} onRetry={load} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={campaign.status} />
        {progress && (
          <span className="text-sm text-[var(--color-ink-muted)]">
            Day {progress.day} of {progress.total}
          </span>
        )}
        {campaign.daily_budget != null && (
          <span className="inline-flex items-center rounded-md bg-[color-mix(in_srgb,var(--accent)_18%,white)] px-2 py-0.5 text-xs font-semibold text-[var(--color-ink)]">
            Daily budget {formatCurrency(Number(campaign.daily_budget))}
          </span>
        )}
        {campaign.budget_total != null && (
          <span className="text-sm text-[var(--color-ink-muted)]">
            Total budget {formatCurrency(Number(campaign.budget_total))}
          </span>
        )}
        {pacing && (
          <span className={`text-sm font-medium ${pacingColor}`}>
            Pace: {pacing.label}
            {pacing.pacePct != null ? ` (${Math.round(pacing.pacePct)}%)` : ''}
          </span>
        )}
      </div>

      {progress && (
        <div className="mb-6">
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress.pct}%`, background: 'var(--accent)' }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <div className="card-surface p-3">
          <p className="text-xs text-[var(--color-ink-muted)]">Daily budget</p>
          <p className="font-semibold">{formatCurrency(campaign.daily_budget)}</p>
          <p className="text-xs text-[var(--color-ink-muted)]">
            {campaign.duration_days ? `${campaign.duration_days} days` : '—'}
          </p>
        </div>
        <div className="card-surface p-3">
          <p className="text-xs text-[var(--color-ink-muted)]">Spend</p>
          <p className="font-semibold">{formatCurrency(totals.spend)}</p>
          <p className="text-xs text-[var(--color-ink-muted)]">
            of {formatCurrency(campaign.budget_total)}
          </p>
        </div>
        <div className="card-surface p-3">
          <p className="text-xs text-[var(--color-ink-muted)]">Impressions</p>
          <p className="font-semibold">{formatNumber(totals.impressions)}</p>
        </div>
        <div className="card-surface p-3">
          <p className="text-xs text-[var(--color-ink-muted)]">Clicks</p>
          <p className="font-semibold">{formatNumber(totals.clicks)}</p>
          <p className="text-xs text-[var(--color-ink-muted)]">CTR {formatPercent(totals.ctr)}</p>
        </div>
        <div className="card-surface p-3">
          <p className="text-xs text-[var(--color-ink-muted)]">Leads</p>
          <p className="font-semibold">{formatNumber(totals.leads)}</p>
          <p className="text-xs text-[var(--color-ink-muted)]">CPL {formatCurrency(totals.cpl)}</p>
        </div>
        <div className="card-surface p-3">
          <p className="text-xs text-[var(--color-ink-muted)]">Won revenue</p>
          <p className="font-semibold">{formatCurrency(won)}</p>
        </div>
      </div>

      <div className="no-print mb-4 flex gap-1 overflow-x-auto border-b border-[var(--color-border)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.id
                ? 'border-[var(--accent)] text-[var(--color-ink)]'
                : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'metrics' && (
        <div className="space-y-6">
          {chartData.length > 0 ? (
            <div className="card-surface p-4 sm:p-6">
              <h3 className="font-semibold mb-4">Performance over time</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e1da" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      labelFormatter={(_, p) => (p?.[0]?.payload?.date ? formatDate(p[0].payload.date) : '')}
                    />
                    <Legend />
                    <Line yAxisId="right" type="monotone" dataKey="spend" name="Spend" stroke="var(--accent)" strokeWidth={2} dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="clicks" name="Clicks" stroke="#1d4ed8" strokeWidth={2} dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="leads" name="Leads" stroke="#047857" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No daily metrics yet"
              description="Add daily performance numbers to unlock charts."
              action={
                isAdmin ? (
                  <Link to="/daily-entry">
                    <Button>Daily entry</Button>
                  </Link>
                ) : undefined
              }
            />
          )}

          <div className="card-surface overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--color-surface)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Impr.</th>
                  <th className="px-3 py-2">Clicks</th>
                  <th className="px-3 py-2">Spend</th>
                  <th className="px-3 py-2">Leads</th>
                  <th className="px-3 py-2">CTR</th>
                  <th className="px-3 py-2">CPC</th>
                  <th className="px-3 py-2">CPL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {[...metrics].reverse().map((row) => {
                  const c = rowComputed(row)
                  return (
                    <tr key={row.id}>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.date)}</td>
                      <td className="px-3 py-2">{formatNumber(row.impressions)}</td>
                      <td className="px-3 py-2">{formatNumber(row.clicks)}</td>
                      <td className="px-3 py-2">{formatCurrency(Number(row.spend))}</td>
                      <td className="px-3 py-2">{formatNumber(row.leads)}</td>
                      <td className="px-3 py-2">{formatPercent(c.ctr)}</td>
                      <td className="px-3 py-2">{formatCurrency(c.cpc)}</td>
                      <td className="px-3 py-2">{formatCurrency(c.cpl)}</td>
                    </tr>
                  )
                })}
                {metrics.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-[var(--color-ink-muted)]">
                      No rows yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'leads' && (
        <div className="space-y-6">
          {isAdmin && (
            <form onSubmit={onAddLead} className="card-surface p-4 sm:p-5 grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Input
                label="Name"
                required
                value={leadForm.name}
                onChange={(e) => setLeadForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                label="Date"
                type="date"
                value={leadForm.date}
                onChange={(e) => setLeadForm((f) => ({ ...f, date: e.target.value }))}
              />
              <Input
                label="Contact method"
                value={leadForm.contact_method}
                onChange={(e) => setLeadForm((f) => ({ ...f, contact_method: e.target.value }))}
              />
              <Input
                label="Project type"
                value={leadForm.project_type}
                onChange={(e) => setLeadForm((f) => ({ ...f, project_type: e.target.value }))}
              />
              <Input
                label="Est. value"
                type="number"
                min={0}
                value={leadForm.estimated_value}
                onChange={(e) => setLeadForm((f) => ({ ...f, estimated_value: e.target.value }))}
              />
              <div className="flex items-end">
                <Button type="submit" disabled={busy} className="w-full">
                  Add lead
                </Button>
              </div>
            </form>
          )}

          <div className="card-surface overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--color-surface)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Contact</th>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Est. value</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Won value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(lead.date)}</td>
                    <td className="px-3 py-2 font-medium">{lead.name}</td>
                    <td className="px-3 py-2">{lead.contact_method || '—'}</td>
                    <td className="px-3 py-2">{lead.project_type || '—'}</td>
                    <td className="px-3 py-2">{formatCurrency(lead.estimated_value)}</td>
                    <td className="px-3 py-2">
                      {isAdmin ? (
                        <select
                          className="rounded-md border border-[var(--color-border)] px-2 py-1 text-sm focus-ring"
                          value={lead.status}
                          onChange={async (e) => {
                            const status = e.target.value as LeadStatus
                            const updated = await updateLead(lead.id, { status })
                            setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)))
                          }}
                        >
                          {LEAD_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        lead.status
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isAdmin ? (
                        <input
                          type="number"
                          className="w-24 rounded-md border border-[var(--color-border)] px-2 py-1 text-sm focus-ring"
                          defaultValue={lead.won_value ?? ''}
                          placeholder="—"
                          onBlur={async (e) => {
                            const val = e.target.value === '' ? null : Number(e.target.value)
                            const updated = await updateLead(lead.id, { won_value: val })
                            setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)))
                          }}
                        />
                      ) : (
                        formatCurrency(lead.won_value)
                      )}
                    </td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-[var(--color-ink-muted)]">
                      No leads yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'visuals' && (
        <div className="card-surface p-4 sm:p-6">
          <AdVisualUpload
            existing={visuals}
            readOnly={!isAdmin}
            onUpload={async (file, meta) => {
              const visual = await uploadAdVisual(campaign.id, file, meta)
              setVisuals((prev) => [visual, ...prev])
            }}
            onDelete={async (visual) => {
              await deleteAdVisual(visual)
              setVisuals((prev) => prev.filter((v) => v.id !== visual.id))
            }}
          />
          {visuals.length === 0 && !isAdmin && (
            <EmptyState title="No ad visuals" description="Visuals will appear here once uploaded." />
          )}
        </div>
      )}

      {tab === 'reports' && (
        <div className="space-y-3">
          {weeks.length === 0 ? (
            <EmptyState title="No weeks yet" description="Set a start date to generate weekly reports." />
          ) : (
            weeks
              .slice()
              .reverse()
              .map((weekStart) => {
                const range = weekRangeLabel(weekStart)
                const note = notes.find((n) => n.week_start === weekStart)
                const isEditing = editingNoteWeek === weekStart
                return (
                  <div key={weekStart} className="card-surface p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div>
                      <p className="font-medium">
                        Week of {formatDate(range.start)} – {formatDate(range.end)}
                      </p>
                      <p className="text-xs text-[var(--color-ink-muted)]">
                        {note?.summary ? note.summary.slice(0, 120) : 'No notes yet'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link to={`/campaigns/${campaign.id}/reports/${weekStart}`}>
                        <Button variant="secondary">Open report</Button>
                      </Link>
                      {isAdmin && !isEditing && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditingNoteWeek(weekStart)
                            setNoteDraft({
                              summary: note?.summary || '',
                              what_worked: note?.what_worked || '',
                              next_steps: note?.next_steps || '',
                            })
                          }}
                        >
                          Edit notes
                        </Button>
                      )}
                    </div>
                    {isEditing && (
                      <div className="w-full space-y-3 border-t border-[var(--color-border)] pt-3">
                        <TextArea
                          label="Summary"
                          value={noteDraft.summary}
                          onChange={(e) => setNoteDraft((d) => ({ ...d, summary: e.target.value }))}
                        />
                        <TextArea
                          label="What worked"
                          value={noteDraft.what_worked}
                          onChange={(e) => setNoteDraft((d) => ({ ...d, what_worked: e.target.value }))}
                        />
                        <TextArea
                          label="Next steps"
                          value={noteDraft.next_steps}
                          onChange={(e) => setNoteDraft((d) => ({ ...d, next_steps: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <Button onClick={() => saveNote(weekStart)} disabled={busy}>
                            Save notes
                          </Button>
                          <Button variant="secondary" onClick={() => setEditingNoteWeek(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
          )}
        </div>
      )}
    </div>
  )
}
