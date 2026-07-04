// localStorage persistence under the `poke.` namespace.
// All reads/writes are try/catch guarded with graceful fallback.

import type { OwnedCard, HistoryPoint, ApiSet } from '../types'

const KEYS = {
  collection: 'poke.collection',
  history: 'poke.history',
  setsCache: 'poke.setsCache',
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
