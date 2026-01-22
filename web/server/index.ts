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

  // Watch src for JS/TS changes
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  watch(srcDir, { recursive: true }, (_event, filename) => {
    if (!filename) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      console.log(`[${new Date().toLocaleTimeString()}] ${filename} changed, rebuilding...`)
      await buildJS()
      console.log('Rebuild complete')
    }, 100)
  })

  // Watch public directory
  watch(publicDir, { recursive: true }, async (_event, filename) => {
    if (!filename) return
    console.log(`[${new Date().toLocaleTimeString()}] public/${filename} changed, copying...`)
    await copyPublicFiles()
  })

  // Run Tailwind in watch mode
  $`bunx @tailwindcss/cli -i ${srcDir}/styles.css -o ${outdir}/styles.css --watch`.catch(() => {})

  console.log('Watching for frontend changes...')
}
