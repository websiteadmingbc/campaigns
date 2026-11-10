-- Great Britton Campaign Tracker
-- Run this in the Supabase SQL Editor (or via supabase db push)

-- Extensions
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (roles)
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'viewer');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role public.user_role not null default 'viewer',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_authenticated_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'viewer'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "Admins can update profiles"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------------
create type public.platform_type as enum (
  'Nextdoor', 'Facebook', 'Instagram', 'Google', 'Yelp', 'Craigslist', 'Print', 'Other'
);

create type public.campaign_status as enum (
  'Draft', 'Scheduled', 'Active', 'Paused', 'Completed'
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform public.platform_type not null default 'Other',
  status public.campaign_status not null default 'Draft',
  status_locked boolean not null default false, -- true when manually set to Draft/Paused
  start_date date,
  duration_days integer not null default 30 check (duration_days > 0),
  end_date date,
  budget_total numeric(12, 2),
  daily_budget numeric(12, 2),
  target_area text,
  audience text,
  objective text,
  offer_headline text,
  ad_copy text,
  landing_page_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  notes text,
  archived boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index campaigns_status_idx on public.campaigns (status);
create index campaigns_start_date_idx on public.campaigns (start_date);
create index campaigns_archived_idx on public.campaigns (archived);

alter table public.campaigns enable row level security;

-- Auto-compute end_date and derive status from dates (unless locked Draft/Paused)
create or replace function public.derive_campaign_fields()
returns trigger
language plpgsql
as $$
declare
  today date := (timezone('America/Los_Angeles', now()))::date;
begin
  -- Compute end_date from start + duration if start_date present
  if new.start_date is not null and new.duration_days is not null then
    if new.end_date is null
       or (tg_op = 'UPDATE' and (old.start_date is distinct from new.start_date or old.duration_days is distinct from new.duration_days))
       or (tg_op = 'INSERT' and new.end_date is null) then
      -- Only auto-set end_date when not explicitly provided on insert,
      -- or when start/duration changed on update (unless end_date was also changed)
      if tg_op = 'INSERT' then
        if new.end_date is null then
          new.end_date := new.start_date + (new.duration_days - 1);
        end if;
      else
        if (old.start_date is distinct from new.start_date or old.duration_days is distinct from new.duration_days)
           and (old.end_date is not distinct from new.end_date) then
          new.end_date := new.start_date + (new.duration_days - 1);
        end if;
      end if;
    end if;
  end if;

  -- Mark status_locked for Draft/Paused
  if new.status in ('Draft', 'Paused') then
    new.status_locked := true;
  elsif new.status in ('Scheduled', 'Active', 'Completed') then
    new.status_locked := false;
  end if;

  -- Auto-derive status unless locked (Draft/Paused)
  if not new.status_locked and new.start_date is not null then
    if today < new.start_date then
      new.status := 'Scheduled';
    elsif new.end_date is not null and today > new.end_date then
      new.status := 'Completed';
    else
      new.status := 'Active';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger campaigns_derive_fields
  before insert or update on public.campaigns
  for each row execute function public.derive_campaign_fields();

create policy "Authenticated can read campaigns"
  on public.campaigns for select
  to authenticated
  using (true);

create policy "Admins can insert campaigns"
  on public.campaigns for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update campaigns"
  on public.campaigns for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete campaigns"
  on public.campaigns for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Ad visuals
-- ---------------------------------------------------------------------------
create table public.ad_visuals (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  image_url text not null,
  storage_path text,
  caption text,
  version_label text,
  created_at timestamptz not null default now()
);

create index ad_visuals_campaign_idx on public.ad_visuals (campaign_id);

alter table public.ad_visuals enable row level security;

create policy "Authenticated can read ad_visuals"
  on public.ad_visuals for select
  to authenticated
  using (true);

create policy "Admins can insert ad_visuals"
  on public.ad_visuals for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update ad_visuals"
  on public.ad_visuals for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete ad_visuals"
  on public.ad_visuals for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Daily metrics
-- ---------------------------------------------------------------------------
create table public.daily_metrics (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  date date not null,
  impressions integer not null default 0 check (impressions >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  spend numeric(12, 2) not null default 0 check (spend >= 0),
  leads integer not null default 0 check (leads >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, date)
);

create index daily_metrics_campaign_date_idx on public.daily_metrics (campaign_id, date);

alter table public.daily_metrics enable row level security;

create policy "Authenticated can read daily_metrics"
  on public.daily_metrics for select
  to authenticated
  using (true);

create policy "Admins can insert daily_metrics"
  on public.daily_metrics for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update daily_metrics"
  on public.daily_metrics for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete daily_metrics"
  on public.daily_metrics for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------
create type public.lead_status as enum (
  'New', 'Contacted', 'Estimate Sent', 'Won', 'Lost'
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  date date not null default (timezone('America/Los_Angeles', now()))::date,
  name text not null,
  contact_method text,
  project_type text,
  estimated_value numeric(12, 2),
  status public.lead_status not null default 'New',
  won_value numeric(12, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_campaign_idx on public.leads (campaign_id);
create index leads_status_idx on public.leads (status);

alter table public.leads enable row level security;

create policy "Authenticated can read leads"
  on public.leads for select
  to authenticated
  using (true);

create policy "Admins can insert leads"
  on public.leads for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update leads"
  on public.leads for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete leads"
  on public.leads for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Weekly notes
-- ---------------------------------------------------------------------------
create table public.weekly_notes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  week_start date not null,
  summary text,
  what_worked text,
  next_steps text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, week_start)
);

create index weekly_notes_campaign_idx on public.weekly_notes (campaign_id, week_start);

alter table public.weekly_notes enable row level security;

create policy "Authenticated can read weekly_notes"
  on public.weekly_notes for select
  to authenticated
  using (true);

create policy "Admins can insert weekly_notes"
  on public.weekly_notes for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update weekly_notes"
  on public.weekly_notes for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete weekly_notes"
  on public.weekly_notes for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: ad-visuals bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ad-visuals',
  'ad-visuals',
  false,
  10485760, -- 10MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do nothing;

create policy "Authenticated can read ad-visuals"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'ad-visuals');

create policy "Admins can upload ad-visuals"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'ad-visuals' and public.is_admin());

create policy "Admins can update ad-visuals"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'ad-visuals' and public.is_admin())
  with check (bucket_id = 'ad-visuals' and public.is_admin());

create policy "Admins can delete ad-visuals"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'ad-visuals' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Seed: Nextdoor Launch Campaign
-- ---------------------------------------------------------------------------
insert into public.campaigns (
  name,
  platform,
  status,
  status_locked,
  start_date,
  duration_days,
  end_date,
  utm_source,
  utm_medium,
  utm_campaign,
  objective
) values (
  'Nextdoor — Launch Campaign',
  'Nextdoor',
  'Active',
  false,
  '2026-11-10',
  30,
  '2026-12-09',
  'nextdoor',
  'paid_social',
  'nextdoor-launch-campaign',
  'Generate local leads for construction services'
);

-- ---------------------------------------------------------------------------
-- Helper: promote a user to admin by email (run after they first log in)
-- ---------------------------------------------------------------------------
-- update public.profiles set role = 'admin' where email = 'you@example.com';
-- update public.profiles set role = 'viewer' where email = 'paul@example.com';
