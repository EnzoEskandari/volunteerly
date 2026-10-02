// Procedurally painted 16x16 pixel-art texture atlas (blocks, items, mobs).
// Everything is generated at startup so the game ships with no image assets.

import { mulberry32, hash3 } from './noise.js';
import { BLOCKS, ITEMS } from './blocks.js';

export const TILE = 16;
export const ATLAS_TILES = 16; // tiles per row
export const ATLAS_SIZE = TILE * ATLAS_TILES; // 256px
export const TILES = Object.create(null); // name -> index

const data = new Uint8ClampedArray(ATLAS_SIZE * ATLAS_SIZE * 4);
let nextTile = 0;

function strSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }
function shade(c, f) { return [clamp(c[0] * f), clamp(c[1] * f), clamp(c[2] * f), c[3] === undefined ? 255 : c[3]]; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 255]; }
function hex(h, a = 255) { return [(h >> 16) & 255, (h >> 8) & 255, h & 255, a]; }

class Painter {
  constructor(index, seed) {
    this.ox = (index % ATLAS_TILES) * TILE;
    this.oy = Math.floor(index / ATLAS_TILES) * TILE;
    this.r = mulberry32(seed);
  }
  set(x, y, c) {
    if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
    const i = ((this.oy + y) * ATLAS_SIZE + this.ox + x) * 4;
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = c[3] === undefined ? 255 : c[3];
  }
  get(x, y) {
    x = (x + TILE) % TILE; y = (y + TILE) % TILE;
    const i = ((this.oy + y) * ATLAS_SIZE + this.ox + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  }
  noise(base, v = 0.12, a) {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const c = shade(base, 1 + (this.r() - 0.5) * 2 * v);
      if (a !== undefined) c[3] = a;
      this.set(x, y, c);
    }
  }
  rect(x0, y0, w, h, c) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, c); }
  speckle(c, n, v = 0.1) {
    for (let i = 0; i < n; i++) this.set((this.r() * 16) | 0, (this.r() * 16) | 0, shade(c, 1 + (this.r() - 0.5) * v));
  }
  border(c) { for (let i = 0; i < 16; i++) { this.set(i, 0, c); this.set(i, 15, c); this.set(0, i, c); this.set(15, i, c); } }
  art(rows, pal) {
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      const c = pal[ch];
      if (c) this.set(x, y, typeof c === 'function' ? c(x, y) : c);
    }
  }
  copy(name) {
    const src = TILES[name];
    const sx = (src % ATLAS_TILES) * TILE, sy = Math.floor(src / ATLAS_TILES) * TILE;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const i = ((sy + y) * ATLAS_SIZE + sx + x) * 4;
      this.set(x, y, [data[i], data[i + 1], data[i + 2], data[i + 3]]);
    }
  }
}

function T(name, fn) {
  const idx = nextTile++;
  TILES[name] = idx;
  fn(new Painter(idx, strSeed(name)));
  return idx;
}

// ---------- shared painters ----------
const C = {
  dirt: hex(0x866043), grass: hex(0x6aaa40), stone: hex(0x7d7d7d), sand: hex(0xdbd3a0),
  oakBark: hex(0x6b5233), oakWood: hex(0xb8945f), oakPlank: hex(0xa8854f), birchBark: hex(0xd8d6cf),
  birchWood: hex(0xc8b77a), spruceBark: hex(0x3d2b17), spruceWood: hex(0x735532), sprucePlank: hex(0x6e5130),
  leaves: hex(0x3f8a24), birchLeaves: hex(0x6a9a40), spruceLeaves: hex(0x2f5a32),
};

function stoneBase(p) {
  p.noise(C.stone, 0.1);
  for (let i = 0; i < 9; i++) {
    const x = (p.r() * 16) | 0, y = (p.r() * 16) | 0, len = 1 + ((p.r() * 3) | 0);
    for (let k = 0; k < len; k++) p.set(x + k, y, shade(C.stone, 0.82));
  }
  p.speckle(shade(C.stone, 1.12), 10, 0.05);
}

function cobble(p, base) {
  const pts = [];
  for (let i = 0; i < 11; i++) pts.push([p.r() * 16, p.r() * 16, 0.8 + p.r() * 0.4]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let d1 = 1e9, d2 = 1e9, best = 0;
    for (let i = 0; i < pts.length; i++) for (let oy = -16; oy <= 16; oy += 16) for (let ox = -16; ox <= 16; ox += 16) {
      const dx = x + 0.5 - pts[i][0] - ox, dy = y + 0.5 - pts[i][1] - oy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) { d2 = d1; d1 = d; best = i; } else if (d < d2) d2 = d;
    }
    let c = shade(base, pts[best][2] * (1 + (p.r() - 0.5) * 0.12));
    if (d2 - d1 < 1.1) c = shade(base, 0.45);
    else if (d1 < 2.2) c = shade(c, 1.12);
    p.set(x, y, c);
  }
}

function ore(p, color, dark) {
  stoneBase(p);
  const n = 4 + ((p.r() * 2) | 0);
  for (let i = 0; i < n; i++) {
    const cx = 2 + ((p.r() * 12) | 0), cy = 2 + ((p.r() * 12) | 0);
    const pix = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]].slice(0, 3 + ((p.r() * 3) | 0));
    for (const [dx, dy] of pix) p.set(cx + dx, cy + dy, shade(color, 0.9 + p.r() * 0.25));
    p.set(cx + 1, cy + 2, dark);
  }
}

function planks(p, base) {
  for (let y = 0; y < 16; y++) {
    const board = y >> 2;
    const seam = [3, 11, 7, 14][board];
    for (let x = 0; x < 16; x++) {
      let c = shade(base, 1 + (p.r() - 0.5) * 0.08 + Math.sin((x + board * 5) * 1.3) * 0.03);
      if ((y & 3) === 3) c = shade(base, 0.68);
      else if (x === seam) c = shade(base, 0.75);
      else if ((y & 3) === 0) c = shade(base, 1.06);
      p.set(x, y, c);
    }
  }
}

