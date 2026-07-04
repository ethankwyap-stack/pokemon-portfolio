# PokéFolio — Pokémon Card Portfolio

Track the Pokémon cards you own and their **TCGplayer market prices**, rolled up
into a portfolio with a value-over-time chart. Prices come from the free
[pokemontcg.io](https://pokemontcg.io) API (which embeds TCGplayer pricing);
every card links out to its TCGplayer page.

## Everyday use

Open **http://localhost:4321** — the LaunchAgent keeps the server running after
login, so it's always there. (Or double-click `launch.command`.)

- **Add cards fast:** type a name, click a result. Or switch to *Set + number*
  and enter collector numbers.
- **Variants:** the printing (Holofoil / Normal / Reverse…) is auto-picked;
  switch it per card with the dropdown.
- **Value chart:** a snapshot is recorded automatically once a day when you
  open the app; use *Snapshot now* to force one.
- Your collection lives in this browser's localStorage (`poke.*` keys).

## Development

```sh
npm install
npm run dev        # Vite dev server at http://localhost:5173
npm run build      # type-check + build to dist/ (what the :4321 server serves)
npm run serve      # run the static server manually
```

After making code changes, run `npm run build` so the always-on server picks
them up.

## Always-on server setup (one-time)

```sh
npm run build
cp com.ethanyap.pokemon-portfolio.plist ~/Library/LaunchAgents/
launchctl load -w ~/Library/LaunchAgents/com.ethanyap.pokemon-portfolio.plist
```

## Optional API key

The pokemontcg.io API works keyless. For higher rate limits, get a free key at
https://dev.pokemontcg.io and put it in `.env` (see `.env.example`).
