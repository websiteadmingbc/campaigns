import { supabase } from './supabase'
import type {
  AdVisual,
  Campaign,
  CampaignInput,
  DailyMetric,
  Lead,
  LeadStatus,
  Profile,
  WeeklyNote,
} from './types'

function throwIfError<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message)
  if (data == null) throw new Error('No data returned')
  return data
}

// ---- Profiles ----
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

// ---- Campaigns ----
export async function fetchCampaigns(includeArchived = false): Promise<Campaign[]> {
  let query = supabase.from('campaigns').select('*').order('start_date', { ascending: false })
  if (!includeArchived) query = query.eq('archived', false)
  const { data, error } = await query
  return throwIfError(data, error)
}

export async function fetchCampaign(id: string): Promise<Campaign> {
  const { data, error } = await supabase.from('campaigns').select('*').eq('id', id).single()
  return throwIfError(data, error)
}

export async function createCampaign(
  input: Partial<CampaignInput>,
  userId: string,
): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .insert({ ...input, created_by: userId })
    .select()
    .single()
  return throwIfError(data, error)
}

export async function updateCampaign(id: string, input: Partial<CampaignInput>): Promise<Campaign> {
  const { data, error } = await supabase.from('campaigns').update(input).eq('id', id).select().single()
  return throwIfError(data, error)
}

export async function archiveCampaign(id: string): Promise<void> {
  const { error } = await supabase.from('campaigns').update({ archived: true }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function duplicateCampaign(source: Campaign, userId: string): Promise<Campaign> {
  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    created_by: _cb,
    archived: _a,
    ...rest
  } = source
  return createCampaign(
    {
      ...rest,
      name: `${source.name} (Copy)`,
      status: 'Draft',
      status_locked: true,
      start_date: null,
      end_date: null,
      archived: false,
    },
    userId,
  )
}

// ---- Ad visuals ----
export async function fetchAdVisuals(campaignId: string): Promise<AdVisual[]> {
  const { data, error } = await supabase
    .from('ad_visuals')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
  const rows = throwIfError(data, error)

  // Refresh signed URLs for private bucket objects
  return Promise.all(
    rows.map(async (row) => {
      if (!row.storage_path) return row
      try {
        const image_url = await getSignedUrl(row.storage_path)
        return { ...row, image_url }
      } catch {
        return row
      }
    }),
  )
}

export async function uploadAdVisual(
  campaignId: string,
  file: File,
  meta: { caption?: string; version_label?: string },
): Promise<AdVisual> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${campaignId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage.from('ad-visuals').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (uploadError) throw new Error(uploadError.message)

  const { data: signed, error: signError } = await supabase.storage
    .from('ad-visuals')
    .createSignedUrl(path, 60 * 60 * 24 * 365) // 1 year
  if (signError) throw new Error(signError.message)

  const { data, error } = await supabase
    .from('ad_visuals')
    .insert({
      campaign_id: campaignId,
      image_url: signed.signedUrl,
      storage_path: path,
      caption: meta.caption || null,
      version_label: meta.version_label || null,
    })
    .select()
    .single()
  return throwIfError(data, error)
}

export async function deleteAdVisual(visual: AdVisual): Promise<void> {
  if (visual.storage_path) {
    await supabase.storage.from('ad-visuals').remove([visual.storage_path])
  }
  const { error } = await supabase.from('ad_visuals').delete().eq('id', visual.id)
  if (error) throw new Error(error.message)
}

export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('ad-visuals')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

// ---- Daily metrics ----
export async function fetchMetrics(campaignId?: string): Promise<DailyMetric[]> {
  let query = supabase.from('daily_metrics').select('*').order('date', { ascending: true })
  if (campaignId) query = query.eq('campaign_id', campaignId)
  const { data, error } = await query
  return throwIfError(data, error)
}

export async function upsertDailyMetric(
  input: Omit<DailyMetric, 'id' | 'created_at' | 'updated_at'> & { id?: string },
): Promise<DailyMetric> {
  const { data, error } = await supabase
    .from('daily_metrics')
    .upsert(
      {
        campaign_id: input.campaign_id,
        date: input.date,
        impressions: input.impressions,
        clicks: input.clicks,
        spend: input.spend,
        leads: input.leads,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'campaign_id,date' },
    )
    .select()
    .single()
  return throwIfError(data, error)
}

export async function importMetricsCsv(
  campaignId: string,
  rows: { date: string; impressions: number; clicks: number; spend: number; leads: number }[],
): Promise<number> {
  const payload = rows.map((r) => ({
    campaign_id: campaignId,
    date: r.date,
    impressions: r.impressions,
    clicks: r.clicks,
    spend: r.spend,
    leads: r.leads,
    updated_at: new Date().toISOString(),
  }))
  const { data, error } = await supabase
    .from('daily_metrics')
    .upsert(payload, { onConflict: 'campaign_id,date' })
    .select()
  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

// ---- Leads ----
export async function fetchLeads(campaignId?: string): Promise<Lead[]> {
  let query = supabase.from('leads').select('*').order('date', { ascending: false })
  if (campaignId) query = query.eq('campaign_id', campaignId)
  const { data, error } = await query
  return throwIfError(data, error)
}

export async function createLead(
  input: Omit<Lead, 'id' | 'created_at' | 'updated_at'>,
): Promise<Lead> {
  const { data, error } = await supabase.from('leads').insert(input).select().single()
  return throwIfError(data, error)
}

export async function updateLead(
  id: string,
  input: Partial<Omit<Lead, 'id' | 'created_at'>>,
): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return throwIfError(data, error)
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<Lead> {
  return updateLead(id, { status })
}

// ---- Weekly notes ----
export async function fetchWeeklyNotes(campaignId: string): Promise<WeeklyNote[]> {
  const { data, error } = await supabase
    .from('weekly_notes')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('week_start', { ascending: false })
  return throwIfError(data, error)
}

export async function upsertWeeklyNote(
  input: Omit<WeeklyNote, 'id' | 'created_at' | 'updated_at'> & { id?: string },
): Promise<WeeklyNote> {
  const { data, error } = await supabase
    .from('weekly_notes')
    .upsert(
      {
        campaign_id: input.campaign_id,
        week_start: input.week_start,
        summary: input.summary,
        what_worked: input.what_worked,
        next_steps: input.next_steps,
        created_by: input.created_by,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'campaign_id,week_start' },
    )
    .select()
    .single()
  return throwIfError(data, error)
}
