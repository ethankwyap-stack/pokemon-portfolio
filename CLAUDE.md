# PokéFolio — Pokémon card portfolio

React 18 + TS + Vite 6 + Tailwind v4. Tracks owned cards with TCGplayer market prices via the free pokemontcg.io API (keyless; optional `VITE_POKEMONTCG_API_KEY` in `.env`).

Backed up to github.com/ethankwyap-stack/pokemon-portfolio (private) — LaunchAgent `com.ethanyap.pokemon-portfolio-backup` runs `scripts/backup.sh` nightly at 21:00 (auto commit + push; log at /tmp/pokemon-portfolio-backup.log).

## Serving — always-on localhost, no cloud deploy
- LaunchAgent `com.ethanyap.pokemon-portfolio` (`~/Library/LaunchAgents`) runs `server.mjs` (dep-free static server for `dist/`) at **http://localhost:4321**.
- **After any code change, run `npm run build`** — :4321 serves `dist/`, so changes are invisible until rebuilt.
- The plist hardcodes the nvm node path (`~/.nvm/versions/node/v24.14.1/bin/node`) — update it if node is upgraded.
- Dev server: `npm run dev` (but the user normally uses :4321).

## Serving — also live on Vercel (added 2026-08-28)
- Live: **https://pokemon-portfolio-gold.vercel.app/?k=SECRET** (Vercel project `ethan16/pokemon-portfolio`, blob store `pokefolio-data`). Secret in `~/pokemon-portfolio/.app-secret`, also set as Vercel env `APP_SECRET` on all three environments.
- Deploy: `vercel deploy --prod --yes`. localhost:4321 still works and is unaffected — with no `?k=` the app runs on localStorage exactly as before.
- `api/collection.js` stores one JSON bundle (collection + history + sell) in Vercel Blob. Same secret-link pattern as house-inventory / coffee-shelf.

## Gotchas
- **`package.json` has `"type": "module"`, so files under `api/` MUST be ESM** (`import` / `export default handler`). A CJS `require` there deploys fine and then fails at runtime with `ReferenceError: require is not defined` and a bare 500 — the browser shows nothing useful, only `vercel logs <deployment>` names the cause. house-inventory's CJS api file is NOT copy-pasteable here.
- The blob store is **public**, so `collection.json` is written with `addRandomSuffix: true` and located via `list({ prefix })`. Do not switch to a fixed pathname — that would make the raw blob URL guessable.

## Data & API quirks
- All data in localStorage under `poke.*` keys (collection, price history, sets cache, sell). Entries keyed by cardId+variant. localStorage stays a live mirror even when cloud sync is on.
- Write guards worth keeping: the API refuses a PUT that would empty a non-empty stored collection (needs `?force=1`), keeps a dated `backups/YYYY-MM-DD.json` blob before each overwrite, and the client blocks cloud writes until the first cloud read settles so a fresh phone tab cannot push empty state over the real collection.
- pokemontcg.io is erratic: cache-cold queries can hang 20–60s then succeed fast on retry. `src/api.ts` aborts at 10s with up to 3 retries — keep that pattern.
- Brand-new sets may have empty `tcgplayer.prices` → card legitimately shows "—"/$0.

## User decisions
- No gain/loss tracking (no cost basis) — declined, don't add.
- Fast add flow matters: type-ahead + set/number entry, variant auto-pick with dropdown, auto daily value snapshots.
