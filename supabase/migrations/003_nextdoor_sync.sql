-- Nextdoor Ads API sync support
-- Adds external IDs so Edge Function can pull daily stats into daily_metrics

alter table public.campaigns
  add column if not exists nextdoor_advertiser_id text,
  add column if not exists nextdoor_campaign_id text;

create index if not exists campaigns_nextdoor_campaign_id_idx
  on public.campaigns (nextdoor_campaign_id)
  where nextdoor_campaign_id is not null;

comment on column public.campaigns.nextdoor_advertiser_id is
  'Nextdoor Ads Manager advertiser ID (e.g. 1059681864853227341)';
comment on column public.campaigns.nextdoor_campaign_id is
  'Nextdoor Ads Manager campaign ID used by the Ads API';

-- Optional: prefill advertiser ID for the remodel campaign once it exists
update public.campaigns
set nextdoor_advertiser_id = coalesce(nextdoor_advertiser_id, '1059681864853227341')
where platform = 'Nextdoor'
  and name in (
    'Remodel Outreach - start.greatbrittongc.com - Fall 2026',
    'Nextdoor — Launch Campaign'
  );
