// Sell-tab math: the cash-offer ladder and per-card sell state.
//
// The ladder percentages come from what vendors actually pay walk-up sellers at
// shows: ~70% of TCGplayer market is a strong cash offer, ~60% is normal, and
// below ~50% is a lowball worth walking away from.

import type { OwnedCard, Offer, SellInfo } from '../types'

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

/** Cards flagged for sale, highest market value first. */
export function forSaleCards(
  collection: OwnedCard[],
  sell: Record<string, SellInfo>,
): OwnedCard[] {
  return collection
    .filter((c) => sellFor(sell, c).forSale)
    .sort((a, b) => lineMarket(b) - lineMarket(a))
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