function logSide(p, bark, dark) {
  for (let x = 0; x < 16; x++) {
    const col = 1 + (p.r() - 0.5) * 0.18;
    for (let y = 0; y < 16; y++) {
      let c = shade(bark, col * (1 + (p.r() - 0.5) * 0.08));
      if ((x === 3 || x === 9 || x === 13) && p.r() < 0.8) c = shade(bark, 0.72);
      p.set(x, y, c);
    }
  }
  if (dark) for (let i = 0; i < 7; i++) {
    const x = (p.r() * 14) | 0, y = (p.r() * 16) | 0, w = 2 + ((p.r() * 3) | 0);
    for (let k = 0; k < w; k++) p.set(x + k, y, dark);
  }
}

function logTop(p, bark, wood) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    let c;
    if (d > 6.6) c = shade(bark, 1 + (p.r() - 0.5) * 0.15);
    else c = shade(wood, (Math.floor(d) % 2 ? 0.9 : 1.03) * (1 + (p.r() - 0.5) * 0.06));
    p.set(x, y, c);
  }
}

function leaves(p, base) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const r = p.r();
    if (r < 0.16) p.set(x, y, [0, 0, 0, 0]);
    else p.set(x, y, shade(base, r < 0.35 ? 0.72 : r > 0.9 ? 1.25 : 1 + (p.r() - 0.5) * 0.15));
  }
}

function wool(p, base) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const w = Math.sin(x * 1.7 + y * 0.9) * 0.05 + Math.sin(y * 2.1 - x * 0.6) * 0.04;
    p.set(x, y, shade(base, 1 + w + (p.r() - 0.5) * 0.08));
  }
}

function metalBlock(p, base) {
  p.noise(base, 0.04);
  for (let i = 0; i < 16; i++) {
    p.set(i, 0, shade(base, 1.25)); p.set(0, i, shade(base, 1.2));
    p.set(i, 15, shade(base, 0.7)); p.set(15, i, shade(base, 0.72));
  }
  for (let i = 2; i < 14; i++) p.set(i, i - 1, shade(base, 1.12));
}

const FONT = {
  T: ['111', '010', '010', '010', '010'],
  N: ['101', '111', '111', '111', '101'],
};

