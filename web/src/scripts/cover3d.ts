/* ELIA · leather goods in 3D on a cover (components/Cover.astro, the Programs page): a pair of field boots in front
   of the page's title on its colour, facing out of the page and turned a little apart, lit like the studio pictures
   (the same lights as the 3D stage, scripts/stage3d-gl.ts). They come up when the models are in,
   turn a little on their own, lean towards the pointer, and turn further as the page scrolls on. Nothing is drawn
   while the cover is off screen, nor while nothing moves. */
import {
  ACESFilmicToneMapping, AgXToneMapping, Box3, CanvasTexture, Color, DirectionalLight, Group, HemisphereLight, Mesh,
  MeshBasicMaterial, Object3D, PCFShadowMap, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Scene, ShadowMaterial,
  SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const D = Math.PI / 180
/* where the boots stand (metres, a boot about 0.2 high), facing out of the page (a turn of 0) and turned a little
   apart, with a gap between them */
/* the framing: how much of the screen's width and height the pieces take (wide screens; N: narrow ones), and where
   their centre sits (-1..1 across, -1..1 up) */
const F = { share: 0.33, tall: 0.5, sx: 0.6, sy: 0.2, shareN: 0.88, tallN: 0.84, syN: -0.06 }
const LAYOUT = {
  boots: 1,
  left: { x: -0.085, z: 0, turn: -10 },
  right: { x: 0.085, z: 0.012, turn: 12 },
}
const tone = typeof AgXToneMapping === 'number' ? AgXToneMapping : ACESFilmicToneMapping

/** a soft round shadow under a piece, where it touches the floor */
function contactShadow(): Mesh {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')!, grad = g.createRadialGradient(64, 64, 2, 64, 64, 63)
  grad.addColorStop(0, 'rgba(255,252,245,1)'); grad.addColorStop(0.55, 'rgba(255,252,245,0.45)'); grad.addColorStop(1, 'rgba(255,252,245,0)')
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128)
  const m = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: new CanvasTexture(c), color: 0x3c1e16, transparent: true, opacity: 0.44, depthWrite: false, toneMapped: false }))
  m.rotation.x = -Math.PI / 2; m.position.y = 0.0008
  return m
}

