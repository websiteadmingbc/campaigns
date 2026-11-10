import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, Pencil } from 'lucide-react'
import { AdVisualUpload } from '../components/AdVisualUpload'
import { QrPreview } from '../components/QrPreview'
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
import { formatCurrency, formatDate, formatNumber, todayLA } from '../lib/format'
import {
  archiveTraditionalCampaign,
  deleteTraditionalVisual,
  fetchTraditionalCampaign,
  fetchTraditionalMetrics,
  fetchTraditionalVisuals,
  uploadTraditionalVisual,
  upsertTraditionalMetric,
} from '../lib/traditionalApi'
import type { TraditionalCampaign, TraditionalMetric, TraditionalVisual } from '../lib/traditionalTypes'

export function TraditionalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [campaign, setCampaign] = useState<TraditionalCampaign | null>(null)
  const [metrics, setMetrics] = useState<TraditionalMetric[]>([])
  const [visuals, setVisuals] = useState<TraditionalVisual[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [metricForm, setMetricForm] = useState({
    date: todayLA(),
    pieces_distributed: '0',
    leads: '0',
    additional_cost: '0',
    locations_covered: '',
    notes: '',
  })

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [c, m, v] = await Promise.all([
        fetchTraditionalCampaign(id),
        fetchTraditionalMetrics(id),
        fetchTraditionalVisuals(id),
      ])
      setCampaign(c)
      setMetrics(m)
      setVisuals(v)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  const totals = useMemo(() => {
    const distributed = metrics.reduce((s, r) => s + (r.pieces_distributed || 0), 0)
    const leads = metrics.reduce((s, r) => s + (r.leads || 0), 0)
    const extra = metrics.reduce((s, r) => s + Number(r.additional_cost || 0), 0)
    const material = Number(campaign?.material_cost || 0)
    const totalCost = material + extra
    return {
      distributed,
      leads,
      extra,
      totalCost,
      costPerPiece: distributed > 0 ? totalCost / distributed : null,
      costPerLead: leads > 0 ? totalCost / leads : null,
    }
  }, [metrics, campaign])

  async function onAddMetric(e: FormEvent) {
    e.preventDefault()
    if (!campaign) return
    setBusy(true)
    setError(null)
    try {
      const saved = await upsertTraditionalMetric({
        campaign_id: campaign.id,
        date: metricForm.date,
        pieces_distributed: Number(metricForm.pieces_distributed) || 0,
        leads: Number(metricForm.leads) || 0,
        additional_cost: Number(metricForm.additional_cost) || 0,
        locations_covered: metricForm.locations_covered || null,
        notes: metricForm.notes || null,
      })
      setMetrics((prev) => {
        const others = prev.filter((m) => !(m.campaign_id === saved.campaign_id && m.date === saved.date))
        return [...others, saved].sort((a, b) => a.date.localeCompare(b.date))
      })
      const refreshed = await fetchTraditionalCampaign(campaign.id)
      setCampaign(refreshed)
      setMetricForm({
        date: todayLA(),
        pieces_distributed: '0',
        leads: '0',
        additional_cost: '0',
        locations_covered: '',
        notes: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save metric')
    } finally {
      setBusy(false)
    }
  }

  async function handleArchive() {
    if (!campaign || !confirm('Archive this traditional effort?')) return
    setBusy(true)
    try {
      await archiveTraditionalCampaign(campaign.id)
      navigate('/traditional')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState />
  if (!campaign) return <ErrorMessage message={error || 'Not found'} onRetry={load} />

  return (
    <div>
      <PageHeader
        title={campaign.name}
        subtitle={`${campaign.material_type}${campaign.start_date ? ` · ${formatDate(campaign.start_date)}` : ''}${
          campaign.end_date ? ` – ${formatDate(campaign.end_date)}` : ''
        }`}
        actions={
          isAdmin ? (
            <>
              <Link to={`/traditional/${campaign.id}/edit`}>
                <Button variant="secondary">
                  <Pencil size={16} />
                  Edit
                </Button>
              </Link>
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
        <span className="text-xs rounded-md px-2 py-0.5 bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]">
          {campaign.material_type}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="card-surface p-3">
          <p className="text-xs text-[var(--color-ink-muted)]">Material cost</p>
          <p className="font-semibold">{formatCurrency(campaign.material_cost)}</p>
        </div>
        <div className="card-surface p-3">
          <p className="text-xs text-[var(--color-ink-muted)]">Distributed</p>
          <p className="font-semibold">{formatNumber(totals.distributed)}</p>
          <p className="text-xs text-[var(--color-ink-muted)]">
            of {formatNumber(campaign.quantity_ordered)}
          </p>
        </div>
        <div className="card-surface p-3">
          <p className="text-xs text-[var(--color-ink-muted)]">Leads</p>
          <p className="font-semibold">{formatNumber(totals.leads)}</p>
          <p className="text-xs text-[var(--color-ink-muted)]">
            CPL {formatCurrency(totals.costPerLead)}
          </p>
        </div>
        <div className="card-surface p-3">
          <p className="text-xs text-[var(--color-ink-muted)]">Total cost</p>
          <p className="font-semibold">{formatCurrency(totals.totalCost)}</p>
          <p className="text-xs text-[var(--color-ink-muted)]">
            + extras {formatCurrency(totals.extra)}
          </p>
        </div>
        <div className="card-surface p-3">
          <p className="text-xs text-[var(--color-ink-muted)]">Cost / piece</p>
          <p className="font-semibold">{formatCurrency(totals.costPerPiece)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <section className="card-surface p-4 sm:p-6 space-y-3">
          <h2 className="text-lg font-semibold">QR & short URL</h2>
          <QrPreview url={campaign.short_url} filename={`qr-${campaign.tracking_src}.png`} />
        </section>

        <section className="card-surface p-4 sm:p-6 space-y-3">
          <h2 className="text-lg font-semibold">Details</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[var(--color-ink-muted)]">Locations</dt>
              <dd className="whitespace-pre-wrap">{campaign.locations || '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Target area</dt>
              <dd>{campaign.target_area || '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Audience</dt>
              <dd>{campaign.audience || '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Objective</dt>
              <dd>{campaign.objective || '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Offer</dt>
              <dd>{campaign.offer_headline || '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Notes</dt>
              <dd className="whitespace-pre-wrap">{campaign.notes || '—'}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="card-surface p-4 sm:p-6 mb-6 space-y-4">
        <h2 className="text-lg font-semibold">Print visuals</h2>
        <AdVisualUpload
          existing={visuals}
          readOnly={!isAdmin}
          onUpload={async (file, meta) => {
            const visual = await uploadTraditionalVisual(campaign.id, file, meta)
            setVisuals((prev) => [visual, ...prev])
          }}
          onDelete={async (visual) => {
            await deleteTraditionalVisual(visual)
            setVisuals((prev) => prev.filter((v) => v.id !== visual.id))
          }}
        />
        {visuals.length === 0 && !isAdmin && (
          <EmptyState title="No visuals" description="Artwork will appear here once uploaded." />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Distribution metrics</h2>

        {isAdmin && (
          <form onSubmit={onAddMetric} className="card-surface p-4 sm:p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Input
              label="Date"
              type="date"
              required
              value={metricForm.date}
              onChange={(e) => setMetricForm((f) => ({ ...f, date: e.target.value }))}
            />
            <Input
              label="Pieces distributed"
              type="number"
              min={0}
              value={metricForm.pieces_distributed}
              onChange={(e) => setMetricForm((f) => ({ ...f, pieces_distributed: e.target.value }))}
            />
            <Input
              label="Leads / responses"
              type="number"
              min={0}
              value={metricForm.leads}
              onChange={(e) => setMetricForm((f) => ({ ...f, leads: e.target.value }))}
            />
            <Input
              label="Additional cost"
              type="number"
              min={0}
              step="0.01"
              value={metricForm.additional_cost}
              onChange={(e) => setMetricForm((f) => ({ ...f, additional_cost: e.target.value }))}
            />
            <Input
              label="Locations covered"
              value={metricForm.locations_covered}
              onChange={(e) => setMetricForm((f) => ({ ...f, locations_covered: e.target.value }))}
            />
            <TextArea
              label="Notes"
              value={metricForm.notes}
              onChange={(e) => setMetricForm((f) => ({ ...f, notes: e.target.value }))}
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save day'}
              </Button>
            </div>
          </form>
        )}

        <div className="card-surface overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--color-surface)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Distributed</th>
                <th className="px-3 py-2">Leads</th>
                <th className="px-3 py-2">Extra cost</th>
                <th className="px-3 py-2">Locations</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {[...metrics].reverse().map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.date)}</td>
                  <td className="px-3 py-2">{formatNumber(row.pieces_distributed)}</td>
                  <td className="px-3 py-2">{formatNumber(row.leads)}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(row.additional_cost))}</td>
                  <td className="px-3 py-2">{row.locations_covered || '—'}</td>
                  <td className="px-3 py-2">{row.notes || '—'}</td>
                </tr>
              ))}
              {metrics.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[var(--color-ink-muted)]">
                    No distribution logs yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
