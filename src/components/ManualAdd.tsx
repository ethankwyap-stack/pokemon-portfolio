// Hand-enter a card the pokemontcg.io API does not carry — Japanese printings,
// promos, sealed oddities. Everything here is user-owned: the price is typed in
// and the price refresh leaves these entries alone.

import { useEffect, useRef, useState } from 'react'
import type { OwnedCard } from '../types'
import { Button } from './ui'

interface Props {
  onAdd: (card: OwnedCard) => void
  /** When set, the form edits this entry instead of creating a new one. */
  editing?: OwnedCard | null
  onCancelEdit?: () => void
}

const LANGUAGES = ['Japanese', 'English', 'Chinese', 'Korean', 'German', 'French', 'Other']

/** Where to look a price up, in the order a seller should trust them.
 *  eBay SOLD listings are first on purpose: they are what someone actually paid
 *  in USD, which is the only number a US vendor will negotiate against. */
const PRICE_SOURCES: { label: string; hint: string; url: (q: string) => string }[] = [
  {
    label: 'eBay sold',
    hint: 'What people actually paid, in USD. Trust this most.',
    url: (q) =>
      `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&_sacat=183454&LH_Sold=1&LH_Complete=1&_sop=13`,
  },
  {
    label: 'PriceCharting',
    hint: 'Free price history, and it covers Japanese cards well.',
    url: (q) => `https://www.pricecharting.com/search-products?q=${encodeURIComponent(q)}&type=prices`,
  },
  {
    label: 'TCGplayer',
    hint: 'The market price vendors quote. Thin on Japanese cards.',
    url: (q) => `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(q)}`,
  },
]

/** Shrink a photo to a sane size and return a data: URI. Full-size phone photos
 *  are several MB, which would blow past the cloud payload limit fast. */
