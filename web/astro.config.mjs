// @ts-check
import { defineConfig } from 'astro/config'

// Static output: every page is plain HTML. The Node server (../server) serves dist/ and the /api routes.
export default defineConfig({
  // the address the pages are served from (canonical and link-preview URLs); SITE_URL overrides it for a build that
  // goes somewhere else for a while (hosting/bundle.mjs: the subdomain of the AALF site)
  site: process.env.SITE_URL || 'https://www.eliaet.com',
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
