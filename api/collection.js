// PokéFolio cloud store — one JSON bundle in Vercel Blob, guarded by a secret key.
//
// GET    /api/collection?k=SECRET   -> the bundle (404 before the first save)
// PUT    /api/collection?k=SECRET   -> replace the bundle
//
// Data-loss guards, in order of importance:
//  1. A PUT whose collection is empty is REFUSED when the stored copy has cards,
//     unless ?force=1. A blank phone tab must never be able to wipe the shelf.
//  2. Every successful PUT first copies the current bundle to a dated backup
//     blob (backups/YYYY-MM-DD.json), so any single bad day is recoverable.
//  3. The response always echoes the stored copy, so the client can tell whether
//     its write actually landed.

import { put, list, del } from '@vercel/blob'

// The store is public, so the blob keeps a random suffix in its pathname and is
// located by prefix instead of by a guessable name. Reads still go through this
// endpoint, which requires the key.
const PREFIX = 'collection'
const ACCESS = { access: 'public', contentType: 'application/json', addRandomSuffix: true }

function keyOk(req) {
  const secret = process.env.APP_SECRET
  if (!secret) return false
  const url = new URL(req.url, 'http://localhost')
  return url.searchParams.get('k') === secret
}

/** Newest blob under the collection prefix; older suffixed copies are pruned. */
async function findLatest() {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 })
  const mine = blobs
    .filter((b) => b.pathname.startsWith(PREFIX) && b.pathname.endsWith('.json'))
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
  return { latest: mine[0] ?? null, older: mine.slice(1) }
}

async function readBundle() {
  const { latest: blob } = await findLatest()
  if (!blob) return null
  // Bust the blob CDN cache — same trick house-inventory uses.
  const res = await fetch(`${blob.url}?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) return null
  try {
    return await res.json()
  } catch {
    return null
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 12_000_000) reject(new Error('Payload too large'))
    })
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (!keyOk(req)) {
    res.status(401).json({ error: 'Bad or missing access key' })
    return
  }

  try {
    if (req.method === 'GET') {
      const data = await readBundle()
      if (!data) {
        res.status(404).json({ error: 'No collection stored yet' })
        return
      }
      res.status(200).json(data)
      return
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const url = new URL(req.url, 'http://localhost')
      const force = url.searchParams.get('force') === '1'

      const raw = typeof req.body === 'string' ? req.body : await readBody(req)
      let incoming
      try {
        incoming = typeof req.body === 'object' && req.body ? req.body : JSON.parse(raw)
      } catch {
        res.status(400).json({ error: 'Body is not valid JSON' })
        return
      }

      if (!incoming || !Array.isArray(incoming.collection)) {
        res.status(400).json({ error: 'Body must include a collection array' })
        return
      }

      const existing = await readBundle()
      const existingCount = existing?.collection?.length ?? 0

      // Guard 1: never let an empty write erase a non-empty shelf.
      if (incoming.collection.length === 0 && existingCount > 0 && !force) {
        res.status(409).json({
          error: `Refused: incoming collection is empty but ${existingCount} cards are stored. Send ?force=1 only if you really mean to clear it.`,
          storedCount: existingCount,
        })
        return
      }

      // Guard 2: keep one dated backup of the copy we are about to replace.
      if (existing) {
        const day = new Date().toISOString().slice(0, 10)
        try {
          // Fixed name so this is one blob per day, not one per keystroke.
          await put(`backups/${day}.json`, JSON.stringify(existing), {
            ...ACCESS,
            addRandomSuffix: false,
            allowOverwrite: true,
          })
        } catch {
          /* a failed backup must not block the save */
        }
      }

      const payload = { ...incoming, version: 2, updatedAt: new Date().toISOString() }
      const before = await findLatest()
      await put(`${PREFIX}.json`, JSON.stringify(payload), ACCESS)

      // Prune superseded copies, keeping the one we just replaced as a rollback.
      const stale = [before.latest, ...before.older].filter(Boolean).slice(1)
      if (stale.length > 0) {
        try {
          await del(stale.map((b) => b.url))
        } catch {
          /* pruning is housekeeping, never fail the save for it */
        }
      }

      res.status(200).json(payload)
      return
    }

    res.setHeader('Allow', 'GET, PUT')
    res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
