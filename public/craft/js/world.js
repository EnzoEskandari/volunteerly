// Chunked voxel world: terrain generation, lighting (sky + block, flood fill),
// block edits, tile entities (furnaces/chests) and persistence of changes.

import { makeNoise, mulberry32, hash3 } from './noise.js';
import { B, BLOCKS, SOLID, OPAQUE, LIGHT, FILTER } from './blocks.js';

export const CS = 16; // chunk size (x/z)
export const CH = 128; // world height
export const SEA = 62;
const LAYER = CS * CS;

export const ckey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
export const bidx = (x, y, z) => x | (z << 4) | (y << 8);

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.key = ckey(cx, cz);
    this.blocks = new Uint8Array(LAYER * CH);
    this.light = new Uint8Array(LAYER * CH); // sky << 4 | block
    this.height = new Uint8Array(LAYER); // highest non-air block per column
    this.dirty = true;
    this.mesh = null;
    this.fresh = true; // generated (not loaded) this session: may spawn animals
  }
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class World {
  constructor(seed, saved = {}) {
    this.seed = seed | 0;
    this.n = makeNoise(this.seed);
    this.nb = makeNoise(this.seed ^ 0x5bd1e995);
    this.nc = makeNoise(this.seed ^ 0x1b873593);
    this.chunks = new Map();
    this.edits = saved.edits || {}; // chunkKey -> {idx: id}
    this.tileEntities = new Map(); // "x,y,z" -> data
    for (const [k, v] of Object.entries(saved.tileEntities || {})) this.tileEntities.set(k, v);
    this.onDrop = null; // (x, y, z, itemId, count)
    this.onBlockChange = null; // (x, y, z, oldId, newId)
    this._last = null;
    this._lightQ = [];
    this.genQueueBudget = 0;
  }

  // ---------- access ----------
  chunk(cx, cz) {
    const l = this._last;
    if (l && l.cx === cx && l.cz === cz) return l;
    const c = this.chunks.get(ckey(cx, cz));
    if (c) this._last = c;
    return c;
  }
  chunkAt(x, z) { return this.chunk(x >> 4, z >> 4); }

  get(x, y, z) {
    if (y < 0) return B.bedrock;
    if (y >= CH) return 0;
    const c = this.chunk(x >> 4, z >> 4);
    if (!c) return 0;
    return c.blocks[(x & 15) | ((z & 15) << 4) | (y << 8)];
  }
  isLoaded(x, z) { return !!this.chunk(x >> 4, z >> 4); }
  sky(x, y, z) {
    if (y >= CH) return 15;
    if (y < 0) return 0;
    const c = this.chunk(x >> 4, z >> 4);
    if (!c) return 15;
    return c.light[(x & 15) | ((z & 15) << 4) | (y << 8)] >> 4;
  }
  blockLight(x, y, z) {
    if (y >= CH || y < 0) return 0;
    const c = this.chunk(x >> 4, z >> 4);
    if (!c) return 0;
    return c.light[(x & 15) | ((z & 15) << 4) | (y << 8)] & 15;
  }
  surfaceY(x, z) {
    const c = this.chunk(x >> 4, z >> 4);
    if (!c) return -1;
    return c.height[(x & 15) | ((z & 15) << 4)];
  }

  // ---------- terrain shape ----------
  climate(x, z) {
    const temp = this.nb.fbm2(x / 1300, z / 1300, 3) * 1.25;
    const humid = this.nb.fbm2(x / 1000 + 700, z / 1000 - 300, 3) * 1.25;
    return { temp, humid };
  }

  column(x, z) {
    const n = this.n;
    const { temp, humid } = this.climate(x, z);
    const desert = smooth(0.18, 0.38, temp) * smooth(0.15, -0.05, humid);
    const cont = n.fbm2(x / 420, z / 420, 3);
    const hills = n.fbm2(x / 130 + 100, z / 130, 4);
    const detail = n.noise2D(x / 28, z / 28);
    let mount = Math.max(0, n.fbm2(x / 260 + 300, z / 260 - 50, 3) - 0.12);
    mount = Math.pow(mount * 1.6, 1.6) * 62 * (1 - desert * 0.8);
    let h = 65 + cont * 16 + hills * (9 - desert * 6) + detail * 1.8 + mount;
    h = Math.max(4, Math.min(CH - 14, Math.floor(h)));
    let biome;
    if (h < SEA - 1) biome = temp < -0.32 ? 'frozen_ocean' : 'ocean';
    else if (mount > 22) biome = 'mountains';
    else if (desert > 0.5) biome = 'desert';
    else if (temp < -0.3) biome = 'snowy';
    else if (humid > 0.12) biome = temp > 0.12 ? 'birch_forest' : 'forest';
    else biome = 'plains';
    return { h, biome, temp };
  }

  // ---------- generation ----------
  generate(cx, cz) {
    const key = ckey(cx, cz);
    let c = this.chunks.get(key);
    if (c) return c;
    c = new Chunk(cx, cz);
    const blocks = c.blocks;
    const x0 = cx * CS, z0 = cz * CS;
    const rnd = mulberry32(hash3(this.seed, cx, cz));

    const cols = new Array(LAYER);
    for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) cols[lx | (lz << 4)] = this.column(x0 + lx, z0 + lz);

    // Cave density sampled on a coarse 4x4x4 grid and trilinearly interpolated.
    const GX = 5, GY = CH / 4 + 1;
    const cave = new Float32Array(GX * GX * GY);
    for (let gy = 0; gy < GY; gy++) for (let gz = 0; gz < GX; gz++) for (let gx = 0; gx < GX; gx++) {
      const wx = x0 + gx * 4, wy = gy * 4, wz = z0 + gz * 4;
      const a = this.nc.noise3D(wx / 36, wy / 22, wz / 36);
      const b = this.nc.noise3D(wx / 36 + 91.7, wy / 22 + 13.1, wz / 36 - 40.3);
      const room = this.n.noise3D(wx / 70, wy / 40, wz / 70);
      cave[gx + gz * GX + gy * GX * GX] = Math.min(a * a + b * b, room > 0.55 ? 0 : 1);
    }
    const caveAt = (lx, y, lz) => {
      const fx = lx / 4, fy = y / 4, fz = lz / 4;
      const ix = fx | 0, iy = fy | 0, iz = fz | 0;
      const tx = fx - ix, ty = fy - iy, tz = fz - iz;
      const i = ix + iz * GX + iy * GX * GX;
      const L = GX * GX;
      const c00 = cave[i] * (1 - tx) + cave[i + 1] * tx;
      const c10 = cave[i + GX] * (1 - tx) + cave[i + GX + 1] * tx;
      const c01 = cave[i + L] * (1 - tx) + cave[i + L + 1] * tx;
      const c11 = cave[i + L + GX] * (1 - tx) + cave[i + L + GX + 1] * tx;
      return (c00 * (1 - tz) + c10 * tz) * (1 - ty) + (c01 * (1 - tz) + c11 * tz) * ty;
    };

    for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
      const col = cols[lx | (lz << 4)];
      const { h, biome } = col;
      const beach = h >= SEA - 1 && h <= SEA + 1 && biome !== 'snowy' && biome !== 'mountains';
      let top, filler;
      if (biome === 'desert') { top = B.sand; filler = B.sand; }
      else if (biome === 'ocean' || biome === 'frozen_ocean') {
        const r = rnd();
        top = r < 0.04 ? B.clay : r < 0.3 ? B.gravel : B.sand;
        filler = top === B.clay ? B.clay : B.sand;
      } else if (beach) { top = B.sand; filler = B.sand; }
      else if (biome === 'mountains') {
        top = h > 100 ? B.snow_block : h > 88 ? B.stone : B.grass;
        filler = top === B.grass ? B.dirt : B.stone;
      } else if (biome === 'snowy') { top = B.snowy_grass; filler = B.dirt; }
      else { top = B.grass; filler = B.dirt; }

      const bedrockTop = 1 + ((rnd() * 3) | 0);
      for (let y = 0; y <= h; y++) {
        let id;
        if (y < bedrockTop) id = B.bedrock;
        else if (y === h) id = top;
        else if (y > h - 4) id = filler;
        else if (biome === 'desert' && y > h - 8) id = B.sandstone;
        else id = B.stone;
        if (y >= bedrockTop && y < h - 3 && y > 2 && caveAt(lx, y, lz) < 0.011) id = y <= 10 ? B.lava : 0;
        blocks[lx | (lz << 4) | (y << 8)] = id;
      }
      for (let y = h + 1; y <= SEA; y++) blocks[lx | (lz << 4) | (y << 8)] = B.water;
      if (h < SEA && (biome === 'frozen_ocean' || biome === 'snowy')) blocks[lx | (lz << 4) | (SEA << 8)] = B.ice;
    }

    // Ore veins.
    const vein = (id, count, size, ymin, ymax) => {
      for (let v = 0; v < count; v++) {
        let x = (rnd() * 16) | 0, z = (rnd() * 16) | 0, y = ymin + ((rnd() * (ymax - ymin)) | 0);
        const n = 1 + ((rnd() * size) | 0);
        for (let k = 0; k < n; k++) {
          if (x >= 0 && x < 16 && z >= 0 && z < 16 && y > 0 && y < CH) {
            const i = x | (z << 4) | (y << 8);
            if (blocks[i] === B.stone) blocks[i] = id;
          }
          const d = (rnd() * 6) | 0;
          if (d === 0) x++; else if (d === 1) x--; else if (d === 2) z++; else if (d === 3) z--; else if (d === 4) y++; else y--;
        }
      }
    };
    vein(B.coal_ore, 16, 10, 5, 110);
    vein(B.iron_ore, 12, 7, 5, 64);
    vein(B.gold_ore, 3, 7, 5, 32);
    vein(B.diamond_ore, 2, 6, 3, 16);
    vein(B.gravel, 5, 20, 5, 90);
    vein(B.dirt, 5, 20, 20, 90);

    // Trees (including ones rooted in neighbouring chunks that overhang this one).
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      for (const t of this.treesFor(cx + dx, cz + dz)) this.placeTree(c, t);
    }

    // Surface decoration (own chunk only).
    for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
      const { h, biome } = cols[lx | (lz << 4)];
      if (h + 1 >= CH) continue;
      const below = blocks[lx | (lz << 4) | (h << 8)];
      const here = lx | (lz << 4) | ((h + 1) << 8);
      if (blocks[here] !== 0) continue;
      const r = rnd();
      if (below === B.grass) {
        const grassChance = biome === 'plains' ? 0.22 : biome === 'mountains' ? 0.05 : 0.09;
        if (r < 0.012) blocks[here] = rnd() < 0.5 ? B.dandelion : B.poppy;
        else if (r < 0.012 + grassChance) blocks[here] = B.tall_grass;
        else if (r > 0.9993) blocks[here] = B.pumpkin;
        else if (r > 0.9988 && biome === 'forest') blocks[here] = B.melon;
      } else if (below === B.sand && biome === 'desert' && r < 0.006 && lx > 0 && lx < 15 && lz > 0 && lz < 15) {
        const ht = 1 + ((rnd() * 3) | 0);
        for (let k = 0; k < ht && h + 1 + k < CH; k++) blocks[lx | (lz << 4) | ((h + 1 + k) << 8)] = B.cactus;
      }
    }

    // Saved player edits.
    const ed = this.edits[key];
    if (ed) {
      c.fresh = false;
      for (const k in ed) blocks[+k] = ed[k];
    }

    this.computeHeights(c);
    this.chunks.set(key, c);
    this.lightNewChunk(c);
    return c;
  }

  treesFor(cx, cz) {
    const r = mulberry32(hash3(this.seed ^ 0x9e3779b9, cx, cz));
    const mid = this.column(cx * CS + 8, cz * CS + 8);
    let n;
    switch (mid.biome) {
      case 'forest': n = 5 + ((r() * 3) | 0); break;
      case 'birch_forest': n = 5 + ((r() * 2) | 0); break;
      case 'snowy': n = 2 + ((r() * 2) | 0); break;
      case 'plains': n = r() < 0.25 ? 1 : 0; break;
      case 'mountains': n = r() < 0.5 ? 1 : 0; break;
      default: n = 0;
    }
    const out = [];
    for (let i = 0; i < n; i++) {
      const lx = (r() * 16) | 0, lz = (r() * 16) | 0;
      const x = cx * CS + lx, z = cz * CS + lz;
      const col = this.column(x, z);
      if (col.h <= SEA || col.h > CH - 16) { r(); r(); continue; }
      if (col.biome === 'desert' || col.biome === 'ocean' || col.biome === 'frozen_ocean') { r(); r(); continue; }
      if (col.biome === 'mountains' && col.h > 88) { r(); r(); continue; }
      let type = 'oak';
      if (col.biome === 'snowy' || (col.biome === 'mountains' && col.temp < 0)) type = 'spruce';
      else if (col.biome === 'birch_forest') type = r() < 0.8 ? 'birch' : 'oak';
      else r();
      out.push({ x, z, y: col.h, type, seed: (r() * 1e9) | 0 });
    }
    return out;
  }

  placeTree(c, t) {
    const x0 = c.cx * CS, z0 = c.cz * CS;
    const r = mulberry32(t.seed);
    const set = (x, y, z, id, force) => {
      const lx = x - x0, lz = z - z0;
      if (lx < 0 || lx >= CS || lz < 0 || lz >= CS || y < 0 || y >= CH) return;
      const i = lx | (lz << 4) | (y << 8);
      const cur = c.blocks[i];
      if (force ? cur !== B.bedrock : cur === 0 || cur === B.tall_grass) c.blocks[i] = id;
    };
    const { x, y, z } = t;
    // Make the ground under the trunk dirt.
    set(x, y, z, B.dirt, true);
    if (t.type === 'spruce') {
      const H = 7 + ((r() * 3) | 0);
      for (let dy = H; dy >= 2; dy--) {
        const k = H - dy;
        const rad = Math.min(3, (k % 2 === 0 ? 1 : 2) + (k >> 2));
        for (let ox = -rad; ox <= rad; ox++) for (let oz = -rad; oz <= rad; oz++) {
          if (Math.abs(ox) + Math.abs(oz) > rad + (rad > 1 ? 1 : 0)) continue;
          set(x + ox, y + dy, z + oz, B.spruce_leaves);
        }
      }
      set(x, y + H + 1, z, B.spruce_leaves);
      for (let dy = 1; dy <= H - 1; dy++) set(x, y + dy, z, B.spruce_log, true);
      return;
    }
    const birch = t.type === 'birch';
    const H = (birch ? 5 : 4) + ((r() * 3) | 0);
    const log = birch ? B.birch_log : B.oak_log;
    const leaf = birch ? B.birch_leaves : B.oak_leaves;
    for (let dy = H - 3; dy <= H; dy++) {
      const rad = dy >= H - 1 ? 1 : 2;
      for (let ox = -rad; ox <= rad; ox++) for (let oz = -rad; oz <= rad; oz++) {
        const corner = Math.abs(ox) === rad && Math.abs(oz) === rad;
        if (corner && (dy === H || r() < 0.5)) continue;
        set(x + ox, y + dy, z + oz, leaf);
      }
    }
    set(x, y + H + 1, z, leaf);
    for (let dy = 1; dy <= H; dy++) set(x, y + dy, z, log, true);
  }

  computeHeights(c) {
    for (let i = 0; i < LAYER; i++) {
      let y = CH - 1;
      while (y > 0 && c.blocks[i | (y << 8)] === 0) y--;
      c.height[i] = y;
    }
  }

  // ---------- lighting ----------
  lightNewChunk(c) {
    const { blocks, light } = c;
    const skyQ = [];
    const blkQ = [];
    const x0 = c.cx * CS, z0 = c.cz * CS;
    // Direct skylight down each column.
    for (let i = 0; i < LAYER; i++) {
      let lv = 15;
      for (let y = CH - 1; y >= 0; y--) {
        const j = i | (y << 8);
        const f = FILTER[blocks[j]];
        if (f) lv = Math.max(0, lv - f);
        light[j] = lv << 4;
        if (lv === 0) break;
      }
    }
    // Seed the flood fill from lit cells next to darker cells.
    for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
      const i = lx | (lz << 4);
      let low = c.height[i];
      if (lx > 0) low = Math.max(low, c.height[i - 1]);
      if (lx < 15) low = Math.max(low, c.height[i + 1]);
      if (lz > 0) low = Math.max(low, c.height[i - 16]);
      if (lz < 15) low = Math.max(low, c.height[i + 16]);
      if (lx === 0 || lx === 15 || lz === 0 || lz === 15) low = Math.max(low, c.height[i] + 1, 100);
      for (let y = Math.min(CH - 1, low + 1); y >= 0; y--) {
        const j = i | (y << 8);
        const s = light[j] >> 4;
        if (s > 1) skyQ.push(x0 + lx, y, z0 + lz);
        else if (s === 0 && OPAQUE[blocks[j]]) { if (y < c.height[i] - 1) break; }
      }
    }
    for (let j = 0; j < blocks.length; j++) {
      const e = LIGHT[blocks[j]];
      if (e) {
        light[j] = (light[j] & 0xf0) | e;
        blkQ.push(x0 + (j & 15), j >> 8, z0 + ((j >> 4) & 15));
      }
    }
    // Let neighbours' light flow into the new chunk.
    const pushBorder = (n, side) => {
      if (!n) return;
      const nx0 = n.cx * CS, nz0 = n.cz * CS;
      for (let k = 0; k < CS; k++) {
        const lx = side === 0 ? 15 : side === 1 ? 0 : k;
        const lz = side === 2 ? 15 : side === 3 ? 0 : k;
        for (let y = 0; y < CH; y++) {
          const v = n.light[lx | (lz << 4) | (y << 8)];
          if ((v >> 4) > 1) skyQ.push(nx0 + lx, y, nz0 + lz);
          if ((v & 15) > 1) blkQ.push(nx0 + lx, y, nz0 + lz);
        }
      }
    };
    pushBorder(this.chunk(c.cx - 1, c.cz), 0);
    pushBorder(this.chunk(c.cx + 1, c.cz), 1);
    pushBorder(this.chunk(c.cx, c.cz - 1), 2);
    pushBorder(this.chunk(c.cx, c.cz + 1), 3);
    this.propagate(skyQ, true);
    this.propagate(blkQ, false);
  }

  markDirty(x, y, z) {
    const cx = x >> 4, cz = z >> 4;
    const c = this.chunk(cx, cz);
    if (c) c.dirty = true;
    const lx = x & 15, lz = z & 15;
    if (lx === 0) { const n = this.chunk(cx - 1, cz); if (n) n.dirty = true; }
    if (lx === 15) { const n = this.chunk(cx + 1, cz); if (n) n.dirty = true; }
    if (lz === 0) { const n = this.chunk(cx, cz - 1); if (n) n.dirty = true; }
    if (lz === 15) { const n = this.chunk(cx, cz + 1); if (n) n.dirty = true; }
    if (lx === 0 && lz === 0) { const n = this.chunk(cx - 1, cz - 1); if (n) n.dirty = true; }
    if (lx === 15 && lz === 0) { const n = this.chunk(cx + 1, cz - 1); if (n) n.dirty = true; }
    if (lx === 0 && lz === 15) { const n = this.chunk(cx - 1, cz + 1); if (n) n.dirty = true; }
    if (lx === 15 && lz === 15) { const n = this.chunk(cx + 1, cz + 1); if (n) n.dirty = true; }
  }

  propagate(q, sky) {
    const shift = sky ? 4 : 0;
    const mask = sky ? 0x0f : 0xf0;
    let head = 0;
    while (head < q.length) {
      const x = q[head++], y = q[head++], z = q[head++];
      const c = this.chunk(x >> 4, z >> 4);
      if (!c) continue;
      const L = (c.light[(x & 15) | ((z & 15) << 4) | (y << 8)] >> shift) & 15;
      if (L <= 1) continue;
      for (let d = 0; d < 6; d++) {
        let nx = x, ny = y, nz = z;
        if (d === 0) nx++; else if (d === 1) nx--; else if (d === 2) ny++; else if (d === 3) ny--; else if (d === 4) nz++; else nz--;
        if (ny < 0 || ny >= CH) continue;
        const nc = (nx >> 4 === c.cx && nz >> 4 === c.cz) ? c : this.chunk(nx >> 4, nz >> 4);
        if (!nc) continue;
        const j = (nx & 15) | ((nz & 15) << 4) | (ny << 8);
        const f = FILTER[nc.blocks[j]];
        if (f >= 15) continue;
        let nl = L - 1 - f;
        if (sky && d === 3 && L === 15 && f === 0) nl = 15;
        const cur = (nc.light[j] >> shift) & 15;
        if (nl > cur) {
          nc.light[j] = (nc.light[j] & mask) | (nl << shift);
          this.markDirty(nx, ny, nz);
          q.push(nx, ny, nz);
        }
      }
    }
    q.length = 0;
  }

  unlight(x, y, z, sky) {
    const shift = sky ? 4 : 0;
    const mask = sky ? 0x0f : 0xf0;
    const c0 = this.chunk(x >> 4, z >> 4);
    if (!c0) return [];
    const j0 = (x & 15) | ((z & 15) << 4) | (y << 8);
    const v0 = (c0.light[j0] >> shift) & 15;
    const addQ = [];
    if (v0 === 0) return addQ;
    c0.light[j0] &= mask;
    this.markDirty(x, y, z);
    const rq = [x, y, z, v0];
    let head = 0;
    while (head < rq.length) {
      const px = rq[head++], py = rq[head++], pz = rq[head++], v = rq[head++];
      for (let d = 0; d < 6; d++) {
        let nx = px, ny = py, nz = pz;
        if (d === 0) nx++; else if (d === 1) nx--; else if (d === 2) ny++; else if (d === 3) ny--; else if (d === 4) nz++; else nz--;
        if (ny < 0 || ny >= CH) continue;
        const nc = this.chunk(nx >> 4, nz >> 4);
        if (!nc) continue;
        const j = (nx & 15) | ((nz & 15) << 4) | (ny << 8);
        const nl = (nc.light[j] >> shift) & 15;
        if (nl === 0) continue;
        if (nl < v || (sky && d === 3 && v === 15 && nl === 15)) {
          nc.light[j] &= mask;
          this.markDirty(nx, ny, nz);
          rq.push(nx, ny, nz, nl);
        } else {
          addQ.push(nx, ny, nz);
        }
      }
    }
    return addQ;
  }

  relightAt(x, y, z, oldId, newId) {
    const c = this.chunk(x >> 4, z >> 4);
    const j = (x & 15) | ((z & 15) << 4) | (y << 8);
    for (const sky of [true, false]) {
      const q = this.unlight(x, y, z, sky);
      // Neighbours flow back in.
      for (let d = 0; d < 6; d++) {
        let nx = x, ny = y, nz = z;
        if (d === 0) nx++; else if (d === 1) nx--; else if (d === 2) ny++; else if (d === 3) ny--; else if (d === 4) nz++; else nz--;
        if (ny < 0) continue;
        if (ny >= CH) continue;
        q.push(nx, ny, nz);
      }
      if (sky && y === CH - 1 && FILTER[newId] < 15) {
        c.light[j] = (c.light[j] & 0x0f) | ((15 - FILTER[newId]) << 4);
        q.push(x, y, z);
      }
      if (!sky && LIGHT[newId]) {
        c.light[j] = (c.light[j] & 0xf0) | LIGHT[newId];
        q.push(x, y, z);
      }
      this.propagate(q, sky);
    }
  }

  // ---------- edits ----------
  set(x, y, z, id, opts = {}) {
    if (y < 0 || y >= CH) return false;
    const c = this.chunk(x >> 4, z >> 4);
    if (!c) return false;
    const lx = x & 15, lz = z & 15;
    const j = lx | (lz << 4) | (y << 8);
    const old = c.blocks[j];
    if (old === id) return false;
    c.blocks[j] = id;
    const ek = c.key;
    (this.edits[ek] || (this.edits[ek] = {}))[j] = id;
    // Height map.
    const hi = lx | (lz << 4);
    if (id !== 0 && y > c.height[hi]) c.height[hi] = y;
    else if (id === 0 && y === c.height[hi]) {
      let yy = y;
      while (yy > 0 && c.blocks[hi | (yy << 8)] === 0) yy--;
      c.height[hi] = yy;
    }
    // Tile entities.
    const ob = BLOCKS[old], nb = BLOCKS[id];
    if (ob.container && ob.container !== 'crafting' && (!nb.container || nb.container !== ob.container)) {
      const tk = `${x},${y},${z}`;
      const te = this.tileEntities.get(tk);
      if (te && this.onDrop) {
        for (const s of te.slots || []) if (s) this.onDrop(x, y, z, s.id, s.count, s);
      }
      this.tileEntities.delete(tk);
    }
    if (FILTER[old] !== FILTER[id] || LIGHT[old] !== LIGHT[id]) this.relightAt(x, y, z, old, id);
    this.markDirty(x, y, z);
    if (this.onBlockChange) this.onBlockChange(x, y, z, old, id);

    if (!opts.noUpdate) this.neighbourUpdate(x, y, z, id);
    return true;
  }

  neighbourUpdate(x, y, z, id) {
    if (y + 1 >= CH) return;
    const above = this.get(x, y + 1, z);
    const ab = BLOCKS[above];
    if (!SOLID[id] && id !== B.water && id !== B.lava) {
      if (ab.needsSupport) {
        this.set(x, y + 1, z, 0);
        if (this.onDrop && above !== B.tall_grass) this.onDrop(x, y + 1, z, above, 1);
      } else if (ab.gravity) {
        this.fall(x, y + 1, z);
      } else if (above === B.cactus) {
        this.set(x, y + 1, z, 0);
        if (this.onDrop) this.onDrop(x, y + 1, z, above, 1);
      }
    }
  }

  fall(x, y, z) {
    const id = this.get(x, y, z);
    let ty = y;
    while (ty > 0) {
      const b = this.get(x, ty - 1, z);
      if (SOLID[b] && !BLOCKS[b].needsSupport) break;
      ty--;
    }
    if (ty === y) return;
    const under = this.get(x, ty, z);
    if (BLOCKS[under].needsSupport && this.onDrop && under !== B.tall_grass) this.onDrop(x, ty, z, under, 1);
    this.set(x, y, z, 0, { noUpdate: true });
    this.set(x, ty, z, id, { noUpdate: true });
    this.neighbourUpdate(x, y, z, 0);
  }

  tileEntity(x, y, z, create) {
    const k = `${x},${y},${z}`;
    let te = this.tileEntities.get(k);
    if (!te && create) { te = create(); this.tileEntities.set(k, te); }
    return te;
  }

  unload(cx, cz) {
    const k = ckey(cx, cz);
    const c = this.chunks.get(k);
    if (!c) return null;
    this.chunks.delete(k);
    if (this._last === c) this._last = null;
    return c;
  }

  serialize() {
    const te = {};
    for (const [k, v] of this.tileEntities) te[k] = v;
    return { edits: this.edits, tileEntities: te };
  }

  // Ray cast through the voxel grid (Amanatides & Woo).
  raycast(ox, oy, oz, dx, dy, dz, maxDist, pred) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    let tmx = (dx > 0 ? x + 1 - ox : ox - x) * tdx;
    let tmy = (dy > 0 ? y + 1 - oy : oy - y) * tdy;
    let tmz = (dz > 0 ? z + 1 - oz : oz - z) * tdz;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let i = 0; i < 200; i++) {
      const id = this.get(x, y, z);
      if (id && pred(id, x, y, z)) return { x, y, z, nx, ny, nz, id, t };
      if (tmx < tmy && tmx < tmz) { t = tmx; x += sx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (tmy < tmz) { t = tmy; y += sy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
      else { t = tmz; z += sz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
      if (t > maxDist) return null;
    }
    return null;
  }

  // Spawn point near origin on dry land.
  findSpawn() {
    for (let r = 0; r < 400; r += 8) {
      for (let a = 0; a < 8; a++) {
        const x = Math.round(Math.cos(a * 0.785) * r), z = Math.round(Math.sin(a * 0.785) * r);
        const col = this.column(x, z);
        if (col.h > SEA + 1 && col.biome !== 'ocean') return { x: x + 0.5, y: col.h + 2, z: z + 0.5 };
      }
    }
    return { x: 0.5, y: 80, z: 0.5 };
  }
}
