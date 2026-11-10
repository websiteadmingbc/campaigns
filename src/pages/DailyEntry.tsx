import { useEffect, useState, type FormEvent } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button, EmptyState, ErrorMessage, Input, LoadingState, PageHeader, Select } from '../components/ui'
import { fetchCampaigns, importMetricsCsv, syncNextdoorMetrics, upsertDailyMetric } from '../lib/api'
import { todayLA } from '../lib/format'
import type { Campaign } from '../lib/types'

function parseCsv(text: string): {
  date: string
  impressions: number
  clicks: number
  spend: number
  leads: number
}[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
  if (lines.length < 2) return []

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''))
  const idx = {
    date: header.findIndex((h) => h === 'date' || h === 'day'),
    impressions: header.findIndex((h) => h.includes('impression')),
    clicks: header.findIndex((h) => h === 'clicks' || h === 'click'),
    spend: header.findIndex((h) => h === 'spend' || h === 'cost' || h === 'amount spent'),
    leads: header.findIndex((h) => h === 'leads' || h === 'conversions' || h === 'results'),
  }

  if (idx.date < 0) throw new Error('CSV must include a Date column')

  return lines.slice(1).map((line) => {
    const cols = line.match(/("([^"]|"")*"|[^,]*)/g)?.map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) || []
    const rawDate = cols[idx.date]
    let date = rawDate
    // Accept M/D/YYYY or YYYY-MM-DD
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) {
      const [m, d, y] = rawDate.split('/')
      date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    return {
      date,
      impressions: idx.impressions >= 0 ? Number(cols[idx.impressions] || 0) : 0,
      clicks: idx.clicks >= 0 ? Number(cols[idx.clicks] || 0) : 0,
      spend: idx.spend >= 0 ? Number(String(cols[idx.spend] || 0).replace(/[$,]/g, '')) : 0,
      leads: idx.leads >= 0 ? Number(cols[idx.leads] || 0) : 0,
    }
  })
}

export function DailyEntryPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [campaignId, setCampaignId] = useState('')
  const [date, setDate] = useState(todayLA())
  const [impressions, setImpressions] = useState('0')
  const [clicks, setClicks] = useState('0')
  const [spend, setSpend] = useState('0')
  const [leads, setLeads] = useState('0')

  useEffect(() => {
    fetchCampaigns(false)
      .then((c) => {
        // Prefer Active campaigns first for convenience
        const sorted = [...c].sort((a, b) => {
          if (a.status === 'Active' && b.status !== 'Active') return -1
          if (b.status === 'Active' && a.status !== 'Active') return 1
          return (b.start_date || '').localeCompare(a.start_date || '')
        })
        setCampaigns(sorted)
        if (sorted[0]) setCampaignId(sorted[0].id)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load campaigns'))
      .finally(() => setLoading(false))
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!campaignId) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await upsertDailyMetric({
        campaign_id: campaignId,
        date,
        impressions: Number(impressions) || 0,
        clicks: Number(clicks) || 0,
        spend: Number(spend) || 0,
        leads: Number(leads) || 0,
      })
      setSuccess(`Saved metrics for ${date}`)
      setImpressions('0')
      setClicks('0')
      setSpend('0')
      setLeads('0')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function onCsv(file: File) {
    if (!campaignId) {
      setError('Select a campaign first')
      return
    }
    setError(null)
    setSuccess(null)
    try {
      const text = await file.text()
      const rows = parseCsv(text)
      if (!rows.length) throw new Error('No data rows found in CSV')
      const count = await importMetricsCsv(campaignId, rows)
      setSuccess(`Imported ${count} metric row${count === 1 ? '' : 's'}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV import failed')
    }
  }

  async function onNextdoorSync() {
    const selected = campaigns.find((c) => c.id === campaignId)
    if (!selected) {
      setError('Select a campaign first')
      return
    }
    if (selected.platform !== 'Nextdoor') {
      setError('Nextdoor sync only works for Nextdoor campaigns')
      return
    }
    if (!selected.nextdoor_campaign_id) {
      setError('Edit the campaign and add the Nextdoor campaign ID first')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await syncNextdoorMetrics({ campaign_id: selected.id, lookback_days: 14 })
      const row = result.results?.[0]
      if (row?.skipped) {
        setSuccess(row.reason || 'Nothing to sync yet')
      } else if (row) {
        setSuccess(`Synced ${row.upserted ?? 0} day(s) from Nextdoor for ${selected.name}`)
        if (row.errors?.length) setError(row.errors.slice(0, 3).join(' · '))
      } else {
        setSuccess(result.message || 'Sync finished')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nextdoor sync failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div>
      <PageHeader
        title="Daily entry"
        subtitle="Log one day manually, import CSV, or sync from the Nextdoor Ads API."
        actions={
          <Button variant="secondary" onClick={onNextdoorSync} disabled={saving || !campaignId}>
            <RefreshCw size={16} className={saving ? 'animate-spin' : ''} />
            Sync Nextdoor
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} />
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {success}
        </div>
      )}

      {campaigns.length === 0 ? (
        <EmptyState title="No campaigns" description="Create a campaign before entering metrics." />
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <form onSubmit={onSubmit} className="card-surface p-4 sm:p-6 space-y-4">
            <h2 className="font-semibold text-lg">Single day</h2>
            <Select
              label="Campaign"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              required
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </Select>
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Impressions"
                type="number"
                min={0}
                value={impressions}
                onChange={(e) => setImpressions(e.target.value)}
              />
              <Input
                label="Clicks"
                type="number"
                min={0}
                value={clicks}
                onChange={(e) => setClicks(e.target.value)}
              />
              <Input
                label="Spend (USD)"
                type="number"
                min={0}
                step="0.01"
                value={spend}
                onChange={(e) => setSpend(e.target.value)}
              />
              <Input
                label="Leads"
                type="number"
                min={0}
                value={leads}
                onChange={(e) => setLeads(e.target.value)}
              />
            </div>
            <p className="text-xs text-[var(--color-ink-muted)]">
              CTR, CPC, and CPL are computed automatically from these fields.
            </p>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save day'}
            </Button>
          </form>

          <div className="card-surface p-4 sm:p-6 space-y-4">
            <h2 className="font-semibold text-lg">CSV import</h2>
            <p className="text-sm text-[var(--color-ink-muted)]">
              Expected columns: <code className="text-xs">Date, Impressions, Clicks, Spend, Leads</code>.
              Matching is flexible (Cost, Conversions, etc.). Rows upsert by date for the selected campaign.
            </p>
            <Select
              label="Campaign for import"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <label className="block">
              <span className="inline-flex cursor-pointer rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm hover:bg-[var(--color-surface)]">
                Choose CSV file
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onCsv(file)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
