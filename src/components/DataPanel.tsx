// Backup, restore, cloud push, and the offline sell sheet.
//
// The collection used to live in exactly one browser's localStorage with no way
// out. Everything here exists so that is never true again.

import { useRef, useState } from 'react'
import type { AppData } from '../types'
import { Button } from './ui'

interface Props {
  cloudOn: boolean
  cloudStatus: string
  onPushToCloud: () => Promise<void>
  onPullFromCloud: () => Promise<void>
  bundle: () => AppData
  onRestore: (data: AppData) => void
  onDownloadOffline: () => Promise<void>
}

export default function DataPanel({
  cloudOn,
  cloudStatus,
  onPushToCloud,
  onPullFromCloud,
  bundle,
  onRestore,
  onDownloadOffline,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="flex flex-col gap-4">
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
