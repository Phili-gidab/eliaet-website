/* ELIA · the home page's door, drawn on the graphics card (WebGL, one fragment shader). The page colour with the
   ELIA lockup set into it; inside the mark, the film. The shapes come from a distance field baked from the logo's
   own vectors (tools/door_sdf.py: red the e, green the wordmark) and the dot is an exact circle, so the edges stay
   sharp at any size, and nothing has to be redrawn on the processor while the page scrolls.
   The caller (scripts/story.ts) moves the state; this draws it. */

const VERT = `
attribute vec2 p;
varying vec2 vUv;
void main() { vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`

const FRAG = `
precision highp float;
uniform sampler2D uSdf, uFilm;
uniform vec2 uRes, uT, uFilmSize;
uniform vec4 uBox;
uniform float uS, uRange, uK, uSweep, uDot, uDotY, uWordX, uWordA, uFilmIn, uRim, uView, uColor, uEA;
varying vec2 vUv;

const vec3 CREAM = vec3(1.0, 0.988, 0.961);
const vec3 AMBER = vec3(0.886, 0.627, 0.145);
const vec3 TAUPE = vec3(0.478, 0.404, 0.384);
const vec3 BROWN = vec3(0.235, 0.118, 0.086);
const vec3 AMBER20 = vec3(0.980, 0.937, 0.859);
const vec2 DOTC = vec2(367.52, 251.05);
const float DOTR = 10.17;
const vec2 EC = vec2(311.0, 281.6);
const float PI = 3.14159265;

// signed distance (logo units, positive inside) from the baked field: channel 0 the e, 1 the wordmark
float field(vec2 L, int ch) {
  vec2 t = (L - uBox.xy) / uBox.zw;
  if (t.x < 0.0 || t.y < 0.0 || t.x > 1.0 || t.y > 1.0) return -1e3;
  vec2 v = texture2D(uSdf, t).rg;
  float c = ch == 0 ? v.r : v.g;
  return (c - 0.5) * 2.0 * uRange / uK;
}

void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes;          // the screen, y down
  vec2 L = (px - uT) / uS;                              // the logo's own units
  float aa = 0.8 / uS;                                  // a little under one screen pixel, in logo units

  // the e, drawn round from the west (as in the brand film) while uSweep runs from 0 to 1
  float dE = field(L, 0);
  vec2 q = L - EC;
  float turn = mod(atan(q.y, q.x) - PI, 2.0 * PI) / (2.0 * PI);
  float swept = uSweep >= 1.0 ? 1.0 : smoothstep(turn - 0.02, turn, uSweep);
  // (uEA: the e itself, which gives way as the page goes in through the dot, so only the dot opens onto the film)
  float mE = smoothstep(-aa, aa, dE) * swept * uEA;

  // the dot, dropping in and settling
  float r = DOTR * uDot;
  float dD = r - length(L - (DOTC + vec2(0.0, uDotY)));
  float mD = uDot > 0.0 ? smoothstep(-aa, aa, dD) : 0.0;
  float mark = max(mE, mD);

  // the wordmark, sliding out from behind the e
  float dW = field(L - vec2(uWordX, 0.0), 1);
  float mW = smoothstep(-aa, aa, dW) * uWordA;

  // the film, behind the door: it covers the screen (as object-fit: cover), a touch larger until the door opens
  vec2 sc = uRes / uFilmSize;
  float k = max(sc.x, sc.y) * uView;
  vec2 fuv = (px - uRes * 0.5) / (uFilmSize * k) + 0.5;
  vec3 film = texture2D(uFilm, clamp(fuv, 0.0, 1.0)).rgb;

  // the film inside the mark: first in the logo's amber (its light and shade only), then, as the door opens, in its
  // own colours. The amber gives way to it spreading out from the dot.
  float lum = dot(film, vec3(0.299, 0.587, 0.114));
  // (the palette's own: brown in the shadows, amber in the middle, amber's palest tint in the light)
  float tl = smoothstep(0.04, 0.82, lum);
  vec3 duo = tl < 0.5 ? mix(BROWN, AMBER, tl * 2.0) : mix(AMBER, AMBER20, tl * 2.0 - 1.0);
  vec3 inside = mix(duo, film, uColor);
  float reach = uFilmIn * 190.0;
  float spread = 1.0 - smoothstep(reach - 26.0, reach, length(L - DOTC));
  vec3 fill = mix(AMBER, inside, uFilmIn >= 1.0 ? 1.0 : spread);

  vec3 col = mix(CREAM, TAUPE, mW);
  col = mix(col, fill, mark);

  // an amber hairline round the cut while the film is in it
  float edge = max(min(dE, 1e3), dD);
  float rimW = 1.3 / uS;
  float rim = (1.0 - smoothstep(rimW * 0.5, rimW * 1.5, abs(edge))) * uRim * max(swept * uEA, step(0.0, uDot) * mD);
  col = mix(col, AMBER, rim);
  gl_FragColor = vec4(col, 1.0);
}`

export interface DoorState {
  /** screen pixels per logo unit, and where the logo's origin falls on the screen (CSS pixels) */
  s: number; tx: number; ty: number
  sweep: number; dot: number; dotY: number
  wordX: number; wordA: number
  filmIn: number; rim: number; view: number
  /** 0: the film in the logo's amber; 1: in its own colours */
  color: number
  /** the e: 1 drawn, 0 gone (only the dot is left to go in through) */
  eA: number
}

