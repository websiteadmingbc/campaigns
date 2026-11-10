import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button, EmptyState, ErrorMessage, LoadingState, PageHeader, StatusBadge } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate, formatNumber } from '../lib/format'
import { fetchTraditionalCampaigns } from '../lib/traditionalApi'
import type { TraditionalCampaign } from '../lib/traditionalTypes'

export function TraditionalListPage() {
  const { isAdmin } = useAuth()
  const [campaigns, setCampaigns] = useState<TraditionalCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setCampaigns(await fetchTraditionalCampaigns(false))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load traditional campaigns')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) return <LoadingState label="Loading traditional efforts…" />

  return (
    <div>
      <PageHeader
        title="Traditional marketing"
        subtitle="Door hangers, flyers, and promo cards — tracked separately from digital ads"
        actions={
          isAdmin ? (
            <Link to="/traditional/new">
              <Button>
                <Plus size={16} />
                Add effort
              </Button>
            </Link>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} onRetry={load} />
        </div>
      )}

      {campaigns.length === 0 ? (
        <EmptyState
          title="No traditional efforts yet"
          description="Track print drops like local shop flyers, door hangers, and promo cards with QR codes and short URLs."
          action={
            isAdmin ? (
              <Link to="/traditional/new">
                <Button>Add first effort</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="card-surface overflow-hidden">
          <ul className="divide-y divide-[var(--color-border)]">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/traditional/${c.id}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3.5 hover:bg-[var(--color-surface)] transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium truncate">{c.name}</p>
                      <StatusBadge status={c.status} />
                      <span className="text-xs rounded-md px-2 py-0.5 bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]">
                        {c.material_type}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-muted)] truncate">
                      {c.start_date ? formatDate(c.start_date) : 'No start'}
                      {c.end_date ? ` – ${formatDate(c.end_date)}` : ''}
                      {c.short_url ? ` · ${c.short_url}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-4 text-xs sm:text-sm text-[var(--color-ink-muted)]">
                    <span>Cost {formatCurrency(c.material_cost)}</span>
                    <span>Distributed {formatNumber(c.quantity_distributed)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
