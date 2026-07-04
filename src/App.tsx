import { useEffect, useRef, useState } from 'react'
import type { ApiCard, OwnedCard } from './types'
import { getCardsByIds, marketPrice } from './lib/api'
import { loadCollection, loadHistory, saveCollection, saveHistory } from './lib/storage'
import { recordSnapshot, refreshPrices, toOwnedCard, totalValue } from './lib/portfolio'
import AddCardSearch from './components/AddCardSearch'
import SetNumberAdd from './components/SetNumberAdd'
import CardTile from './components/CardTile'
import PortfolioSummary from './components/PortfolioSummary'
import ValueChart from './components/ValueChart'
import { Button } from './components/ui'

type AddMode = 'search' | 'setNumber'
type SortMode = 'added' | 'value' | 'name'

/** Entries are keyed by cardId+variant (the same card in two printings is two entries). */
const entryKey = (c: { cardId: string; variant: string }) => `${c.cardId}|${c.variant}`

export default function App() {
  const [collection, setCollection] = useState<OwnedCard[]>(() => loadCollection())
  const [history, setHistory] = useState(() => loadHistory())
  const [addMode, setAddMode] = useState<AddMode>('search')
  const [sortMode, setSortMode] = useState<SortMode>('added')
  const [refreshing, setRefreshing] = useState(false)
  const bootRef = useRef(false)

  // Persist on every change.
  useEffect(() => saveCollection(collection), [collection])
  useEffect(() => saveHistory(history), [history])

  // On load: refresh prices from the API, then record today's auto-snapshot.
  useEffect(() => {
    if (bootRef.current) return // guard StrictMode double-invoke
    bootRef.current = true
    const initial = loadCollection()
    if (initial.length === 0) return
    setRefreshing(true)
    refreshPrices(initial)
      .then((fresh) => {
        setCollection(fresh)
        setHistory((h) => recordSnapshot(h, totalValue(fresh)))
      })
      .catch(() => {
        /* offline — keep stale prices */
      })
      .finally(() => setRefreshing(false))
  }, [])

  function addCard(card: ApiCard) {
    setCollection((prev) => {
      const entry = toOwnedCard(card)
      const existing = prev.find((c) => entryKey(c) === entryKey(entry))
      if (existing) {
        return prev.map((c) =>
          entryKey(c) === entryKey(entry)
            ? { ...c, qty: c.qty + 1, priceMarket: entry.priceMarket, priceUpdatedAt: entry.priceUpdatedAt }
            : c,
        )
      }
      return [...prev, entry]
    })
  }

  function changeQty(cardId: string, variant: string, qty: number) {
    setCollection((prev) =>
      qty <= 0
        ? prev.filter((c) => !(c.cardId === cardId && c.variant === variant))
        : prev.map((c) => (c.cardId === cardId && c.variant === variant ? { ...c, qty } : c)),
    )
  }

  function removeCard(cardId: string, variant: string) {
    setCollection((prev) => prev.filter((c) => !(c.cardId === cardId && c.variant === variant)))
  }

  async function changeVariant(cardId: string, variant: string, next: string) {
    if (variant === next) return
    // Reprice from cached data immediately isn't possible (we only store the
    // current variant's price), so fetch the card and reprice.
    let price: number | null = null
    let updatedAt: string | undefined
    try {
      const [card] = await getCardsByIds([cardId])
      if (card) {
        price = marketPrice(card, next)
        updatedAt = card.tcgplayer?.updatedAt
      }
    } catch {
      /* keep null price if offline */
    }
    setCollection((prev) => {
      const source = prev.find((c) => c.cardId === cardId && c.variant === variant)
      if (!source) return prev
      const target = prev.find((c) => c.cardId === cardId && c.variant === next)
      if (target) {
        // Merge into the existing entry for that variant.
        return prev
          .filter((c) => !(c.cardId === cardId && c.variant === variant))
          .map((c) =>
            c.cardId === cardId && c.variant === next ? { ...c, qty: c.qty + source.qty } : c,
          )
      }
      return prev.map((c) =>
        c.cardId === cardId && c.variant === variant
          ? { ...c, variant: next, priceMarket: price, priceUpdatedAt: updatedAt ?? c.priceUpdatedAt }
          : c,
      )
    })
  }

  function snapshotNow() {
    setHistory((h) => recordSnapshot(h, totalValue(collection), { overwriteToday: true }))
  }

  const sorted = [...collection].sort((a, b) => {
    if (sortMode === 'value') return (b.priceMarket ?? 0) * b.qty - (a.priceMarket ?? 0) * a.qty
    if (sortMode === 'name') return a.name.localeCompare(b.name)
    return a.addedAt.localeCompare(b.addedAt)
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-baseline gap-3">
        <h1 className="text-2xl font-bold text-ink">
          Poké<span className="text-neon">Folio</span>
        </h1>
        <p className="text-sm text-muted">Your Pokémon card portfolio · TCGplayer market prices</p>
      </header>

      <div className="flex flex-col gap-5">
        <PortfolioSummary collection={collection} refreshing={refreshing} onSnapshot={snapshotNow} />
        <ValueChart history={history} />

        <section className="rounded-2xl border border-neon/30 bg-surface p-5 shadow-[0_0_24px_rgba(0,224,164,0.08)]">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="mr-2 text-lg font-semibold text-ink">Add cards</h2>
            <Button
              variant={addMode === 'search' ? 'primary' : 'subtle'}
              onClick={() => setAddMode('search')}
            >
              Search by name
            </Button>
            <Button
              variant={addMode === 'setNumber' ? 'primary' : 'subtle'}
              onClick={() => setAddMode('setNumber')}
            >
              Set + number
            </Button>
          </div>
          {addMode === 'search' ? (
            <AddCardSearch onAdd={addCard} />
          ) : (
            <SetNumberAdd onAdd={addCard} />
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Collection</h2>
            {collection.length > 1 && (
              <label className="flex items-center gap-2 text-sm text-muted">
                Sort
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-ink outline-none focus:border-neon"
                >
                  <option value="added">Recently added</option>
                  <option value="value">Highest value</option>
                  <option value="name">Name</option>
                </select>
              </label>
            )}
          </div>
          {collection.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
              No cards yet — search above and click a card to add it.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {sorted.map((card) => (
                <CardTile
                  key={entryKey(card)}
                  card={card}
                  onQtyChange={changeQty}
                  onVariantChange={changeVariant}
                  onRemove={removeCard}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
