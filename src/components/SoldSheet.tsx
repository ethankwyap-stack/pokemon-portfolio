// The Sold tab — what actually happened, in cash.
//
// The Sell tab is a plan; this is the receipt. Every row is money already in
// your pocket, so the headline number is cash received and the honest second
// number is what percentage of market that came to.

import { useMemo } from 'react'
import type { OwnedCard, Sale, SellInfo } from '../types'
import { usd } from '../lib/format'
import { entryKey, rateOffer, soldEntries, soldTotals } from '../lib/sell'

interface Props {
  collection: OwnedCard[]
  sell: Record<string, SellInfo>
  onUnsell: (card: OwnedCard) => void
}

const toneText: Record<string, string> = {
  good: 'text-neon',
  ok: 'text-ink',
  low: 'text-accent',
  bad: 'text-danger',
  none: 'text-muted',
}

/** Group sales by calendar day, newest day first — one show is usually one day. */
function byDay(entries: Array<{ card: OwnedCard; sale: Sale }>) {
  const days = new Map<string, Array<{ card: OwnedCard; sale: Sale }>>()
  for (const e of entries) {
    const day = e.sale.at.slice(0, 10)
    const list = days.get(day)
    if (list) list.push(e)
    else days.set(day, [e])
  }
  return [...days.entries()].sort((a, b) => b[0].localeCompare(a[0]))
}

export default function SoldSheet({ collection, sell, onUnsell }: Props) {
  const entries = useMemo(() => soldEntries(collection, sell), [collection, sell])
  const totals = useMemo(() => soldTotals(entries), [entries])
  const days = useMemo(() => byDay(entries), [entries])

  if (entries.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
        Nothing sold yet. When a vendor pays you, open the <strong className="text-ink">Sell</strong>{' '}
        tab, find the card, and tap <strong className="text-ink">Sold</strong>.
      </p>
    )
  }

  const rating = totals.pct != null ? rateOffer(totals.cash, totals.market) : null

  return (
    <div className="flex flex-col gap-4">
      {/* The only number that matters after a show. */}
      <div className="rounded-2xl border border-neon/30 bg-surface p-4 shadow-[0_0_24px_rgba(0,224,164,0.08)]">
        <p className="text-sm text-muted">Cash received</p>
        <p className="text-3xl font-bold tabular-nums text-neon">{usd(totals.cash)}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Cards sold</p>
            <p className="text-lg font-bold tabular-nums text-ink">{totals.count}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">They were worth</p>
            <p className="text-lg font-bold tabular-nums text-ink">{usd(totals.market)}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">You got</p>
            <p className={`text-lg font-bold tabular-nums ${rating ? toneText[rating.tone] : 'text-muted'}`}>
              {totals.pct != null ? `${Math.round(totals.pct * 100)}%` : '—'}
            </p>
          </div>
        </div>
        {rating && (
          <p className="mt-3 text-sm text-muted">
            {rating.tone === 'good' && 'Strong day — 70% or more of market in cash is a good deal.'}
            {rating.tone === 'ok' && 'Fair day — 60% of market is the normal walk-up cash rate.'}
            {rating.tone === 'low' && 'On the low side. 50% is the floor; below that, walk away next time.'}
            {rating.tone === 'bad' && 'Below 50% of market. That is lowball territory — hold out longer next time.'}
          </p>
        )}
      </div>

      {days.map(([day, list]) => {
        const dayTotals = soldTotals(list)
        return (
          <section key={day} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-base font-semibold text-ink">
                {new Date(`${day}T12:00:00`).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </h2>
              <p className="text-sm text-muted">
                <span className="font-semibold text-neon tabular-nums">{usd(dayTotals.cash)}</span>
                {dayTotals.pct != null && ` · ${Math.round(dayTotals.pct * 100)}% of market`}
              </p>
            </div>
            {list.map(({ card, sale }) => (
              <SoldRow key={entryKey(card)} card={card} sale={sale} onUnsell={onUnsell} />
            ))}
          </section>
        )
      })}

      <p className="rounded-xl border border-border bg-surface-2 p-3 text-xs text-muted">
        Sold cards stay in your Portfolio so nothing disappears by accident. Remove them there when
        you get home, or leave them — the Sell tab already skips them.
      </p>
    </div>
  )
}

/** Card thumbnail that degrades to a label when a hand-entered card has no photo. */
function Thumb({ card, className }: { card: OwnedCard; className: string }) {
  if (card.imageSmall) {
    return <img src={card.imageSmall} alt="" className={`${className} shrink-0 rounded-lg object-cover`} />
  }
  return (
    <div
      className={`${className} flex shrink-0 items-center justify-center rounded-lg border border-dashed border-border px-1 text-center text-[10px] leading-tight text-muted`}
    >
      {card.language ?? 'no photo'}
    </div>
  )
}

function SoldRow({
  card,
  sale,
  onUnsell,
}: {
  card: OwnedCard
  sale: Sale
  onUnsell: Props['onUnsell']
}) {
  const rating = rateOffer(sale.amount, sale.marketAtSale)
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <Thumb card={card} className="h-16 w-[46px]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {card.name}
          {sale.qty > 1 && <span className="text-muted"> ×{sale.qty}</span>}
        </p>
        <p className="truncate text-xs text-muted">
          {card.setName}
          {card.number && ` · #${card.number}`}
        </p>
        <p className="mt-1 truncate text-xs text-muted">
          to <span className="text-ink">{sale.vendor}</span>
          {sale.note && ` · ${sale.note}`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-base font-bold tabular-nums text-neon">{usd(sale.amount)}</p>
        <p className={`text-xs tabular-nums ${toneText[rating.tone]}`}>
          {rating.pct != null ? `${Math.round(rating.pct * 100)}% ${rating.label}` : rating.label}
        </p>
        <button
          onClick={() => {
            if (confirm(`Undo the sale of ${card.name}? It goes back on the sell list.`)) {
              onUnsell(card)
            }
          }}
          className="mt-1 text-xs text-muted underline hover:text-danger"
        >
          Undo
        </button>
      </div>
    </div>
  )
}
