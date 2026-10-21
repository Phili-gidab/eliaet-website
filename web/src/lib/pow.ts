/* The forms' spam check, the browser's side: a small proof-of-work puzzle (server/src/security.ts) solved while the
   visitor types. No picture to read, nothing sent to another company. solvePow() resolves to the token the form
   sends as "pow"; ready() starts one in the background so it is usually done before the form is. */

// SHA-256 over a short ASCII string, in plain JavaScript (fast enough for tens of thousands of tries)
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])
const W = new Uint32Array(64)

/** the first 32 bits of SHA-256(s), for s of ASCII characters */
function sha256head(s: string): number {
  const n = s.length
  const blocks = ((n + 8) >> 6) + 1
  const words = new Uint32Array(blocks * 16)
  for (let i = 0; i < n; i++) words[i >> 2] |= s.charCodeAt(i) << (24 - (i & 3) * 8)
  words[n >> 2] |= 0x80 << (24 - (n & 3) * 8)
  words[blocks * 16 - 1] = n * 8
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19
  for (let b = 0; b < blocks; b++) {
    for (let t = 0; t < 16; t++) W[t] = words[b * 16 + t]
    for (let t = 16; t < 64; t++) {
      const x = W[t - 15], y = W[t - 2]
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0
    }
    let a = h0, bb = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + K[t] + W[t]) | 0
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
      const maj = (a & bb) ^ (a & c) ^ (bb & c)
      const t2 = (S0 + maj) | 0
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0
    }
    h0 = (h0 + a) | 0; h1 = (h1 + bb) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0
  }
  return h0 >>> 0
}

interface Challenge { id: string; salt: string; bits: number; expires: number; sig: string }

async function solve(c: Challenge): Promise<string> {
  const limit = c.bits >= 32 ? 0 : 2 ** (32 - c.bits)        // the first 32 bits must be below this
  let n = 0
  for (;;) {
    const end = n + 6000
    for (; n < end; n++) if (sha256head(c.salt + n) < limit) return `${c.id}.${c.salt}.${c.bits}.${c.expires}.${c.sig}.${n}`
    await new Promise((r) => setTimeout(r, 0))               // let the page breathe
  }
}

let pending: { at: number; token: Promise<string> } | null = null

/** Starts a puzzle in the background (once); a later solvePow() picks it up. */
export function ready() {
  if (pending && Date.now() - pending.at < 25 * 60 * 1000) return
  const token = fetch('/api/pow', { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('pow'))))
    .then((c: Challenge) => solve(c))
  token.catch(() => { pending = null })
  pending = { at: Date.now(), token }
}

/** A solved token for one send (each token works once). */
export async function solvePow(): Promise<string> {
  ready()
  const p = pending!
  pending = null
  return p.token
}