export async function mountGoods(canvas: HTMLCanvasElement, cover: HTMLElement): Promise<boolean> {
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  } catch { return false }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = tone
  renderer.toneMappingExposure = 1.02
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.setClearColor(0x000000, 0)

  const scene = new Scene()
  const pm = new PMREMGenerator(renderer)
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.6
  pm.dispose()
  const key = new DirectionalLight(0xfff0e0, 2.2)
  key.position.set(-1.4, 1.6, 1.1)
  key.castShadow = true
  key.shadow.mapSize.setScalar(2048)
  Object.assign(key.shadow.camera, { left: -0.9, right: 0.9, top: 0.9, bottom: -0.4, near: 0.1, far: 6 })
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.002; key.shadow.radius = 8; key.shadow.blurSamples = 16
  const top = new DirectionalLight(0xfff7ee, 0.7); top.position.set(0.1, 2, 0.2)
  const rim = new DirectionalLight(0xffe2c4, 1.2); rim.position.set(1.1, 0.8, -1.3)
  const bounce = new HemisphereLight(0xfffaf2, 0xe8c48a, 0.4)
  scene.add(key, key.target, top, rim, bounce)
  const floor = new Mesh(new PlaneGeometry(8, 8), new ShadowMaterial({ color: new Color(0x3c1e16), opacity: 0.2 }))
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true
  scene.add(floor)

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const load = (url: string) => loader.loadAsync(url).then((g) => {
    g.scene.traverse((o) => { if ((o as Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } })
    return g.scene
  })
  let boots: Object3D
  try {
    boots = await load('/media/3d/fieldboots.glb')
  } catch { renderer.dispose(); return false }
  // the field boots (tools/obj2glb.mjs): one boot, set on the floor at the centre of a holder of its own (its node
  // keeps its own transform: meshopt's quantisation lives in it); its pair is the holder mirrored
  const bootNode = boots.getObjectByName('FieldBoot_Model___01') ?? boots.children[0]
  bootNode.removeFromParent()
  bootNode.updateMatrixWorld(true)
  const bb = new Box3().setFromObject(bootNode), bc = bb.getCenter(new Vector3())
  bootNode.position.x -= bc.x; bootNode.position.y -= bb.min.y; bootNode.position.z -= bc.z
  const boot = new Group(); boot.add(bootNode)

  // each piece on its own turntable, with its contact shadow; the boots a pair (the left one is the right mirrored)
  const stand = (o: Object3D, mirror = false) => {
    const t = new Group()
    if (mirror) o.scale.x *= -1                    // three.js turns the faces round for a mirrored piece
    const box = new Box3().setFromObject(o), size = box.getSize(new Vector3())
    const shadow = contactShadow(); shadow.scale.set(size.x * 1.3, size.z * 1.7, 1)
    t.add(o, shadow)
    return t
  }
  const group = new Group()
  const B = LAYOUT.boots
  boot.scale.setScalar(B)
  const bootR = stand(boot)
  const bootL = stand(boot.clone(true), true)
  const place = (t: Group, p: { x: number; z: number; turn: number }) => { t.position.set(p.x, 0, p.z); t.rotation.y = p.turn * D }
  place(bootL, LAYOUT.left); place(bootR, LAYOUT.right)
  group.add(bootR, bootL)
  scene.add(group)
  // the pieces' own extent (not their shadows), at rest, for the framing (the group moves once it is up)
  group.updateMatrixWorld(true)
  const rest = new Box3()
  for (const t of [bootL, bootR]) rest.union(new Box3().setFromObject(t.children[0]))
  const gsize = rest.getSize(new Vector3()), gcenter = rest.getCenter(new Vector3())

  // a long lens, as for a product photograph: the pieces keep their proportions and stand on one floor
  const camera = new PerspectiveCamera(16, 1, 0.05, 60)
  const frame = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    const aspect = w / h
    camera.aspect = aspect
    const t = Math.tan((camera.fov / 2) * D)
    const narrow = matchMedia('(max-width: 760px)').matches     // a phone: the boots centred under the title
    // the goods stand to the right of a wide screen, under the title on a narrow one; far enough to fit
    const share = narrow ? F.shareN : F.share                         // of the screen's width
    const tall = narrow ? F.tallN : F.tall                            // of its height
    const dW = gsize.x / (2 * t * aspect * share), dH = gsize.y / (2 * t * tall)
    const dist = Math.max(dW, dH)
    const halfW = t * aspect * dist, halfH = t * dist
    // where on the screen the group's centre goes (-1..1), and how far down the floor sits
    const sx = narrow ? 0 : F.sx, sy = narrow ? F.syN : F.sy
    camera.position.set(gcenter.x - sx * halfW, gcenter.y + dist * 0.16, gcenter.z + dist)
    camera.lookAt(new Vector3(gcenter.x - sx * halfW, gcenter.y - sy * halfH, gcenter.z))
    camera.updateProjectionMatrix()
    key.target.position.set(gcenter.x, 0, gcenter.z)
  }
  frame()

  // motion: up from below as it arrives, the pointer, the scroll, and a slow sway of its own
  let rise = reduce ? 1 : 0, px = 0, py = 0, tx = 0, ty = 0, scroll = 0, t0 = performance.now()
  let visible = true, raf = 0
  const start = performance.now()
  const tick = () => {
    raf = 0
    const now = performance.now(), time = (now - t0) / 1000
    rise = reduce ? 1 : Math.min(1, (now - start) / 1600)
    const e = 1 - Math.pow(1 - rise, 4)
    px += (tx - px) * 0.06; py += (ty - py) * 0.06
    const sway = reduce ? 0 : Math.sin(time * 0.5) * 4
    group.position.y = (1 - e) * -0.22 + scroll * 0.06
    group.rotation.y = (px * 9 + sway) * D + scroll * 28 * D - (1 - e) * 18 * D
    group.rotation.x = py * 2.5 * D
    renderer.render(scene, camera)
    const moving = !reduce || rise < 1 || Math.abs(tx - px) + Math.abs(ty - py) > 0.002
    if (visible && moving) raf = requestAnimationFrame(tick)
  }
  const go = () => { if (!raf && visible) raf = requestAnimationFrame(tick) }
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; go() }).observe(canvas)
  new ResizeObserver(() => { frame(); go() }).observe(canvas)
  cover.addEventListener('pointermove', (ev) => {
    const r = cover.getBoundingClientRect()
    tx = ((ev.clientX - r.left) / r.width) * 2 - 1
    ty = ((ev.clientY - r.top) / r.height) * 2 - 1
    go()
  })
  addEventListener('scroll', () => {
    scroll = Math.min(1, Math.max(0, scrollY / Math.max(1, cover.offsetHeight)))
    go()
  }, { passive: true })
  cover.classList.add('has-gl')
  go()
  return true
}
