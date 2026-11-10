import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AdVisualUpload } from '../components/AdVisualUpload'
import { QrPreview } from '../components/QrPreview'
import { Button, ErrorMessage, Input, LoadingState, PageHeader, Select, TextArea } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { formatDate, toDateInputValue } from '../lib/format'
import { buildShortUrl, trackingSlugFromName } from '../lib/qr'
import {
  createTraditionalCampaign,
  deleteTraditionalVisual,
  fetchTraditionalCampaign,
  fetchTraditionalVisuals,
  updateTraditionalCampaign,
  uploadTraditionalVisual,
} from '../lib/traditionalApi'
import {
  DEFAULT_LANDING_BASE,
  MATERIAL_TYPES,
  type MaterialType,
  type TraditionalCampaign,
  type TraditionalVisual,
} from '../lib/traditionalTypes'
import { CAMPAIGN_STATUSES, type CampaignStatus } from '../lib/types'

type FormState = {
  name: string
  material_type: MaterialType
  status: CampaignStatus
  start_date: string
  end_date: string
  landing_page_base: string
  tracking_src: string
  material_cost: string
  quantity_ordered: string
  locations: string
  target_area: string
  audience: string
  objective: string
  offer_headline: string
  notes: string
}

const emptyForm: FormState = {
  name: '',
  material_type: 'Flyer',
  status: 'Draft',
  start_date: '',
  end_date: '',
  landing_page_base: DEFAULT_LANDING_BASE,
  tracking_src: '',
  material_cost: '',
  quantity_ordered: '',
  locations: '',
  target_area: '',
  audience: '',
  objective: '',
  offer_headline: '',
  notes: '',
}

function toForm(c: TraditionalCampaign): FormState {
  return {
    name: c.name,
    material_type: c.material_type,
    status: c.status,
    start_date: toDateInputValue(c.start_date),
    end_date: toDateInputValue(c.end_date),
    landing_page_base: c.landing_page_base || DEFAULT_LANDING_BASE,
    tracking_src: c.tracking_src,
    material_cost: c.material_cost != null ? String(c.material_cost) : '',
    quantity_ordered: c.quantity_ordered != null ? String(c.quantity_ordered) : '',
    locations: c.locations || '',
    target_area: c.target_area || '',
    audience: c.audience || '',
    objective: c.objective || '',
    offer_headline: c.offer_headline || '',
    notes: c.notes || '',
  }
}

