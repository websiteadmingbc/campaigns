# Great Britton Campaign Tracker

Internal dashboard for tracking ad campaigns at **campaigns.greatbrittongc.com**.

Built with Vite + React + TypeScript, Tailwind CSS, Recharts, and Supabase (auth, Postgres, storage). Deployed to GitHub Pages with HashRouter.

## Features

- Magic-link email login (no public access)
- Roles: **admin** (create/edit/archive, enter metrics) and **viewer** (read-only)
- Campaign CRUD with ad visual uploads
- Daily metrics entry + CSV import
- Overview KPIs and charts
- Campaign detail with pacing, leads pipeline, weekly reports
- Printable weekly reports with shareable links
- Upcoming calendar / timeline

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql).
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

### 4. Brand accent

Change the accent color in [`src/index.css`](src/index.css):

```css
:root {
  --accent: #c4a35a;
  --accent-foreground: #1a1a1a;
}
```

Replace [`public/logo.svg`](public/logo.svg) with the real Great Britton logo when ready.

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

The migration seeds one campaign:

- **Nextdoor — Launch Campaign**
- Platform: Nextdoor
- Start: 2026-11-10
- Duration: 30 days
- Status: Active (derived from dates)
- Budget / metrics: empty for you to fill in

## Project structure

```
src/
  components/     # Layout, shared UI, uploads
  contexts/       # Auth + roles
  lib/            # Supabase client, API, formatting, metrics
  pages/          # Overview, detail, forms, reports, upcoming, daily entry
supabase/
  migrations/     # SQL schema, RLS, storage, seed
.github/workflows/deploy.yml
public/CNAME
```

## Scripts

| Command        | Description              |
|----------------|--------------------------|
| `npm run dev`  | Local Vite dev server    |
| `npm run build`| Typecheck + production build |
| `npm run preview` | Preview production build |
