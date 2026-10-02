// Builds chunk geometry: hidden-face culling, per-vertex ambient occlusion and
// smooth sky/block lighting (Minecraft "smooth lighting" style).

import { BLOCKS, OPAQUE } from './blocks.js';
import { TILES, ATLAS_TILES } from './textures.js';
import { CS, CH } from './world.js';

const PW = CS + 2; // padded width
const PL = PW * PW; // padded layer
const pad = new Uint8Array(PL * (CH + 2));
const padL = new Uint8Array(PL * (CH + 2));
const PI = (x, y, z) => (x + 1) + (z + 1) * PW + (y + 1) * PL;

export const FLOATS_PER_VERTEX = 8; // x y z u v sky block shade

class Buf {
  constructor() { this.v = new Float32Array(1 << 16); this.i = new Uint32Array(1 << 15); this.nv = 0; this.ni = 0; }
  reset() { this.nv = 0; this.ni = 0; }
  ensure(nv, ni) {
    if ((this.nv + nv) * FLOATS_PER_VERTEX > this.v.length) {
      const n = new Float32Array(Math.max(this.v.length * 2, (this.nv + nv) * FLOATS_PER_VERTEX));
      n.set(this.v); this.v = n;
    }
    if (this.ni + ni > this.i.length) {
      const n = new Uint32Array(Math.max(this.i.length * 2, this.ni + ni));
      n.set(this.i); this.i = n;
    }
  }
  vert(x, y, z, u, v, s, b, sh) {
    const o = this.nv * FLOATS_PER_VERTEX;
    const a = this.v;
    a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = u; a[o + 4] = v; a[o + 5] = s; a[o + 6] = b; a[o + 7] = sh;
    return this.nv++;
  }
  quad(b, flip) {
    const I = this.i, n = this.ni;
    if (flip) { I[n] = b + 1; I[n + 1] = b + 2; I[n + 2] = b + 3; I[n + 3] = b + 1; I[n + 4] = b + 3; I[n + 5] = b; }
    else { I[n] = b; I[n + 1] = b + 1; I[n + 2] = b + 2; I[n + 3] = b; I[n + 4] = b + 2; I[n + 5] = b + 3; }
    this.ni += 6;
  }
  take() {
    return { verts: this.v.slice(0, this.nv * FLOATS_PER_VERTEX), idx: this.i.slice(0, this.ni), count: this.ni };
  }
}
const opaqueBuf = new Buf();
const transBuf = new Buf();

// Face tables. f: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z
const FACE_SHADE = [0.6, 0.6, 1.0, 0.5, 0.8, 0.8];
const FACES = [];
for (let f = 0; f < 6; f++) {
  const a = f >> 1, s = f & 1 ? -1 : 1;
  const ua = (a + 1) % 3, va = (a + 2) % 3;
  const corners = s > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 1], [1, 1], [1, 0], [0, 0]];
  const n = [0, 0, 0];
  n[a] = s;
  const toPad = (d) => d[0] + d[2] * PW + d[1] * PL;
  const verts = corners.map(([cu, cv]) => {
    const p = [0, 0, 0];
    p[a] = s > 0 ? 1 : 0; p[ua] = cu; p[va] = cv;
    const du = [0, 0, 0]; du[ua] = cu ? 1 : -1;
    const dv = [0, 0, 0]; dv[va] = cv ? 1 : -1;
    let tu, tv;
    if (a === 0) { tu = s > 0 ? 1 - p[2] : p[2]; tv = 1 - p[1]; }
    else if (a === 2) { tu = s > 0 ? p[0] : 1 - p[0]; tv = 1 - p[1]; }
    else { tu = p[0]; tv = s > 0 ? p[2] : 1 - p[2]; }
    return {
      p, tu, tv,
      s1: toPad([n[0] + du[0], n[1] + du[1], n[2] + du[2]]),
      s2: toPad([n[0] + dv[0], n[1] + dv[1], n[2] + dv[2]]),
      c: toPad([n[0] + du[0] + dv[0], n[1] + du[1] + dv[1], n[2] + du[2] + dv[2]]),
    };
  });
  FACES.push({ n, off: toPad(n), verts, shade: FACE_SHADE[f] });
}
const AO_CURVE = [0.42, 0.62, 0.8, 1.0];
// facing index (0 +z,1 -x,2 -z,3 +x) -> face index
const FACING_TO_FACE = [4, 1, 5, 0];