// ---------- blocks ----------
T('dirt', (p) => {
  p.noise(C.dirt, 0.1);
  p.speckle(shade(C.dirt, 0.7), 14);
  p.speckle(shade(C.dirt, 1.25), 8);
});
T('grass_top', (p) => {
  p.noise(C.grass, 0.14);
  p.speckle(shade(C.grass, 0.78), 22);
  p.speckle(shade(C.grass, 1.18), 10);
});
T('grass_side', (p) => {
  p.copy('dirt');
  for (let x = 0; x < 16; x++) {
    const depth = 2 + ((p.r() * 3) | 0);
    for (let y = 0; y < depth; y++) p.set(x, y, shade(C.grass, 1 + (p.r() - 0.5) * 0.25));
    if (p.r() < 0.35) p.set(x, depth, shade(C.grass, 0.8));
  }
});
T('snow', (p) => { p.noise([242, 250, 252], 0.04); p.speckle([220, 232, 240], 10); });
T('grass_snow_side', (p) => {
  p.copy('dirt');
  for (let x = 0; x < 16; x++) {
    const depth = 3 + ((p.r() * 2) | 0);
    for (let y = 0; y < depth; y++) p.set(x, y, shade([240, 248, 252], 1 + (p.r() - 0.5) * 0.05));
  }
});
T('stone', stoneBase);
T('smooth_stone', (p) => { p.noise(hex(0x9e9e9e), 0.04); p.border(hex(0x7a7a7a)); });
T('cobblestone', (p) => cobble(p, hex(0x7f7f7f)));
T('mossy_cobblestone', (p) => {
  cobble(p, hex(0x7a7a7a));
  for (let i = 0; i < 45; i++) {
    const x = (p.r() * 16) | 0, y = (p.r() * 16) | 0;
    if (p.r() < 0.7) p.set(x, y, shade(hex(0x4f7a32), 0.8 + p.r() * 0.4));
  }
});
T('bedrock', (p) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const r = p.r();
    p.set(x, y, shade(hex(0x565656), r < 0.3 ? 0.45 : r > 0.8 ? 1.3 : 0.9));
  }
});
T('sand', (p) => { p.noise(C.sand, 0.06); p.speckle(shade(C.sand, 0.86), 18); p.speckle(shade(C.sand, 1.08), 10); });
T('gravel', (p) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const r = p.r();
    const base = r < 0.3 ? hex(0x6a6260) : r < 0.55 ? hex(0x8f8784) : r < 0.75 ? hex(0x7a6e66) : hex(0xa49b96);
    p.set(x, y, shade(base, 0.9 + p.r() * 0.2));
  }
});
T('oak_log', (p) => logSide(p, C.oakBark, shade(C.oakBark, 0.6)));
T('oak_log_top', (p) => logTop(p, C.oakBark, C.oakWood));
T('oak_leaves', (p) => leaves(p, C.leaves));
T('oak_planks', (p) => planks(p, C.oakPlank));
T('birch_log', (p) => {
  p.noise(C.birchBark, 0.04);
  for (let i = 0; i < 9; i++) {
    const x = (p.r() * 14) | 0, y = (p.r() * 16) | 0, w = 1 + ((p.r() * 4) | 0);
    for (let k = 0; k < w; k++) p.set(x + k, y, hex(0x34312c));
  }
});
T('birch_log_top', (p) => logTop(p, C.birchBark, C.birchWood));
T('birch_leaves', (p) => leaves(p, C.birchLeaves));
T('birch_planks', (p) => planks(p, hex(0xc4b27a)));
T('spruce_log', (p) => logSide(p, C.spruceBark, shade(C.spruceBark, 0.7)));
T('spruce_log_top', (p) => logTop(p, C.spruceBark, C.spruceWood));
T('spruce_leaves', (p) => leaves(p, C.spruceLeaves));
T('spruce_planks', (p) => planks(p, C.sprucePlank));
T('glass', (p) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, [0, 0, 0, 0]);
  const edge = [218, 238, 245, 255];
  for (let i = 0; i < 16; i++) { p.set(i, 0, edge); p.set(i, 15, edge); p.set(0, i, edge); p.set(15, i, edge); }
  for (let i = 0; i < 4; i++) { p.set(3 + i, 6 - i, [255, 255, 255, 200]); p.set(9 + i, 12 - i, [255, 255, 255, 170]); }
  p.set(4, 3, [255, 255, 255, 150]);
});
T('water', (p) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const w = Math.sin(x * 0.8 + y * 0.4) * 0.07 + Math.sin(y * 1.3) * 0.05;
    const c = shade(hex(0x3060d8), 1 + w + (p.r() - 0.5) * 0.06);
    c[3] = 165;
    p.set(x, y, c);
  }
});
T('lava', (p) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const w = Math.sin(x * 0.9 + Math.cos(y * 0.7) * 2) * 0.5 + 0.5;
    p.set(x, y, mix(hex(0xd04a08), hex(0xffc53a), w * 0.8 + p.r() * 0.2));
  }
});
T('coal_ore', (p) => ore(p, hex(0x2a2a2a), hex(0x1a1a1a)));
T('iron_ore', (p) => ore(p, hex(0xd8af93), hex(0xa5795c)));
T('gold_ore', (p) => ore(p, hex(0xfcee4b), hex(0xc69a1a)));
T('diamond_ore', (p) => ore(p, hex(0x5decf5), hex(0x1aaab5)));
T('cactus_side', (p) => {
  p.noise(hex(0x4f8a2a), 0.08);
  for (let y = 0; y < 16; y++) { p.set(0, y, hex(0x2c5a18)); p.set(15, y, hex(0x2c5a18)); }
  for (let x of [3, 8, 12]) for (let y = 0; y < 16; y++) p.set(x, y, shade(hex(0x3f7a22), 0.9));
  for (let i = 0; i < 8; i++) p.set(1 + ((p.r() * 14) | 0), (p.r() * 16) | 0, hex(0x1a2a10));
});
T('cactus_top', (p) => {
  p.noise(hex(0x5f9a35), 0.08);
  p.border(hex(0x2c5a18));
  for (let i = 3; i < 13; i++) { p.set(i, 3, hex(0x3f7a22)); p.set(i, 12, hex(0x3f7a22)); p.set(3, i, hex(0x3f7a22)); p.set(12, i, hex(0x3f7a22)); }
});
T('cactus_bottom', (p) => { p.noise(hex(0x9ac066), 0.06); p.border(hex(0x2c5a18)); });
T('bricks', (p) => {
  const mortar = hex(0xb3a89a);
  for (let y = 0; y < 16; y++) {
    const row = y >> 2;
    const off = row % 2 ? 4 : 0;
    const tone = 0.9 + p.r() * 0.2;
    for (let x = 0; x < 16; x++) {
      let c = shade(hex(0x96503b), tone * (1 + (p.r() - 0.5) * 0.12));
      if ((y & 3) === 3 || (x + off) % 8 === 7) c = shade(mortar, 1 + (p.r() - 0.5) * 0.1);
      p.set(x, y, c);
    }
  }
});
T('stone_bricks', (p) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const row = y >> 3;
    const off = row ? 4 : 0;
    let c = shade(hex(0x7b7b7b), 1 + (p.r() - 0.5) * 0.12);
    if ((y & 7) === 7 || (x + off) % 8 === 7) c = hex(0x4c4c4c);
    else if ((y & 7) === 0 || (x + off) % 8 === 0) c = shade(c, 1.12);
    p.set(x, y, c);
  }
});
T('crafting_table_top', (p) => {
  planks(p, hex(0xa07444));
  p.border(hex(0x5a3a1e));
  for (let i = 1; i < 15; i++) { p.set(i, 5, hex(0x6b4a28)); p.set(i, 10, hex(0x6b4a28)); p.set(5, i, hex(0x6b4a28)); p.set(10, i, hex(0x6b4a28)); }
});
T('crafting_table_side', (p) => {
  planks(p, C.oakPlank);
  p.rect(0, 0, 16, 3, hex(0x6b4a28));
  p.rect(3, 6, 1, 7, hex(0x5a3a1e)); p.rect(2, 6, 3, 2, hex(0x8c8c8c));
  p.rect(10, 5, 4, 1, hex(0x8c8c8c)); p.rect(11, 6, 1, 7, hex(0x5a3a1e));
});
T('crafting_table_front', (p) => {
  planks(p, C.oakPlank);
  p.rect(0, 0, 16, 3, hex(0x6b4a28));
  p.rect(4, 5, 8, 2, hex(0x9a9a9a)); p.rect(4, 7, 8, 1, hex(0x6a6a6a));
  p.rect(7, 8, 2, 6, hex(0x5a3a1e));
});
T('furnace_top', (p) => { p.noise(hex(0x6e6e6e), 0.08); p.border(hex(0x575757)); });
T('furnace_side', (p) => { cobble(p, hex(0x7a7a7a)); p.rect(0, 0, 16, 2, hex(0x5e5e5e)); });
T('furnace_front', (p) => {
  cobble(p, hex(0x7a7a7a));
  p.rect(0, 0, 16, 2, hex(0x5e5e5e));
  p.rect(3, 3, 10, 3, hex(0x5a5a5a));
  p.rect(4, 8, 8, 6, hex(0x1b1b1b));
  p.rect(4, 7, 8, 1, hex(0x484848));
});
T('furnace_front_on', (p) => {
  p.copy('furnace_front');
  for (let y = 9; y < 14; y++) for (let x = 4; x < 12; x++) {
    const t = (y - 9) / 4;
    if (p.r() < 0.8) p.set(x, y, mix(hex(0xffe066), hex(0xe0420e), 1 - t + (p.r() - 0.5) * 0.4));
  }
});
T('white_wool', (p) => wool(p, hex(0xe9ecec)));
T('red_wool', (p) => wool(p, hex(0xa12722)));
T('yellow_wool', (p) => wool(p, hex(0xf8c627)));
T('blue_wool', (p) => wool(p, hex(0x35399d)));
T('green_wool', (p) => wool(p, hex(0x546d1b)));
T('black_wool', (p) => wool(p, hex(0x1d1d21)));
T('sandstone_top', (p) => { p.noise(hex(0xd8cc94), 0.05); });
T('sandstone_side', (p) => {
  p.noise(hex(0xd5c890), 0.05);
  for (let x = 0; x < 16; x++) { p.set(x, 3, hex(0xc4b47a)); p.set(x, 11, hex(0xc4b47a)); p.set(x, 12, hex(0xe0d6a6)); }
});
T('sandstone_bottom', (p) => { p.noise(hex(0xd5c890), 0.06); p.speckle(hex(0xbca86e), 20); });
T('tall_grass', (p) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, [0, 0, 0, 0]);
  for (let b = 0; b < 9; b++) {
    const x0 = 1 + b * 1.6 + p.r();
    const h = 6 + ((p.r() * 9) | 0);
    const lean = (p.r() - 0.5) * 0.4;
    for (let k = 0; k < h; k++) p.set(Math.round(x0 + lean * k), 15 - k, shade(hex(0x5f9c38), 0.75 + (k / h) * 0.5));
  }
});
T('dandelion', (p) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, [0, 0, 0, 0]);
  p.rect(7, 9, 1, 7, hex(0x3f8a24)); p.set(6, 12, hex(0x3f8a24)); p.set(8, 13, hex(0x3f8a24));
  p.rect(6, 6, 3, 3, hex(0xf6e12c)); p.set(7, 5, hex(0xf6e12c)); p.set(5, 7, hex(0xf6e12c)); p.set(9, 7, hex(0xf6e12c)); p.set(7, 7, hex(0xe0a010));
});
T('poppy', (p) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, [0, 0, 0, 0]);
  p.rect(7, 8, 1, 8, hex(0x3f8a24)); p.set(6, 11, hex(0x3f8a24)); p.set(5, 10, hex(0x3f8a24)); p.set(8, 13, hex(0x3f8a24));
  p.rect(5, 4, 5, 4, hex(0xd5231d)); p.rect(6, 3, 3, 1, hex(0xd5231d)); p.set(7, 5, hex(0x2a1a10)); p.set(5, 4, hex(0xa01510));
});
T('bookshelf', (p) => {
  planks(p, C.oakPlank);
  const books = [0xa12722, 0x35399d, 0x546d1b, 0x8a5a2a, 0xd8c070, 0x6a2a6a];
  for (const sy of [2, 9]) {
    for (let x = 1; x < 15; x++) {
      const c = hex(books[(x * 7 + sy) % books.length]);
      const h = 4 + ((p.r() * 2) | 0);
      for (let y = sy + (6 - h); y < sy + 6; y++) p.set(x, y, shade(c, x % 2 ? 1 : 0.85));
    }
  }
  for (let x = 0; x < 16; x++) { p.set(x, 0, hex(0x6b4a28)); p.set(x, 8, hex(0x6b4a28)); p.set(x, 15, hex(0x6b4a28)); }
});
T('obsidian', (p) => {
  p.noise(hex(0x140f20), 0.15);
  for (let i = 0; i < 14; i++) p.set((p.r() * 16) | 0, (p.r() * 16) | 0, hex(0x3b2a5a));
  for (let i = 0; i < 6; i++) p.set((p.r() * 16) | 0, (p.r() * 16) | 0, hex(0x5a4a80));
});
T('ice', (p) => {
  p.noise(hex(0x9cc0f8), 0.05, 200);
  for (let i = 0; i < 4; i++) {
    const x = (p.r() * 10) | 0, y = (p.r() * 12) | 0;
    for (let k = 0; k < 4; k++) p.set(x + k, y + k, [235, 245, 255, 220]);
  }
});
T('clay', (p) => { p.noise(hex(0xa0a6b4), 0.06); p.speckle(hex(0x8c92a0), 14); });
T('torch', (p) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, [0, 0, 0, 0]);
  for (let y = 8; y < 16; y++) { p.set(7, y, hex(0x8a6a3a)); p.set(8, y, hex(0x6b4f2a)); }
  p.set(7, 6, hex(0xffffc0)); p.set(8, 6, hex(0xffe066)); p.set(7, 7, hex(0xffb020)); p.set(8, 7, hex(0xff8a10));
  p.set(7, 5, [255, 220, 120, 160]); p.set(8, 5, [255, 220, 120, 120]);
});
T('iron_block', (p) => metalBlock(p, hex(0xdcdcdc)));
T('gold_block', (p) => metalBlock(p, hex(0xf7d33e)));
T('diamond_block', (p) => metalBlock(p, hex(0x62e3dd)));
T('glowstone', (p) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const r = p.r();
    p.set(x, y, r < 0.25 ? hex(0x8a6a2a) : r < 0.6 ? hex(0xd8a84a) : r < 0.9 ? hex(0xf8d888) : hex(0xffffe0));
  }
});
T('tnt_side', (p) => {
  p.noise(hex(0xc8301e), 0.08);
  for (let x = 0; x < 16; x += 4) for (let y = 0; y < 16; y++) p.set(x, y, hex(0x9a2414));
  p.rect(0, 5, 16, 6, hex(0xe8e8e0));
  let x0 = 2;
  for (const ch of ['T', 'N', 'T']) {
    const g = FONT[ch];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (g[y][x] === '1') p.set(x0 + x * 1, 5 + y + 0, hex(0x1a1a1a));
    x0 += 5;
  }
});
T('tnt_top', (p) => { p.noise(hex(0xb83020), 0.06); p.rect(6, 6, 4, 4, hex(0x404040)); p.rect(7, 7, 2, 2, hex(0xd8d8c8)); });
T('tnt_bottom', (p) => { p.noise(hex(0xb83020), 0.06); });
T('chest_top', (p) => { planks(p, hex(0xa2742f)); p.border(hex(0x4a2e10)); });
T('chest_side', (p) => {
  planks(p, hex(0xa2742f)); p.border(hex(0x4a2e10));
  for (let x = 0; x < 16; x++) p.set(x, 5, hex(0x4a2e10));
});
T('chest_front', (p) => {
  p.copy('chest_side');
  p.rect(7, 4, 2, 4, hex(0xb8b8b8)); p.set(7, 7, hex(0x5a5a5a)); p.set(8, 7, hex(0x5a5a5a));
});
T('pumpkin_side', (p) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = shade(hex(0xd88a1a), 1 + (p.r() - 0.5) * 0.08);
    if (x % 5 === 0) c = shade(hex(0xd88a1a), 0.78);
    p.set(x, y, c);
  }
});
T('pumpkin_top', (p) => {
  p.copy('pumpkin_side');
  p.rect(6, 6, 4, 4, hex(0x6a5020)); p.rect(7, 7, 2, 2, hex(0x8a6a2a));
});
function pumpkinFace(p, inner) {
  p.copy('pumpkin_side');
  p.art([
    '................',
    '................',
    '................',
    '...XX......XX...',
    '...XXX....XXX...',
    '................',
    '................',
    '................',
    '..XXXXXXXXXXXX..',
    '..XXXXXXXXXXXX..',
    '...XX.XXXX.XX...',
    '................',
  ], { X: inner });
}
T('pumpkin_face', (p) => pumpkinFace(p, hex(0x2a1606)));
T('pumpkin_face_on', (p) => pumpkinFace(p, hex(0xffd84a)));
T('melon_side', (p) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = shade(hex(0x6a9a2a), 1 + (p.r() - 0.5) * 0.1);
    if (x % 4 < 2) c = shade(hex(0x4a7a1a), 1 + (p.r() - 0.5) * 0.1);
    p.set(x, y, c);
  }
});
T('melon_top', (p) => { p.noise(hex(0x6a9a2a), 0.12); p.rect(6, 6, 4, 4, hex(0x4a6a1a)); });

