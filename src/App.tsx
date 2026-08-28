import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ApiCard, AppData, OwnedCard, SellInfo } from './types'
import { getCardsByIds, marketPrice } from './lib/api'
import {
  bundle,
  loadCollection,
  loadHistory,
  loadSell,
  restore,
  saveCollection,
  saveHistory,
  saveSell,
} from './lib/storage'
import { cloudEnabled, cloudLoad, cloudSave } from './lib/cloud'
import { buildOfflineSheet, downloadFile } from './lib/offline'
import { recordSnapshot, refreshPrices, toOwnedCard, totalValue } from './lib/portfolio'
import { emptySell, entryKey, newOffer } from './lib/sell'
import AddCardSearch from './components/AddCardSearch'
import SetNumberAdd from './components/SetNumberAdd'
import CardTile from './components/CardTile'
import PortfolioSummary from './components/PortfolioSummary'
import ValueChart from './components/ValueChart'
import SellSheet from './components/SellSheet'
import DataPanel from './components/DataPanel'
import { Button } from './components/ui'

type AddMode = 'search' | 'setNumber'
type SortMode = 'added' | 'value' | 'name'
type Tab = 'portfolio' | 'sell' | 'data'

const TABS: { id: Tab; label: string }[] = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'sell', label: 'Sell' },
  { id: 'data', label: 'Data' },
]

