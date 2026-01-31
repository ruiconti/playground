import { createRouter, type Route } from './router'
import { listUsers, createUser, getUser, deleteUser } from './handlers/users'
import { watch } from 'fs'
import { resolve } from 'path'
import { $ } from 'bun'

const isDev = process.env.NODE_ENV !== 'production'

// Route definitions - in C this would be a static array of route_t structs
const routes: Route[] = [
  { method: 'GET', pattern: '/api/users', handler: listUsers },
  { method: 'POST', pattern: '/api/users', handler: createUser },
  { method: 'GET', pattern: '/api/users/:id', handler: getUser },
  { method: 'DELETE', pattern: '/api/users/:id', handler: deleteUser },

  // WebSocket test endpoints
  { method: 'POST', pattern: '/api/ws/broadcast', handler: async (req) => {
    const body = await req.json() as { text: string }
    const msg = JSON.stringify({
      id: crypto.randomUUID(),
      text: body.text,
      sender: 'server',
      timestamp: Date.now(),
      type: 'server',
    })
    for (const client of chatClients) {
      client.send(msg)
    }
    return new Response(JSON.stringify({ sent: chatClients.size }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }},
  { method: 'POST', pattern: '/api/ws/disconnect/:username', handler: async (_req, params) => {
    const target = params.username
    for (const client of chatClients) {
      if (client.data.username === target) {
        client.close(1000, 'Server initiated disconnect')
        return new Response(JSON.stringify({ disconnected: target }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }
    return new Response(JSON.stringify({ error: 'Client not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }},
  { method: 'GET', pattern: '/api/ws/clients', handler: async () => {
    const clients = Array.from(chatClients).map(c => c.data.username)
    return new Response(JSON.stringify({ clients }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }},
]

const router = createRouter(routes)

// WebSocket chat state
type ChatClient = {
  username: string
}
const chatClients = new Set<import('bun').ServerWebSocket<ChatClient>>()

// Resolve paths for static file serving
const distDir = new URL('../dist', import.meta.url).pathname
const publicDir = new URL('../frontend/public', import.meta.url).pathname

async function serveStatic(path: string): Promise<Response | null> {
  // Try dist directory first (built assets)
  const distPath = `${distDir}${path}`
  let file = Bun.file(distPath)
  if (await file.exists()) {
    return new Response(file)
  }

  // Fall back to public directory
  const publicPath = `${publicDir}${path}`
  file = Bun.file(publicPath)
  if (await file.exists()) {
    return new Response(file)
  }

  return null
}

const server = Bun.serve<ChatClient>({
  port: 3000,

  async fetch(req, server) {
    const url = new URL(req.url)
    const path = url.pathname

    // WebSocket upgrade for chat
    if (path === '/ws/chat') {
      const username = url.searchParams.get('username') || 'anonymous'
      const upgraded = server.upgrade(req, { data: { username } })
      if (!upgraded) {
        return new Response('WebSocket upgrade failed', { status: 400 })
      }
      return undefined
    }

    // API routes
    if (path.startsWith('/api/')) {
      const match = router.match(req.method, path)
      if (match) {
        return match.handler(req, match.params)
      }
      return new Response(JSON.stringify({ error: 'not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Static files
    const staticResponse = await serveStatic(path)
    if (staticResponse) {
      return staticResponse
    }

    // SPA fallback - serve index.html for client-side routing
    const indexFile = Bun.file(`${distDir}/index.html`)
    if (await indexFile.exists()) {
      return new Response(indexFile)
    }

    // Development fallback to public/index.html
    const devIndexFile = Bun.file(`${publicDir}/index.html`)
    if (await devIndexFile.exists()) {
      return new Response(devIndexFile)
    }

    return new Response('Not Found', { status: 404 })
  },

  websocket: {
    open(ws) {
      chatClients.add(ws)
      console.log(`[ws] ${ws.data.username} connected (${chatClients.size} clients)`)

      // Notify others
      const joinMsg = JSON.stringify({
        id: crypto.randomUUID(),
        type: 'system',
        text: `${ws.data.username} joined`,
        sender: 'system',
        timestamp: Date.now(),
      })
      for (const client of chatClients) {
        if (client !== ws) client.send(joinMsg)
      }
    },

    message(ws, message) {
      const text = typeof message === 'string' ? message : new TextDecoder().decode(message)

      // Broadcast to all clients
      const chatMsg = JSON.stringify({
        id: crypto.randomUUID(),
        text,
        sender: ws.data.username,
        timestamp: Date.now(),
      })
      for (const client of chatClients) {
        client.send(chatMsg)
      }
    },

    close(ws) {
      chatClients.delete(ws)
      console.log(`[ws] ${ws.data.username} disconnected (${chatClients.size} clients)`)

      // Notify others
      const leaveMsg = JSON.stringify({
        id: crypto.randomUUID(),
        type: 'system',
        text: `${ws.data.username} left`,
        sender: 'system',
        timestamp: Date.now(),
      })
      for (const client of chatClients) {
        client.send(leaveMsg)
      }
    },
  },
})

console.log(`Server running at http://localhost:${server.port}`)

// Dev mode: watch frontend and rebuild on changes
if (isDev) {
  const frontendDir = resolve(import.meta.dir, '../frontend')
  const srcDir = resolve(frontendDir, 'src')
  const publicDir = resolve(frontendDir, 'public')
  const outdir = resolve(import.meta.dir, '../dist')

  async function buildJS() {
    const result = await Bun.build({
      entrypoints: [resolve(srcDir, 'index.tsx')],
      outdir,
      naming: 'app.js',
      sourcemap: 'inline',
    })
    if (!result.success) {
      console.error('Build failed:', result.logs)
    }
    return result
  }

  async function copyPublicFiles() {
    const publicFiles = ['index.html']
    for (const file of publicFiles) {
      await Bun.write(`${outdir}/${file}`, Bun.file(`${publicDir}/${file}`))
    }
  }

  // Initial build
  await buildJS()
  await copyPublicFiles()
  console.log('Initial frontend build complete')

  // Watch entire frontend directory for changes (tracks imports from katas/, etc.)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  const ignoreDirs = ['node_modules', 'dist', '.git']

  watch(frontendDir, { recursive: true }, (_event, filename) => {
    if (!filename) return
    if (ignoreDirs.some(dir => filename.includes(dir))) return

    // JS/TS files trigger rebuild
    if (/\.(tsx?|jsx?|css)$/.test(filename)) {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(async () => {
        console.log(`[${new Date().toLocaleTimeString()}] ${filename} changed, rebuilding...`)
        await buildJS()
        console.log('Rebuild complete')
      }, 100)
    }

    // Public files get copied
    if (filename.startsWith('public/')) {
      console.log(`[${new Date().toLocaleTimeString()}] ${filename} changed, copying...`)
      copyPublicFiles()
    }
  })

  // Run Tailwind in watch mode
  $`bunx @tailwindcss/cli -i ${srcDir}/styles.css -o ${outdir}/styles.css --watch`.catch(() => {})

  console.log('Watching for frontend changes...')
}