const EPS = 0.0015;
function tileBase(name) {
  const t = TILES[name];
  return [(t % ATLAS_TILES) / ATLAS_TILES, Math.floor(t / ATLAS_TILES) / ATLAS_TILES];
}
// Pre-resolve per-block face tiles.
const FACE_TILE = []; // id -> [6 x [u0,v0]] + front
for (const b of BLOCKS) {
  if (!b) continue;
  const side = tileBase(b.tiles.side), top = tileBase(b.tiles.top), bot = tileBase(b.tiles.bottom), front = tileBase(b.tiles.front);
  FACE_TILE[b.id] = { faces: [side, side, top, bot, side, side], front };
}
const TS = 1 / ATLAS_TILES;

function fillPad(world, chunk, ymax) {
  const cx = chunk.cx, cz = chunk.cz;
  const top = Math.min(CH - 1, ymax + 1);
  // Clear the padding rows above ymax so stale data can't leak in.
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const c = world.chunk(cx + dx, cz + dz);
    const xs = dx < 0 ? 15 : 0, xe = dx > 0 ? 0 : 15;
    const zs = dz < 0 ? 15 : 0, ze = dz > 0 ? 0 : 15;
    for (let y = 0; y <= top; y++) for (let z = zs; z <= ze; z++) for (let x = xs; x <= xe; x++) {
      const px = x + dx * 16, pz = z + dz * 16;
      const pi = PI(px, y, pz);
      if (c) {
        const j = x | (z << 4) | (y << 8);
        pad[pi] = c.blocks[j];
        padL[pi] = c.light[j];
      } else { pad[pi] = 0; padL[pi] = 0xf0; }
    }
  }
  // Below the world: bedrock. Above the meshed range: open sky.
  for (let z = -1; z <= CS; z++) for (let x = -1; x <= CS; x++) {
    pad[PI(x, -1, z)] = 5; padL[PI(x, -1, z)] = 0;
    pad[PI(x, top + 1, z)] = 0; padL[PI(x, top + 1, z)] = 0xf0;
  }
}

export function buildChunkMesh(world, chunk) {
  let ymax = 0;
  for (let i = 0; i < 256; i++) if (chunk.height[i] > ymax) ymax = chunk.height[i];
  ymax = Math.min(CH - 1, ymax + 1);
  fillPad(world, chunk, ymax);
  opaqueBuf.reset();
  transBuf.reset();
  const x0 = chunk.cx * CS, z0 = chunk.cz * CS;

  for (let y = 0; y <= ymax; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const pi = PI(x, y, z);
    const id = pad[pi];
    if (id === 0) continue;
    const b = BLOCKS[id];
    if (b.shape === 'cross') { emitCross(x, y, z, id, padL[pi]); continue; }
    if (b.shape === 'torch') { emitTorch(x, y, z, padL[pi]); continue; }
    const buf = b.translucent ? transBuf : opaqueBuf;
    const tiles = FACE_TILE[id];
    let frontFace = -1;
    if (b.orient) {
      const te = world.tileEntities.get(`${x0 + x},${y},${z0 + z}`);
      frontFace = FACING_TO_FACE[te && te.facing !== undefined ? te.facing : 0];
    }
    const liquidTop = b.liquid && !BLOCKS[pad[pi + PL]].liquid;
    for (let f = 0; f < 6; f++) {
      const F = FACES[f];
      const nid = pad[pi + F.off];
      if (OPAQUE[nid]) continue;
      if (nid === id && b.sameCull) continue;
      if (b.liquid && BLOCKS[nid].liquid) continue;
      if (b.liquid && f !== 2 && nid !== 0 && BLOCKS[nid].solid && !b.translucent) continue;
      const [u0, v0] = f === frontFace ? tiles.front : tiles.faces[f];
      buf.ensure(4, 6);
      const npi = pi + F.off;
      const aoArr = [0, 0, 0, 0];
      let base = -1;
      for (let k = 0; k < 4; k++) {
        const V = F.verts[k];
        let ao = 3, sky, blk;
        const L0 = padL[npi];
        if (b.liquid) {
          sky = L0 >> 4; blk = L0 & 15;
        } else {
          const s1 = OPAQUE[pad[npi + V.s1 - F.off]] ? 1 : 0;
          const s2 = OPAQUE[pad[npi + V.s2 - F.off]] ? 1 : 0;
          const cc = OPAQUE[pad[npi + V.c - F.off]] ? 1 : 0;
          ao = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
          let n = 1; sky = L0 >> 4; blk = L0 & 15;
          if (!s1) { const l = padL[npi + V.s1 - F.off]; sky += l >> 4; blk += l & 15; n++; }
          if (!s2) { const l = padL[npi + V.s2 - F.off]; sky += l >> 4; blk += l & 15; n++; }
          if (!cc && !(s1 && s2)) { const l = padL[npi + V.c - F.off]; sky += l >> 4; blk += l & 15; n++; }
          sky /= n; blk /= n;
        }
        aoArr[k] = ao;
        const p = V.p;
        let py = p[1];
        if (liquidTop && py === 1) py = 0.875;
        const tv = liquidTop && f !== 2 && f !== 3 && V.tv === 0 ? 0.125 : V.tv;
        const u = u0 + (EPS + V.tu * (1 - 2 * EPS)) * TS;
        const v = v0 + (EPS + tv * (1 - 2 * EPS)) * TS;
        const vi = buf.vert(x + p[0], y + py, z + p[2], u, v, sky / 15, blk / 15, F.shade * AO_CURVE[ao]);
        if (k === 0) base = vi;
      }
      buf.quad(base, aoArr[0] + aoArr[2] < aoArr[1] + aoArr[3]);
    }
  }
  return { opaque: opaqueBuf.take(), trans: transBuf.take() };
}

