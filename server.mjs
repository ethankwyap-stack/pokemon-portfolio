// Tiny dependency-free static server for the built app (dist/).
// Kept alive by the com.ethanyap.pokemon-portfolio LaunchAgent so
// http://localhost:4321 is always available after login.

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = 4321
const DIST = join(fileURLToPath(new URL('.', import.meta.url)), 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    // Resolve within dist/ only; anything traversal-ish falls through to 404.
    let path = normalize(join(DIST, decodeURIComponent(url.pathname)))
    if (!path.startsWith(DIST)) path = join(DIST, 'index.html')
    let body
    let ext = extname(path)
    try {
      body = await readFile(path)
    } catch {
      // SPA fallback: serve index.html for unknown paths.
      body = await readFile(join(DIST, 'index.html'))
      ext = '.html'
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' })
    res.end(body)
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end(`Server error: ${err.message}\nHave you run "npm run build" yet?`)
  }
}).listen(PORT, () => {
  console.log(`PokéFolio serving dist/ at http://localhost:${PORT}`)
})
