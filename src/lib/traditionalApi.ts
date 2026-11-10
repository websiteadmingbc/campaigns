import { supabase } from './supabase'
import type {
  TraditionalCampaign,
  TraditionalCampaignInput,
  TraditionalMetric,
  TraditionalVisual,
} from './traditionalTypes'

function throwIfError<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message)
  if (data == null) throw new Error('No data returned')
  return data
}

export async function fetchTraditionalCampaigns(includeArchived = false): Promise<TraditionalCampaign[]> {
  let query = supabase
    .from('traditional_campaigns')
    .select('*')
    .order('start_date', { ascending: false })
  if (!includeArchived) query = query.eq('archived', false)
  const { data, error } = await query
  return throwIfError(data, error)
}

export async function fetchTraditionalCampaign(id: string): Promise<TraditionalCampaign> {
  const { data, error } = await supabase.from('traditional_campaigns').select('*').eq('id', id).single()
  return throwIfError(data, error)
}

export async function createTraditionalCampaign(
  input: Partial<TraditionalCampaignInput>,
  userId: string,
): Promise<TraditionalCampaign> {
  const { data, error } = await supabase
    .from('traditional_campaigns')
    .insert({ ...input, created_by: userId })
    .select()
    .single()
  return throwIfError(data, error)
}

export async function updateTraditionalCampaign(
  id: string,
  input: Partial<TraditionalCampaignInput>,
): Promise<TraditionalCampaign> {
  const { data, error } = await supabase
    .from('traditional_campaigns')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  return throwIfError(data, error)
}

export async function archiveTraditionalCampaign(id: string): Promise<void> {
  const { error } = await supabase
    .from('traditional_campaigns')
    .update({ archived: true })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchTraditionalVisuals(campaignId: string): Promise<TraditionalVisual[]> {
  const { data, error } = await supabase
    .from('traditional_visuals')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
  const rows = throwIfError(data, error)
  return Promise.all(
    rows.map(async (row) => {
      if (!row.storage_path) return row
      try {
        const { data: signed, error: signError } = await supabase.storage
          .from('ad-visuals')
          .createSignedUrl(row.storage_path, 60 * 60 * 24 * 7)
        if (signError) return row
        return { ...row, image_url: signed.signedUrl }
      } catch {
        return row
      }
    }),
  )
}

export async function uploadTraditionalVisual(
  campaignId: string,
  file: File,
  meta: { caption?: string; version_label?: string },
): Promise<TraditionalVisual> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `traditional/${campaignId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage.from('ad-visuals').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (uploadError) throw new Error(uploadError.message)

  const { data: signed, error: signError } = await supabase.storage
    .from('ad-visuals')
    .createSignedUrl(path, 60 * 60 * 24 * 365)
  if (signError) throw new Error(signError.message)

  const { data, error } = await supabase
    .from('traditional_visuals')
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

export async function deleteTraditionalVisual(visual: {
  id: string
  storage_path?: string | null
}): Promise<void> {
  if (visual.storage_path) {
    await supabase.storage.from('ad-visuals').remove([visual.storage_path])
  }
  const { error } = await supabase.from('traditional_visuals').delete().eq('id', visual.id)
  if (error) throw new Error(error.message)
}

export async function fetchTraditionalMetrics(campaignId?: string): Promise<TraditionalMetric[]> {
  let query = supabase.from('traditional_metrics').select('*').order('date', { ascending: true })
  if (campaignId) query = query.eq('campaign_id', campaignId)
  const { data, error } = await query
  return throwIfError(data, error)
}

export async function upsertTraditionalMetric(
  input: Omit<TraditionalMetric, 'id' | 'created_at' | 'updated_at'> & { id?: string },
): Promise<TraditionalMetric> {
  const { data, error } = await supabase
    .from('traditional_metrics')
    .upsert(
      {
        campaign_id: input.campaign_id,
        date: input.date,
        pieces_distributed: input.pieces_distributed,
        leads: input.leads,
        additional_cost: input.additional_cost,
        locations_covered: input.locations_covered,
        notes: input.notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'campaign_id,date' },
    )
    .select()
    .single()
  return throwIfError(data, error)
}
