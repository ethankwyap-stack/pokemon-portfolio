# PokéFolio — Pokémon card portfolio

React 18 + TS + Vite 6 + Tailwind v4. Tracks owned cards with TCGplayer market prices via the free pokemontcg.io API (keyless; optional `VITE_POKEMONTCG_API_KEY` in `.env`).

Backed up to github.com/ethankwyap-stack/pokemon-portfolio (private) — LaunchAgent `com.ethanyap.pokemon-portfolio-backup` runs `scripts/backup.sh` nightly at 21:00 (auto commit + push; log at /tmp/pokemon-portfolio-backup.log).

## Serving — always-on localhost, no cloud deploy
- LaunchAgent `com.ethanyap.pokemon-portfolio` (`~/Library/LaunchAgents`) runs `server.mjs` (dep-free static server for `dist/`) at **http://localhost:4321**.
- **After any code change, run `npm run build`** — :4321 serves `dist/`, so changes are invisible until rebuilt.
- The plist hardcodes the nvm node path (`~/.nvm/versions/node/v24.14.1/bin/node`) — update it if node is upgraded.
- Dev server: `npm run dev` (but the user normally uses :4321).

## Serving — also live on Vercel (added 2026-08-28)
- Public share copy (what other people are given): **https://ethankwyap-stack.github.io/pokemon-portfolio/** — the `gh-pages` branch. Rebuild it with `npm run build` then push `dist/` to `gh-pages` via a git worktree; it goes stale silently otherwise.
- Live: **https://pokemon-portfolio-gold.vercel.app/?k=SECRET** (Vercel project `ethan16/pokemon-portfolio`, blob store `pokefolio-data`). Secret in `~/pokemon-portfolio/.app-secret`, also set as Vercel env `APP_SECRET` on all three environments.
- Deploy: `vercel deploy --prod --yes`. localhost:4321 still works and is unaffected — with no `?k=` the app runs on localStorage exactly as before.
- `api/collection.js` stores one JSON bundle (collection + history + sell) in Vercel Blob. Same secret-link pattern as house-inventory / coffee-shelf.

## Gotchas
- **`package.json` has `"type": "module"`, so files under `api/` MUST be ESM** (`import` / `export default handler`). A CJS `require` there deploys fine and then fails at runtime with `ReferenceError: require is not defined` and a bare 500 — the browser shows nothing useful, only `vercel logs <deployment>` names the cause. house-inventory's CJS api file is NOT copy-pasteable here.
- The blob store is **public**, so `collection.json` is written with `addRandomSuffix: true` and located via `list({ prefix })`. Do not switch to a fixed pathname — that would make the raw blob URL guessable.

## Manual cards
- "Enter by hand" add mode creates entries with `manual: true` and a `manual-<ts>-<rand>` cardId, for Japanese printings and anything pokemontcg.io does not carry. Fields: name, set, number, language, printing/finish, qty, hand-typed price, note, optional photo (shrunk to 500px, stored as a data URI in `imageSmall`/`imageLarge`).
- **`refreshPrices` skips `manual` entries entirely** — their price is user-owned. Never "fix" this by looking them up; the API has no record and the lookup would waste a request per card.
- Edit via the "Edit details / price" link on the card tile; it reuses the same form and keeps the cardId stable so the sell flag and logged offers stay attached. A changed printing label triggers `applyRenames`.
- Manual cards may have no photo — `CardTile`, `SellSheet`'s `Thumb`, and the offline sheet all render a dashed placeholder instead. Don't assume `imageSmall` is non-empty.

## Share by link (added 2026-08-28)
- Anyone using the public GitHub Pages copy can hit **Data → Share your collection** to get a link with their cards packed into the URL fragment (`#s=…`, gzip via `CompressionStream` + base64url, `src/lib/share.ts`). Nothing is uploaded and no backend is touched — the fragment never leaves the browser.
- Opening a `#s=` link mounts `SharedView` **instead of** `App` (see `src/main.tsx`). That is deliberate: it is what guarantees a shared collection can never write to the viewer's own localStorage or cloud copy. Do not "simplify" it into a tab inside App.
- The payload is lossy on purpose — no history, no sell flags, no offers, and `data:` photos on manual cards are stripped (they would add hundreds of KB per card). Rows are tuples, not objects, so field names don't dominate the bytes.
- ~120 cards packs to a ~1.6 KB link. Past `LINK_WARN_CHARS` (8000) the UI warns that chat apps may cut the link and suggests the backup file instead.

## Data & API quirks
- All data in localStorage under `poke.*` keys (collection, price history, sets cache, sell). Entries keyed by cardId+variant. localStorage stays a live mirror even when cloud sync is on.
- Write guards worth keeping: the API refuses a PUT that would empty a non-empty stored collection (needs `?force=1`), keeps a dated `backups/YYYY-MM-DD.json` blob before each overwrite, and the client blocks cloud writes until the first cloud read settles so a fresh phone tab cannot push empty state over the real collection.
- pokemontcg.io is erratic: cache-cold queries can hang 20–60s then succeed fast on retry. `src/api.ts` aborts at 10s with up to 3 retries — keep that pattern.
- Brand-new sets may have empty `tcgplayer.prices` → card legitimately shows "—"/$0.

## User decisions
- No gain/loss tracking (no cost basis) — declined, don't add.
- Fast add flow matters: type-ahead + set/number entry, variant auto-pick with dropdown, auto daily value snapshots.
