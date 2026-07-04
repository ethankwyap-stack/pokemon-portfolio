# PokéFolio — Pokémon card portfolio

React 18 + TS + Vite 6 + Tailwind v4. Tracks owned cards with TCGplayer market prices via the free pokemontcg.io API (keyless; optional `VITE_POKEMONTCG_API_KEY` in `.env`).

## Serving — always-on localhost, no cloud deploy
- LaunchAgent `com.ethanyap.pokemon-portfolio` (`~/Library/LaunchAgents`) runs `server.mjs` (dep-free static server for `dist/`) at **http://localhost:4321**.
- **After any code change, run `npm run build`** — :4321 serves `dist/`, so changes are invisible until rebuilt.
- The plist hardcodes the nvm node path (`~/.nvm/versions/node/v24.14.1/bin/node`) — update it if node is upgraded.
- Dev server: `npm run dev` (but the user normally uses :4321).

## Data & API quirks
- All data in localStorage under `poke.*` keys (collection, price history, sets cache). Entries keyed by cardId+variant.
- pokemontcg.io is erratic: cache-cold queries can hang 20–60s then succeed fast on retry. `src/api.ts` aborts at 10s with up to 3 retries — keep that pattern.
- Brand-new sets may have empty `tcgplayer.prices` → card legitimately shows "—"/$0.

## User decisions
- No gain/loss tracking (no cost basis) — declined, don't add.
- Fast add flow matters: type-ahead + set/number entry, variant auto-pick with dropdown, auto daily value snapshots.
