// The 3D stage's models, packed for the web (meshopt geometry, WebP textures):
//   node pack.mjs boot <aalf boot.glb> <out.glb>   the AALF boot, finished (its animation's last pose), no camera
//   node pack.mjs tote <tote_raw.glb> <ao.png> <out.glb> [size]   the baked tote, AO packed with the roughness
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, prune, quantize, meshopt, textureCompress, resample } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [kind, src, ...rest] = process.argv.slice(2);
const doc = await io.read(src);
const root = doc.getRoot();

function sample(sampler, t) {
  const inp = sampler.getInput().getArray(), out = sampler.getOutput().getArray();
  const n = sampler.getOutput().getElementSize();
  let i = 0;
  while (i < inp.length - 1 && inp[i + 1] < t) i++;
  if (t <= inp[0]) return Array.from(out.slice(0, n));
  if (i >= inp.length - 1) return Array.from(out.slice((inp.length - 1) * n, inp.length * n));
  const u = (t - inp[i]) / (inp[i + 1] - inp[i]);
  const a = out.slice(i * n, i * n + n), b = out.slice((i + 1) * n, (i + 1) * n + n);
  if (sampler.getInterpolation() === 'STEP') return Array.from(a);
  if (n === 4) {          // rotation: normalised lerp along the short way
    const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], s = d < 0 ? -1 : 1;
    const q = [0, 1, 2, 3].map((k) => a[k] * (1 - u) + b[k] * s * u);
    const l = Math.hypot(...q); return q.map((x) => x / l);
  }
  return Array.from(a).map((x, k) => x * (1 - u) + b[k] * u);
}

if (kind === 'boot') {
  const [out] = rest;
  const T = 7.3;                                   // as the AALF site: (LAST - 1) / FPS, the finished boot
  for (const a of root.listAnimations()) {
    for (const ch of a.listChannels()) {
      const node = ch.getTargetNode(), path = ch.getTargetPath();
      if (!node) continue;
      const v = sample(ch.getSampler(), T);
      if (path === 'translation') node.setTranslation(v);
      else if (path === 'rotation') node.setRotation(v);
      else if (path === 'scale') node.setScale(v);
    }
    a.dispose();
  }
  for (const n of root.listNodes()) {
    if (n.getCamera() || n.getName().startsWith('Cam_') || n.getName().startsWith('Label_')) n.dispose();
  }
  for (const c of root.listCameras()) c.dispose();
  await doc.transform(prune(), dedup(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  await io.write(out, doc);
  console.log('boot', out, fs.statSync(out).size);
} else if (kind === 'tote') {
  const [aoPath, out, sizeArg] = rest;
  const size = Number(sizeArg || 1024);
  const mat = root.listMaterials().find((m) => m.getName() === 'Tote_Leather');
  // occlusion (R) with the baked roughness (G): one texture, as glTF's ORM
  const mr = mat.getMetallicRoughnessTexture();
  const rough = await sharp(Buffer.from(mr.getImage())).extractChannel('green').raw().toBuffer({ resolveWithObject: true });
  const ao = await sharp(aoPath).resize(rough.info.width, rough.info.height).extractChannel('red').raw().toBuffer();
  const W = rough.info.width, H = rough.info.height, orm = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) { orm[i * 3] = ao[i]; orm[i * 3 + 1] = rough.data[i]; orm[i * 3 + 2] = 0; }
  const png = await sharp(orm, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
  const tex = doc.createTexture('tote_orm').setImage(new Uint8Array(png)).setMimeType('image/png');
  mat.setMetallicRoughnessTexture(tex).setOcclusionTexture(tex).setMetallicFactor(0).setRoughnessFactor(1);
  await doc.transform(
    dedup(), weld(), prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 82, slots: /^(baseColor|metallicRoughness|occlusion)/ }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 92, slots: /^normal/ }),
    quantize(), meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  await io.write(out, doc);
  console.log('tote', out, fs.statSync(out).size);
}