// Crack overlay stages.
(function cracks() {
  const r = mulberry32(1234);
  const pix = [];
  for (let s = 0; s < 14; s++) {
    let x = 4 + r() * 8, y = 4 + r() * 8;
    const a = r() * Math.PI * 2;
    for (let k = 0; k < 10; k++) {
      pix.push([Math.floor(x), Math.floor(y)]);
      x += Math.cos(a + (r() - 0.5) * 1.2) * 1.1;
      y += Math.sin(a + (r() - 0.5) * 1.2) * 1.1;
      if (x < 0 || y < 0 || x > 15 || y > 15) break;
    }
  }
  for (let st = 0; st < 10; st++) {
    T('destroy_' + st, (p) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, [0, 0, 0, 0]);
      const n = Math.floor(((st + 1) / 10) * pix.length);
      for (let i = 0; i < n; i++) p.set(pix[i][0], pix[i][1], [20, 20, 20, 210]);
    });
  }
})();

// ---------- items ----------
const STICK = hex(0x6b4f2a), STICK_L = hex(0x9a7444);
const MAT = {
  wooden: [hex(0x9a7444), hex(0x6b4f2a), hex(0xbc9862)],
  stone: [hex(0x8a8a8a), hex(0x555555), hex(0xaaaaaa)],
  iron: [hex(0xd8d8d8), hex(0x9a9a9a), hex(0xffffff)],
  golden: [hex(0xf8d838), hex(0xc09018), hex(0xfff6a0)],
  diamond: [hex(0x4ae0d8), hex(0x1a9a92), hex(0xb8fff8)],
};
const TOOL_ART = {
  pickaxe: [
    '................',
    '...LHHHHHHHL....',
    '..HHDDDDDDDHH...',
    '.HD....SS...DH..',
    '.D.....SS....D..',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '................',
  ],
  axe: [
    '................',
    '....LHH.........',
    '...HHHHSS.......',
    '..HHHHHSS.......',
    '..HHHHDSS.......',
    '...HHD.SS.......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '................',
  ],
  shovel: [
    '................',
    '......LHHL......',
    '.....LHHHHD.....',
    '.....HHHHHD.....',
    '.....HHHHHD.....',
    '......HHHD......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '......SSSS......',
    '................',
    '................',
  ],
  sword: [
    '........L.......',
    '.......LHD......',
    '.......LHD......',
    '.......LHD......',
    '.......LHD......',
    '.......LHD......',
    '.......LHD......',
    '.......LHD......',
    '.......LHD......',
    '.......LHD......',
    '....SSSSSSSS....',
    '.....SSSSSS.....',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
    '.......SS.......',
  ],
};
for (const mat of Object.keys(MAT)) {
  for (const type of Object.keys(TOOL_ART)) {
    T(`${mat}_${type}`, (p) => {
      p.art(TOOL_ART[type], { H: MAT[mat][0], D: MAT[mat][1], L: MAT[mat][2], S: (x, y) => ((x + y) % 2 ? STICK : STICK_L) });
    });
  }
}

