// @ts-check
import { defineConfig } from 'astro/config'

// Static output: every page is plain HTML. The Node server (../server) serves dist/ and the /api routes.
export default defineConfig({
  site: 'https://www.eliaet.com',
  output: 'static',
  trailingSlash: 'never',
  // the styles go inside each page: no stylesheet request stands between a slow phone and the first paint
  build: { format: 'file', inlineStylesheets: 'always', assets: '_assets' },
  compressHTML: true,
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  vite: {
    // three.js (the boot) is one ~670 kB chunk, loaded only when that section comes near
    build: { assetsInlineLimit: 2048, cssMinify: true, chunkSizeWarningLimit: 800 },
    server: { proxy: { '/api': 'http://localhost:4000' } },
  },
})
