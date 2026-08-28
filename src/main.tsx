import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import SharedView from './components/SharedView'
import { decodeShare, shareHash, type SharedPortfolio } from './lib/share'

/** A `#s=…` fragment means this tab is viewing someone else's shared collection.
 *  App is not mounted at all in that case, so nothing can write to the viewer's
 *  own localStorage or cloud copy while they look at it. */
function Root() {
  const encoded = shareHash()
  const [shared, setShared] = useState<SharedPortfolio | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!encoded) return
    decodeShare(encoded)
      .then(setShared)
      .catch((err: Error) => setError(err.message))
  }, [encoded])

  if (!encoded) return <App />

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-ink">That share link did not open</h1>
        <p className="mt-2 text-sm text-muted">
          {error}. Links can get cut short by chat apps — ask for it again as a plain link, or as a
          backup file.
        </p>
      </div>
    )
  }

  if (!shared) return <p className="p-8 text-center text-muted">Opening shared collection…</p>

  return <SharedView data={shared} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
