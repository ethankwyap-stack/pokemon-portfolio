// The fast path: debounced type-ahead search. Click a result to add it
// instantly; the input stays focused and clears for the next card.

import { useEffect, useRef, useState } from 'react'
import type { ApiCard } from '../types'
import { marketPrice, pickVariant, searchCards } from '../lib/api'
import { usd } from '../lib/format'

interface Props {
  onAdd: (card: ApiCard) => void
}

export default function AddCardSearch({ onAdd }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ApiCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const seqRef = useRef(0)

  // Debounced search (~250ms), with stale-response protection.
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    const seq = ++seqRef.current
    const t = setTimeout(async () => {
      try {
        const cards = await searchCards(trimmed)
        if (seqRef.current === seq) {
          setResults(cards)
          setError(null)
        }
      } catch {
        if (seqRef.current === seq) setError('Search failed — check your connection and try again.')
      } finally {
        if (seqRef.current === seq) setLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  function handleAdd(card: ApiCard) {
    onAdd(card)
    setJustAdded(`Added ${card.name} (${card.set.name} ${card.number})`)
    setQuery('')
    setResults([])
    inputRef.current?.focus()
    setTimeout(() => setJustAdded(null), 2500)
  }

  return (
    <div>
      <input
        ref={inputRef}
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Start typing a card name… e.g. Charizard"
        className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-ink placeholder-muted outline-none focus:border-neon focus:shadow-[0_0_12px_rgba(0,224,164,0.2)]"
      />
      {justAdded && <p className="mt-2 text-sm text-neon">✓ {justAdded}</p>}
      {loading && <p className="mt-2 text-sm text-muted">Searching…</p>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {results.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {results.map((card) => {
            const price = marketPrice(card, pickVariant(card))
            return (
              <button
                key={card.id}
                onClick={() => handleAdd(card)}
                title={`Add ${card.name}`}
                className="group cursor-pointer rounded-xl border border-border bg-surface p-2 text-left transition-colors hover:border-neon"
              >
                <img
                  src={card.images.small}
                  alt={card.name}
                  loading="lazy"
                  className="w-full rounded-lg"
                />
                <p className="mt-1.5 truncate text-xs font-medium text-ink">{card.name}</p>
                <p className="truncate text-xs text-muted">
                  {card.set.name} · #{card.number}
                </p>
                <p className="text-xs font-semibold text-neon">{usd(price)}</p>
                <p className="text-center text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100">
                  click to add
                </p>
              </button>
            )
          })}
        </div>
      )}
      {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
        <p className="mt-2 text-sm text-muted">No cards found for “{query.trim()}”.</p>
      )}
    </div>
  )
}
