# Great Britton Campaign Tracker

Internal dashboard for tracking ad campaigns at **campaigns.greatbrittongc.com**.

Built with Vite + React + TypeScript, Tailwind CSS, Recharts, and Supabase (auth, Postgres, storage). Deployed to GitHub Pages with HashRouter.

## Features

- Magic-link email login (no public access)
- Roles: **admin** (create/edit/archive, enter metrics) and **viewer** (read-only)
- Campaign CRUD with ad visual uploads
- Daily metrics entry + CSV import
- **Nextdoor Ads API sync** (Edge Function → `daily_metrics`)
- Overview KPIs and charts
- Campaign detail with pacing, leads pipeline, weekly reports
- Printable weekly reports with shareable links
- Upcoming calendar / timeline

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the migrations in order:
   - [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql)
   - [`supabase/migrations/002_nextdoor_campaign_details.sql`](supabase/migrations/002_nextdoor_campaign_details.sql)
   - [`supabase/migrations/003_nextdoor_sync.sql`](supabase/migrations/003_nextdoor_sync.sql)
3. In **Authentication → URL Configuration**, add redirect URLs:
   - `http://localhost:5173/`
   - `https://campaigns.greatbrittongc.com/`
   - `https://<your-github-username>.github.io/<repo>/` (if using project Pages before custom domain)
4. Enable **Email** provider (magic link / OTP). Disable public sign-ups if you want invite-only; otherwise create users by sending them a magic link, then promote roles (below).

### 2. Promote roles

After you and Paul each sign in once (so `profiles` rows exist):

```sql
update public.profiles set role = 'admin' where email = 'your-email@example.com';
update public.profiles set role = 'viewer' where email = 'paul@example.com';
```

### 3. Local app

```bash
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from Supabase → Settings → API

npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### 4. Nextdoor Ads API sync (optional)

Pulls impressions / clicks / spend / lead conversions into `daily_metrics` so you don’t have to enter them by hand.

1. Request Ads API access if needed: [Nextdoor applying for access](https://developer.nextdoor.com/reference/applying-for-access).
2. Generate a token in Nextdoor Ads Manager: [https://ads.nextdoor.com/v2/manage/api](https://ads.nextdoor.com/v2/manage/api).
3. Deploy the Edge Function and set secrets:

```bash
supabase login
supabase link --project-ref tyrbmlsnkqttbtztvflg
supabase secrets set NEXTDOOR_API_TOKEN="your-token" NEXTDOOR_ADVERTISER_ID="1059681864853227341" SYNC_CRON_SECRET="long-random-string"
supabase functions deploy sync-nextdoor-metrics
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to functions.

4. Edit the campaign in the app → fill **Nextdoor campaign ID** (and advertiser ID if different).
5. Click **Sync Nextdoor** on the campaign detail or Daily Entry page (admin only). Default lookback is 7–14 days through yesterday.

Optional daily cron (Supabase scheduled trigger or external cron):

```bash
curl -X POST "https://tyrbmlsnkqttbtztvflg.supabase.co/functions/v1/sync-nextdoor-metrics" \
  -H "x-sync-secret: YOUR_SYNC_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"lookback_days":7}'
```

### 5. Brand accent

Change the accent color in [`src/index.css`](src/index.css):

```css
:root {
  --accent: #c4a35a;
  --accent-foreground: #1a1a1a;
}
```

Brand logo lives at [`public/logo.png`](public/logo.png).

## Deploy (GitHub Pages)

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment**: set Source to **GitHub Actions**.
3. Add repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Push to `main` (or run the **Deploy to GitHub Pages** workflow manually).
5. Custom domain: `public/CNAME` already contains `campaigns.greatbrittongc.com`. In GitHub Pages settings, confirm the custom domain and enable HTTPS. Point a CNAME DNS record for `campaigns` to `<user>.github.io`.

The app uses **HashRouter**, so routes work on GitHub Pages without a rewrite server (`/#/campaigns/...`).

## Seed data

The migrations seed / update the Nextdoor remodel outreach campaign (30 days, $12/day). Paste the Nextdoor **campaign ID** in Edit to enable API sync.

## Project structure

```
src/
  components/     # Layout, shared UI, uploads
  contexts/       # Auth + roles
  lib/            # Supabase client, API, formatting, metrics
  pages/          # Overview, detail, forms, reports, upcoming, daily entry
supabase/
  migrations/     # SQL schema, RLS, storage, seed
  functions/      # sync-nextdoor-metrics Edge Function
.github/workflows/deploy.yml
public/CNAME
```

## Scripts

| Command        | Description              |
|----------------|--------------------------|
| `npm run dev`  | Local Vite dev server    |
| `npm run build`| Typecheck + production build |
| `npm run preview` | Preview production build |
