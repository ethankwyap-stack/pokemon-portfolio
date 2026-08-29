// Sell-tab math: the cash-offer ladder and per-card sell state.
//
// The ladder percentages come from what vendors actually pay walk-up sellers at
// shows: ~70% of TCGplayer market is a strong cash offer, ~60% is normal, and
// below ~50% is a lowball worth walking away from.

import type { OwnedCard, Offer, Sale, SellInfo } from '../types'

export const LADDER = [
  { pct: 0.7, label: 'Great', tone: 'good' as const },
  { pct: 0.6, label: 'Fair', tone: 'ok' as const },
  { pct: 0.5, label: 'Floor', tone: 'low' as const },
]

export const entryKey = (c: { cardId: string; variant: string }) => `${c.cardId}|${c.variant}`

export const emptySell = (): SellInfo => ({ forSale: false, offers: [] })

export function sellFor(sell: Record<string, SellInfo>, card: OwnedCard): SellInfo {
  return sell[entryKey(card)] ?? emptySell()
}

/** Line value of this entry at market (qty-weighted). */
export function lineMarket(card: OwnedCard): number {
  return (card.priceMarket ?? 0) * card.qty
}

/** The three cash lines for one entry. */
export function ladderFor(card: OwnedCard) {
  const market = lineMarket(card)
  return LADDER.map((step) => ({ ...step, amount: market * step.pct }))
}

/** Rate an offer against market: >=70% great, >=60% fair, >=50% low, else lowball. */
export function rateOffer(amount: number, market: number) {
  if (market <= 0) return { label: 'No price', tone: 'none' as const, pct: null }
  const pct = amount / market
  if (pct >= 0.7) return { label: 'Great', tone: 'good' as const, pct }
  if (pct >= 0.6) return { label: 'Fair', tone: 'ok' as const, pct }
  if (pct >= 0.5) return { label: 'Low', tone: 'low' as const, pct }
  return { label: 'Lowball', tone: 'bad' as const, pct }
}

export function bestOffer(offers: Offer[]): Offer | null {
  if (offers.length === 0) return null
  return offers.reduce((best, o) => (o.amount > best.amount ? o : best))
}

export function newOffer(vendor: string, amount: number, note?: string): Offer {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    vendor: vendor.trim() || 'Unnamed table',
    amount,
    note: note?.trim() || undefined,
    at: new Date().toISOString(),
  }
}

/** True once cash has changed hands for this entry. */
export function isSold(info: SellInfo): boolean {
  return Boolean(info.sale)
}

/** Cards flagged for sale and NOT yet sold, highest market value first.
 *  Sold cards leave the pile so the running totals stop counting money you
 *  have already collected. */
export function forSaleCards(
  collection: OwnedCard[],
  sell: Record<string, SellInfo>,
): OwnedCard[] {
  return collection
    .filter((c) => {
      const info = sellFor(sell, c)
      return info.forSale && !isSold(info)
    })
    .sort((a, b) => lineMarket(b) - lineMarket(a))
}

/** Build a Sale record. `marketAtSale` is frozen here on purpose: the daily
 *  price refresh would otherwise rewrite history and change what percentage you
 *  "got" for a card weeks after the fact. */
export function newSale(
  vendor: string,
  amount: number,
  qty: number,
  marketAtSale: number,
  note?: string,
): Sale {
  return {
    vendor: vendor.trim() || 'Unnamed table',
    amount,
    qty: Math.max(1, Math.round(qty) || 1),
    marketAtSale,
    note: note?.trim() || undefined,
    at: new Date().toISOString(),
  }
}

/** Every sold entry, newest sale first, paired with its Sale record. */
export function soldEntries(
  collection: OwnedCard[],
  sell: Record<string, SellInfo>,
): Array<{ card: OwnedCard; sale: Sale }> {
  const out: Array<{ card: OwnedCard; sale: Sale }> = []
  for (const card of collection) {
    const sale = sellFor(sell, card).sale
    if (sale) out.push({ card, sale })
  }
  return out.sort((a, b) => b.sale.at.localeCompare(a.sale.at))
}

/** How the day actually went: cash in, what it was worth, and the blended
 *  percentage of market you achieved. */
export function soldTotals(entries: Array<{ sale: Sale }>) {
  const cash = entries.reduce((sum, e) => sum + e.sale.amount, 0)
  const market = entries.reduce((sum, e) => sum + e.sale.marketAtSale, 0)
  return {
    cash,
    market,
    count: entries.length,
    pct: market > 0 ? cash / market : null,
  }
}

/** Totals across the for-sale pile at each ladder step. */
export function pileTotals(cards: OwnedCard[]) {
  const market = cards.reduce((sum, c) => sum + lineMarket(c), 0)
  return {
    market,
    steps: LADDER.map((step) => ({ ...step, amount: market * step.pct })),
  }
}

/** Sum of the best logged offer per card, for cards that have one. */
export function bestOffersTotal(
  cards: OwnedCard[],
  sell: Record<string, SellInfo>,
): { total: number; count: number } {
  let total = 0
  let count = 0
  for (const c of cards) {
    const best = bestOffer(sellFor(sell, c).offers)
    if (best) {
      total += best.amount
      count += 1
    }
  }
  return { total, count }
}
