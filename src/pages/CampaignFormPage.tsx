import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { addDays, format, parseISO } from 'date-fns'
import { AdVisualUpload } from '../components/AdVisualUpload'
import { Button, ErrorMessage, Input, LoadingState, PageHeader, Select, TextArea } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import {
  createCampaign,
  deleteAdVisual,
  fetchAdVisuals,
  fetchCampaign,
  updateCampaign,
  uploadAdVisual,
} from '../lib/api'
import { suggestUtms, toDateInputValue } from '../lib/format'
import type { AdVisual, Campaign, CampaignStatus, Platform } from '../lib/types'
import { CAMPAIGN_STATUSES, PLATFORMS } from '../lib/types'

type FormState = {
  name: string
  platform: Platform
  status: CampaignStatus
  start_date: string
  duration_days: number
  end_date: string
  budget_total: string
  daily_budget: string
  target_area: string
  audience: string
  objective: string
  offer_headline: string
  ad_copy: string
  landing_page_url: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
  notes: string
  nextdoor_advertiser_id: string
  nextdoor_campaign_id: string
}

const emptyForm: FormState = {
  name: '',
  platform: 'Nextdoor',
  status: 'Draft',
  start_date: '',
  duration_days: 30,
  end_date: '',
  budget_total: '',
  daily_budget: '',
  target_area: '',
  audience: '',
  objective: '',
  offer_headline: '',
  ad_copy: '',
  landing_page_url: '',
  utm_source: '',
  utm_medium: '',
  utm_campaign: '',
  notes: '',
  nextdoor_advertiser_id: '1059681864853227341',
  nextdoor_campaign_id: '',
}

function campaignToForm(c: Campaign): FormState {
  return {
    name: c.name,
    platform: c.platform,
    status: c.status,
    start_date: toDateInputValue(c.start_date),
    duration_days: c.duration_days,
    end_date: toDateInputValue(c.end_date),
    budget_total: c.budget_total != null ? String(c.budget_total) : '',
    daily_budget: c.daily_budget != null ? String(c.daily_budget) : '',
    target_area: c.target_area || '',
    audience: c.audience || '',
    objective: c.objective || '',
    offer_headline: c.offer_headline || '',
    ad_copy: c.ad_copy || '',
    landing_page_url: c.landing_page_url || '',
    utm_source: c.utm_source || '',
    utm_medium: c.utm_medium || '',
    utm_campaign: c.utm_campaign || '',
    notes: c.notes || '',
    nextdoor_advertiser_id: c.nextdoor_advertiser_id || '1059681864853227341',
    nextdoor_campaign_id: c.nextdoor_campaign_id || '',
  }
}

