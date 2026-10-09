// Packs the site for PHP hosting, for now the subdomain of the AALF site (see hosting/deploy-elia.sh):
//
//   node hosting/bundle.mjs [https://elia.allafricanleatherfair.org]
//
// 1. builds the pages for that address, kept out of search engines (SITE_URL, NOINDEX=1);
// 2. puts the pages, scripts and typefaces (web/dist without film/ and media/), the PHP form handlers (hosting/api)
//    and the Apache rules (hosting/htaccess-elia.conf, with the hashes of the pages' inline scripts) into
//    hosting/out/elia-site-<commit>.tar.gz, a few MB, with the commit in a VERSION file;
// 3. copies deploy-elia.sh next to it.
// The films and photos are not in the package: the server downloads them from GitHub at that same commit, so the
// commit must be pushed and web/public must have no changes that are not committed (checked here).
// Afterwards the normal build (for www.eliaet.com) is made again, so web/dist is what it was.
import { execFileSync, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SITE = (process.argv[2] || 'https://elia.allafricanleatherfair.org').replace(/\/+$/, '')
const OUT = path.join(repo, 'hosting', 'out')
const dist = path.join(repo, 'web', 'dist')
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim()

// the films and photos come from GitHub at this commit: it must be there, with every picture committed
const commit = git('rev-parse', 'HEAD')
const dirty = git('status', '--porcelain', '--', 'web/public')
if (dirty) {
  console.error(`!! web/public has changes that are not committed:\n${dirty}\nCommit and push them first.`)
  process.exit(1)
}
const remote = git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0]
const onGitHub = remote === commit || spawnSync('git', ['merge-base', '--is-ancestor', commit, remote], { cwd: repo }).status === 0
if (!onGitHub) {
  console.error(`!! ${commit.slice(0, 7)} is not on GitHub yet (main there is ${remote.slice(0, 7)}). Push first.`)
  process.exit(1)
}

const build = (env) => {
  const r = spawnSync('npm', ['run', 'build', '-w', 'web'], { cwd: repo, stdio: 'inherit', env: { ...process.env, ...env } })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

console.log(`bundle: building for ${SITE}`)
build({ SITE_URL: SITE, NOINDEX: '1' })

const stage = fs.mkdtempSync(path.join(repo, 'hosting', '.stage-'))
try {
  const site = path.join(stage, 'site')
  fs.mkdirSync(site, { recursive: true })
  for (const e of fs.readdirSync(dist)) {
    if (e === 'film' || e === 'media') continue
    fs.cpSync(path.join(dist, e), path.join(site, e), { recursive: true })
  }
  fs.cpSync(path.join(repo, 'hosting', 'api'), path.join(site, 'api'), { recursive: true })
  // _assets/ files carry a fingerprint in their names: browsers may keep them for a year
  fs.writeFileSync(
    path.join(site, '_assets', '.htaccess'),
    '# the names of these files change whenever their content does\n<IfModule mod_headers.c>\n    Header set Cache-Control "public, max-age=31536000, immutable"\n</IfModule>\n',
  )

  // the Content-Security-Policy allows the pages' few inline scripts by their hashes (as the Node server does)
  const hashes = new Set()
  for (const f of fs.readdirSync(site).filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(site, f), 'utf8')
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/type=["']?application\/(ld\+)?json/.test(m[1]) || !m[2].trim()) continue
      hashes.add(`'sha256-${crypto.createHash('sha256').update(m[2], 'utf8').digest('base64')}'`)
    }
  }
  const conf = fs.readFileSync(path.join(repo, 'hosting', 'htaccess-elia.conf'), 'utf8').replaceAll('__SCRIPT_HASHES__', [...hashes].join(' '))
  fs.writeFileSync(path.join(stage, 'htaccess-elia.conf'), conf)
  fs.writeFileSync(path.join(stage, 'VERSION'), commit + '\n')
  fs.writeFileSync(path.join(stage, 'SITE'), SITE + '\n')

  fs.mkdirSync(OUT, { recursive: true })
  for (const old of fs.readdirSync(OUT).filter((f) => /^elia-site-.*\.tar\.gz$/.test(f))) fs.rmSync(path.join(OUT, old))
  const file = path.join(OUT, `elia-site-${commit.slice(0, 7)}.tar.gz`)
  execFileSync('tar', ['czf', file, '-C', stage, '.'])
  fs.copyFileSync(path.join(repo, 'hosting', 'deploy-elia.sh'), path.join(OUT, 'deploy-elia.sh'))
  fs.chmodSync(path.join(OUT, 'deploy-elia.sh'), 0o755)
  console.log(`bundle: ${path.relative(repo, file)} (${Math.round(fs.statSync(file).size / 1024)} kB), ${hashes.size} inline script hashes, commit ${commit.slice(0, 7)}`)
} finally {
  fs.rmSync(stage, { recursive: true, force: true })
}

console.log('bundle: building again for www.eliaet.com')
build({ SITE_URL: '', NOINDEX: '' })
