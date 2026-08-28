// The Sell tab — built to be read one-handed at a noisy card show.
//
// Per card: the cash ladder (70/60/50% of market) and a log of what each vendor
// offered, so offers can be compared before committing to one table.

import { useMemo, useState } from 'react'
import type { OwnedCard, SellInfo } from '../types'
import { usd } from '../lib/format'
import {
  bestOffer,
  bestOffersTotal,
  entryKey,
  forSaleCards,
  ladderFor,
  lineMarket,
  pileTotals,
  rateOffer,
  sellFor,
} from '../lib/sell'
import { Button } from './ui'

interface Props {
  collection: OwnedCard[]
  sell: Record<string, SellInfo>
  onToggleForSale: (card: OwnedCard, forSale: boolean) => void
  onAddOffer: (card: OwnedCard, vendor: string, amount: number, note?: string) => void
  onRemoveOffer: (card: OwnedCard, offerId: string) => void
}

/** Filter by card name, set name, or collector number. */
function matches(cards: OwnedCard[], query: string): OwnedCard[] {
  const q = query.trim().toLowerCase()
  if (!q) return cards
  return cards.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.setName.toLowerCase().includes(q) ||
      c.number.toLowerCase().includes(q),
  )
}

const toneText: Record<string, string> = {
  good: 'text-neon',
  ok: 'text-ink',
  low: 'text-accent',
  bad: 'text-danger',
  none: 'text-muted',
}

export default function SellSheet({
  collection,
  sell,
  onToggleForSale,
  onAddOffer,
  onRemoveOffer,
}: Props) {
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')
  const [pileQuery, setPileQuery] = useState('')

  const pile = useMemo(() => forSaleCards(collection, sell), [collection, sell])
  // Totals always cover the WHOLE pile, never just the search hits — a filtered
  // total would quietly misreport what the bag is worth.
  const totals = useMemo(() => pileTotals(pile), [pile])
  const offersTotal = useMemo(() => bestOffersTotal(pile, sell), [pile, sell])

  const shownPile = useMemo(() => matches(pile, pileQuery), [pile, pileQuery])

  // Checked cards stay pinned to the top of the picker even when they don't
  // match the search, so filtering can never look like it un-picked something.
  const pickList = useMemo(() => {
    const byValue = [...collection].sort((a, b) => lineMarket(b) - lineMarket(a))
    const hits = matches(byValue, query)
    const hitKeys = new Set(hits.map(entryKey))
    const pinned = byValue.filter((c) => sellFor(sell, c).forSale && !hitKeys.has(entryKey(c)))
    return { pinned, hits }
  }, [collection, query, sell])

  if (collection.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
        Add cards to your collection first, then flag the ones you're bringing to the show.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Running totals — the number you actually care about at the table. */}
      <div className="rounded-2xl border border-neon/30 bg-surface p-4 shadow-[0_0_24px_rgba(0,224,164,0.08)]">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-muted">Bringing {pile.length} cards</p>
          <p className="text-sm text-muted">Market {usd(totals.market)}</p>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {totals.steps.map((step) => (
            <div key={step.pct} className="rounded-xl border border-border bg-surface-2 p-3">
              <p className="text-xs text-muted">
                {step.label} · {Math.round(step.pct * 100)}%
              </p>
              <p className={`text-lg font-bold tabular-nums ${toneText[step.tone]}`}>
                {usd(step.amount)}
              </p>
            </div>
          ))}
        </div>
        {offersTotal.count > 0 && (
          <p className="mt-3 text-sm text-ink">
            Best offers so far:{' '}
            <span className="font-bold text-neon tabular-nums">{usd(offersTotal.total)}</span>{' '}
            <span className="text-muted">
              across {offersTotal.count} of {pile.length} cards
            </span>
          </p>
        )}
      </div>

      <Button variant={picking ? 'primary' : 'ghost'} onClick={() => setPicking((p) => !p)}>
        {picking ? 'Done picking' : 'Pick cards to bring'}
      </Button>

      {picking && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your collection…"
            className="mb-3 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-base text-ink outline-none focus:border-neon"
          />
          <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
            {pickList.pinned.length > 0 && (
              <p className="px-1 pt-1 text-xs text-muted">
                Already picked ({pickList.pinned.length}) — kept here so the search can't hide them
              </p>
            )}
            {pickList.pinned.map((card) => (
              <PickRow
                key={entryKey(card)}
                card={card}
                checked
                onToggleForSale={onToggleForSale}
              />
            ))}

            {pickList.pinned.length > 0 && pickList.hits.length > 0 && (
              <p className="px-1 pt-2 text-xs text-muted">Everything else</p>
            )}
            {pickList.hits.map((card) => (
              <PickRow
                key={entryKey(card)}
                card={card}
                checked={sellFor(sell, card).forSale}
                onToggleForSale={onToggleForSale}
              />
            ))}

            {pickList.hits.length === 0 && pickList.pinned.length === 0 && (
              <p className="p-4 text-center text-sm text-muted">No cards match “{query}”.</p>
            )}
          </div>
        </div>
      )}

      {pile.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
          Nothing flagged yet. Tap “Pick cards to bring” and check the ones you're selling.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <input
              value={pileQuery}
              onChange={(e) => setPileQuery(e.target.value)}
              placeholder={`Search your ${pile.length} cards…`}
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-base text-ink outline-none focus:border-neon"
            />
            {pileQuery && (
              <Button variant="subtle" onClick={() => setPileQuery('')}>
                Clear
              </Button>
            )}
          </div>
          {pileQuery && (
            <p className="text-xs text-muted">
              Showing {shownPile.length} of {pile.length}. Searching only hides rows — nothing is
              un-picked, and the totals above still cover all {pile.length}.
            </p>
          )}
          {shownPile.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-muted">
              None of your picked cards match “{pileQuery}”.
            </p>
          )}
          {shownPile.map((card) => (
            <SellRow
              key={entryKey(card)}
              card={card}
              info={sellFor(sell, card)}
              onToggleForSale={onToggleForSale}
              onAddOffer={onAddOffer}
              onRemoveOffer={onRemoveOffer}
            />
          ))}
        </div>
      )}
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

