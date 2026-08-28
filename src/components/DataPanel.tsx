// Backup, restore, cloud push, and the offline sell sheet.
//
// The collection used to live in exactly one browser's localStorage with no way
// out. Everything here exists so that is never true again.

import { useRef, useState } from 'react'
import type { AppData, OwnedCard } from '../types'
import { buildShareUrl } from '../lib/share'
import { Button } from './ui'

interface Props {
  cloudOn: boolean
  cloudStatus: string
  onPushToCloud: () => Promise<void>
  onPullFromCloud: () => Promise<void>
  bundle: () => AppData
  onRestore: (data: AppData) => void
  onDownloadOffline: () => Promise<void>
  collection: OwnedCard[]
}

/** Past roughly this length a link starts getting cut in half by chat apps, so
 *  the sender is warned to send a backup file instead of a broken link. */
const LINK_WARN_CHARS = 8000

export default function DataPanel({
  cloudOn,
  cloudStatus,
  onPushToCloud,
  onPullFromCloud,
  bundle,
  onRestore,
  onDownloadOffline,
  collection,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [shareName, setShareName] = useState('')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function run(label: string, fn: () => Promise<void> | void) {
    setBusy(label)
    setMsg(null)
    try {
      await fn()
      setMsg(`${label} — done.`)
    } catch (err) {
      setMsg(`${label} failed: ${(err as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  function downloadBackup() {
    const data = bundle()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pokefolio-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMsg(`Backup downloaded — ${data.collection.length} cards.`)
  }

  function pickRestore(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as AppData
        if (!Array.isArray(data.collection)) throw new Error('That file has no collection array')
        const ok = confirm(
          `Restore ${data.collection.length} cards from this backup? This replaces what is loaded now.`,
        )
        if (!ok) return
        onRestore(data)
        setMsg(`Restored ${data.collection.length} cards.`)
      } catch (err) {
        setMsg(`Restore failed: ${(err as Error).message}`)
      }
    }
    reader.readAsText(file)
  }

  async function makeShareLink() {
    const url = await buildShareUrl(collection, shareName || 'Someone')
    setShareUrl(url)
    setCopied(false)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      /* clipboard blocked (Safari without a user gesture, http, …) — the link
         is shown in the box below either way, so this is not a failure. */
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-neon/30 bg-surface p-5 shadow-[0_0_24px_rgba(0,224,164,0.08)]">
        <h2 className="text-lg font-semibold text-ink">Share your collection</h2>
        <p className="mt-1 text-sm text-muted">
          Makes a link with your cards baked into it. Send it to Ethan and he sees a read-only list
          with the total value. Nothing is uploaded anywhere — the cards travel inside the link
          itself, and whoever opens it cannot change anything.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={shareName}
            onChange={(e) => setShareName(e.target.value)}
            placeholder="Your name"
            maxLength={60}
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm text-ink outline-none placeholder:text-muted focus:border-neon sm:flex-none sm:w-56"
          />
          <Button
            disabled={collection.length === 0 || busy != null}
            onClick={() => run('Make share link', makeShareLink)}
          >
            {busy === 'Make share link' ? 'Building…' : 'Make share link'}
          </Button>
        </div>
        {collection.length === 0 && (
          <p className="mt-2 text-sm text-muted">Add a card first — there is nothing to share yet.</p>
        )}
        {shareUrl && (
          <div className="mt-3">
            <textarea
              readOnly
              value={shareUrl}
              rows={3}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full break-all rounded-lg border border-border bg-surface-2 p-3 text-xs text-ink outline-none focus:border-neon"
            />
            <p className="mt-2 text-sm text-muted">
              {copied ? 'Copied to your clipboard. ' : 'Tap the box and copy it. '}
              {collection.length} {collection.length === 1 ? 'card' : 'different cards'} in this link.
              {shareUrl.length > LINK_WARN_CHARS &&
                ' This link is long — some chat apps cut long links in half. If it does not open, send the backup file below instead.'}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold text-ink">Sync</h2>
        <p className="mt-1 text-sm text-muted">{cloudStatus}</p>
        {cloudOn ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              disabled={busy != null}
              onClick={() => run('Push this device to cloud', onPushToCloud)}
            >
              {busy === 'Push this device to cloud' ? 'Pushing…' : 'Push this device → cloud'}
            </Button>
            <Button
              variant="ghost"
              disabled={busy != null}
              onClick={() => run('Pull cloud to this device', onPullFromCloud)}
            >
              Pull cloud → this device
            </Button>
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-border bg-surface-2 p-3 text-sm text-muted">
            No access key in this URL, so this device is running on local storage only. Open the app
            with <code className="text-neon">?k=YOUR-KEY</code> to sync.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold text-ink">Backup</h2>
        <p className="mt-1 text-sm text-muted">
          A .json file with every card, price snapshot, and logged offer. Keep one before any big
          change.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={downloadBackup}>Download backup (.json)</Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            Restore from backup…
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) pickRestore(f)
              e.target.value = ''
            }}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-neon/30 bg-surface p-5">
        <h2 className="text-lg font-semibold text-ink">Offline sell sheet</h2>
        <p className="mt-1 text-sm text-muted">
          One .html file with your cards and the price ladder baked in. AirDrop it to your phone and
          it opens with no signal at all. It's a read-only snapshot.
        </p>
        <div className="mt-3">
          <Button
            disabled={busy != null}
            onClick={() => run('Build offline sheet', onDownloadOffline)}
          >
            {busy === 'Build offline sheet' ? 'Building…' : 'Download offline sheet (.html)'}
          </Button>
        </div>
      </section>

      {msg && (
        <p className="rounded-lg border border-border bg-surface-2 p-3 text-sm text-ink">{msg}</p>
      )}
    </div>
  )
}