export function CampaignFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const duplicateOf = searchParams.get('duplicate')
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [form, setForm] = useState<FormState>(emptyForm)
  const [visuals, setVisuals] = useState<AdVisual[]>([])
  const [loading, setLoading] = useState(isEdit || Boolean(duplicateOf))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [utmTouched, setUtmTouched] = useState(false)
  const [endDateTouched, setEndDateTouched] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const sourceId = id || duplicateOf
        if (!sourceId) return
        const campaign = await fetchCampaign(sourceId)
        const next = campaignToForm(campaign)
        if (duplicateOf && !id) {
          next.name = `${campaign.name} (Copy)`
          next.status = 'Draft'
          next.start_date = ''
          next.end_date = ''
        }
        setForm(next)
        if (id) {
          setVisuals(await fetchAdVisuals(id))
        }
        setUtmTouched(true)
        setEndDateTouched(Boolean(campaign.end_date))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load campaign')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, duplicateOf])

  // Auto end date from start + duration
  useEffect(() => {
    if (!form.start_date || !form.duration_days || endDateTouched) return
    const end = format(addDays(parseISO(`${form.start_date}T12:00:00`), form.duration_days - 1), 'yyyy-MM-dd')
    setForm((f) => ({ ...f, end_date: end }))
  }, [form.start_date, form.duration_days, endDateTouched])

  // Auto UTM suggestions
  useEffect(() => {
    if (utmTouched) return
    if (!form.name) return
    const suggested = suggestUtms(form.name, form.platform)
    setForm((f) => ({ ...f, ...suggested }))
  }, [form.name, form.platform, utmTouched])

  const validation = useMemo(() => {
    const errors: Partial<Record<keyof FormState, string>> = {}
    if (!form.name.trim()) errors.name = 'Name is required'
    if (form.duration_days < 1) errors.duration_days = 'Duration must be at least 1 day'
    if (form.landing_page_url && !/^https?:\/\//i.test(form.landing_page_url)) {
      errors.landing_page_url = 'URL must start with http:// or https://'
    }
    return errors
  }, [form])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (Object.keys(validation).length) {
      setError('Please fix the highlighted fields.')
      return
    }
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        platform: form.platform,
        status: form.status,
        start_date: form.start_date || null,
        duration_days: Number(form.duration_days),
        end_date: form.end_date || null,
        budget_total: form.budget_total === '' ? null : Number(form.budget_total),
        daily_budget: form.daily_budget === '' ? null : Number(form.daily_budget),
        target_area: form.target_area || null,
        audience: form.audience || null,
        objective: form.objective || null,
        offer_headline: form.offer_headline || null,
        ad_copy: form.ad_copy || null,
        landing_page_url: form.landing_page_url || null,
        utm_source: form.utm_source || null,
        utm_medium: form.utm_medium || null,
        utm_campaign: form.utm_campaign || null,
        notes: form.notes || null,
        nextdoor_advertiser_id: form.nextdoor_advertiser_id.trim() || null,
        nextdoor_campaign_id: form.nextdoor_campaign_id.trim() || null,
        archived: false,
      }

      const saved = isEdit && id
        ? await updateCampaign(id, payload)
        : await createCampaign(payload, user.id)

      navigate(`/campaigns/${saved.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save campaign')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState label="Loading campaign…" />

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Campaign' : duplicateOf ? 'Duplicate Campaign' : 'New Campaign'}
        subtitle="Admins only. Changes are saved to Supabase with RLS."
        actions={
          <Link to={id ? `/campaigns/${id}` : '/'}>
            <Button variant="secondary">Cancel</Button>
          </Link>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} />
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="card-surface p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold">Basics</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Campaign name"
              required
              value={form.name}
              error={validation.name}
              onChange={(e) => {
                setUtmTouched(false)
                setField('name', e.target.value)
              }}
            />
            <Select
              label="Platform"
              value={form.platform}
              onChange={(e) => {
                setUtmTouched(false)
                setField('platform', e.target.value as Platform)
              }}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setField('status', e.target.value as CampaignStatus)}
            >
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Input
              label="Landing page URL"
              type="url"
              placeholder="https://"
              value={form.landing_page_url}
              error={validation.landing_page_url}
              onChange={(e) => setField('landing_page_url', e.target.value)}
            />
          </div>
        </section>

        <section className="card-surface p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold">Schedule & budget</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="Start date"
              type="date"
              value={form.start_date}
              onChange={(e) => {
                setEndDateTouched(false)
                setField('start_date', e.target.value)
              }}
            />
            <Input
              label="Duration (days)"
              type="number"
              min={1}
              value={form.duration_days}
              error={validation.duration_days}
              onChange={(e) => {
                setEndDateTouched(false)
                setField('duration_days', Number(e.target.value) || 1)
              }}
            />
            <Input
              label="End date"
              type="date"
              value={form.end_date}
              onChange={(e) => {
                setEndDateTouched(true)
                setField('end_date', e.target.value)
              }}
            />
            <div className="text-xs text-[var(--color-ink-muted)] self-end pb-2">
              End date auto-calculates from start + duration. Edit to override.
            </div>
            <Input
              label="Total budget (USD)"
              type="number"
              min={0}
              step="0.01"
              value={form.budget_total}
              onChange={(e) => setField('budget_total', e.target.value)}
            />
            <Input
              label="Daily budget (USD)"
              type="number"
              min={0}
              step="0.01"
              value={form.daily_budget}
              onChange={(e) => setField('daily_budget', e.target.value)}
            />
          </div>
        </section>

        <section className="card-surface p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold">Targeting & creative</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Target area"
              placeholder="Neighborhoods / ZIP codes"
              value={form.target_area}
              onChange={(e) => setField('target_area', e.target.value)}
            />
            <Input
              label="Audience"
              value={form.audience}
              onChange={(e) => setField('audience', e.target.value)}
            />
            <Input
              label="Objective"
              value={form.objective}
              onChange={(e) => setField('objective', e.target.value)}
            />
            <Input
              label="Offer / headline"
              value={form.offer_headline}
              onChange={(e) => setField('offer_headline', e.target.value)}
            />
          </div>
          <TextArea
            label="Ad copy"
            value={form.ad_copy}
            onChange={(e) => setField('ad_copy', e.target.value)}
          />
          <TextArea label="Notes" value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
        </section>

        {form.platform === 'Nextdoor' && (
          <section className="card-surface p-4 sm:p-6 space-y-4">
            <h2 className="text-lg font-semibold">Nextdoor API sync</h2>
            <p className="text-xs text-[var(--color-ink-muted)]">
              Paste IDs from Nextdoor Ads Manager so metrics can sync automatically. Advertiser ID is
              usually your account ID. Campaign ID is on the campaign URL/details page.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Nextdoor advertiser ID"
                value={form.nextdoor_advertiser_id}
                onChange={(e) => setField('nextdoor_advertiser_id', e.target.value)}
                placeholder="1059681864853227341"
              />
              <Input
                label="Nextdoor campaign ID"
                value={form.nextdoor_campaign_id}
                onChange={(e) => setField('nextdoor_campaign_id', e.target.value)}
                placeholder="Required for Sync from Nextdoor"
              />
            </div>
          </section>
        )}

        <section className="card-surface p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold">UTM parameters</h2>
          <p className="text-xs text-[var(--color-ink-muted)]">
            Auto-suggested from name + platform. Edit anytime.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            <Input
              label="utm_source"
              value={form.utm_source}
              onChange={(e) => {
                setUtmTouched(true)
                setField('utm_source', e.target.value)
              }}
            />
            <Input
              label="utm_medium"
              value={form.utm_medium}
              onChange={(e) => {
                setUtmTouched(true)
                setField('utm_medium', e.target.value)
              }}
            />
            <Input
              label="utm_campaign"
              value={form.utm_campaign}
              onChange={(e) => {
                setUtmTouched(true)
                setField('utm_campaign', e.target.value)
              }}
            />
          </div>
        </section>

        {isEdit && id && (
          <section className="card-surface p-4 sm:p-6 space-y-4">
            <h2 className="text-lg font-semibold">Ad visuals</h2>
            <AdVisualUpload
              existing={visuals}
              onUpload={async (file, meta) => {
                const visual = await uploadAdVisual(id, file, meta)
                setVisuals((prev) => [visual, ...prev])
              }}
              onDelete={async (visual) => {
                await deleteAdVisual(visual)
                setVisuals((prev) => prev.filter((v) => v.id !== visual.id))
              }}
            />
          </section>
        )}

        {!isEdit && (
          <p className="text-sm text-[var(--color-ink-muted)]">
            Save the campaign first, then you can upload ad visuals on the edit screen.
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create campaign'}
          </Button>
          <Link to={id ? `/campaigns/${id}` : '/'}>
            <Button variant="secondary">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
