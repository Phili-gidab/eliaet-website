// The field boots for the web: an OBJ (from 3ds Max, centimetres) and its PBR textures made into one GLB with
// meshopt compression. Each object of the OBJ (a boot) becomes a node of its own, standing on y = 0 at its own
// centre, so the page can set them out as it likes.
//   node tools/obj2glb.mjs <dir with boot.obj(.gz), base.jpg, normal.jpg, orm.jpg> <out.glb>
// (needs @gltf-transform/core, /extensions, /functions and meshoptimizer installed where it runs)
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { Document, NodeIO } from '@gltf-transform/core'
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions'
import { meshopt, weld, prune, dedup } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'

const [dir, out] = process.argv.slice(2)
const objPath = fs.existsSync(path.join(dir, 'boot.obj')) ? path.join(dir, 'boot.obj') : path.join(dir, 'boot.obj.gz')
let text = fs.readFileSync(objPath)
if (objPath.endsWith('.gz')) text = zlib.gunzipSync(text)
text = text.toString('utf8')

const V = [], T = [], N = []
const groups = []          // { name, faces: [[ [v,t,n], ... ], ...] }
let cur = null
for (const raw of text.split('\n')) {
  const line = raw.trim()
  if (line.startsWith('v ')) V.push(line.split(/\s+/).slice(1, 4).map(Number))
  else if (line.startsWith('vt ')) T.push(line.split(/\s+/).slice(1, 3).map(Number))
  else if (line.startsWith('vn ')) N.push(line.split(/\s+/).slice(1, 4).map(Number))
  else if (line.startsWith('o ')) { cur = { name: line.slice(2).trim(), faces: [] }; groups.push(cur) }
  else if (line.startsWith('f ')) {
    if (!cur) { cur = { name: 'boot', faces: [] }; groups.push(cur) }
    const idx = line.split(/\s+/).slice(1).map((c) => c.split('/').map((x) => (x ? parseInt(x, 10) : 0)))
    cur.faces.push(idx)
  }
}
console.log('vertices', V.length, 'uvs', T.length, 'normals', N.length, 'objects', groups.map((g) => `${g.name}:${g.faces.length}`).join(' '))

const S = 0.01   // centimetres to metres
const doc = new Document()
const buffer = doc.createBuffer()
const img = (f, mime) => doc.createTexture(f).setImage(fs.readFileSync(path.join(dir, f))).setMimeType(mime)
const mat = doc.createMaterial('leather')
  .setBaseColorTexture(img('base.jpg', 'image/jpeg'))
  .setNormalTexture(img('normal.jpg', 'image/jpeg'))
  .setMetallicRoughnessTexture(img('orm.jpg', 'image/jpeg'))
  .setOcclusionTexture(doc.getRoot().listTextures().find((t) => t.getName() === 'orm.jpg'))
  .setMetallicFactor(1).setRoughnessFactor(1)
const scene = doc.createScene('boots')

const fix = (i, len) => (i < 0 ? len + i : i - 1)
for (const g of groups) {
  const pos = [], uv = [], nor = [], index = []
  const seen = new Map()
  const vert = ([vi, ti, ni]) => {
    const key = `${vi}/${ti}/${ni}`
    let k = seen.get(key)
    if (k === undefined) {
      k = pos.length / 3
      const p = V[fix(vi, V.length)]
      pos.push(p[0] * S, p[1] * S, p[2] * S)
      const t = ti ? T[fix(ti, T.length)] : [0, 0]
      uv.push(t[0], 1 - t[1])
      const n = ni ? N[fix(ni, N.length)] : [0, 1, 0]
      nor.push(n[0], n[1], n[2])
      seen.set(key, k)
    }
    return k
  }
  for (const f of g.faces) {
    const ids = f.map(vert)
    for (let i = 1; i < ids.length - 1; i++) index.push(ids[0], ids[i], ids[i + 1])
  }
  // stand it on the floor at its own centre
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], pos[i + a]); max[a] = Math.max(max[a], pos[i + a]) }
  const c = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2]
  for (let i = 0; i < pos.length; i += 3) { pos[i] -= c[0]; pos[i + 1] -= c[1]; pos[i + 2] -= c[2] }
  console.log(g.name, 'size (m)', max.map((m, a) => (m - min[a]).toFixed(3)).join(' x '), 'was centred at', c.map((v) => v.toFixed(3)).join(','))
  const acc = (arr, type, Ctor) => doc.createAccessor().setArray(new Ctor(arr)).setType(type).setBuffer(buffer)
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc(pos, 'VEC3', Float32Array))
    .setAttribute('NORMAL', acc(nor, 'VEC3', Float32Array))
    .setAttribute('TEXCOORD_0', acc(uv, 'VEC2', Float32Array))
    .setIndices(acc(index, 'SCALAR', Uint32Array))
    .setMaterial(mat)
  const mesh = doc.createMesh(g.name).addPrimitive(prim)
  const node = doc.createNode(g.name).setMesh(mesh).setTranslation(c)
  scene.addChild(node)
}

await MeshoptEncoder.ready
await doc.transform(weld(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
await io.write(out, doc)
console.log('wrote', out, fs.statSync(out).size, 'bytes')
