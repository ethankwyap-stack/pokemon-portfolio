// Builds a single self-contained .html file of the sell sheet.
//
// Why this exists: the cloud sheet needs signal, and a convention centre is the
// classic place not to have any. This file has the card data (and, when the
// fetch succeeds, the images) baked in, so it opens with the radio off.

import type { OwnedCard, SellInfo } from '../types'
import { LADDER, entryKey, forSaleCards, lineMarket, pileTotals, bestOffer, sellFor } from './sell'

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )

/** Fetch an image and return a data: URI, or null if it can't be inlined. */
async function inlineImage(url: string): Promise<string | null> {
  if (!url) return null
  // A hand-entered card's photo is already a data: URI — it is offline-ready and
  // refetching it would only risk tripping the size cap.
  if (url.startsWith('data:')) return url
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    if (blob.size > 400_000) return null
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function buildOfflineSheet(
  collection: OwnedCard[],
  sell: Record<string, SellInfo>,
  onProgress?: (done: number, total: number) => void,
): Promise<string> {
  const pile = forSaleCards(collection, sell)
  const cards = pile.length > 0 ? pile : [...collection].sort((a, b) => lineMarket(b) - lineMarket(a))
  const totals = pileTotals(cards)

  // Inline images a few at a time so a big collection doesn't hammer the API.
  const images = new Map<string, string>()
  for (let i = 0; i < cards.length; i += 5) {
    const batch = cards.slice(i, i + 5)
    const results = await Promise.all(batch.map((c) => inlineImage(c.imageSmall)))
    batch.forEach((c, j) => {
      const data = results[j]
      if (data) images.set(entryKey(c), data)
    })
    onProgress?.(Math.min(i + 5, cards.length), cards.length)
  }

  const rows = cards
    .map((card) => {
      const market = lineMarket(card)
      const src = images.get(entryKey(card)) ?? card.imageSmall
      const best = bestOffer(sellFor(sell, card).offers)
      const ladder = LADDER.map(
        (s) =>
          `<div class="step"><span class="lab">${s.label} ${Math.round(s.pct * 100)}%</span><b class="${s.tone}">${money(market * s.pct)}</b></div>`,
      ).join('')
      return `<article class="card">
  ${src ? `<img src="${src}" alt="">` : `<div class="nophoto">${esc(card.language ?? 'no photo')}</div>`}
  <div class="meta">
    <h2>${esc(card.name)}</h2>
    <p class="sub">${esc(card.setName)}${card.number ? ` · #${esc(card.number)}` : ''} · x${card.qty}${card.language && card.language !== 'English' ? ` · ${esc(card.language)}` : ''}</p>
    <p class="mk">Market <b>${money(market)}</b></p>
    ${best ? `<p class="sub">Best offer logged: <b>${money(best.amount)}</b> (${esc(best.vendor)})</p>` : ''}
    <div class="ladder">${ladder}</div>
  </div>
</article>`
    })
    .join('\n')

  const stamp = new Date().toLocaleString('en-US')

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PokeFolio sell sheet</title>
<style>
  :root{--bg:#0b0f14;--surface:#131a22;--surface2:#1a232e;--border:#263242;--ink:#e6edf3;--muted:#8b98a9;--neon:#00e0a4;--accent:#ff7a59}
  *{box-sizing:border-box}
  body{margin:0;padding:16px;background:var(--bg);color:var(--ink);font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  header{margin-bottom:16px}
  h1{margin:0;font-size:22px}
  h1 span{color:var(--neon)}
  .stamp{color:var(--muted);font-size:12px;margin-top:4px}
  .totals{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0 20px;
    border:1px solid rgba(0,224,164,.3);background:var(--surface);border-radius:16px;padding:12px}
  .totals .step{border:1px solid var(--border);background:var(--surface2);border-radius:12px;padding:10px}
  .lab{display:block;color:var(--muted);font-size:11px}
  b.good{color:var(--neon)} b.ok{color:var(--ink)} b.low{color:var(--accent)}
  .totals b{font-size:18px;font-variant-numeric:tabular-nums}
  .card{display:flex;gap:12px;border:1px solid var(--border);background:var(--surface);
    border-radius:16px;padding:12px;margin-bottom:12px}
  .card img{width:68px;height:auto;border-radius:8px;flex:0 0 auto;background:var(--surface2)}
  .nophoto{width:68px;height:95px;flex:0 0 auto;border:1px dashed var(--border);border-radius:8px;
    display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:10px;text-align:center;padding:2px}
  .meta{min-width:0;flex:1}
  h2{margin:0;font-size:16px}
  .sub{margin:2px 0;color:var(--muted);font-size:12px}
  .mk{margin:6px 0}
  .mk b{font-variant-numeric:tabular-nums}
  .ladder{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}
  .ladder .step{border:1px solid var(--border);background:var(--surface2);border-radius:10px;padding:6px 8px}
  .ladder b{font-size:15px;font-variant-numeric:tabular-nums}
  footer{color:var(--muted);font-size:12px;margin-top:20px;border-top:1px solid var(--border);padding-top:12px}
</style></head><body>
<header>
  <h1>Poké<span>Folio</span> · sell sheet</h1>
  <p class="stamp">Snapshot taken ${esc(stamp)} · ${cards.length} cards · works with no signal</p>
</header>
<section class="totals">
  ${totals.steps.map((s) => `<div class="step"><span class="lab">${s.label} ${Math.round(s.pct * 100)}%</span><b class="${s.tone}">${money(s.amount)}</b></div>`).join('')}
</section>
${rows}
<footer>Market total ${money(totals.market)}. Offers logged after this snapshot was taken will not appear here — the live app has those.</footer>
</body></html>`
}

/** Trigger a browser download of a text file. */
export function downloadFile(filename: string, contents: string, type = 'text/html') {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