function itemArt(name, rows, pal) { T(name, (p) => p.art(rows, pal)); }
itemArt('stick', [
  '................', '............SL..', '...........SL...', '..........SL....', '.........SL.....',
  '........SL......', '.......SL.......', '......SL........', '.....SL.........', '....SL..........',
  '...SL...........', '..SL............', '................',
], { S: STICK, L: STICK_L });
const gem = (name, a, b, c) => itemArt(name, [
  '................', '................', '.....AAAAAA.....', '....ABBBBBBA....', '...ABCCBBBBBA...',
  '..ABCCBBBBBBBA..', '..ABCBBBBBBBBA..', '...ABBBBBBBBA...', '....ABBBBBBA....', '.....ABBBBA.....',
  '......ABBA......', '.......AA.......',
], { A: a, B: b, C: c });
gem('diamond', hex(0x0e6e68), hex(0x4ae0d8), hex(0xd8fffa));
gem('coal', hex(0x101010), hex(0x2e2e2e), hex(0x5a5a5a));
gem('flint', hex(0x1a1a1a), hex(0x3a3a3a), hex(0x6a6a6a));
const ingot = (name, a, b, c) => itemArt(name, [
  '................', '................', '................', '................', '.....CCCCCCCC...',
  '....CBBBBBBBBA..', '...CBBBBBBBBA...', '..CBBBBBBBBA....', '..AAAAAAAAA.....',
], { A: a, B: b, C: c });
ingot('iron_ingot', hex(0x7a7a7a), hex(0xd8d8d8), hex(0xffffff));
ingot('gold_ingot', hex(0xa07a10), hex(0xf8d838), hex(0xfffac0));
const meat = (name, a, b, c) => itemArt(name, [
  '................', '................', '......AAAA......', '....AABBBBAA....', '...ABBCCBBBBA...',
  '..ABBCBBBBBBBA..', '..ABBBBBBCCBBA..', '..ABBBBBBBBBBA..', '...ABBBBBBBBA...', '....AABBBBAA..WW',
  '......AAAAA..WW.', '............WW..', '................',
], { A: a, B: b, C: c, W: hex(0xe8e0d0) });
meat('porkchop', hex(0xa04848), hex(0xf09090), hex(0xffd0d0));
meat('cooked_porkchop', hex(0x6a3a18), hex(0xb07040), hex(0xe0b080));
meat('beef', hex(0x8a2020), hex(0xd04040), hex(0xf0a0a0));
meat('steak', hex(0x4a2810), hex(0x8a5028), hex(0xc08050));
meat('mutton', hex(0x9a3030), hex(0xd85a50), hex(0xf8c8b8));
meat('cooked_mutton', hex(0x5a3010), hex(0x9a6030), hex(0xd8a070));
meat('rotten_flesh', hex(0x5a3a20), hex(0x8a6a3a), hex(0x6a8a3a));
const leg = (name, a, b) => itemArt(name, [
  '................', '................', '.....AAAA.......', '....ABBBBA......', '...ABBBBBBA.....',
  '...ABBBBBBA.....', '...ABBBBBBA.....', '....ABBBBA......', '.....AABBA......', '.......AWW......',
  '........WW......', '........WWW.....', '.........W......',
], { A: a, B: b, W: hex(0xf0ece0) });
leg('chicken', hex(0xd09080), hex(0xf8d0c0));
leg('cooked_chicken', hex(0x8a5020), hex(0xd0904a));
itemArt('apple', [
  '................', '.......S........', '.......SLL......', '....RRRSRRR.....', '...RRRRRRRRR....',
  '..RRWRRRRRRRR...', '..RWRRRRRRRRR...', '..RRRRRRRRRRR...', '..RRRRRRRRRRD...', '...RRRRRRRRD....',
  '....RRDRRDD.....', '................',
], { R: hex(0xd8201a), D: hex(0x8a1010), W: hex(0xffa0a0), S: STICK, L: hex(0x3f8a24) });
itemArt('melon_slice', [
  '................', '................', '................', '..G..........G..', '..GPPPPPPPPPPG..',
  '...GPPBPPPBPG...', '....GPPPBPPG....', '.....GPPPPG.....', '......GPPG......', '.......GG.......',
], { G: hex(0x4a8a1a), P: hex(0xe84a3a), B: hex(0x1a1a1a) });
itemArt('bread', [
  '................', '................', '................', '.....AAAAAA.....', '...AABBBBBBAA...',
  '..ABBCBBCBBCBA..', '..ABBBBBBBBBBA..', '..ABBBBBBBBBBA..', '...AAAAAAAAAA...',
], { A: hex(0x7a4a1a), B: hex(0xc8883a), C: hex(0xe8b860) });
itemArt('bone', [
  '................', '............WW..', '...........WWW..', '..........WWW...', '.........WW.....',
  '........WW......', '.......WW.......', '......WW........', '.....WW.........', '...WWW..........',
  '..WWW...........', '..WW............',
], { W: hex(0xe8e4d4) });
itemArt('arrow', [
  '................', '...........AAA..', '............AA..', '...........S.A..', '..........S.....',
  '.........S......', '........S.......', '.......S........', '......S.........', '..F.FS..........',
  '..FFS...........', '..FFF...........',
], { A: hex(0x9a9a9a), S: STICK_L, F: hex(0xe8e8e8) });
itemArt('string', [
  '................', '............W...', '...........W....', '..........W.....', '.........W......',
  '........WW......', '.......W..W.....', '......W....W....', '.....W......W...', '....W...........',
  '...W............',
], { W: hex(0xe8e8e8) });
itemArt('gunpowder', [
  '................', '................', '................', '......GGG.......', '....GGDGGGG.....',
  '...GDGGGGDGG....', '..GGGGDGGGGGG...', '..GDGGGGGDGGG...', '...GGGGGGGGG....', '....GGDGGG......',
], { G: hex(0x6a6a6a), D: hex(0x3a3a3a) });
itemArt('feather', [
  '................', '............WW..', '..........WWWW..', '.........WWWWW..', '........WWWWW...',
  '.......WWWWW....', '......WWWWW.....', '.....WWWW.......', '....GWW.........', '...G............',
  '..G.............',
], { W: hex(0xf4f4f4), G: hex(0xa0a0a0) });
itemArt('leather', [
  '................', '................', '...LLLLLLLLLL...', '..LLDLLLLLLDLL..', '..LLLLLLLLLLLL..',
  '...LLLLLLLLLL...', '...LLLLLLLLLL...', '..LLLLLLLLLLLL..', '..LLDLLLLLLDLL..', '...LLLLLLLLLL...',
], { L: hex(0xa0582a), D: hex(0x6a3a18) });
itemArt('flint_and_steel', [
  '................', '..IIII..........', '.I....I.........', '.I.....I........', '..I.....I.......',
  '...........FFF..', '..........FFFF..', '.........FFFFF..', '.........FFFF...', '..........FF....',
], { I: hex(0xb0b0b0), F: hex(0x3a3a3a) });
itemArt('wheat', [
  '..........Y.....', '.........YYY....', '........YYY.Y...', '.......YYY.YY...', '......SYY.YY....',
  '.....S..YYY.....', '....S...........', '...S............', '..S.............',
], { Y: hex(0xd8b848), S: hex(0x8a8a2a) });

