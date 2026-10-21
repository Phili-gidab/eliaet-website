// Packs the website as a Node.js app for cPanel's "Setup Node.js App", for now on the subdomain of the AALF site
// (see hosting/deploy-elia.sh):
//
//   node hosting/bundle.mjs [https://elia.allafricanleatherfair.org]
//
// 1. builds the pages for that address, kept out of search engines (SITE_URL, NOINDEX=1), and the server (one file,
//    server/dist/index.mjs, with everything it uses inside: nothing to install on the host);
// 2. puts the app into hosting/out/elia-app-<commit>.tar.gz, a few MB: app.js (the startup file), the server, the
//    content the database starts with, and the built pages without the films and photos;
// 3. copies deploy-elia.sh next to it.
// The films, photos and the profile PDF are not in the package: the server downloads them from GitHub at that same
// commit, so the commit must be pushed, with nothing uncommitted in web/public or server/data (checked here).
// Afterwards the normal build (for www.eliaet.com) is made again, so web/dist is what it was.
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
// --try: a package for a test install only (no check that GitHub has this commit)
const TRY = args.includes('--try')
const SITE = (args.find((a) => !a.startsWith('--')) || 'https://elia.allafricanleatherfair.org').replace(/\/+$/, '')
const OUT = path.join(repo, 'hosting', 'out')
const dist = path.join(repo, 'web', 'dist')
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim()

// what the server downloads from GitHub must be there at this commit
const commit = git('rev-parse', 'HEAD')
const dirty = git('status', '--porcelain', '--', 'web/public', 'server/data')
if (dirty && !TRY) {
  console.error(`!! web/public or server/data has changes that are not committed:\n${dirty}\nCommit and push them first.`)
  process.exit(1)
}
const remote = TRY ? commit : git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0]
const onGitHub = remote === commit || spawnSync('git', ['merge-base', '--is-ancestor', commit, remote], { cwd: repo }).status === 0
if (!onGitHub) {
  console.error(`!! ${commit.slice(0, 7)} is not on GitHub yet (main there is ${remote.slice(0, 7)}). Push first.`)
  process.exit(1)
}

const run = (args, env = {}) => {
  const r = spawnSync('npm', args, { cwd: repo, stdio: 'inherit', env: { ...process.env, ...env } })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

console.log(`bundle: building the pages for ${SITE}`)
run(['run', 'build', '-w', 'web'], { SITE_URL: SITE, NOINDEX: '1' })
console.log('bundle: building the server')
run(['run', 'build', '-w', 'server'])

const stage = fs.mkdtempSync(path.join(repo, 'hosting', '.stage-'))
try {
  const app = path.join(stage, 'app')
  const cp = (from, to, filter) => fs.cpSync(path.join(repo, from), path.join(app, to), { recursive: true, filter })
  // the pages, scripts and typefaces (the films and photos come from GitHub)
  fs.mkdirSync(path.join(app, 'web', 'dist'), { recursive: true })
  for (const e of fs.readdirSync(dist)) {
    if (e === 'film' || e === 'media') continue
    fs.cpSync(path.join(dist, e), path.join(app, 'web', 'dist', e), { recursive: true })
  }
  // the server, and the content the database starts with (its files, the profile PDF, come from GitHub)
  cp('server/dist', 'server/dist', (src) => !src.endsWith('.map'))
  cp('server/data', 'server/data', (src) => !src.includes(`${path.sep}seed${path.sep}files`))
  // the startup file, and a package.json that says what it is (nothing to install)
  fs.copyFileSync(path.join(repo, 'hosting', 'node', 'app.js'), path.join(app, 'app.js'))
  const node = JSON.parse(fs.readFileSync(path.join(repo, 'server', 'package.json'), 'utf8')).engines?.node ?? '>=22.13'
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({
    name: 'elia-website',
    private: true,
    version: `2.0.0+${commit.slice(0, 7)}`,
    description: 'Ethiopian Leather Industries Association: the website (one Node.js process; nothing to install)',
    main: 'app.js',
    scripts: { start: 'node app.js' },
    engines: { node },
  }, null, 2) + '\n')

  fs.copyFileSync(path.join(repo, 'hosting', 'htaccess-elia.conf'), path.join(stage, 'htaccess-elia.conf'))
  fs.writeFileSync(path.join(stage, 'VERSION'), commit + '\n')
  // what the films, photos and documents are at this commit: the server downloads them again only when this changes
  const tree = (p) => spawnSync('git', ['rev-parse', `HEAD:${p}`], { cwd: repo, encoding: 'utf8' }).stdout.trim().slice(0, 12) || 'none'
  fs.writeFileSync(path.join(stage, 'MEDIA'), ['web/public/film', 'web/public/media', 'server/data/seed/files'].map(tree).join('-') + '\n')
  fs.writeFileSync(path.join(stage, 'SITE'), SITE + '\n')

  fs.mkdirSync(OUT, { recursive: true })
  for (const old of fs.readdirSync(OUT).filter((f) => /^elia-(site|app)-.*\.tar\.gz$/.test(f))) fs.rmSync(path.join(OUT, old))
  const file = path.join(OUT, `elia-app-${commit.slice(0, 7)}.tar.gz`)
  execFileSync('tar', ['czf', file, '-C', stage, '.'])
  fs.copyFileSync(path.join(repo, 'hosting', 'deploy-elia.sh'), path.join(OUT, 'deploy-elia.sh'))
  fs.chmodSync(path.join(OUT, 'deploy-elia.sh'), 0o755)
  console.log(`bundle: ${path.relative(repo, file)} (${Math.round(fs.statSync(file).size / 1024)} kB), commit ${commit.slice(0, 7)}`)
} finally {
  fs.rmSync(stage, { recursive: true, force: true })
}

console.log('bundle: building the pages again for www.eliaet.com')
run(['run', 'build', '-w', 'web'], { SITE_URL: '', NOINDEX: '' })