export function TraditionalFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [form, setForm] = useState<FormState>(emptyForm)
  const [visuals, setVisuals] = useState<TraditionalVisual[]>([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [srcTouched, setSrcTouched] = useState(false)

  useEffect(() => {
    async function load() {
      if (!id) return
      try {
        const campaign = await fetchTraditionalCampaign(id)
        setForm(toForm(campaign))
        setVisuals(await fetchTraditionalVisuals(id))
        setSrcTouched(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load effort')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  useEffect(() => {
    if (srcTouched || !form.name) return
    setForm((f) => ({ ...f, tracking_src: trackingSlugFromName(f.name) }))
  }, [form.name, srcTouched])

  const previewUrl = useMemo(
    () => buildShortUrl(form.landing_page_base, form.tracking_src || trackingSlugFromName(form.name)),
    [form.landing_page_base, form.tracking_src, form.name],
  )

  const validation = useMemo(() => {
    const errors: Partial<Record<keyof FormState, string>> = {}
    if (!form.name.trim()) errors.name = 'Name is required'
    if (!trackingSlugFromName(form.tracking_src || form.name)) {
      errors.tracking_src = 'Tracking source is required (e.g. localshops)'
    }
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      errors.end_date = 'End date must be on or after start date'
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
        material_type: form.material_type,
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        landing_page_base: form.landing_page_base.trim() || DEFAULT_LANDING_BASE,
        tracking_src: trackingSlugFromName(form.tracking_src || form.name),
        material_cost: form.material_cost === '' ? null : Number(form.material_cost),
        quantity_ordered: form.quantity_ordered === '' ? null : Number(form.quantity_ordered),
        locations: form.locations || null,
        target_area: form.target_area || null,
        audience: form.audience || null,
        objective: form.objective || null,
        offer_headline: form.offer_headline || null,
        notes: form.notes || null,
        archived: false,
      }

      const saved =
        isEdit && id
          ? await updateTraditionalCampaign(id, payload)
          : await createTraditionalCampaign(payload, user.id)

      navigate(`/traditional/${saved.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit traditional effort' : 'Add traditional effort'}
        subtitle="Door hangers, flyers, promo cards — QR and short URL are generated from tracking source"
        actions={
          <Link to={id ? `/traditional/${id}` : '/traditional'}>
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
              label="Effort name"
              required
              placeholder="Local shops — flyers"
              value={form.name}
              error={validation.name}
              onChange={(e) => {
                setSrcTouched(false)
                setField('name', e.target.value)
              }}
            />
            <Select
              label="Material"
              value={form.material_type}
              onChange={(e) => setField('material_type', e.target.value as MaterialType)}
            >
              {MATERIAL_TYPES.map((m) => (
                <option key={m} value={m}>
                  {m}
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
              label="Offer / headline"
              value={form.offer_headline}
              onChange={(e) => setField('offer_headline', e.target.value)}
            />
          </div>
        </section>

        <section className="card-surface p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold">Schedule & cost</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="Start date"
              type="date"
              value={form.start_date}
              onChange={(e) => setField('start_date', e.target.value)}
            />
            <Input
              label="End date"
              type="date"
              value={form.end_date}
              error={validation.end_date}
              onChange={(e) => setField('end_date', e.target.value)}
            />
            <Input
              label="Material cost (USD)"
              type="number"
              min={0}
              step="0.01"
              value={form.material_cost}
              onChange={(e) => setField('material_cost', e.target.value)}
            />
            <Input
              label="Quantity ordered"
              type="number"
              min={0}
              value={form.quantity_ordered}
              onChange={(e) => setField('quantity_ordered', e.target.value)}
            />
          </div>
          {form.start_date && form.end_date && (
            <p className="text-xs text-[var(--color-ink-muted)]">
              Runs {formatDate(form.start_date)} – {formatDate(form.end_date)}
            </p>
          )}
        </section>

        <section className="card-surface p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold">Tracking URL & QR</h2>
          <p className="text-xs text-[var(--color-ink-muted)]">
            Same landing page as digital ads; tracking source becomes <code>?src=…</code> for attribution.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Landing page base"
              value={form.landing_page_base}
              onChange={(e) => setField('landing_page_base', e.target.value)}
              placeholder={DEFAULT_LANDING_BASE}
            />
            <Input
              label="Tracking source (src)"
              value={form.tracking_src}
              error={validation.tracking_src}
              onChange={(e) => {
                setSrcTouched(true)
                setField('tracking_src', e.target.value)
              }}
              placeholder="localshops"
            />
          </div>
          <QrPreview url={previewUrl} filename={`qr-${form.tracking_src || 'campaign'}.png`} />
        </section>

        <section className="card-surface p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold">Locations & audience</h2>
          <TextArea
            label="Locations"
            placeholder="Shop names, neighborhoods, ZIP codes, drop routes…"
            value={form.locations}
            onChange={(e) => setField('locations', e.target.value)}
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Target area"
              value={form.target_area}
              onChange={(e) => setField('target_area', e.target.value)}
            />
            <Input
              label="Audience"
              value={form.audience}
              onChange={(e) => setField('audience', e.target.value)}
            />
          </div>
          <Input
            label="Objective"
            value={form.objective}
            onChange={(e) => setField('objective', e.target.value)}
          />
          <TextArea label="Notes" value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
        </section>

        {isEdit && id && (
          <section className="card-surface p-4 sm:p-6 space-y-4">
            <h2 className="text-lg font-semibold">Ad visuals</h2>
            <AdVisualUpload
              existing={visuals}
              onUpload={async (file, meta) => {
                const visual = await uploadTraditionalVisual(id, file, meta)
                setVisuals((prev) => [visual, ...prev])
              }}
              onDelete={async (visual) => {
                await deleteTraditionalVisual(visual)
                setVisuals((prev) => prev.filter((v) => v.id !== visual.id))
              }}
            />
          </section>
        )}

        {!isEdit && (
          <p className="text-sm text-[var(--color-ink-muted)]">
            Save the effort first, then upload print artwork on the edit screen.
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create effort'}
          </Button>
          <Link to={id ? `/traditional/${id}` : '/traditional'}>
            <Button variant="secondary">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
