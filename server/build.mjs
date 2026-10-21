// Bundles the server into dist/index.mjs and dist/cli.mjs: everything it needs in two files, so the host needs no
// npm install (node:sqlite is part of Node). The node_modules folder is only for building and development.
import fs from 'node:fs'
import { build } from 'esbuild'

fs.rmSync('dist', { recursive: true, force: true })

await build({
  entryPoints: { index: 'src/index.ts', cli: 'src/cli.ts' },
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: 'linked',
  legalComments: 'none',
  logLevel: 'warning',
  external: ['node:*'],
  // some of the bundled packages are CommonJS and call require() for Node's own modules
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
})
console.log('server: dist/index.mjs, dist/cli.mjs')
