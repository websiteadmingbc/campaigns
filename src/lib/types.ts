export type UserRole = 'admin' | 'viewer'

export type Platform =
  | 'Nextdoor'
  | 'Facebook'
  | 'Instagram'
  | 'Google'
  | 'Yelp'
  | 'Craigslist'
  | 'Print'
  | 'Other'

export type CampaignStatus = 'Draft' | 'Scheduled' | 'Active' | 'Paused' | 'Completed'

export type LeadStatus = 'New' | 'Contacted' | 'Estimate Sent' | 'Won' | 'Lost'

export const PLATFORMS: Platform[] = [
  'Nextdoor',
  'Facebook',
  'Instagram',
  'Google',
  'Yelp',
  'Craigslist',
  'Print',
  'Other',
]

export const CAMPAIGN_STATUSES: CampaignStatus[] = [
  'Draft',
  'Scheduled',
  'Active',
  'Paused',
  'Completed',
]

export const LEAD_STATUSES: LeadStatus[] = [
  'New',
  'Contacted',
  'Estimate Sent',
  'Won',
  'Lost',
]

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  role: UserRole
  created_at: string
}

export interface Campaign {
  id: string
  name: string
  platform: Platform
  status: CampaignStatus
  status_locked: boolean
  start_date: string | null
  duration_days: number
  end_date: string | null
  budget_total: number | null
  daily_budget: number | null
  target_area: string | null
  audience: string | null
  objective: string | null
  offer_headline: string | null
  ad_copy: string | null
  landing_page_url: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  notes: string | null
  archived: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AdVisual {
  id: string
  campaign_id: string
  image_url: string
  storage_path: string | null
  caption: string | null
  version_label: string | null
  created_at: string
}

export interface DailyMetric {
  id: string
  campaign_id: string
  date: string
  impressions: number
  clicks: number
  spend: number
  leads: number
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  campaign_id: string
  date: string
  name: string
  contact_method: string | null
  project_type: string | null
  estimated_value: number | null
  status: LeadStatus
  won_value: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface WeeklyNote {
  id: string
  campaign_id: string
  week_start: string
  summary: string | null
  what_worked: string | null
  next_steps: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type CampaignInput = Omit<
  Campaign,
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'status_locked'
> & {
  id?: string
  status_locked?: boolean
}

/** Computed metrics helpers */
export interface MetricTotals {
  impressions: number
  clicks: number
  spend: number
  leads: number
  ctr: number
  cpc: number
  cpl: number
}
