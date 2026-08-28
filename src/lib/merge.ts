// Merging two versions of the data — used when the cloud changed underneath us.
//
// The rule everywhere here is ADDITIVE: when in doubt, keep it. A card flagged
// for sale on either device stays flagged, and every logged offer from either
// device survives. Losing a pick at the table is worse than keeping a stale one,
// which is one tap to undo.

import type { AppData, HistoryPoint, OwnedCard, SellInfo } from '../types'
import { entryKey } from './sell'

function mergeCollections(mine: OwnedCard[], theirs: OwnedCard[]): OwnedCard[] {
  const out = new Map<string, OwnedCard>()
  for (const c of theirs) out.set(entryKey(c), c)
  for (const c of mine) {
    const k = entryKey(c)
    const other = out.get(k)
    if (!other) {
      out.set(k, c)
      continue
    }
    // Same entry on both sides: keep the freshest price, and the larger qty
    // (a qty bump is a deliberate edit; a stale copy shouldn't undo it).
    const mineNewer = (c.priceUpdatedAt ?? '') > (other.priceUpdatedAt ?? '')
    const base = mineNewer ? c : other
    out.set(k, { ...base, qty: Math.max(c.qty, other.qty) })
  }
  return [...out.values()]
}

function mergeSell(
  mine: Record<string, SellInfo>,
  theirs: Record<string, SellInfo>,
): Record<string, SellInfo> {
  const out: Record<string, SellInfo> = {}
  for (const k of new Set([...Object.keys(mine), ...Object.keys(theirs)])) {
    const a = mine[k]
    const b = theirs[k]
    if (!a || !b) {
      out[k] = (a ?? b) as SellInfo
      continue
    }
    // Union the offers by id, newest-logged first when amounts tie.
    const byId = new Map((b.offers ?? []).map((o) => [o.id, o]))
    for (const o of a.offers ?? []) byId.set(o.id, o)
    out[k] = {
      // Flagged on either device wins — this is the "don't unselect me" rule.
      forSale: Boolean(a.forSale || b.forSale),
      askPrice: a.askPrice ?? b.askPrice ?? null,
      offers: [...byId.values()].sort((x, y) => x.at.localeCompare(y.at)),
    }
  }
  return out
}

function mergeHistory(mine: HistoryPoint[], theirs: HistoryPoint[]): HistoryPoint[] {
  const byDate = new Map(theirs.map((h) => [h.date, h]))
  for (const h of mine) byDate.set(h.date, h)
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** Combine this device's state with the copy currently in the cloud. */
export function mergeData(mine: AppData, theirs: AppData): AppData {
  return {
    version: 2,
    collection: mergeCollections(mine.collection ?? [], theirs.collection ?? []),
    history: mergeHistory(mine.history ?? [], theirs.history ?? []),
    sell: mergeSell(mine.sell ?? {}, theirs.sell ?? {}),
    updatedAt: new Date().toISOString(),
  }
}

/** Rewrite sell keys after a card's variant changed (see refreshPrices). */
export function applyRenames(
  sell: Record<string, SellInfo>,
  renames: Array<[string, string]>,
): Record<string, SellInfo> {
  if (renames.length === 0) return sell
  const next = { ...sell }
  for (const [from, to] of renames) {
    if (!next[from]) continue
    const moving = next[from]
    delete next[from]
    // If something already sits at the target key, keep both sides' data.
    next[to] = next[to]
      ? mergeData(
          { version: 2, collection: [], history: [], sell: { x: moving }, updatedAt: '' },
          { version: 2, collection: [], history: [], sell: { x: next[to] }, updatedAt: '' },
        ).sell.x
      : moving
  }
  return next
}
