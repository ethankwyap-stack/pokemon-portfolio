// Read-only view of a collection someone shared by link.
//
// Nothing here touches localStorage. Opening a share link must never disturb
// the viewer's own collection — that is the whole safety property of the
// feature, so this component takes its data as a prop and writes nothing.

import { useMemo, useState } from 'react'
import type { SharedPortfolio } from '../lib/share'
import { variantLabel } from '../lib/api'
import { usd } from '../lib/format'
import { Badge, Button } from './ui'

type SortMode = 'value' | 'name'

export default function SharedView({ data }: { data: SharedPortfolio }) {
  const [sortMode, setSortMode] = useState<SortMode>('value')

  const total = useMemo(
    () => data.cards.reduce((sum, c) => sum + (c.priceMarket ?? 0) * c.qty, 0),
    [data],
  )
  const count = useMemo(() => data.cards.reduce((sum, c) => sum + c.qty, 0), [data])

  const sorted = useMemo(
    () =>
      [...data.cards].sort((a, b) =>
        sortMode === 'name'
          ? a.name.localeCompare(b.name)
          : (b.priceMarket ?? 0) * b.qty - (a.priceMarket ?? 0) * a.qty,
      ),
    [data, sortMode],
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-ink">
          Poké<span className="text-neon">Folio</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          Shared collection from <span className="text-ink">{data.from}</span> ·{' '}
          {new Date(data.at).toLocaleDateString('en-US')}
        </p>
      </header>

      <section className="mb-5 rounded-2xl border border-neon/30 bg-surface p-5">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Total value</p>
            <p className="text-2xl font-bold text-neon">{usd(total)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Cards</p>
            <p className="text-2xl font-bold text-ink">{count}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Different cards</p>
            <p className="text-2xl font-bold text-ink">{data.cards.length}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          A read-only snapshot at TCGplayer market prices when the link was made. Nothing here is
          saved, and your own collection is untouched.
        </p>
      </section>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Their cards</h2>
        {data.cards.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-muted">
            Sort
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-ink outline-none focus:border-neon"
            >
              <option value="value">Highest value</option>
              <option value="name">Name</option>
            </select>
          </label>
        )}
      </div>

      {data.cards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
          This link has no cards in it.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {sorted.map((card, i) => (
            <div
              key={`${card.name}|${card.number}|${card.variant}|${i}`}
              className="flex flex-col rounded-xl border border-border bg-surface p-3"
            >
              {card.imageSmall ? (
                <img
                  src={card.imageSmall}
                  alt={card.name}
                  loading="lazy"
                  className="w-full rounded-lg"
                />
              ) : (
                <div className="flex aspect-[5/7] w-full items-center justify-center rounded-lg border border-dashed border-border px-2 text-center text-xs text-muted">
                  no photo
                </div>
              )}
              <div className="mt-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{card.name}</p>
                  <p className="truncate text-xs text-muted">
                    {card.setName} · #{card.number}
                  </p>
                </div>
                {card.rarity && (
                  <span className="max-w-[45%] shrink-0" title={card.rarity}>
                    <Badge tone="accent">{card.rarity}</Badge>
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-muted">{variantLabel(card.variant)}</p>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-sm text-muted">×{card.qty}</span>
                <span className="font-semibold text-ink">
                  {usd(card.priceMarket != null ? card.priceMarket * card.qty : null)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Button
          variant="ghost"
          onClick={() => {
            location.hash = ''
            location.reload()
          }}
        >
          Open my own PokéFolio
        </Button>
      </div>
    </div>
  )
}
