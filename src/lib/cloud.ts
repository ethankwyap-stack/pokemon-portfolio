// Cloud sync against /api/collection (Vercel Blob behind a secret key).
//
// Access model matches house-inventory / coffee-shelf: the secret lives in the
// URL as ?k=<key>. No key -> the app runs purely on localStorage, exactly as it
// did before, so the always-on localhost:4321 build keeps working untouched.

import type { AppData } from '../types'

/** The secret from ?k=, remembered in sessionStorage so a page refresh on the
 *  phone does not drop it if the user shared a trimmed link. */
export function readKey(): string | null {
  try {
    const fromUrl = new URLSearchParams(location.search).get('k')
    if (fromUrl) {
      sessionStorage.setItem('poke.k', fromUrl)
      return fromUrl
    }
    return sessionStorage.getItem('poke.k')
  } catch {
    return null
  }
}

export const cloudEnabled = () => readKey() != null

/** Fetch the cloud bundle. Returns null when there is no cloud copy yet. */
export async function cloudLoad(): Promise<AppData | null> {
  const k = readKey()
  if (!k) return null
  const res = await fetch(`/api/collection?k=${encodeURIComponent(k)}&t=${Date.now()}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Cloud load failed (${res.status})`)
  const data = (await res.json()) as AppData
  return data && Array.isArray(data.collection) ? data : null
}

/** Raised when the cloud copy moved on since this device last read it. */
export class ConflictError extends Error {
  stored: AppData
  constructor(stored: AppData) {
    super('The cloud copy changed since this device last read it')
    this.name = 'ConflictError'
    this.stored = stored
  }
}

/** Write the bundle to the cloud.
 *  `baseUpdatedAt` is the `updatedAt` this device last saw; the server rejects
 *  the write with a ConflictError when the stored copy has moved past it.
 *  `force` skips both the empty-write and the conflict guard. */
export async function cloudSave(
  data: AppData,
  { force = false, baseUpdatedAt }: { force?: boolean; baseUpdatedAt?: string | null } = {},
): Promise<AppData> {
  const k = readKey()
  if (!k) throw new Error('No access key in the URL')
  const res = await fetch(
    `/api/collection?k=${encodeURIComponent(k)}${force ? '&force=1' : ''}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        baseUpdatedAt: baseUpdatedAt ?? undefined,
        updatedAt: new Date().toISOString(),
      }),
    },
  )
  if (res.status === 409) {
    const payload = await res.json().catch(() => null)
    if (payload?.error === 'conflict' && payload.stored) throw new ConflictError(payload.stored)
    throw new Error(payload?.error || 'Cloud refused the write')
  }
  if (!res.ok) throw new Error((await res.text()) || `Cloud save failed (${res.status})`)
  return (await res.json()) as AppData
}
