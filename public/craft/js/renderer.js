// WebGL renderer (works on WebGL2 and WebGL1). Draws sky, chunks, entities,
// clouds, water, block-break cracks, the selection outline and the held item.

import * as M from './math.js';
import { FLOATS_PER_VERTEX } from './mesher.js';
import { CS, CH } from './world.js';

const STRIDE = FLOATS_PER_VERTEX * 4;

const VS = `
attribute vec3 aPos; attribute vec2 aUV; attribute vec3 aL;
uniform mat4 uProj; uniform mat4 uView; uniform vec3 uOffset;
uniform float uDay; uniform float uMinLight; uniform float uGamma;
varying vec2 vUV; varying vec3 vCol; varying float vDist; varying vec4 vTint;
float curve(float f){ float b = f / (3.0 * (1.0 - f) + 1.0); return mix(b, f, uGamma); }
void main(){
  vec4 vp = uView * vec4(aPos + uOffset, 1.0);
  gl_Position = uProj * vp;
  vDist = length(vp.xyz);
  vUV = aUV;
  float sh = aL.z;
  vTint = vec4(0.0);
  if (sh >= 10.0) { sh -= 10.0; vTint = vec4(1.0, 1.0, 1.0, 0.55); }
  else if (sh < 0.0) { sh = -sh; vTint = vec4(1.0, 0.15, 0.1, 0.45); }
  float s = curve(aL.x * uDay);
  float b = curve(aL.y);
  vec3 c = max(vec3(s), vec3(b, b * 0.9, b * 0.75));
  c = max(c, vec3(uMinLight));
  vCol = c * sh;
}`;

const FS = `
precision highp float;
uniform sampler2D uTex; uniform vec3 uFog; uniform vec2 uFogRange; uniform float uAlphaTest; uniform float uAlpha;
varying vec2 vUV; varying vec3 vCol; varying float vDist; varying vec4 vTint;
void main(){
  vec4 t = texture2D(uTex, vUV);
  if (t.a < uAlphaTest) discard;
  vec3 c = t.rgb * vCol;
  c = mix(c, vTint.rgb, vTint.a);
  float f = clamp((vDist - uFogRange.x) / (uFogRange.y - uFogRange.x), 0.0, 1.0);
  c = mix(c, uFog, f);
  gl_FragColor = vec4(c, t.a * uAlpha);
}`;

const SKY_VS = `attribute vec2 aP; varying vec2 vP; void main(){ vP = aP; gl_Position = vec4(aP, 0.9999, 1.0); }`;
const SKY_FS = `
precision highp float;
uniform vec3 uTop; uniform vec3 uHorizon; uniform float uPitch; uniform float uTanHalf;
varying vec2 vP;
void main(){
  float y = vP.y * uTanHalf;
  float e = (sin(uPitch) + y * cos(uPitch)) / sqrt(1.0 + y * y);
  vec3 c = mix(uHorizon, uTop, smoothstep(-0.02, 0.5, e));
  c = mix(c, uHorizon * 0.55, smoothstep(0.0, -0.35, e));
  gl_FragColor = vec4(c, 1.0);
}`;

const LINE_VS = `attribute vec3 aPos; uniform mat4 uProj; uniform mat4 uView; void main(){ gl_Position = uProj * uView * vec4(aPos, 1.0); }`;
const LINE_FS = `precision mediump float; uniform vec4 uColor; void main(){ gl_FragColor = uColor; }`;

