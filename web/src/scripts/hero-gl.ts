/* ELIA · the home film's last frame, kept alive (WebGL: one picture, one fragment shader, nothing to download but
   the frame the page already shows). The hills shift with depth as the pointer moves, or breathe slowly on their
   own; cloud shadows drift over the land; the tannery's chimney keeps smoking. Drawn only while it is on screen,
   at most at 1.5 pixels per CSS pixel. Where WebGL is missing the picture simply stays (with its CSS drift). */

const VERT = `
attribute vec2 p;
varying vec2 vUv;
void main() { vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`

const FRAG = `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes, uImg, uCam, uChimney;
uniform float uTime, uLean, uHorizon;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}

void main() {
  // the picture covers the canvas (as object-fit: cover), a touch larger so its edges never show when it moves
  float rs = uRes.x / uRes.y, ri = uImg.x / uImg.y;
  vec2 s = rs > ri ? vec2(1.0, ri / rs) : vec2(rs / ri, 1.0);
  vec2 iuv = (vec2(vUv.x, 1.0 - vUv.y) - 0.5) * s * 0.96 + 0.5;          // the picture's own uv, y down

  // depth: the sky and far hills stay, the yard below moves most
  float depth = smoothstep(uHorizon - 0.06, 1.0, iuv.y);
  depth *= depth;
  vec2 q = iuv + uCam * depth;
  vec3 col = texture2D(uTex, q).rgb;

  // cloud shadows drifting slowly over the land
  float land = smoothstep(uHorizon - 0.12, uHorizon + 0.04, iuv.y);
  float cl = fbm(q * vec2(2.2, 3.6) + vec2(uTime * 0.014, uTime * 0.005));
  col *= 1.0 - land * smoothstep(0.5, 0.78, cl) * 0.2;
  // and a soft, slow light across the hills
  col *= 1.0 + 0.05 * (1.0 - land) * sin(uTime * 0.12 + q.x * 3.0);

  // the chimney's smoke: a plume from its top, rising and leaning with the wind, torn by noise
  vec2 d = q - uChimney;
  d.x *= ri;
  float up = -d.y;
  if (up > 0.0) {
    float lean = up * up * uLean + sin(uTime * 0.35 + up * 9.0) * 0.004 * up * 10.0;
    float w = 0.004 + up * 0.16;
    float dx = (d.x - lean) / w;
    float n = fbm(vec2(d.x * 10.0 + uTime * 0.1, up * 8.0 - uTime * 0.6));
    float body = exp(-dx * dx * 1.1) * smoothstep(0.0, 0.04, up) * (1.0 - smoothstep(0.1, 0.36, up));
    float smoke = body * smoothstep(0.32, 0.72, n + 0.18 - up * 0.6);
    col = mix(col, vec3(0.9, 0.9, 0.88), clamp(smoke * 0.7, 0.0, 0.7));
  }
  gl_FragColor = vec4(col, 1.0);
}`

export interface HeroGL { start(): void; stop(): void; destroy(): void }

export function mountHeroGL(
  canvas: HTMLCanvasElement,
  src: string,
  portrait: boolean,
  pointer: () => { x: number; y: number },
): Promise<HeroGL | null> {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' })
  if (!gl) return Promise.resolve(null)
  const sh = (type: number, code: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, code); gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader')
    return s
  }
  let prog: WebGLProgram
  try {
    prog = gl.createProgram()!
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return Promise.resolve(null)
  } catch { return Promise.resolve(null) }
  gl.useProgram(prog)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'p')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const u = (n: string) => gl.getUniformLocation(prog, n)
  const U = { tex: u('uTex'), res: u('uRes'), img: u('uImg'), cam: u('uCam'), chimney: u('uChimney'), time: u('uTime'), lean: u('uLean'), horizon: u('uHorizon') }
  // where the chimney's top is in each frame (the wide one, and the tall one for phones), and how the smoke leans
  const shot = portrait ? { chimney: [0.952, 0.452], lean: -2.3, horizon: 0.3 } : { chimney: [0.6956, 0.4385], lean: -1.45, horizon: 0.3 }
  gl.uniform2f(U.chimney, shot.chimney[0], shot.chimney[1])
  gl.uniform1f(U.lean, shot.lean)
  gl.uniform1f(U.horizon, shot.horizon)

  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onerror = () => resolve(null)
    img.onload = () => {
      const tex = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img)
      gl.uniform1i(U.tex, 0)
      gl.uniform2f(U.img, img.naturalWidth, img.naturalHeight)

      let raf = 0, t0 = performance.now(), running = false
      const size = () => {
        const dpr = Math.min(devicePixelRatio || 1, 1.5)
        const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr)
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h) }
        gl.uniform2f(U.res, w, h)
      }
      const frame = (now: number) => {
        const t = (now - t0) / 1000
        const p = pointer()
        // the camera: the pointer's pull, and a slow breath of its own
        const cx = -p.x * 0.011 + Math.sin(t * 0.09) * 0.0035
        const cy = -p.y * 0.007 + Math.cos(t * 0.07) * 0.0025
        size()
        gl.uniform2f(U.cam, cx, cy)
        gl.uniform1f(U.time, t)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        raf = requestAnimationFrame(frame)
      }
      const api: HeroGL = {
        start() { if (!running) { running = true; raf = requestAnimationFrame(frame) } },
        stop() { running = false; cancelAnimationFrame(raf) },
        destroy() { api.stop(); gl.getExtension('WEBGL_lose_context')?.loseContext() },
      }
      resolve(api)
    }
    img.src = src
  })
}