function shrinkImage(file: File, maxPx = 500): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That file is not an image'))
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas unavailable'))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export default function ManualAdd({ onAdd, editing = null, onCancelEdit }: Props) {
  const [name, setName] = useState('')
  const [cardSet, setCardSet] = useState('')
  const [number, setNumber] = useState('')
  const [language, setLanguage] = useState('Japanese')
  const [variant, setVariant] = useState('')
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('')
  const [note, setNote] = useState('')
  const [image, setImage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Load the entry being edited into the form.
  useEffect(() => {
    if (!editing) return
    setName(editing.name)
    setCardSet(editing.setName)
    setNumber(editing.number)
    setLanguage(editing.language ?? 'Japanese')
    setVariant(editing.variant === 'manual' ? '' : editing.variant)
    setQty(String(editing.qty))
    setPrice(editing.priceMarket == null ? '' : String(editing.priceMarket))
    setNote(editing.note ?? '')
    setImage(editing.imageSmall ?? '')
  }, [editing])

  function reset() {
    setName('')
    setCardSet('')
    setNumber('')
    setVariant('')
    setQty('1')
    setPrice('')
    setNote('')
    setImage('')
    setError(null)
  }

  async function pickPhoto(file: File) {
    setBusy(true)
    setError(null)
    try {
      setImage(await shrinkImage(file))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function submit() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Give the card a name.')
      return
    }
    const qtyNum = Math.max(1, Math.round(Number.parseFloat(qty) || 1))
    const priceNum = price.trim() === '' ? null : Number.parseFloat(price)
    if (priceNum != null && (!Number.isFinite(priceNum) || priceNum < 0)) {
      setError('Price must be a number, or left blank.')
      return
    }

    const card: OwnedCard = {
      // Keep the id stable when editing so the card's sell flag and logged
      // offers stay attached to it.
      cardId: editing?.cardId ?? `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      number: number.trim(),
      setId: 'manual',
      setName: cardSet.trim() || 'Manual entry',
      rarity: undefined,
      imageSmall: image,
      imageLarge: image,
      tcgplayerUrl: undefined,
      variant: variant.trim() || 'manual',
      variants: [variant.trim() || 'manual'],
      qty: qtyNum,
      priceMarket: priceNum,
      priceUpdatedAt: new Date().toISOString(),
      addedAt: editing?.addedAt ?? new Date().toISOString(),
      manual: true,
      language,
      note: note.trim() || undefined,
    }
    onAdd(card)
    if (!editing) reset()
    setError(null)
  }

  const input =
    'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-base text-ink outline-none focus:border-neon'

  // Search text built from what's been typed so far. Language is deliberately
  // left out: sites index these cards under their English names.
  const lookupQuery = [name.trim(), cardSet.trim(), variant.trim(), number.trim()]
    .filter(Boolean)
    .join(' ')
    .trim()

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        For cards the price API doesn't carry — Japanese printings, promos, anything sealed. You set
        the price yourself, and the daily price refresh leaves these alone.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Card name *</span>
          <input
            className={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Charizard ex"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Set</span>
          <input
            className={input}
            value={cardSet}
            onChange={(e) => setCardSet(e.target.value)}
            placeholder="Shiny Treasure ex"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Card number</span>
          <input
            className={input}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="205/190"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Language</span>
          <select
            className={input}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Printing / finish</span>
          <input
            className={input}
            value={variant}
            onChange={(e) => setVariant(e.target.value)}
            placeholder="SAR, Master Ball, holo…"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Quantity</span>
          <input
            className={input}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Market price each ($)</span>
          <input
            className={input}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            placeholder="120"
          />
          <span className="text-[11px] text-muted">
            Price ONE copy, not the stack. Quantity is handled separately.
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Note</span>
          <input
            className={input}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="NM, from Akihabara"
          />
        </label>
      </div>

      {/* Price lookup. Opens a search already filled in from the fields above,
          so the card never has to be typed twice. */}
      <div className="rounded-xl border border-border bg-surface-2 p-3">
        <p className="text-sm text-ink">Not sure what it's worth?</p>
        <p className="mt-0.5 text-xs text-muted">
          {lookupQuery
            ? 'Opens a search for this card in a new tab. Use the SOLD price, not the asking price.'
            : 'Type the card name above first, then these will search for it.'}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRICE_SOURCES.map((src) => (
            <a
              key={src.label}
              href={lookupQuery ? src.url(lookupQuery) : undefined}
              target="_blank"
              rel="noreferrer"
              title={src.hint}
              aria-disabled={!lookupQuery}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                lookupQuery
                  ? 'border-neon/40 text-neon hover:border-neon hover:bg-neon/10'
                  : 'pointer-events-none border-border text-muted opacity-40'
              }`}
            >
              {src.label} ↗
            </a>
          ))}
        </div>
        {language === 'Japanese' && (
          <p className="mt-2 text-xs text-muted">
            Japanese card: search the English name (e.g. “Charizard ex SAR”). Price it at what it
            sells for <strong className="text-ink">in the US</strong> — Japanese cards are cheaper in
            Japan, and a US vendor pays the US number.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {image ? (
          <img src={image} alt="" className="h-24 w-[68px] rounded-lg border border-border" />
        ) : (
          <div className="flex h-24 w-[68px] items-center justify-center rounded-lg border border-dashed border-border text-center text-[10px] text-muted">
            no photo
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="subtle" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? 'Shrinking…' : image ? 'Change photo' : 'Add photo'}
          </Button>
          {image && (
            <Button variant="danger" onClick={() => setImage('')}>
              Remove photo
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void pickPhoto(f)
              e.target.value = ''
            }}
          />
        </div>
        <p className="text-xs text-muted">Optional. Shrunk to 500px so sync stays fast.</p>
      </div>

      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button onClick={submit}>{editing ? 'Save changes' : 'Add to portfolio'}</Button>
        {editing && onCancelEdit && (
          <Button variant="subtle" onClick={onCancelEdit}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
