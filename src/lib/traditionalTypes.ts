import type { CampaignStatus } from './types'

export type MaterialType = 'Door hanger' | 'Flyer' | 'Promo card' | 'Other'

export const MATERIAL_TYPES: MaterialType[] = [
  'Door hanger',
  'Flyer',
  'Promo card',
  'Other',
]

export const DEFAULT_LANDING_BASE = 'https://start.greatbrittongc.com/'

export interface TraditionalCampaign {
  id: string
  name: string
  material_type: MaterialType
  status: CampaignStatus
  status_locked: boolean
  start_date: string | null
  end_date: string | null
  landing_page_base: string
  tracking_src: string
  short_url: string
  material_cost: number | null
  quantity_ordered: number | null
  quantity_distributed: number
  locations: string | null
  target_area: string | null
  audience: string | null
  objective: string | null
  offer_headline: string | null
  notes: string | null
  archived: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TraditionalVisual {
  id: string
  campaign_id: string
  image_url: string
  storage_path: string | null
  caption: string | null
  version_label: string | null
  created_at: string
}

export interface TraditionalMetric {
  id: string
  campaign_id: string
  date: string
  pieces_distributed: number
  leads: number
  additional_cost: number
  locations_covered: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type TraditionalCampaignInput = Omit<
  TraditionalCampaign,
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'status_locked' | 'short_url' | 'quantity_distributed'
> & {
  id?: string
  status_locked?: boolean
  short_url?: string
  quantity_distributed?: number
}
