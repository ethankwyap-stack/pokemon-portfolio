// localStorage persistence under the `poke.` namespace.
// All reads/writes are try/catch guarded with graceful fallback.

import type { OwnedCard, HistoryPoint, ApiSet, SellInfo, AppData } from '../types'

const KEYS = {
  collection: 'poke.collection',
  history: 'poke.history',
  setsCache: 'poke.setsCache',
  sell: 'poke.sell',
} as const

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or unavailable — keep going in-memory */
  }
}

export function loadCollection(): OwnedCard[] {
  return load<OwnedCard[]>(KEYS.collection, [])
}
export function saveCollection(collection: OwnedCard[]): void {
  save(KEYS.collection, collection)
}

export function loadHistory(): HistoryPoint[] {
  return load<HistoryPoint[]>(KEYS.history, [])
}
export function saveHistory(history: HistoryPoint[]): void {
  save(KEYS.history, history)
}

interface SetsCache {
  fetchedAt: string
  sets: ApiSet[]
}

/** Cached set list (refreshed when older than 7 days). */
export function loadSetsCache(): ApiSet[] | null {
  const cache = load<SetsCache | null>(KEYS.setsCache, null)
  if (!cache) return null
  const ageMs = Date.now() - new Date(cache.fetchedAt).getTime()
  if (ageMs > 7 * 24 * 60 * 60 * 1000) return null
  return cache.sets
}
export function saveSetsCache(sets: ApiSet[]): void {
  save(KEYS.setsCache, { fetchedAt: new Date().toISOString(), sets })
}

export function loadSell(): Record<string, SellInfo> {
  return load<Record<string, SellInfo>>(KEYS.sell, {})
}
export function saveSell(sell: Record<string, SellInfo>): void {
  save(KEYS.sell, sell)
}

/** Bundle every piece of user data into one object (cloud payload / backup file). */
export function bundle(): AppData {
  return {
    version: 2,
    collection: loadCollection(),
    history: loadHistory(),
    sell: loadSell(),
    updatedAt: new Date().toISOString(),
  }
}

/** Write a bundle back to localStorage. Refuses to clobber a non-empty local
 *  collection with an empty one — losing cards is the one unrecoverable failure. */
export function restore(data: AppData, { allowEmpty = false } = {}): boolean {
  const incoming = Array.isArray(data?.collection) ? data.collection : []
  if (incoming.length === 0 && !allowEmpty && loadCollection().length > 0) return false
  saveCollection(incoming)
  saveHistory(Array.isArray(data?.history) ? data.history : [])
  saveSell(data?.sell && typeof data.sell === 'object' ? data.sell : {})
  return true
}