function PickRow({
  card,
  checked,
  onToggleForSale,
}: {
  card: OwnedCard
  checked: boolean
  onToggleForSale: Props['onToggleForSale']
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2 ${
        checked ? 'border-neon/50 bg-neon/5' : 'border-border bg-surface-2'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggleForSale(card, e.target.checked)}
        className="h-5 w-5 shrink-0 accent-[#00e0a4]"
      />
      <Thumb card={card} className="h-12 w-9" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink">{card.name}</span>
        <span className="block truncate text-xs text-muted">
          {card.setName} · #{card.number} · x{card.qty}
        </span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-neon">
        {usd(lineMarket(card))}
      </span>
    </label>
  )
}

function SellRow({
  card,
  info,
  onToggleForSale,
  onAddOffer,
  onRemoveOffer,
}: {
  card: OwnedCard
  info: SellInfo
  onToggleForSale: Props['onToggleForSale']
  onAddOffer: Props['onAddOffer']
  onRemoveOffer: Props['onRemoveOffer']
}) {
  const [open, setOpen] = useState(false)
  const [vendor, setVendor] = useState('')
  const [amount, setAmount] = useState('')

  const market = lineMarket(card)
  const ladder = ladderFor(card)
  const best = bestOffer(info.offers)
  const bestRating = best ? rateOffer(best.amount, market) : null

  function submit() {
    const n = Number.parseFloat(amount)
    if (!Number.isFinite(n) || n <= 0) return
    onAddOffer(card, vendor, n)
    setVendor('')
    setAmount('')
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex gap-3">
        <Thumb card={card} className="h-24 w-[68px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink">{card.name}</p>
          <p className="truncate text-xs text-muted">
            {card.setName} · #{card.number} · x{card.qty}
          </p>
          <p className="mt-1 text-sm text-muted">
            Market <span className="font-semibold text-ink tabular-nums">{usd(market)}</span>
          </p>
          {best && bestRating && (
            <p className="mt-1 text-sm">
              Best offer{' '}
              <span className={`font-bold tabular-nums ${toneText[bestRating.tone]}`}>
                {usd(best.amount)}
              </span>{' '}
              <span className="text-muted">
                ({bestRating.pct != null ? `${Math.round(bestRating.pct * 100)}% · ` : ''}
                {best.vendor})
              </span>
            </p>
          )}
        </div>
      </div>

      {/* The ladder — glance at this while a vendor is talking. */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {ladder.map((step) => (
          <div key={step.pct} className="rounded-lg border border-border bg-surface-2 px-2 py-1.5">
            <p className="text-[11px] text-muted">
              {step.label} {Math.round(step.pct * 100)}%
            </p>
            <p className={`text-base font-bold tabular-nums ${toneText[step.tone]}`}>
              {usd(step.amount)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Button variant="subtle" className="flex-1" onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide offers' : `Offers (${info.offers.length})`}
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            // Offers are typed in by hand at a table; never drop them on one tap.
            if (
              info.offers.length > 0 &&
              !confirm(
                `Take ${card.name} off the sell list? Its ${info.offers.length} logged offer${
                  info.offers.length === 1 ? '' : 's'
                } stay saved if you put it back.`,
              )
            ) {
              return
            }
            onToggleForSale(card, false)
          }}
        >
          Not selling
        </Button>
      </div>

      {open && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex gap-2">
            <input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Table / vendor"
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-base text-ink outline-none focus:border-neon"
            />
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              inputMode="decimal"
              placeholder="$"
              className="w-24 shrink-0 rounded-lg border border-border bg-surface-2 px-3 py-2 text-base text-ink outline-none focus:border-neon"
            />
            <Button onClick={submit}>Log</Button>
          </div>

          {info.offers.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {[...info.offers]
                .sort((a, b) => b.amount - a.amount)
                .map((o) => {
                  const r = rateOffer(o.amount, market)
                  return (
                    <li
                      key={o.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2 py-1.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{o.vendor}</span>
                      <span className={`text-sm font-bold tabular-nums ${toneText[r.tone]}`}>
                        {usd(o.amount)}
                      </span>
                      <span className={`w-20 text-right text-xs ${toneText[r.tone]}`}>
                        {r.pct != null ? `${Math.round(r.pct * 100)}% ${r.label}` : r.label}
                      </span>
                      <button
                        onClick={() => onRemoveOffer(card, o.id)}
                        className="shrink-0 px-1 text-muted hover:text-danger"
                        aria-label="Delete offer"
                      >
                        ×
                      </button>
                    </li>
                  )
                })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
