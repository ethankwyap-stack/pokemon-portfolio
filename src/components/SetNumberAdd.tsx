// Set + collector-number entry: pick a set once, then type numbers and hit
// Enter repeatedly — efficient for adding many cards from the same set.

import { useEffect, useRef, useState } from 'react'
import type { ApiCard, ApiSet } from '../types'
import { getCardsBySetNumber, getSets } from '../lib/api'
import { loadSetsCache, saveSetsCache } from '../lib/storage'
import { Button } from './ui'

interface Props {
  onAdd: (card: ApiCard) => void
}

export default function SetNumberAdd({ onAdd }: Props) {
  const [sets, setSets] = useState<ApiSet[]>([])
  const [setId, setSetId] = useState('')
  const [number, setNumber] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const numberRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const cached = loadSetsCache()
    if (cached) {
      setSets(cached)
      return
    }
    getSets()
      .then((fetched) => {
        setSets(fetched)
        saveSetsCache(fetched)
      })
      .catch(() => setStatus('Could not load set list — check your connection.'))
  }, [])

  const selectedSet = sets.find((s) => s.id === setId)

  async function handleAdd() {
    if (!setId || !number.trim() || busy) return
    setBusy(true)
    setStatus(null)
    try {
      const cards = await getCardsBySetNumber(setId, number)
      if (cards.length === 0) {
        setStatus(`No card #${number.trim()} in ${selectedSet?.name ?? setId}.`)
      } else {
        onAdd(cards[0])
        setStatus(`✓ Added ${cards[0].name} (#${cards[0].number})`)
        setNumber('')
      }
    } catch {
      setStatus('Lookup failed — try again.')
    } finally {
      setBusy(false)
      numberRef.current?.focus()
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm text-muted">
        Set
        <select
          value={setId}
          onChange={(e) => {
            setSetId(e.target.value)
            numberRef.current?.focus()
          }}
          className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-ink outline-none focus:border-neon"
        >
          <option value="">Choose a set…</option>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.series}, {s.releaseDate.slice(0, 4)})
            </option>
          ))}
        </select>
      </label>
      <label className="flex w-40 flex-col gap-1 text-sm text-muted">
        Card number{selectedSet ? ` / ${selectedSet.printedTotal}` : ''}
        <input
          ref={numberRef}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="e.g. 4"
          className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-ink placeholder-muted outline-none focus:border-neon"
        />
      </label>
      <Button onClick={handleAdd} disabled={!setId || !number.trim() || busy}>
        {busy ? 'Adding…' : 'Add card'}
      </Button>
      {status && (
        <p className={`w-full text-sm ${status.startsWith('✓') ? 'text-neon' : 'text-muted'}`}>
          {status}
        </p>
      )}
    </div>
  )
}
