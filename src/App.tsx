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
import { ConflictError, cloudEnabled, cloudLoad, cloudSave } from './lib/cloud'
import { applyRenames, mergeData } from './lib/merge'
import { buildOfflineSheet, downloadFile } from './lib/offline'
import { recordSnapshot, refreshPrices, toOwnedCard, totalValue } from './lib/portfolio'
import { emptySell, entryKey, newOffer } from './lib/sell'
import AddCardSearch from './components/AddCardSearch'
import SetNumberAdd from './components/SetNumberAdd'
import ManualAdd from './components/ManualAdd'
import CardTile from './components/CardTile'
import PortfolioSummary from './components/PortfolioSummary'
import ValueChart from './components/ValueChart'
import SellSheet from './components/SellSheet'
import DataPanel from './components/DataPanel'
import { Button } from './components/ui'

type AddMode = 'search' | 'setNumber' | 'manual'
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
  const [editingManual, setEditingManual] = useState<OwnedCard | null>(null)
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
  // The `updatedAt` this device last saw. The server rejects a write whose base
  // does not match, which is what stops one device clobbering the other.
  const baseUpdatedAt = useRef<string | null>(null)

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
              const saved = await cloudSave(bundle())
              baseUpdatedAt.current = saved.updatedAt
              setCloudStatus(`Cloud seeded with ${base.length} cards from this device.`)
            } else {
              setCloudStatus('Cloud is empty, and so is this device.')
            }
          } else if (remote.collection.length === 0 && base.length > 0) {
            baseUpdatedAt.current = remote.updatedAt
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
            baseUpdatedAt.current = remote.updatedAt
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
        const { collection: fresh, renames } = await refreshPrices(base)
        setCollection(fresh)
        // A variant that changed under us would otherwise orphan that card's
        // for-sale flag and its offers, which reads as "it unselected itself".
        if (renames.length > 0) setSell((s) => applyRenames(s, renames))
        setHistory((h) => recordSnapshot(h, totalValue(fresh)))
      } catch {
        /* offline — keep stale prices */
      } finally {
        setRefreshing(false)
      }
    }

    void boot()
  }, [])

  // Debounced push of any change to the cloud. On a conflict (the other device
  // saved first) the two versions are merged additively and the write retried,
  // so neither device's picks or offers are dropped.
  useEffect(() => {
    if (!cloudEnabled() || !syncReady.current) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(async () => {
      const mine: AppData = {
        version: 2,
        collection,
        history,
        sell,
        updatedAt: new Date().toISOString(),
      }
      try {
        const saved = await cloudSave(mine, { baseUpdatedAt: baseUpdatedAt.current })
        baseUpdatedAt.current = saved.updatedAt
        setCloudStatus(`Saved to cloud ${new Date().toLocaleTimeString('en-US')}.`)
      } catch (err) {
        if (!(err instanceof ConflictError)) {
          setCloudStatus(`Not saved: ${(err as Error).message}`)
          return
        }
        try {
          const merged = mergeData(mine, err.stored)
          const saved = await cloudSave(merged, { baseUpdatedAt: err.stored.updatedAt })
          baseUpdatedAt.current = saved.updatedAt
          setCollection(merged.collection)
          setHistory(merged.history)
          setSell(merged.sell)
          setCloudStatus(`Merged this device with the other one at ${new Date().toLocaleTimeString('en-US')}.`)
        } catch (err2) {
          setCloudStatus(`Not saved: ${(err2 as Error).message}. Your data is safe on this device.`)
        }
      }
    }, 800)
    return () => window.clearTimeout(saveTimer.current)
  }, [collection, history, sell])

  // Pull fresh data when the tab comes back into view, so switching between the
  // phone and the Mac shows what the other one just did.
  useEffect(() => {
    if (!cloudEnabled()) return
    function onFocus() {
      if (!syncReady.current || document.hidden) return
      cloudLoad()
        .then((remote) => {
          if (!remote || remote.updatedAt === baseUpdatedAt.current) return
          setCollection((c) => {
            const merged = mergeData(
              { version: 2, collection: c, history, sell, updatedAt: '' },
              remote,
            )
            setHistory(merged.history)
            setSell(merged.sell)
            return merged.collection
          })
          baseUpdatedAt.current = remote.updatedAt
          setCloudStatus(`Updated from the other device at ${new Date().toLocaleTimeString('en-US')}.`)
        })
        .catch(() => {
          /* offline — the local copy stands */
        })
    }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [history, sell])

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

  /** Add or update a hand-entered card. Editing keeps the same cardId+variant,
   *  so the card's sell flag and logged offers stay attached. */
  function upsertManual(card: OwnedCard) {
    setCollection((prev) => {
      const idx = prev.findIndex((c) => c.cardId === card.cardId)
      if (idx === -1) return [...prev, card]
      const prevEntry = prev[idx]
      const next = [...prev]
      next[idx] = card
      // If the printing label changed, carry the sell state to the new key.
      if (entryKey(prevEntry) !== entryKey(card)) {
        setSell((s) => applyRenames(s, [[entryKey(prevEntry), entryKey(card)]]))
      }
      return next
    })
    setEditingManual(null)
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

  /** Deliberate "make the cloud match this device" — overrides both guards, but
   *  asks first when that would clear a stored collection. */
  async function pushToCloud() {
    if (collection.length === 0) {
      const remote = await cloudLoad().catch(() => null)
      const stored = remote?.collection.length ?? 0
      if (stored > 0 && !confirm(`This device has no cards. Really replace the ${stored} cards stored in the cloud?`)) {
        throw new Error('cancelled')
      }
    }
    const saved = await cloudSave(
      { version: 2, collection, history, sell, updatedAt: new Date().toISOString() },
      { force: true },
    )
    baseUpdatedAt.current = saved.updatedAt
    setCloudStatus(`Pushed ${collection.length} cards to the cloud.`)
  }

  async function pullFromCloud() {
    const remote = await cloudLoad()
    if (!remote) throw new Error('nothing stored in the cloud yet')
    baseUpdatedAt.current = remote.updatedAt
    setCollection(remote.collection)
    setHistory(remote.history ?? [])
    setSell(remote.sell ?? {})
    setCloudStatus(`Pulled ${remote.collection.length} cards from the cloud.`)
  }

  /** Restoring a backup means "this file is the truth", so it overwrites the
   *  cloud rather than merging with it. */
  async function applyRestore(data: AppData) {
    setCollection(data.collection)
    setHistory(data.history ?? [])
    setSell(data.sell ?? {})
    if (cloudEnabled()) {
      try {
        const saved = await cloudSave({ ...data, updatedAt: new Date().toISOString() }, { force: true })
        baseUpdatedAt.current = saved.updatedAt
        setCloudStatus(`Restored ${data.collection.length} cards and pushed them to the cloud.`)
      } catch (err) {
        setCloudStatus(`Restored on this device, but the cloud push failed: ${(err as Error).message}`)
      }
    }
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
              <Button
                variant={addMode === 'manual' ? 'primary' : 'subtle'}
                onClick={() => setAddMode('manual')}
              >
                Enter by hand
              </Button>
            </div>
            {addMode === 'search' && <AddCardSearch onAdd={addCard} />}
            {addMode === 'setNumber' && <SetNumberAdd onAdd={addCard} />}
            {addMode === 'manual' && (
              <ManualAdd
                onAdd={upsertManual}
                editing={editingManual}
                onCancelEdit={() => setEditingManual(null)}
              />
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
                    onEditManual={(c) => {
                      setEditingManual(c)
                      setAddMode('manual')
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
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
          collection={collection}
        />
      )}
    </div>
  )
}