export interface Door {
  state: DoorState
  draw(): void
  /** keep drawing the film's new frames (and stop) */
  run(on: boolean): void
  destroy(): void
}

const SDF = { src: '/media/brand/elia-sdf.webp', x0: 231.9, y0: 209.7, w: 378.0, h: 143.8, range: 24, texW: 2048 }

export function mountDoor(canvas: HTMLCanvasElement, video: HTMLVideoElement, poster: string): Promise<Door | null> {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false })
  if (!gl) return Promise.resolve(null)
  const make = (type: number, code: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, code); gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader')
    return s
  }
  let prog: WebGLProgram
  try {
    prog = gl.createProgram()!
    gl.attachShader(prog, make(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, make(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return Promise.resolve(null)
  } catch { return Promise.resolve(null) }
  gl.useProgram(prog)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'p')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const U: Record<string, WebGLUniformLocation | null> = {}
  for (const n of ['uSdf', 'uFilm', 'uRes', 'uT', 'uFilmSize', 'uBox', 'uS', 'uRange', 'uK', 'uSweep', 'uDot', 'uDotY', 'uWordX', 'uWordA', 'uFilmIn', 'uRim', 'uView', 'uColor', 'uEA']) U[n] = gl.getUniformLocation(prog, n)
  gl.uniform4f(U.uBox, SDF.x0, SDF.y0, SDF.w, SDF.h)
  gl.uniform1f(U.uRange, SDF.range)
  gl.uniform1f(U.uK, SDF.texW / SDF.w)

  const texture = (unit: number) => {
    const t = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([226, 160, 37]))
    return t
  }
  const sdfTex = texture(0)
  const filmTex = texture(1)
  gl.uniform1i(U.uSdf, 0)
  gl.uniform1i(U.uFilm, 1)
  let filmW = 16, filmH = 9

  const load = (src: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = no; i.src = src })

  return Promise.all([load(SDF.src), load(poster).catch(() => null)]).then(([sdfImg, posterImg]) => {
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sdfTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, sdfImg)
    if (posterImg) {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, filmTex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, posterImg)
      filmW = posterImg.naturalWidth; filmH = posterImg.naturalHeight
    }
    const state: DoorState = { s: 1, tx: 0, ty: 0, sweep: 0, dot: 0, dotY: 0, wordX: 0, wordA: 0, filmIn: 0, rim: 0, view: 1.18, color: 0, eA: 1 }
    // the film's frame goes up to the graphics card only when it is a new one (the film waits at its first frame
    // while the door is shut: that one frame, once)
    let upFor = -1
    const upload = () => {
      if (video.readyState < 2 || !video.videoWidth) return
      const at = video.currentTime
      if (at === upFor && video.paused) return
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, filmTex)
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video) } catch { return }
      filmW = video.videoWidth; filmH = video.videoHeight; upFor = at
    }
    const draw = () => {
      // (at most 1.5 device pixels to a CSS pixel: the shapes are drawn from a distance field and stay sharp)
      const dpr = Math.min(devicePixelRatio || 1, 1.5)
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr)
      if (!w || !h) return
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h) }
      gl.uniform2f(U.uRes, w, h)
      gl.uniform2f(U.uT, state.tx * dpr, state.ty * dpr)
      gl.uniform1f(U.uS, state.s * dpr)
      gl.uniform2f(U.uFilmSize, filmW, filmH)
      gl.uniform1f(U.uSweep, state.sweep); gl.uniform1f(U.uDot, state.dot); gl.uniform1f(U.uDotY, state.dotY)
      gl.uniform1f(U.uWordX, state.wordX); gl.uniform1f(U.uWordA, state.wordA)
      gl.uniform1f(U.uFilmIn, state.filmIn); gl.uniform1f(U.uRim, state.rim); gl.uniform1f(U.uView, state.view); gl.uniform1f(U.uColor, state.color); gl.uniform1f(U.uEA, state.eA)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    // the film's frames: drawn as they come (the frame callback where there is one), only while the door is in use
    // and the film is playing; a paused film is drawn once more when a frame arrives or it is moved, and otherwise
    // only when the door itself moves (the caller's draw)
    let on = false, raf = 0
    const vfc = 'requestVideoFrameCallback' in video
    const frame = () => {
      raf = 0
      if (!on) return
      upload(); draw()
      if (video.paused) return
      if (vfc) (video as any).requestVideoFrameCallback(frame)
      else raf = requestAnimationFrame(frame)
    }
    const once = () => { if (on && !raf) raf = requestAnimationFrame(frame) }
    video.addEventListener('play', () => { if (on) { cancelAnimationFrame(raf); raf = 0; frame() } })
    for (const ev of ['loadeddata', 'seeked']) video.addEventListener(ev, once)
    const door: Door = {
      state,
      draw: () => { upload(); draw() },
      run(v) { if (v === on) return; on = v; if (on) frame(); else { cancelAnimationFrame(raf); raf = 0 } },
      destroy() { door.run(false); gl.getExtension('WEBGL_lose_context')?.loseContext() },
    }
    return door
  }).catch(() => null)
}
