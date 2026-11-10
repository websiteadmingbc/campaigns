-- Traditional marketing efforts (door hangers, flyers, promo cards)
-- Separate from digital campaigns; shares landing page via ?src= tracking

create type public.material_type as enum (
  'Door hanger',
  'Flyer',
  'Promo card',
  'Other'
);

create table public.traditional_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  material_type public.material_type not null default 'Flyer',
  status public.campaign_status not null default 'Draft',
  status_locked boolean not null default false,
  start_date date,
  end_date date,
  landing_page_base text not null default 'https://start.greatbrittongc.com/',
  tracking_src text not null,
  short_url text not null,
  material_cost numeric(12, 2),
  quantity_ordered integer check (quantity_ordered is null or quantity_ordered >= 0),
  quantity_distributed integer not null default 0 check (quantity_distributed >= 0),
  locations text,
  target_area text,
  audience text,
  objective text,
  offer_headline text,
  notes text,
  archived boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tracking_src)
);

create index traditional_campaigns_status_idx on public.traditional_campaigns (status);
create index traditional_campaigns_start_date_idx on public.traditional_campaigns (start_date);
create index traditional_campaigns_archived_idx on public.traditional_campaigns (archived);

alter table public.traditional_campaigns enable row level security;

create or replace function public.derive_traditional_campaign_fields()
returns trigger
language plpgsql
as $$
declare
  today date := (timezone('America/Los_Angeles', now()))::date;
  base text;
  src text;
begin
  -- Normalize tracking src
  src := lower(regexp_replace(coalesce(new.tracking_src, ''), '[^a-z0-9]+', '', 'g'));
  if src = '' then
    src := lower(regexp_replace(coalesce(new.name, 'campaign'), '[^a-z0-9]+', '', 'g'));
  end if;
  new.tracking_src := left(src, 64);

  base := coalesce(nullif(trim(new.landing_page_base), ''), 'https://start.greatbrittongc.com/');
  if right(base, 1) = '/' then
    new.short_url := base || '?src=' || new.tracking_src;
  else
    new.short_url := base || '/?src=' || new.tracking_src;
  end if;
  new.landing_page_base := base;

  if new.status in ('Draft', 'Paused') then
    new.status_locked := true;
  elsif new.status in ('Scheduled', 'Active', 'Completed') then
    new.status_locked := false;
  end if;

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

create trigger traditional_campaigns_derive_fields
  before insert or update on public.traditional_campaigns
  for each row execute function public.derive_traditional_campaign_fields();

create policy "Authenticated can read traditional_campaigns"
  on public.traditional_campaigns for select
  to authenticated
  using (true);

create policy "Admins can insert traditional_campaigns"
  on public.traditional_campaigns for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update traditional_campaigns"
  on public.traditional_campaigns for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete traditional_campaigns"
  on public.traditional_campaigns for delete
  to authenticated
  using (public.is_admin());

-- Visuals for traditional materials
create table public.traditional_visuals (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.traditional_campaigns (id) on delete cascade,
  image_url text not null,
  storage_path text,
  caption text,
  version_label text,
  created_at timestamptz not null default now()
);

create index traditional_visuals_campaign_idx on public.traditional_visuals (campaign_id);

alter table public.traditional_visuals enable row level security;

create policy "Authenticated can read traditional_visuals"
  on public.traditional_visuals for select
  to authenticated
  using (true);

create policy "Admins can insert traditional_visuals"
  on public.traditional_visuals for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update traditional_visuals"
  on public.traditional_visuals for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete traditional_visuals"
  on public.traditional_visuals for delete
  to authenticated
  using (public.is_admin());

-- Distribution / response metrics
create table public.traditional_metrics (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.traditional_campaigns (id) on delete cascade,
  date date not null,
  pieces_distributed integer not null default 0 check (pieces_distributed >= 0),
  leads integer not null default 0 check (leads >= 0),
  additional_cost numeric(12, 2) not null default 0 check (additional_cost >= 0),
  locations_covered text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, date)
);

create index traditional_metrics_campaign_date_idx
  on public.traditional_metrics (campaign_id, date);

alter table public.traditional_metrics enable row level security;

create policy "Authenticated can read traditional_metrics"
  on public.traditional_metrics for select
  to authenticated
  using (true);

create policy "Admins can insert traditional_metrics"
  on public.traditional_metrics for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update traditional_metrics"
  on public.traditional_metrics for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete traditional_metrics"
  on public.traditional_metrics for delete
  to authenticated
  using (public.is_admin());

-- Keep quantity_distributed in sync with metrics sum
create or replace function public.refresh_traditional_distributed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  total integer;
begin
  cid := coalesce(new.campaign_id, old.campaign_id);
  select coalesce(sum(pieces_distributed), 0) into total
  from public.traditional_metrics
  where campaign_id = cid;

  update public.traditional_campaigns
  set quantity_distributed = total, updated_at = now()
  where id = cid;

  return coalesce(new, old);
end;
$$;

create trigger traditional_metrics_refresh_distributed
  after insert or update or delete on public.traditional_metrics
  for each row execute function public.refresh_traditional_distributed();