itemArt('bow', [
  '................', '..........SSS...', '........SS..X...', '.......S....X...', '......S.....X...',
  '.....S......X...', '....S.......X...', '...S.......X....', '...S......X.....', '...S.....X......',
  '....S...X.......', '.....S.X........', '......SX........', '.......S........',
], { S: hex(0x7a5a2a), X: hex(0xd8d8d8) });

// ---------- mob skins ----------
T('white', (p) => p.noise([255, 255, 255], 0));
T('pig_skin', (p) => { p.noise(hex(0xf0a0a0), 0.05); p.speckle(hex(0xe08888), 10); });
T('pig_face', (p) => {
  p.copy('pig_skin');
  p.art([
    '................', '................', '................', '................', '................',
    '.WWBB......BBWW.', '.WWBB......BBWW.', '................', '................',
    '....SSSSSSSS....', '....SNNSSNNS....', '....SNNSSNNS....', '....SSSSSSSS....',
  ], { W: hex(0xffffff), B: hex(0x1a1a1a), S: hex(0xf8b8b8), N: hex(0x8a4a4a) });
});
T('cow_skin', (p) => {
  p.noise(hex(0x4a3424), 0.08);
  for (let i = 0; i < 4; i++) {
    const cx = p.r() * 16, cy = p.r() * 16, rad = 2 + p.r() * 3;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 < rad * rad) p.set(x, y, shade(hex(0xe8e8e0), 1 + (p.r() - 0.5) * 0.06));
  }
});
T('cow_face', (p) => {
  p.noise(hex(0x4a3424), 0.08);
  p.rect(5, 0, 6, 9, hex(0xe8e8e0));
  p.art([
    '................', '................', '................', '................', '................',
    '.WB..........BW.', '.WB..........BW.', '................', '................', '................',
    '...MMMMMMMMMM...', '...MMMMMMMMMM...', '...MNNMMMMNNM...', '...MMMMMMMMMM...', '...MMMMMMMMMM...',
  ], { W: hex(0xffffff), B: hex(0x1a1a1a), M: hex(0xc8a090), N: hex(0x4a2a20) });
});
T('sheep_wool', (p) => wool(p, hex(0xe8e8e2)));
T('sheep_face', (p) => {
  p.noise(hex(0xd4b4a0), 0.05);
  p.rect(0, 0, 16, 3, hex(0xe8e8e2));
  p.art([
    '................', '................', '................', '................', '................',
    '...WB......BW...', '...WB......BW...', '................', '................',
    '......PPPP......', '.......PP.......',
  ], { W: hex(0xffffff), B: hex(0x1a1a1a), P: hex(0xb08878) });
});
T('sheep_skin', (p) => p.noise(hex(0xd4b4a0), 0.05));
T('chicken_white', (p) => { p.noise(hex(0xf4f4f4), 0.04); p.speckle(hex(0xdadada), 10); });
T('chicken_head', (p) => {
  p.copy('chicken_white');
  p.art(['................', '................', '................', '................', '.BB..........BB.', '.BB..........BB.'], { B: hex(0x1a1a1a) });
});
T('chicken_beak', (p) => p.noise(hex(0xf8b028), 0.06));
T('chicken_wattle', (p) => p.noise(hex(0xd81a1a), 0.06));
T('chicken_leg', (p) => p.noise(hex(0xe8a020), 0.08));
T('zombie_skin', (p) => { p.noise(hex(0x6a9a52), 0.08); p.speckle(hex(0x4a7a3a), 12); });
T('zombie_hair', (p) => { p.noise(hex(0x3a5a2a), 0.12); });
T('zombie_face', (p) => {
  p.copy('zombie_skin');
  p.rect(0, 0, 16, 3, hex(0x3a5a2a));
  p.art([
    '................', '................', '................', '................', '................',
    '................', '...BBB....BBB...', '...BBB....BBB...', '................', '................',
    '......DDDD......', '.....D....D.....', '................',
  ], { B: hex(0x101810), D: hex(0x3a5a2a) });
});
T('zombie_shirt', (p) => { p.noise(hex(0x00a0a8), 0.08); p.speckle(hex(0x008890), 10); });
T('zombie_pants', (p) => { p.noise(hex(0x3c3c94), 0.08); p.speckle(hex(0x2a2a74), 10); });
T('skeleton_bone', (p) => { p.noise(hex(0xc8c8c8), 0.06); p.speckle(hex(0xa8a8a8), 10); });
T('skeleton_face', (p) => {
  p.copy('skeleton_bone');
  p.art([
    '................', '................', '................', '................', '................',
    '..BBBB....BBBB..', '..BBBB....BBBB..', '................', '.......BB.......', '................',
    '...BBBBBBBBBB...', '...B.B.B.B.B.B..', '................',
  ], { B: hex(0x1a1a1a) });
});
T('creeper_skin', (p) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const r = p.r();
    p.set(x, y, r < 0.2 ? hex(0x3a8a32) : r < 0.5 ? hex(0x5aaa48) : r < 0.85 ? hex(0x6aca58) : hex(0xa8e8a0));
  }
});
T('creeper_face', (p) => {
  p.copy('creeper_skin');
  p.art([
    '................', '................', '................', '................',
    '..BBBB....BBBB..', '..BBBB....BBBB..', '..BBBB....BBBB..', '..BBBB....BBBB..',
    '......BBBB......', '......BBBB......', '....BBBBBBBB....', '....BBBBBBBB....',
    '....BBB..BBB....', '....BBB..BBB....',
  ], { B: hex(0x0a0a0a) });
});
T('spider_body', (p) => {
  p.noise(hex(0x342a24), 0.15);
  p.speckle(hex(0x1a1410), 30);
});
T('spider_face', (p) => {
  p.copy('spider_body');
  p.art([
    '................', '................', '................', '................', '....R......R....',
    '..RRR.R..R.RRR..', '..RRR.R..R.RRR..', '................', '.....R....R.....',
  ], { R: hex(0xd81a1a) });
});
T('sun', (p) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    p.set(x, y, d < 5 ? hex(0xffffd8) : d < 7 ? [255, 240, 140, 180] : [255, 220, 100, 60]);
  }
});
T('moon', (p) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    p.set(x, y, d < 6 ? shade(hex(0xe8ecf4), 0.9 + p.r() * 0.15) : [0, 0, 0, 0]);
  }
  p.rect(4, 5, 2, 2, hex(0xb0b4c0)); p.rect(9, 9, 3, 2, hex(0xb0b4c0)); p.rect(8, 4, 1, 1, hex(0xb0b4c0));
});
T('flame', (p) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, [0, 0, 0, 0]);
  for (let x = 0; x < 16; x++) {
    const h = 6 + Math.abs(Math.sin(x * 1.3 + 0.5)) * 7 + p.r() * 3;
    for (let k = 0; k < h; k++) {
      const t = k / h;
      const c = mix(hex(0xe8400a), hex(0xffe27a), t * 0.9 + p.r() * 0.15);
      c[3] = t > 0.85 ? 150 : 235;
      p.set(x, 15 - k, c);
    }
  }
});
T('smoke', (p) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x - 7.5, y - 7.5);
    p.set(x, y, d < 6 ? [200, 200, 200, 230 - d * 20] : [0, 0, 0, 0]);
  }
});