export default function App() {
  const [collection, setCollection] = useState<OwnedCard[]>(() => loadCollection())
  const [history, setHistory] = useState(() => loadHistory())
  const [sell, setSell] = useState<Record<string, SellInfo>>(() => loadSell())
  const [tab, setTab] = useState<Tab>('portfolio')
  const [addMode, setAddMode] = useState<AddMode>('search')
  const [sortMode, setSortMode] = useState<SortMode>('added')
  const [refreshing, setRefreshing] = useState(false)
  const [cloudStatus, setCloudStatus] = useState(
    cloudEnabled() ? 'Connecting to cloud…' : 'Local only — this device’s browser storage.',
  )

  const bootRef = useRef(false)
  // Blocks cloud writes until the first cloud read has settled, so a freshly
  // opened phone tab can never push its empty state over the real collection.
  const syncReady = useRef(false)
  const saveTimer = useRef<number | undefined>(undefined)

  // Local persistence — always on, cloud or not. localStorage stays a mirror.
  useEffect(() => saveCollection(collection), [collection])
  useEffect(() => saveHistory(history), [history])
  useEffect(() => saveSell(sell), [sell])

  // Boot: adopt the cloud copy if there is one, otherwise seed the cloud from
  // this device. Prices refresh afterwards either way.
  useEffect(() => {
    if (bootRef.current) return // guard StrictMode double-invoke
    bootRef.current = true

    async function boot() {
      let base = loadCollection()

      if (cloudEnabled()) {
        try {
          const remote = await cloudLoad()
          if (!remote) {
            // First run against an empty cloud: seed it from this device.
            if (base.length > 0) {
              await cloudSave(bundle())
              setCloudStatus(`Cloud seeded with ${base.length} cards from this device.`)
            } else {
              setCloudStatus('Cloud is empty, and so is this device.')
            }
          } else if (remote.collection.length === 0 && base.length > 0) {
            // Cloud is blank but this device has cards — trust the cards.
            setCloudStatus(
              `Cloud was empty but this device has ${base.length} cards. Nothing overwritten — use “Push this device → cloud” if that is right.`,
            )
          } else {
            // Stash what was here before adopting the cloud copy, just in case.
            try {
              localStorage.setItem('poke.preCloudBackup', JSON.stringify(bundle()))
            } catch {
              /* non-fatal */
            }
            restore(remote, { allowEmpty: true })
            base = remote.collection
            setCollection(remote.collection)
            setHistory(remote.history ?? [])
            setSell(remote.sell ?? {})
            setCloudStatus(
              `Synced — ${remote.collection.length} cards, saved ${new Date(remote.updatedAt).toLocaleString('en-US')}.`,
            )
          }
        } catch (err) {
          setCloudStatus(`Cloud unreachable (${(err as Error).message}). Running on this device.`)
        }
      }

      syncReady.current = true

      if (base.length === 0) return
      setRefreshing(true)
      try {
        const fresh = await refreshPrices(base)
        setCollection(fresh)
        setHistory((h) => recordSnapshot(h, totalValue(fresh)))
      } catch {
        /* offline — keep stale prices */
      } finally {
        setRefreshing(false)
      }
    }

    void boot()
  }, [])

  // Debounced push of any change to the cloud.
  useEffect(() => {
    if (!cloudEnabled() || !syncReady.current) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      cloudSave({ version: 2, collection, history, sell, updatedAt: new Date().toISOString() })
        .then(() => setCloudStatus(`Saved to cloud ${new Date().toLocaleTimeString('en-US')}.`))
        .catch((err) => setCloudStatus(`Not saved: ${(err as Error).message}`))
    }, 800)
    return () => window.clearTimeout(saveTimer.current)
  }, [collection, history, sell])

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
    setSell((prev) => {
      const next = { ...prev }
      delete next[`${cardId}|${variant}`]
      return next
    })
  }

  async function changeVariant(cardId: string, variant: string, next: string) {
    if (variant === next) return
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
    // Carry the sell state (flag + offers) over to the new variant key.
    setSell((prev) => {
      const from = `${cardId}|${variant}`
      if (!prev[from]) return prev
      const next2 = { ...prev, [`${cardId}|${next}`]: prev[from] }
      delete next2[from]
      return next2
    })
  }

  function snapshotNow() {
    setHistory((h) => recordSnapshot(h, totalValue(collection), { overwriteToday: true }))
  }

  const toggleForSale = useCallback((card: OwnedCard, forSale: boolean) => {
    setSell((prev) => {
      const k = entryKey(card)
      return { ...prev, [k]: { ...(prev[k] ?? emptySell()), forSale } }
    })
  }, [])

  const addOffer = useCallback((card: OwnedCard, vendor: string, amount: number, note?: string) => {
    setSell((prev) => {
      const k = entryKey(card)
      const cur = prev[k] ?? emptySell()
      return { ...prev, [k]: { ...cur, offers: [...cur.offers, newOffer(vendor, amount, note)] } }
    })
  }, [])

  const removeOffer = useCallback((card: OwnedCard, offerId: string) => {
    setSell((prev) => {
      const k = entryKey(card)
      const cur = prev[k]
      if (!cur) return prev
      return { ...prev, [k]: { ...cur, offers: cur.offers.filter((o) => o.id !== offerId) } }
    })
  }, [])

  async function pushToCloud() {
    await cloudSave(
      { version: 2, collection, history, sell, updatedAt: new Date().toISOString() },
      { force: collection.length === 0 },
    )
    setCloudStatus(`Pushed ${collection.length} cards to the cloud.`)
  }

  async function pullFromCloud() {
    const remote = await cloudLoad()
    if (!remote) throw new Error('nothing stored in the cloud yet')
    setCollection(remote.collection)
    setHistory(remote.history ?? [])
    setSell(remote.sell ?? {})
    setCloudStatus(`Pulled ${remote.collection.length} cards from the cloud.`)
  }

  function applyRestore(data: AppData) {
    setCollection(data.collection)
    setHistory(data.history ?? [])
    setSell(data.sell ?? {})
  }

  async function downloadOffline() {
    const html = await buildOfflineSheet(collection, sell)
    downloadFile(`pokefolio-sell-sheet-${new Date().toISOString().slice(0, 10)}.html`, html)
  }

  const sorted = useMemo(
    () =>
      [...collection].sort((a, b) => {
        if (sortMode === 'value') return (b.priceMarket ?? 0) * b.qty - (a.priceMarket ?? 0) * a.qty
        if (sortMode === 'name') return a.name.localeCompare(b.name)
        return a.addedAt.localeCompare(b.addedAt)
      }),
    [collection, sortMode],
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold text-ink">
          Poké<span className="text-neon">Folio</span>
        </h1>
        <p className="text-sm text-muted">Your Pokémon card portfolio · TCGplayer market prices</p>
      </header>

      <nav className="mb-5 flex gap-2">
        {TABS.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? 'primary' : 'subtle'}
            className="flex-1 sm:flex-none"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </nav>

      {tab === 'portfolio' && (
        <div className="flex flex-col gap-5">
          <PortfolioSummary collection={collection} refreshing={refreshing} onSnapshot={snapshotNow} />
          <ValueChart history={history} />

          <section className="rounded-2xl border border-neon/30 bg-surface p-5 shadow-[0_0_24px_rgba(0,224,164,0.08)]">
            <div className="mb-3 flex flex-wrap items-center gap-2">
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
      )}

      {tab === 'sell' && (
        <SellSheet
          collection={collection}
          sell={sell}
          onToggleForSale={toggleForSale}
          onAddOffer={addOffer}
          onRemoveOffer={removeOffer}
        />
      )}

      {tab === 'data' && (
        <DataPanel
          cloudOn={cloudEnabled()}
          cloudStatus={cloudStatus}
          onPushToCloud={pushToCloud}
          onPullFromCloud={pullFromCloud}
          bundle={bundle}
          onRestore={applyRestore}
          onDownloadOffline={downloadOffline}
        />
      )}
    </div>
  )
}
