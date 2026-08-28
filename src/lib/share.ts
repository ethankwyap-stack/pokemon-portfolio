// Share-by-link: pack a read-only snapshot of someone's collection into the URL
// hash so they can send it to Ethan with no account, no server, and no upload.
//
// Why the hash and not a query string: the fragment never leaves the browser,
// so a shared collection is never logged by GitHub Pages or any proxy in between.
//
// The payload is deliberately lossy. It carries what a viewer needs to look at
// the cards and nothing else — no price history, no logged offers, no sell
// flags, and no hand-uploaded photos (those are data URIs and would blow the
// link up to megabytes). Rows are tuples rather than objects because the field
// names would otherwise be most of the bytes.

import type { OwnedCard } from '../types'

/** [name, setName, number, variant, qty, price, imageUrl, rarity] */
type Row = [string, string, string, string, number, number | null, string, string]

export interface SharedPortfolio {
  /** Who sent it. Free text, whatever they typed. */
  from: string
  /** ISO timestamp of when the link was made. */
  at: string
  cards: {
    name: string
    setName: string
    number: string
    variant: string
    qty: number
    priceMarket: number | null
    imageSmall: string
    rarity: string
  }[]
}

interface Payload {
  v: 1
  n: string
  at: string
  c: Row[]
}

const PREFIX = '#s='

function toBase64Url(bytes: Uint8Array<ArrayBuffer>): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** gzip when the browser has CompressionStream, otherwise pass the bytes through.
 *  The marker byte says which happened, so a link made on one browser still
 *  opens on another. */
async function pack(text: string): Promise<Uint8Array<ArrayBuffer>> {
  const raw = new TextEncoder().encode(text)
  if (typeof CompressionStream === 'undefined') return withMarker(0, raw)
  const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))
  const gz = new Uint8Array(await new Response(stream).arrayBuffer())
  return withMarker(1, gz)
}

async function unpack(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const body = bytes.subarray(1)
  if (bytes[0] === 0) return new TextDecoder().decode(body)
  const stream = new Blob([body]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

function withMarker(marker: number, body: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(body.length + 1)
  out[0] = marker
  out.set(body, 1)
  return out
}

/** Hand-uploaded photos are stored as `data:` URIs. Keeping them would add
 *  hundreds of KB per card to the link, so the viewer shows a placeholder. */
function shareableImage(url: string): string {
  return url && !url.startsWith('data:') ? url : ''
}

function toRow(c: OwnedCard): Row {
  return [
    c.name,
    c.setName,
    c.number,
    c.variant,
    c.qty,
    c.priceMarket,
    shareableImage(c.imageSmall),
    c.rarity ?? '',
  ]
}

/** Build the full share URL. `from` is whatever name the sender typed. */
export async function buildShareUrl(collection: OwnedCard[], from: string): Promise<string> {
  const payload: Payload = {
    v: 1,
    n: from.trim().slice(0, 60),
    at: new Date().toISOString(),
    c: collection.map(toRow),
  }
  const encoded = toBase64Url(await pack(JSON.stringify(payload)))
  const base = location.origin + location.pathname
  return `${base}${PREFIX}${encoded}`
}

/** The share payload in the current URL, or null when this is a normal visit. */
export function shareHash(): string | null {
  const h = location.hash
  return h.startsWith(PREFIX) ? h.slice(PREFIX.length) : null
}

export async function decodeShare(encoded: string): Promise<SharedPortfolio> {
  const payload = JSON.parse(await unpack(fromBase64Url(encoded))) as Payload
  if (payload?.v !== 1 || !Array.isArray(payload.c)) throw new Error('not a PokéFolio share link')
  return {
    from: payload.n || 'Someone',
    at: payload.at,
    cards: payload.c.map(([name, setName, number, variant, qty, priceMarket, imageSmall, rarity]) => ({
      name,
      setName,
      number,
      variant,
      qty,
      priceMarket,
      imageSmall,
      rarity,
    })),
  }
}
