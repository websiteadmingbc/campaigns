import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const NEXTDOOR_API = 'https://ads.nextdoor.com/api/v3'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret',
}

type SyncBody = {
  campaign_id?: string
  lookback_days?: number
  start_date?: string
  end_date?: string
}

type NextdoorStats = {
  impressions?: number
  clicks?: number
  billable_spend?: string | null
  lead_conversions?: number | null
  total_conversions?: number | null
  result?: number | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const nextdoorToken = Deno.env.get('NEXTDOOR_API_TOKEN')
    const cronSecret = Deno.env.get('SYNC_CRON_SECRET')
    const defaultAdvertiserId = Deno.env.get('NEXTDOOR_ADVERTISER_ID') || '1059681864853227341'

    if (!supabaseUrl || !serviceKey) {
      return json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500)
    }
    if (!nextdoorToken) {
      return json(
        {
          error:
            'Missing NEXTDOOR_API_TOKEN. Generate one at https://ads.nextdoor.com/v2/manage/api and set it as a function secret.',
        },
        500,
      )
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const authHeader = req.headers.get('Authorization') || ''
    const syncSecret = req.headers.get('x-sync-secret') || ''

    let authorized = false
    if (cronSecret && syncSecret && syncSecret === cronSecret) {
      authorized = true
    } else if (authHeader.startsWith('Bearer ')) {
      const jwt = authHeader.slice(7)
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || serviceKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      })
      const { data: userData, error: userError } = await userClient.auth.getUser()
      if (userError || !userData.user) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const { data: profile } = await admin
        .from('profiles')
        .select('role')
        .eq('id', userData.user.id)
        .maybeSingle()
      if (profile?.role !== 'admin') {
        return json({ error: 'Admin role required' }, 403)
      }
      authorized = true
    }

    if (!authorized) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const body = (req.method === 'POST' ? await req.json().catch(() => ({})) : {}) as SyncBody
    const lookbackDays = Math.min(Math.max(Number(body.lookback_days) || 7, 1), 60)

    let query = admin
      .from('campaigns')
      .select('id, name, start_date, end_date, nextdoor_advertiser_id, nextdoor_campaign_id, platform, archived')
      .eq('platform', 'Nextdoor')
      .eq('archived', false)
      .not('nextdoor_campaign_id', 'is', null)

    if (body.campaign_id) {
      query = query.eq('id', body.campaign_id)
    }

    const { data: campaigns, error: campaignError } = await query
    if (campaignError) throw new Error(campaignError.message)
    if (!campaigns?.length) {
      return json({
        ok: true,
        synced: 0,
        message:
          'No Nextdoor campaigns with nextdoor_campaign_id set. Edit the campaign and paste the Nextdoor campaign ID first.',
        results: [],
      })
    }

    const today = todayInLA()
    const defaultEnd = body.end_date || addDays(today, -1) // metrics usually lag; sync through yesterday
    const results: Array<Record<string, unknown>> = []

    for (const campaign of campaigns) {
      const advertiserId = campaign.nextdoor_advertiser_id || defaultAdvertiserId
      const nextdoorCampaignId = campaign.nextdoor_campaign_id
      if (!nextdoorCampaignId) continue

      const endDate = clampDate(defaultEnd, campaign.start_date, campaign.end_date)
      let startDate =
        body.start_date ||
        addDays(endDate, -(lookbackDays - 1))
      if (campaign.start_date && startDate < campaign.start_date) {
        startDate = campaign.start_date
      }
      if (startDate > endDate) {
        results.push({
          campaign_id: campaign.id,
          name: campaign.name,
          skipped: true,
          reason: 'Start date is after end date (campaign may not have started yet)',
        })
        continue
      }

      const days = eachDate(startDate, endDate)
      let upserted = 0
      const dayErrors: string[] = []

      for (const date of days) {
        try {
          const stats = await fetchDayStats(nextdoorToken, advertiserId, nextdoorCampaignId, date)
          const spend = parseMoney(stats.billable_spend)
          const leads = Number(stats.lead_conversions ?? stats.result ?? stats.total_conversions ?? 0) || 0
          const { error } = await admin.from('daily_metrics').upsert(
            {
              campaign_id: campaign.id,
              date,
              impressions: Number(stats.impressions || 0),
              clicks: Number(stats.clicks || 0),
              spend,
              leads,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'campaign_id,date' },
          )
          if (error) throw new Error(error.message)
          upserted += 1
        } catch (err) {
          dayErrors.push(`${date}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      results.push({
        campaign_id: campaign.id,
        name: campaign.name,
        nextdoor_campaign_id: nextdoorCampaignId,
        range: { start: startDate, end: endDate },
        days_requested: days.length,
        upserted,
        errors: dayErrors,
      })
    }

    return json({ ok: true, synced: results.length, results })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

async function fetchDayStats(
  token: string,
  advertiserId: string,
  campaignId: string,
  date: string,
): Promise<NextdoorStats> {
  const url = new URL(
    `${NEXTDOOR_API}/advertisers/${encodeURIComponent(advertiserId)}/campaigns/${encodeURIComponent(campaignId)}/stats`,
  )
  url.searchParams.set('startTime', date)
  url.searchParams.set('endTime', date)

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Nextdoor ${res.status}: ${text.slice(0, 240)}`)
  }
  return (await res.json()) as NextdoorStats
}

function parseMoney(value: string | null | undefined): number {
  if (value == null || value === '') return 0
  const cleaned = String(value).replace(/[^0-9.-]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

function todayInLA(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function clampDate(date: string, min: string | null, max: string | null): string {
  let out = date
  if (min && out < min) out = min
  if (max && out > max) out = max
  return out
}

function eachDate(start: string, end: string): string[] {
  const out: string[] = []
  let cursor = start
  while (cursor <= end) {
    out.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return out
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
