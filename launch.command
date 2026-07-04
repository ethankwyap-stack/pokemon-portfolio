#!/bin/zsh
# Double-clickable launcher: builds if needed, ensures the server is running,
# and opens PokéFolio in the browser.
cd "$(dirname "$0")"

if [ ! -d dist ]; then
  echo "First run — installing and building…"
  [ -d node_modules ] || npm install
  npm run build
fi

# Start the server if nothing is listening on 4321 yet.
if ! lsof -i :4321 -sTCP:LISTEN >/dev/null 2>&1; then
  nohup node server.mjs >/tmp/pokemon-portfolio-server.log 2>&1 &
  sleep 1
fi

open "http://localhost:4321"
