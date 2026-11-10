-- Update / replace seed campaign with Nextdoor Fall 2026 remodel outreach details.
-- Run in Supabase SQL Editor after 001_initial.sql

update public.campaigns
set
  name = 'Remodel Outreach - start.greatbrittongc.com - Fall 2026',
  platform = 'Nextdoor',
  status = 'Active',
  status_locked = false,
  start_date = '2026-11-10',
  duration_days = 30,
  end_date = '2026-12-09',
  daily_budget = 12.00,
  budget_total = 360.00,
  landing_page_url = 'https://start.greatbrittongc.com/',
  audience = 'Homeowners — Kitchen & Bath Remodels (Newsfeed)',
  objective = 'Clicks (automatic bidding; no conversion type set)',
  offer_headline = 'Kitchen & Bath Remodel - Estimate Request - Newsfeed',
  ad_copy = 'Ad group: Homeowners - Kitchen & Bath Remodels - Newsfeed. Placement: Newsfeed. Optimizing for clicks with automatic bidding.',
  target_area = 'United States — Pacific Time markets',
  utm_source = 'nextdoor',
  utm_medium = 'paid_social',
  utm_campaign = 'remodel-outreach-fall-2026',
  notes = $notes$
Ad account
- Name: Great Britton Construction
- Account ID: 1059681864853227341
- Owned by: Great Britton Construction
- Website: https://start.greatbrittongc.com/
- Business category: Home & Garden
- Subcategories: Remodeling & Construction
- Country & currency: United States (USD)
- Time zone: Pacific Time
- Web scraping status: Opted In

Campaign setup notes
- Marked Active in Nextdoor; begins 2026-11-10 (no spend/results before start)
- Estimated total cost: up to ~$360 ($12 × 30 days) if it runs full budget every day
- Spend so far: $0.00 (0 impressions / 0 clicks / 0 conversions in last 7 days)
- Ad: Kitchen & Bath Remodel - Estimate Request - Newsfeed (Active; no creatives rejected)
$notes$,
  updated_at = now()
where name = 'Nextdoor — Launch Campaign'
   or name = 'Remodel Outreach - start.greatbrittongc.com - Fall 2026';

-- If the seed row was never created, insert it
insert into public.campaigns (
  name, platform, status, status_locked,
  start_date, duration_days, end_date,
  daily_budget, budget_total,
  landing_page_url, audience, objective, offer_headline, ad_copy, target_area,
  utm_source, utm_medium, utm_campaign, notes
)
select
  'Remodel Outreach - start.greatbrittongc.com - Fall 2026',
  'Nextdoor',
  'Active',
  false,
  '2026-11-10',
  30,
  '2026-12-09',
  12.00,
  360.00,
  'https://start.greatbrittongc.com/',
  'Homeowners — Kitchen & Bath Remodels (Newsfeed)',
  'Clicks (automatic bidding; no conversion type set)',
  'Kitchen & Bath Remodel - Estimate Request - Newsfeed',
  'Ad group: Homeowners - Kitchen & Bath Remodels - Newsfeed. Placement: Newsfeed. Optimizing for clicks with automatic bidding.',
  'United States — Pacific Time markets',
  'nextdoor',
  'paid_social',
  'remodel-outreach-fall-2026',
  $notes$
Ad account
- Name: Great Britton Construction
- Account ID: 1059681864853227341
- Owned by: Great Britton Construction
- Website: https://start.greatbrittongc.com/
- Business category: Home & Garden
- Subcategories: Remodeling & Construction
- Country & currency: United States (USD)
- Time zone: Pacific Time
- Web scraping status: Opted In

Campaign setup notes
- Marked Active in Nextdoor; begins 2026-11-10 (no spend/results before start)
- Estimated total cost: up to ~$360 ($12 × 30 days) if it runs full budget every day
- Spend so far: $0.00 (0 impressions / 0 clicks / 0 conversions in last 7 days)
- Ad: Kitchen & Bath Remodel - Estimate Request - Newsfeed (Active; no creatives rejected)
$notes$
where not exists (
  select 1 from public.campaigns
  where name in (
    'Nextdoor — Launch Campaign',
    'Remodel Outreach - start.greatbrittongc.com - Fall 2026'
  )
);

-- Ensure you can edit in the app UI
update public.profiles
set role = 'admin'
where email = 'dylansimpson@greatbrittongc.com';