function emitCross(x, y, z, id, L) {
  const [u0, v0] = FACE_TILE[id].faces[0];
  const sky = (L >> 4) / 15, blk = (L & 15) / 15;
  const buf = opaqueBuf;
  buf.ensure(16, 24);
  const d = 0.15, e = 0.85;
  const U = (t) => u0 + (EPS + t * (1 - 2 * EPS)) * TS;
  const Vv = (t) => v0 + (EPS + t * (1 - 2 * EPS)) * TS;
  const planes = [[[x + d, z + d], [x + e, z + e]], [[x + d, z + e], [x + e, z + d]]];
  for (const [[ax, az], [bx, bz]] of planes) {
    for (const flip of [false, true]) {
      const b = buf.nv;
      const A = flip ? [bx, bz] : [ax, az], Bp = flip ? [ax, az] : [bx, bz];
      buf.vert(A[0], y, A[1], U(flip ? 1 : 0), Vv(1), sky, blk, 0.9);
      buf.vert(Bp[0], y, Bp[1], U(flip ? 0 : 1), Vv(1), sky, blk, 0.9);
      buf.vert(Bp[0], y + 1, Bp[1], U(flip ? 0 : 1), Vv(0), sky, blk, 0.9);
      buf.vert(A[0], y + 1, A[1], U(flip ? 1 : 0), Vv(0), sky, blk, 0.9);
      buf.quad(b, false);
    }
  }
}

function emitTorch(x, y, z, L) {
  const [u0, v0] = FACE_TILE[36].faces[0];
  const sky = (L >> 4) / 15;
  const buf = opaqueBuf;
  buf.ensure(24, 36);
  const a = 7 / 16, c = 9 / 16, h = 10 / 16;
  const U = (px) => u0 + px / 16 * TS;
  const V = (px) => v0 + px / 16 * TS;
  const box = [
    // +x
    [[c, 0, c], [c, 0, a], [c, h, a], [c, h, c], 0.6],
    // -x
    [[a, 0, a], [a, 0, c], [a, h, c], [a, h, a], 0.6],
    // +z
    [[a, 0, c], [c, 0, c], [c, h, c], [a, h, c], 0.8],
    // -z
    [[c, 0, a], [a, 0, a], [a, h, a], [c, h, a], 0.8],
  ];
  for (const [p0, p1, p2, p3, sh] of box) {
    const b = buf.nv;
    buf.vert(x + p0[0], y + p0[1], z + p0[2], U(7), V(16), sky, 1, sh);
    buf.vert(x + p1[0], y + p1[1], z + p1[2], U(9), V(16), sky, 1, sh);
    buf.vert(x + p2[0], y + p2[1], z + p2[2], U(9), V(6), sky, 1, sh);
    buf.vert(x + p3[0], y + p3[1], z + p3[2], U(7), V(6), sky, 1, sh);
    buf.quad(b, false);
  }
  const b = buf.nv;
  buf.vert(x + a, y + h, z + a, U(7), V(6), sky, 1, 1);
  buf.vert(x + a, y + h, z + c, U(7), V(8), sky, 1, 1);
  buf.vert(x + c, y + h, z + c, U(9), V(8), sky, 1, 1);
  buf.vert(x + c, y + h, z + a, U(9), V(6), sky, 1, 1);
  buf.quad(b, false);
}
