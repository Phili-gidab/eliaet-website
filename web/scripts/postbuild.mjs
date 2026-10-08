// Astro's content layer leaves two empty module stubs in the output; nothing links to them, so they are not shipped.
import fs from 'node:fs'
import path from 'node:path'
const dist = path.resolve(process.argv[2] ?? 'dist')
for (const f of ['content-assets.mjs', 'content-modules.mjs']) fs.rmSync(path.join(dist, f), { force: true })
