// Headline stats: total value, counts, price freshness, manual snapshot.

import type { OwnedCard } from '../types'
import { totalCards, totalValue } from '../lib/portfolio'
import { usd } from '../lib/format'
import { Button } from './ui'

interface Props {
  collection: OwnedCard[]
  refreshing: boolean
  onSnapshot: () => void
}

export default function PortfolioSummary({ collection, refreshing, onSnapshot }: Props) {
  const updatedAt = collection
    .map((c) => c.priceUpdatedAt)
    .filter(Boolean)
    .sort()
    .at(-1)

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-border bg-surface p-5">
      <div>
        <p className="text-sm text-muted">Portfolio value</p>
        <p className="text-3xl font-bold text-neon drop-shadow-[0_0_12px_rgba(0,224,164,0.35)]">
          {usd(totalValue(collection))}
        </p>
      </div>
      <div>
        <p className="text-sm text-muted">Cards</p>
        <p className="text-xl font-semibold text-ink">{totalCards(collection)}</p>
      </div>
      <div>
        <p className="text-sm text-muted">Unique</p>
        <p className="text-xl font-semibold text-ink">{collection.length}</p>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <p className="text-xs text-muted">
          {refreshing ? 'Refreshing prices…' : updatedAt ? `Prices updated ${updatedAt}` : ''}
        </p>
        <Button variant="ghost" onClick={onSnapshot} disabled={collection.length === 0}>
          Snapshot now
        </Button>
      </div>
    </div>
  )
}