// Verify every block/item has its tiles.
const missing = [];
for (const b of BLOCKS) if (b && b.id) for (const k of ['top', 'side', 'bottom', 'front']) if (TILES[b.tiles[k]] === undefined) missing.push(b.tiles[k]);
for (const it of ITEMS) if (it && !it.block && TILES[it.tile] === undefined) missing.push(it.tile);
if (missing.length) console.warn('Missing tiles:', [...new Set(missing)]);
if (nextTile > ATLAS_TILES * ATLAS_TILES) throw new Error('Atlas overflow');

export function tileUV(name) {
  const t = typeof name === 'number' ? name : TILES[name];
  return [(t % ATLAS_TILES) / ATLAS_TILES, Math.floor(t / ATLAS_TILES) / ATLAS_TILES];
}

let atlasCanvas = null;
export function getAtlasCanvas() {
  if (atlasCanvas) return atlasCanvas;
  atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = atlasCanvas.height = ATLAS_SIZE;
  const ctx = atlasCanvas.getContext('2d');
  ctx.putImageData(new ImageData(data, ATLAS_SIZE, ATLAS_SIZE), 0, 0);
  return atlasCanvas;
}

export function getAtlasData() { return data; }

export function tileDataURL(name, scale = 4) {
  const c = document.createElement('canvas');
  c.width = c.height = TILE * scale;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const t = TILES[name];
  ctx.drawImage(getAtlasCanvas(), (t % ATLAS_TILES) * TILE, Math.floor(t / ATLAS_TILES) * TILE, TILE, TILE, 0, 0, c.width, c.height);
  return c.toDataURL();
}

