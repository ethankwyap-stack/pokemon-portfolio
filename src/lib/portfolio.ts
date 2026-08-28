// Portfolio math and price refreshing.

import type { ApiCard, HistoryPoint, OwnedCard } from '../types'
import { getCardsByIds, marketPrice, pickVariant, variantOptions } from './api'

/** Total market value of the collection (qty-weighted; unpriced cards count 0). */
export function totalValue(collection: OwnedCard[]): number {
  return collection.reduce((sum, c) => sum + (c.priceMarket ?? 0) * c.qty, 0)
}

export function totalCards(collection: OwnedCard[]): number {
  return collection.reduce((sum, c) => sum + c.qty, 0)
}

/** Build an OwnedCard entry from an API card. */
export function toOwnedCard(card: ApiCard, variant?: string): OwnedCard {
  const v = variant ?? pickVariant(card)
  return {
    cardId: card.id,
    name: card.name,
    number: card.number,
    setId: card.set.id,
    setName: card.set.name,
    rarity: card.rarity,
    imageSmall: card.images.small,
    imageLarge: card.images.large,
    tcgplayerUrl: card.tcgplayer?.url,
    variant: v,
    variants: variantOptions(card),
    qty: 1,
    priceMarket: marketPrice(card, v),
    priceUpdatedAt: card.tcgplayer?.updatedAt,
    addedAt: new Date().toISOString(),
  }
}

/** Refresh prices (and variant lists) for the whole collection from the API.
 *  Returns a new array; cards the API didn't return keep their stale price. */
/** Refresh prices (and variant lists) for the whole collection from the API.
 *  Cards the API didn't return keep their stale price.
 *
 *  `renames` reports entries whose variant had to change because the API no
 *  longer lists the old one. Sell-tab state is keyed by `cardId|variant`, so the
 *  caller MUST apply these renames or a card silently loses its for-sale flag
 *  and its logged offers on the next page load. */
export async function refreshPrices(
  collection: OwnedCard[],
): Promise<{ collection: OwnedCard[]; renames: Array<[string, string]> }> {
  if (collection.length === 0) return { collection, renames: [] }
  const ids = [...new Set(collection.map((c) => c.cardId))]
  const fresh = await getCardsByIds(ids)
  const byId = new Map(fresh.map((c) => [c.id, c]))
  const renames: Array<[string, string]> = []
  const next = collection.map((owned) => {
    const card = byId.get(owned.cardId)
    if (!card) return owned
    const variants = variantOptions(card)
    // Keep the user's chosen variant if it still exists, else fall back.
    const variant = variants.includes(owned.variant) ? owned.variant : pickVariant(card)
    if (variant !== owned.variant) {
      renames.push([`${owned.cardId}|${owned.variant}`, `${owned.cardId}|${variant}`])
    }
    return {
      ...owned,
      variant,
      variants,
      tcgplayerUrl: card.tcgplayer?.url ?? owned.tcgplayerUrl,
      priceMarket: marketPrice(card, variant),
      priceUpdatedAt: card.tcgplayer?.updatedAt ?? owned.priceUpdatedAt,
    }
  })
  return { collection: next, renames }
}

export function todayKey(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** Append (or update) today's snapshot. Auto mode records at most one per day;
 *  manual snapshots overwrite today's point with the latest total. */
export function recordSnapshot(
  history: HistoryPoint[],
  total: number,
  { overwriteToday = false }: { overwriteToday?: boolean } = {},
): HistoryPoint[] {
  const date = todayKey()
  const existing = history.find((h) => h.date === date)
  if (existing && !overwriteToday) return history
  const rest = history.filter((h) => h.date !== date)
  return [...rest, { date, totalValue: total }].sort((a, b) => a.date.localeCompare(b.date))
}
