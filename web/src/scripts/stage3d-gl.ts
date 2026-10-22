/* ELIA · the 3D stage, the part that draws (three.js). Loaded by stage3d.ts only when a stage comes near and the
   browser can draw 3D: a piece made in Blender for the hero film (the tote) or for the All African Leather Fair's
   site (the boot), lit like the studio picture it starts from. The picture (rendered in Blender from the same
   camera) stays until the model is ready; then the model takes its place and turns slowly. Drag, or use the arrow
   keys, to turn it yourself. Nothing is drawn while the stage is off screen. */
import {
  ACESFilmicToneMapping, AgXToneMapping, Box3, CanvasTexture, Color, DirectionalLight, Group, HemisphereLight, Mesh,
  MeshBasicMaterial, Object3D, PCFShadowMap, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Scene,
  ShadowMaterial, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export interface View {
  /** vertical field of view, degrees */
  fov: number
  /** the camera and the point it looks at, metres (y up; the piece stands on y = 0, its front towards +z) */
  cam: [number, number, number]
  target: [number, number, number]
  /** the piece's turn about its upright, degrees, as in the picture */
  turn: number
}
export interface Piece { key: string; model: string; view: View; label: string }

const TAU = Math.PI * 2
const D = Math.PI / 180
const AUTO = 9                                   // degrees a second, while nobody is turning it
const tone = typeof AgXToneMapping === 'number' ? AgXToneMapping : ACESFilmicToneMapping

export class Stage {
  root: HTMLElement
  canvas: HTMLCanvasElement
  renderer: WebGLRenderer
  scene = new Scene()
  camera = new PerspectiveCamera(24, 4 / 5, 0.02, 20)
  turntable = new Group()
  loader: GLTFLoader
  models = new Map<string, Promise<Object3D>>()
  piece: Piece | null = null
  reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  visible = false
  spin = 0; vel = 0; user = 0               // degrees: the piece's own turn, the visitor's momentum and turn
  idle = true                                 // turning on its own until someone takes hold of it
  drag: { id: number; x: number; trail: { t: number; s: number }[] } | null = null
  last = performance.now()
  raf = 0
  contact: Mesh
  key: DirectionalLight

  constructor(root: HTMLElement) {
    this.root = root
    this.canvas = root.querySelector('canvas')!
    const r = this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    r.outputColorSpace = SRGBColorSpace
    r.toneMapping = tone
    r.toneMappingExposure = 1.0
    r.shadowMap.enabled = true
    r.shadowMap.type = PCFShadowMap
    r.setClearColor(0x000000, 0)

    const pm = new PMREMGenerator(r)
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.55
    pm.dispose()
    // the studio picture's light: a big warm key from the front left and above, a top box, a rim from behind
    const key = this.key = new DirectionalLight(0xfff0e0, 2.1)
    key.position.set(-1.25, 1.35, 0.95)
    key.castShadow = true
    key.shadow.mapSize.setScalar(1024)
    Object.assign(key.shadow.camera, { left: -0.4, right: 0.4, top: 0.5, bottom: -0.3, near: 0.1, far: 5 })
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.002; key.shadow.radius = 7; key.shadow.blurSamples = 16
    const top = new DirectionalLight(0xfff7ee, 0.7); top.position.set(0.1, 2, 0.2)
    const rim = new DirectionalLight(0xffe2c4, 1.1); rim.position.set(0.9, 0.7, -1.2)
    const bounce = new HemisphereLight(0xfffaf2, 0xe8d2b4, 0.35)
    this.scene.add(key, key.target, top, rim, bounce, this.turntable)

    // the floor shows only the shadows, on the stage's own colour
    const floor = new Mesh(new PlaneGeometry(4, 4), new ShadowMaterial({ color: new Color(0x3c1e16), opacity: 0.16 }))
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true
    this.scene.add(floor)
    const blob = document.createElement('canvas'); blob.width = blob.height = 128
    const g = blob.getContext('2d')!, grad = g.createRadialGradient(64, 64, 2, 64, 64, 63)
    grad.addColorStop(0, 'rgba(255,252,245,1)'); grad.addColorStop(0.55, 'rgba(255,252,245,0.45)'); grad.addColorStop(1, 'rgba(255,252,245,0)')
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128)
    this.contact = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({
      map: new CanvasTexture(blob), color: 0x3c1e16, transparent: true, opacity: 0.48, depthWrite: false, toneMapped: false,
    }))
    this.contact.rotation.x = -Math.PI / 2; this.contact.position.y = 0.0008
    this.turntable.add(this.contact)

    this.loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    this.bind()
    this.resize()
  }

  load(p: Piece): Promise<Object3D> {
    let m = this.models.get(p.key)
    if (!m) {
      m = this.loader.loadAsync(p.model).then((gltf) => {
        const s = gltf.scene
        s.traverse((o) => {
          if ((o as Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true }
        })
        return s
      })
      this.models.set(p.key, m)
    }
    return m
  }

  /** show a piece: resolves once it is on the stage */
  async show(p: Piece) {
    const model = await this.load(p)
    this.piece = p
    for (const c of [...this.turntable.children]) if (c !== this.contact) this.turntable.remove(c)
    // the contact shadow follows the footprint (measured with the piece on its own, unturned)
    model.removeFromParent()
    model.updateMatrixWorld(true)
    const box = new Box3().setFromObject(model), size = box.getSize(new Vector3())
    this.turntable.add(model)
    this.contact.scale.set(size.x * 1.25, size.z * 1.6, 1)
    const v = p.view
    this.camera.fov = v.fov
    this.camera.position.set(...v.cam)
    this.camera.lookAt(new Vector3(...v.target))
    this.camera.updateProjectionMatrix()
    this.key.target.position.set(v.target[0], 0, v.target[2])
    this.spin = v.turn; this.user = 0; this.vel = 0; this.idle = !this.reduce
    this.canvas.setAttribute('aria-label', p.label)
    this.frame(true)
    this.loop()
  }

  bind() {
    new ResizeObserver(() => { this.resize(); this.frame(true) }).observe(this.canvas)
    // on screen, and not under the next sections (a held section stays in the viewport: scripts/motion.ts)
    let seen = false, covered = false
    const update = () => { this.visible = seen && !covered; if (this.visible) this.loop() }
    new IntersectionObserver((es) => { seen = es[0].isIntersecting; update() }).observe(this.canvas)
    this.canvas.closest('main > section')?.addEventListener('sheet-covered', (e) => { covered = (e as CustomEvent<boolean>).detail; update() })
    const c = this.canvas
    c.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return
      this.drag = { id: e.pointerId, x: e.clientX, trail: [] }
      this.vel = 0; this.idle = false
      c.setPointerCapture(e.pointerId)
      this.root.classList.add('is-turning', 'is-used')
      this.loop()
    })
    c.addEventListener('pointermove', (e) => {
      const d = this.drag
      if (!d || d.id !== e.pointerId) return
      const dx = e.clientX - d.x; d.x = e.clientX
      this.user += dx * 0.45
      const now = performance.now(); d.trail.push({ t: now, s: this.user })
      while (d.trail.length > 2 && now - d.trail[0].t > 100) d.trail.shift()
    })
    const end = (e: PointerEvent) => {
      const d = this.drag
      if (!d || d.id !== e.pointerId) return
      this.drag = null
      this.root.classList.remove('is-turning')
      const a = d.trail[0], b = d.trail[d.trail.length - 1]
      if (a && b && b.t > a.t && performance.now() - b.t < 80) this.vel = Math.max(-480, Math.min(480, (b.s - a.s) / ((b.t - a.t) / 1000)))
      this.loop()
    }
    c.addEventListener('pointerup', end)
    c.addEventListener('pointercancel', end)
    c.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      this.idle = false
      this.root.classList.add('is-used')
      if (this.reduce) this.user += e.key === 'ArrowLeft' ? -15 : 15
      else this.vel += e.key === 'ArrowLeft' ? -140 : 140
      this.loop()
    })
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  loop() {
    if (this.raf) return
    this.last = performance.now()
    const tick = () => {
      this.raf = 0
      const moving = this.frame()
      if (this.visible && moving) this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  /** one frame; true while something is still moving */
  frame(force = false): boolean {
    const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    let moving = false
    if (this.idle && !this.drag) { this.spin += AUTO * dt; moving = true }
    if (!this.drag && Math.abs(this.vel) > 0.5) {
      this.user += this.vel * dt
      this.vel *= Math.pow(0.04, dt)                // the momentum dies away in about a second
      moving = true
    } else if (!this.drag) this.vel = 0
    if (this.drag) moving = true
    if (!moving && !force) return false
    this.turntable.rotation.y = ((this.spin + this.user) * D) % TAU
    this.renderer.render(this.scene, this.camera)
    return moving
  }
}