// CPU-side geometry batch for things that move every frame.
export class Batch {
  constructor() { this.v = new Float32Array(8192 * FLOATS_PER_VERTEX); this.i = new Uint32Array(12288); this.nv = 0; this.ni = 0; }
  reset() { this.nv = 0; this.ni = 0; }
  ensure(nv, ni) {
    if ((this.nv + nv) * FLOATS_PER_VERTEX > this.v.length) { const n = new Float32Array(this.v.length * 2 + nv * FLOATS_PER_VERTEX); n.set(this.v); this.v = n; }
    if (this.ni + ni > this.i.length) { const n = new Uint32Array(this.i.length * 2 + ni); n.set(this.i); this.i = n; }
  }
  vert(x, y, z, u, v, s, b, sh) {
    const o = this.nv * FLOATS_PER_VERTEX, a = this.v;
    a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = u; a[o + 4] = v; a[o + 5] = s; a[o + 6] = b; a[o + 7] = sh;
    return this.nv++;
  }
  tri4(b) { const I = this.i, n = this.ni; I[n] = b; I[n + 1] = b + 1; I[n + 2] = b + 2; I[n + 3] = b; I[n + 4] = b + 2; I[n + 5] = b + 3; this.ni += 6; }
  // Quad from 4 world points (counter-clockwise when seen from the front).
  quad(p, uv, s, b, sh) {
    this.ensure(4, 6);
    const base = this.nv;
    this.vert(p[0], p[1], p[2], uv[0], uv[3], s, b, sh);
    this.vert(p[3], p[4], p[5], uv[2], uv[3], s, b, sh);
    this.vert(p[6], p[7], p[8], uv[2], uv[1], s, b, sh);
    this.vert(p[9], p[10], p[11], uv[0], uv[1], s, b, sh);
    this.tri4(base);
  }
  // Box with local bounds transformed by matrix m. faces: array of 6 uv rects
  // [u0,v0,u1,v1] in order +x,-x,+y,-y,+z,-z.
  box(m, x0, y0, z0, x1, y1, z1, faces, s, b, shade = 1) {
    const P = BOX_TMP;
    const cs = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    for (let i = 0; i < 8; i++) M.transformPoint(m, cs[i][0], cs[i][1], cs[i][2], P, i * 3);
    const sign = shade < 0 ? -1 : 1, sm = Math.abs(shade) >= 10 ? 10 : 0, base = Math.abs(shade) - sm;
    for (let f = 0; f < 6; f++) {
      const idx = BOX_FACES[f];
      const q = QUAD_TMP;
      for (let k = 0; k < 4; k++) { q[k * 3] = P[idx[k] * 3]; q[k * 3 + 1] = P[idx[k] * 3 + 1]; q[k * 3 + 2] = P[idx[k] * 3 + 2]; }
      const sh = (base * BOX_SHADE[f] + sm) * sign;
      this.quad(q, faces[f], s, b, sh);
    }
  }
}
const BOX_TMP = new Float32Array(24);
const QUAD_TMP = new Float32Array(12);
// Corner indices per face, CCW from outside, starting bottom-left of texture.
const BOX_FACES = [
  [5, 1, 2, 6], // +x
  [0, 4, 7, 3], // -x
  [7, 6, 2, 3], // +y
  [0, 1, 5, 4], // -y
  [4, 5, 6, 7], // +z
  [1, 0, 3, 2], // -z
];
const BOX_SHADE = [0.6, 0.6, 1.0, 0.5, 0.8, 0.8];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const opts = { antialias: false, alpha: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false };
    let gl = canvas.getContext('webgl2', opts);
    this.webgl2 = !!gl;
    if (!gl) {
      gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
      if (!gl) throw new Error('WebGL is not available on this device.');
      if (!gl.getExtension('OES_element_index_uint')) throw new Error('This device lacks 32-bit index support.');
    }
    this.gl = gl;
    this.prog = this.program(VS, FS, ['aPos', 'aUV', 'aL'], ['uProj', 'uView', 'uOffset', 'uDay', 'uMinLight', 'uGamma', 'uTex', 'uFog', 'uFogRange', 'uAlphaTest', 'uAlpha']);
    this.sky = this.program(SKY_VS, SKY_FS, ['aP'], ['uTop', 'uHorizon', 'uPitch', 'uTanHalf']);
    this.line = this.program(LINE_VS, LINE_FS, ['aPos'], ['uProj', 'uView', 'uColor']);
    this.skyBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.lineBuf = gl.createBuffer();
    this.dynV = gl.createBuffer();
    this.dynI = gl.createBuffer();
    this.proj = M.mat4();
    this.view = M.mat4();
    this.viewRot = M.mat4();
    this.vp = M.mat4();
    this.frus = new Float32Array(24);
    this.ident = M.mat4();
    this.chunkMeshes = new Map();
    this.stats = { chunks: 0, tris: 0 };
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  program(vs, fs, attrs, unis) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for (const n of unis) u[n] = gl.getUniformLocation(p, n);
    return { p, u, n: attrs.length };
  }

  texture(canvas, repeat) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    return t;
  }
  setAtlas(canvas) { this.atlas = this.texture(canvas, false); }
  setClouds(canvas) { this.clouds = this.texture(canvas, true); }

  resize(scale) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3) * scale;
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  uploadChunk(chunk, mesh) {
    const gl = this.gl;
    let g = this.chunkMeshes.get(chunk.key);
    if (!g) {
      g = { cx: chunk.cx, cz: chunk.cz, o: { vb: gl.createBuffer(), ib: gl.createBuffer(), n: 0 }, t: { vb: gl.createBuffer(), ib: gl.createBuffer(), n: 0 } };
      this.chunkMeshes.set(chunk.key, g);
    }
    const up = (dst, src) => {
      dst.n = src.count;
      if (!src.count) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, dst.vb);
      gl.bufferData(gl.ARRAY_BUFFER, src.verts, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, dst.ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, src.idx, gl.STATIC_DRAW);
    };
    up(g.o, mesh.opaque);
    up(g.t, mesh.trans);
    let maxY = 0;
    for (let i = 0; i < 256; i++) if (chunk.height[i] > maxY) maxY = chunk.height[i];
    g.maxY = maxY + 2;
    chunk.mesh = g;
  }

  deleteChunk(key) {
    const g = this.chunkMeshes.get(key);
    if (!g) return;
    const gl = this.gl;
    gl.deleteBuffer(g.o.vb); gl.deleteBuffer(g.o.ib); gl.deleteBuffer(g.t.vb); gl.deleteBuffer(g.t.ib);
    this.chunkMeshes.delete(key);
  }

  bindAttribs() {
    const gl = this.gl;
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE, 12);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, STRIDE, 20);
  }

  drawBatch(batch) {
    if (!batch.ni) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dynV);
    gl.bufferData(gl.ARRAY_BUFFER, batch.v.subarray(0, batch.nv * FLOATS_PER_VERTEX), gl.STREAM_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.dynI);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, batch.i.subarray(0, batch.ni), gl.STREAM_DRAW);
    this.bindAttribs();
    gl.drawElements(gl.TRIANGLES, batch.ni, gl.UNSIGNED_INT, 0);
  }

  // s: frame state assembled by the game.
  render(s) {
    const gl = this.gl;
    const w = this.canvas.width, h = this.canvas.height;
    gl.viewport(0, 0, w, h);
    const aspect = w / h;
    const fov = s.fov;
    M.perspective(this.proj, fov, aspect, 0.05, 1000);
    const cam = s.cam;
    M.identity(this.viewRot);
    M.rotateX(this.viewRot, -cam.pitch);
    M.rotateY(this.viewRot, -cam.yaw);
    M.copy(this.view, this.viewRot);
    M.translate(this.view, -cam.x, -cam.y, -cam.z);
    M.multiply(this.vp, this.proj, this.view);
    M.frustum(this.vp, this.frus);

    gl.clearColor(s.fog[0], s.fog[1], s.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Sky gradient.
    if (!s.underwater) {
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(this.sky.p);
      gl.uniform3fv(this.sky.u.uTop, s.skyTop);
      gl.uniform3fv(this.sky.u.uHorizon, s.fog);
      gl.uniform1f(this.sky.u.uPitch, cam.pitch);
      gl.uniform1f(this.sky.u.uTanHalf, Math.tan(fov / 2));
      gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
      gl.enableVertexAttribArray(0);
      gl.disableVertexAttribArray(1);
      gl.disableVertexAttribArray(2);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.enable(gl.DEPTH_TEST);
    }

    const P = this.prog;
    gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.uniform1i(P.u.uTex, 0);
    gl.uniformMatrix4fv(P.u.uProj, false, this.proj);
    gl.uniform1f(P.u.uDay, s.day);
    gl.uniform1f(P.u.uMinLight, s.minLight);
    gl.uniform1f(P.u.uGamma, s.gamma);
    gl.uniform3fv(P.u.uFog, s.fog);
    gl.uniform1f(P.u.uAlpha, 1);

    // Sun and moon (rotation-only view, no fog, drawn behind everything).
    if (!s.underwater && s.skyBatch.ni) {
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.uniformMatrix4fv(P.u.uView, false, this.viewRot);
      gl.uniform3f(P.u.uOffset, 0, 0, 0);
      gl.uniform2f(P.u.uFogRange, 1e5, 1e6);
      gl.uniform1f(P.u.uAlphaTest, 0.01);
      gl.uniform1f(P.u.uDay, 1);
      this.drawBatch(s.skyBatch);
      gl.uniform1f(P.u.uDay, s.day);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.enable(gl.CULL_FACE);
    }

    gl.uniformMatrix4fv(P.u.uView, false, this.view);
    gl.uniform2f(P.u.uFogRange, s.fogNear, s.fogFar);

    // Opaque + cutout chunks, front to back.
    const visible = [];
    for (const g of this.chunkMeshes.values()) {
      const x0 = g.cx * CS, z0 = g.cz * CS;
      if (!M.boxInFrustum(this.frus, x0, 0, z0, x0 + CS, g.maxY, z0 + CS)) continue;
      const dx = x0 + 8 - cam.x, dz = z0 + 8 - cam.z;
      g.d = dx * dx + dz * dz;
      visible.push(g);
    }
    visible.sort((a, b) => a.d - b.d);
    gl.uniform1f(P.u.uAlphaTest, 0.5);
    let tris = 0;
    for (const g of visible) {
      if (!g.o.n) continue;
      gl.uniform3f(P.u.uOffset, g.cx * CS, 0, g.cz * CS);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.o.vb);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.o.ib);
      this.bindAttribs();
      gl.drawElements(gl.TRIANGLES, g.o.n, gl.UNSIGNED_INT, 0);
      tris += g.o.n / 3;
    }

    // Entities, dropped items, particles.
    gl.uniform3f(P.u.uOffset, 0, 0, 0);
    gl.disable(gl.CULL_FACE);
    this.drawBatch(s.entityBatch);

    // Clouds.
    if (s.cloudBatch && s.cloudBatch.ni && this.clouds) {
      gl.enable(gl.BLEND);
      gl.bindTexture(gl.TEXTURE_2D, this.clouds);
      gl.uniform1f(P.u.uAlphaTest, 0.05);
      gl.uniform2f(P.u.uFogRange, s.fogFar * 0.8, s.fogFar * 2.2);
      gl.uniform1f(P.u.uAlpha, 0.8);
      this.drawBatch(s.cloudBatch);
      gl.uniform1f(P.u.uAlpha, 1);
      gl.uniform2f(P.u.uFogRange, s.fogNear, s.fogFar);
      gl.bindTexture(gl.TEXTURE_2D, this.atlas);
      gl.disable(gl.BLEND);
    }

    // Translucent chunks (water, ice), back to front.
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.uniform1f(P.u.uAlphaTest, 0.01);
    for (let i = visible.length - 1; i >= 0; i--) {
      const g = visible[i];
      if (!g.t.n) continue;
      gl.uniform3f(P.u.uOffset, g.cx * CS, 0, g.cz * CS);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.t.vb);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.t.ib);
      this.bindAttribs();
      gl.drawElements(gl.TRIANGLES, g.t.n, gl.UNSIGNED_INT, 0);
      tris += g.t.n / 3;
    }

    // Translucent entity bits (particles with alpha, crack overlay).
    gl.uniform3f(P.u.uOffset, 0, 0, 0);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(-1, -1);
    this.drawBatch(s.decalBatch);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    // Selection outline.
    if (s.outline) this.drawOutline(s.outline);

    // First-person hand / held item.
    if (s.handBatch && s.handBatch.ni) {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(P.p);
      M.perspective(this.proj, 70 * Math.PI / 180, aspect, 0.01, 10);
      gl.uniformMatrix4fv(P.u.uProj, false, this.proj);
      gl.uniformMatrix4fv(P.u.uView, false, this.ident);
      gl.uniform2f(P.u.uFogRange, 1e5, 1e6);
      gl.uniform1f(P.u.uAlphaTest, 0.5);
      gl.enable(gl.CULL_FACE);
      gl.disable(gl.CULL_FACE);
      this.drawBatch(s.handBatch);
    }
    gl.enable(gl.CULL_FACE);
    this.stats.chunks = visible.length;
    this.stats.tris = tris | 0;
  }

  drawOutline(b) {
    const gl = this.gl;
    const e = 0.002;
    const x0 = b[0] - e, y0 = b[1] - e, z0 = b[2] - e, x1 = b[3] + e, y1 = b[4] + e, z1 = b[5] + e;
    const v = new Float32Array([
      x0, y0, z0, x1, y0, z0, x1, y0, z0, x1, y0, z1, x1, y0, z1, x0, y0, z1, x0, y0, z1, x0, y0, z0,
      x0, y1, z0, x1, y1, z0, x1, y1, z0, x1, y1, z1, x1, y1, z1, x0, y1, z1, x0, y1, z1, x0, y1, z0,
      x0, y0, z0, x0, y1, z0, x1, y0, z0, x1, y1, z0, x1, y0, z1, x1, y1, z1, x0, y0, z1, x0, y1, z1,
    ]);
    gl.useProgram(this.line.p);
    gl.uniformMatrix4fv(this.line.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(this.line.u.uView, false, this.view);
    gl.uniform4f(this.line.u.uColor, 0, 0, 0, 0.6);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STREAM_DRAW);
    gl.enableVertexAttribArray(0);
    gl.disableVertexAttribArray(1);
    gl.disableVertexAttribArray(2);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.enable(gl.BLEND);
    gl.drawArrays(gl.LINES, 0, 24);
    gl.disable(gl.BLEND);
    gl.useProgram(this.prog.p);
  }
}

export { CH };
