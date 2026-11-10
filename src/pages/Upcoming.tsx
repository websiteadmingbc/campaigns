import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, eachDayOfInterval, endOfMonth, format, isSameMonth, parseISO, startOfMonth } from 'date-fns'
import { Button, EmptyState, ErrorMessage, LoadingState, PageHeader, StatusBadge } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { fetchCampaigns } from '../lib/api'
import { formatDate, todayLA } from '../lib/format'
import type { Campaign } from '../lib/types'

export function UpcomingPage() {
  const { isAdmin } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date(`${todayLA()}T12:00:00`)))

  useEffect(() => {
    fetchCampaigns(false)
      .then(setCampaigns)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const upcoming = useMemo(() => {
    const today = todayLA()
    return campaigns
      .filter((c) => {
        if (c.status === 'Scheduled') return true
        if (c.start_date && c.start_date > today) return true
        if (c.status === 'Active' && c.end_date && c.end_date >= today) return true
        return false
      })
      .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''))
  }, [campaigns])

  const days = useMemo(() => {
    const start = startOfMonth(monthCursor)
    const end = endOfMonth(monthCursor)
    // Pad to Monday start
    const startPad = addDays(start, -((start.getDay() + 6) % 7))
    const endPad = addDays(end, (7 - ((end.getDay() + 6) % 7)) % 7)
    return eachDayOfInterval({ start: startPad, end: endPad })
  }, [monthCursor])

  const campaignsByDay = useMemo(() => {
    const map = new Map<string, Campaign[]>()
    for (const c of campaigns) {
      if (!c.start_date) continue
      const key = c.start_date
      const list = map.get(key) || []
      list.push(c)
      map.set(key, list)
    }
    return map
  }, [campaigns])

  if (loading) return <LoadingState />

  return (
    <div>
      <PageHeader
        title="Upcoming"
        subtitle="Scheduled and active campaigns on a planning timeline"
        actions={
          isAdmin ? (
            <Link to="/campaigns/new">
              <Button>New campaign</Button>
            </Link>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} />
        </div>
      )}

      <section className="card-surface p-4 sm:p-6 mb-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{format(monthCursor, 'MMMM yyyy')}</h2>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setMonthCursor((d) => startOfMonth(addDays(d, -15)))}
            >
              Prev
            </Button>
            <Button
              variant="secondary"
              onClick={() => setMonthCursor(startOfMonth(new Date(`${todayLA()}T12:00:00`)))}
            >
              Today
            </Button>
            <Button
              variant="secondary"
              onClick={() => setMonthCursor((d) => startOfMonth(addDays(endOfMonth(d), 1)))}
            >
              Next
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-[var(--color-ink-muted)] mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const items = campaignsByDay.get(key) || []
            const inMonth = isSameMonth(day, monthCursor)
            const isToday = key === todayLA()
            return (
              <div
                key={key}
                className={`min-h-20 rounded-lg border p-1.5 text-left ${
                  inMonth ? 'border-[var(--color-border)] bg-white' : 'border-transparent bg-transparent opacity-40'
                } ${isToday ? 'ring-2 ring-[var(--accent)]' : ''}`}
              >
                <p className="text-xs font-medium mb-1">{format(day, 'd')}</p>
                <div className="space-y-1">
                  {items.map((c) => (
                    <Link
                      key={c.id}
                      to={`/campaigns/${c.id}`}
                      className="block truncate rounded px-1 py-0.5 text-[10px] sm:text-xs font-medium"
                      style={{ background: 'color-mix(in srgb, var(--accent) 22%, white)' }}
                      title={c.name}
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Timeline</h2>
        {upcoming.length === 0 ? (
          <EmptyState
            title="Nothing upcoming"
            description="Scheduled campaigns and active runs will appear on this timeline."
          />
        ) : (
          <div className="space-y-3">
            {upcoming.map((c) => {
              const start = c.start_date ? parseISO(`${c.start_date}T12:00:00`) : null
              const end = c.end_date ? parseISO(`${c.end_date}T12:00:00`) : null
              return (
                <Link
                  key={c.id}
                  to={`/campaigns/${c.id}`}
                  className="card-surface block p-4 hover:bg-[var(--color-surface)] transition"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <p className="font-medium">{c.name}</p>
                    <StatusBadge status={c.status} />
                    <span className="text-xs text-[var(--color-ink-muted)]">{c.platform}</span>
                  </div>
                  <div className="relative h-3 rounded-full bg-[var(--color-border)] overflow-hidden">
                    <div
                      className="absolute inset-y-0 rounded-full"
                      style={{
                        left: '0%',
                        width: '100%',
                        background: 'color-mix(in srgb, var(--accent) 55%, #d4d4d4)',
                        opacity: 0.9,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
                    {start ? formatDate(c.start_date) : 'No start'}
                    {end ? ` → ${formatDate(c.end_date)}` : ''}
                    {c.duration_days ? ` · ${c.duration_days} days` : ''}
                  </p>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
