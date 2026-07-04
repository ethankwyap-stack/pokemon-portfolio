// Client for the pokemontcg.io v2 API, which embeds TCGplayer market prices.
// Works keyless; an optional VITE_POKEMONTCG_API_KEY raises rate limits.

import type { ApiCard, ApiSet, VariantPrices } from '../types'

const BASE = 'https://api.pokemontcg.io/v2'

function headers(): HeadersInit {
  const key = import.meta.env.VITE_POKEMONTCG_API_KEY as string | undefined
  return key ? { 'X-Api-Key': key } : {}
}

// The pokemontcg.io API sometimes hangs on cache-cold queries but responds
// quickly on retry (the first attempt warms their cache). Abort slow attempts
// and retry instead of waiting out a 60s hang.
const ATTEMPT_TIMEOUT_MS = 10_000
const MAX_ATTEMPTS = 3

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString()
  const url = `${BASE}${path}?${qs}`
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: headers(),
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      })
      if (res.status >= 500) throw new Error(`API ${res.status}`) // retryable
      if (!res.ok) throw Object.assign(new Error(`API ${res.status}`), { final: true })
      const json = await res.json()
      return json.data as T
    } catch (err) {
      lastError = err
      if ((err as { final?: boolean }).final) break
    }
  }
  throw lastError
}

/** Escape double quotes for use inside a quoted Lucene term. */
function q(s: string): string {
  return s.replace(/"/g, '\\"')
}

/** Type-ahead search by card name, newest sets first. */
export async function searchCards(query: string, pageSize = 12): Promise<ApiCard[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  return get<ApiCard[]>('/cards', {
    q: `name:"${q(trimmed)}*"`,
    orderBy: '-set.releaseDate',
    pageSize: String(pageSize),
  })
}

/** Exact lookup by set + collector number. */
export async function getCardsBySetNumber(setId: string, number: string): Promise<ApiCard[]> {
  return get<ApiCard[]>('/cards', {
    q: `set.id:${setId} number:${q(number.trim())}`,
    pageSize: '5',
  })
}

/** Batched fetch by ids (for refreshing prices). Falls back to per-id on failure. */
export async function getCardsByIds(ids: string[]): Promise<ApiCard[]> {
  const out: ApiCard[] = []
  const CHUNK = 20
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    try {
      const cards = await get<ApiCard[]>('/cards', {
        q: chunk.map((id) => `id:${id}`).join(' OR '),
        pageSize: String(CHUNK),
      })
      out.push(...cards)
    } catch {
      // Fall back to fetching one at a time; skip cards that fail.
      for (const id of chunk) {
        try {
          const card = await get<ApiCard>(`/cards/${id}`, {})
          out.push(card)
        } catch {
          /* leave stale price for this card */
        }
      }
    }
  }
  return out
}

/** All sets, newest first. */
export async function getSets(): Promise<ApiSet[]> {
  return get<ApiSet[]>('/sets', { orderBy: '-releaseDate', pageSize: '250' })
}

// ---- Price helpers ----------------------------------------------------------

const VARIANT_PREFERENCE = ['holofoil', 'normal', 'reverseHolofoil']

/** Human label for a variant key, e.g. "1stEditionHolofoil" -> "1st Edition Holofoil". */
export function variantLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/1st Edition/i, '1st Edition')
}

/** Variant keys available on a card, preferred ones first. */
export function variantOptions(card: ApiCard): string[] {
  const keys = Object.keys(card.tcgplayer?.prices ?? {})
  return [
    ...VARIANT_PREFERENCE.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !VARIANT_PREFERENCE.includes(k)),
  ]
}

/** Auto-pick the primary printing variant for a card. */
export function pickVariant(card: ApiCard): string {
  return variantOptions(card)[0] ?? 'normal'
}

/** Best available price for a card+variant: market, then mid, then low,
 *  then cardmarket trend as a last resort. Null if nothing is priced. */
export function marketPrice(card: ApiCard, variant: string): number | null {
  const p: VariantPrices | undefined = card.tcgplayer?.prices?.[variant]
  if (p) return p.market ?? p.mid ?? p.low ?? null
  const cm = card.cardmarket?.prices
  return cm?.trendPrice ?? cm?.averageSellPrice ?? null
}
