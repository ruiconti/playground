import { $ } from 'bun'

const outdir = '../dist'

// Build React app
await Bun.build({
  entrypoints: ['./src/index.tsx'],
  outdir,
  naming: 'app.js',
  minify: process.env.NODE_ENV === 'production',
  sourcemap: process.env.NODE_ENV !== 'production' ? 'inline' : 'none',
})

// Build CSS with Tailwind
await $`bunx @tailwindcss/cli -i ./src/styles.css -o ${outdir}/styles.css ${process.env.NODE_ENV === 'production' ? '--minify' : ''}`

// Copy static files from public to dist
const publicFiles = ['index.html']
for (const file of publicFiles) {
  await Bun.write(`${outdir}/${file}`, Bun.file(`./public/${file}`))
}

console.log('Build complete')
