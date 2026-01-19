import { createRouter, type Route } from './router'
import { listUsers, createUser, getUser, deleteUser } from './handlers/users'

// Route definitions - in C this would be a static array of route_t structs
const routes: Route[] = [
  { method: 'GET', pattern: '/api/users', handler: listUsers },
  { method: 'POST', pattern: '/api/users', handler: createUser },
  { method: 'GET', pattern: '/api/users/:id', handler: getUser },
  { method: 'DELETE', pattern: '/api/users/:id', handler: deleteUser },
]

const router = createRouter(routes)

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

const server = Bun.serve({
  port: 3000,

  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname

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
})

console.log(`Server running at http://localhost:${server.port}`)