export function makeCloudCanvas() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const r = mulberry32(99);
  const cells = new Uint8Array(S * S);
  for (let i = 0; i < 70; i++) {
    const cx = (r() * S) | 0, cy = (r() * S) | 0, w = 3 + ((r() * 10) | 0), h = 2 + ((r() * 7) | 0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells[((cy + y) % S) * S + ((cx + x) % S)] = 1;
  }
  for (let i = 0; i < S * S; i++) {
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = cells[i] ? 215 : 0;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------- UI icons ----------
const iconCache = new Map();
export function itemIcon(id, size = 48) {
  const key = id + ':' + size;
  if (iconCache.has(key)) return iconCache.get(key);
  const it = ITEMS[id];
  if (!it) return '';
  const atlas = getAtlasCanvas();
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const blk = it.block ? BLOCKS[it.block] : null;
  const src = (name) => {
    const t = TILES[name];
    return [(t % ATLAS_TILES) * TILE, Math.floor(t / ATLAS_TILES) * TILE];
  };
  if (blk && blk.shape === 'cube') {
    const S = size;
    const face = (name, a, b, cc, d, e, f, dark) => {
      const [sx, sy] = src(name);
      ctx.setTransform(a, b, cc, d, e, f);
      ctx.drawImage(atlas, sx, sy, 16, 16, 0, 0, 16, 16);
      if (dark) { ctx.fillStyle = `rgba(0,0,0,${dark})`; ctx.fillRect(0, 0, 16, 16); }
    };
    const k = 0.92; // inset so the cube fits
    const s = S * k, o = (S - s) / 2;
    face(blk.tiles.top, (s / 2) / 16, (s / 4) / 16, -(s / 2) / 16, (s / 4) / 16, o + s / 2, o, 0);
    face(blk.tiles.front, (s / 2) / 16, (s / 4) / 16, 0, (s / 2) / 16, o, o + s / 4, 0.22);
    face(blk.tiles.side, (s / 2) / 16, -(s / 4) / 16, 0, (s / 2) / 16, o + s / 2, o + s / 2, 0.42);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  } else {
    const name = blk ? blk.tiles.side : it.tile;
    const [sx, sy] = src(name);
    ctx.drawImage(atlas, sx, sy, 16, 16, 0, 0, size, size);
  }
  const url = c.toDataURL();
  iconCache.set(key, url);
  return url;
}
