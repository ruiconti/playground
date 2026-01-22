import { $ } from 'bun'
import { watch } from 'fs'
import { resolve } from 'path'

const outdir = '../dist'
const isWatch = process.argv.includes('--watch')

async function buildJS() {
  const result = await Bun.build({
    entrypoints: ['./src/index.tsx'],
    outdir,
    naming: 'app.js',
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV !== 'production' ? 'inline' : 'none',
  })
  if (!result.success) {
    console.error('Build failed:', result.logs)
  }
  return result
}

async function copyPublicFiles() {
  const publicFiles = ['index.html']
  for (const file of publicFiles) {
    await Bun.write(`${outdir}/${file}`, Bun.file(`./public/${file}`))
  }
}

// Initial build
await buildJS()
await copyPublicFiles()
console.log('Build complete')

if (isWatch) {
  console.log('Watching for changes...')

  // Watch src directory for JS/TS changes
  const srcDir = resolve(import.meta.dir, 'src')
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  watch(srcDir, { recursive: true }, (event, filename) => {
    if (!filename) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      console.log(`[${new Date().toLocaleTimeString()}] ${filename} changed, rebuilding...`)
      await buildJS()
      console.log('Rebuild complete')
    }, 100)
  })

  // Watch public directory
  const publicDir = resolve(import.meta.dir, 'public')
  watch(publicDir, { recursive: true }, async (event, filename) => {
    if (!filename) return
    console.log(`[${new Date().toLocaleTimeString()}] public/${filename} changed, copying...`)
    await copyPublicFiles()
  })

  // Run Tailwind in watch mode (runs in background)
  $`bunx @tailwindcss/cli -i ./src/styles.css -o ${outdir}/styles.css --watch`.catch(() => {})
} else {
  // One-time CSS build
  await $`bunx @tailwindcss/cli -i ./src/styles.css -o ${outdir}/styles.css ${process.env.NODE_ENV === 'production' ? '--minify' : ''}`
}
