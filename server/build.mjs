// Bundles the server into dist/index.mjs and dist/cli.mjs (and the code they share, in dist/chunks/): everything it
// needs, so the host needs no npm install (node:sqlite is part of Node). node_modules is only for building and
// development. Whitespace is taken out (names are kept, so errors in the log still say where they come from); the
// source maps stay here for reading those errors, and are not sent to the server.
import fs from 'node:fs'
import { build } from 'esbuild'

fs.rmSync('dist', { recursive: true, force: true })

await build({
  entryPoints: { index: 'src/index.ts', cli: 'src/cli.ts' },
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  chunkNames: 'chunks/[name]-[hash]',
  bundle: true,
  splitting: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  minifyWhitespace: true,
  minifySyntax: true,
  sourcemap: 'linked',
  legalComments: 'none',
  logLevel: 'warning',
  external: ['node:*'],
  // some of the bundled packages are CommonJS and call require() for Node's own modules
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
})
console.log('server: dist/index.mjs, dist/cli.mjs')
