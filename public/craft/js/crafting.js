// Crafting recipes (shaped + shapeless) and inventory stack helpers.

import { I, ITEMS, maxStack } from './blocks.js';

const PLANKS = ['oak_planks', 'birch_planks', 'spruce_planks'];
const RECIPES = [];

function shaped(pattern, key, out, count = 1) {
  const k = {};
  for (const [ch, v] of Object.entries(key)) k[ch] = (Array.isArray(v) ? v : [v]).map((n) => I[n]);
  RECIPES.push({ pattern, key: k, out: I[out], count, w: pattern[0].length, h: pattern.length });
}
function shapeless(items, out, count = 1) {
  RECIPES.push({ shapeless: items.map((n) => (Array.isArray(n) ? n : [n]).map((x) => I[x])), out: I[out], count });
}

shapeless(['oak_log'], 'oak_planks', 4);
shapeless(['birch_log'], 'birch_planks', 4);
shapeless(['spruce_log'], 'spruce_planks', 4);
shaped(['P', 'P'], { P: PLANKS }, 'stick', 4);
shaped(['PP', 'PP'], { P: PLANKS }, 'crafting_table');
shaped(['CCC', 'C C', 'CCC'], { C: 'cobblestone' }, 'furnace');
shaped(['PPP', 'P P', 'PPP'], { P: PLANKS }, 'chest');
shaped(['c', 's'], { c: 'coal', s: 'stick' }, 'torch', 4);
const MATS = { wooden: PLANKS, stone: ['cobblestone'], iron: ['iron_ingot'], golden: ['gold_ingot'], diamond: ['diamond'] };
for (const [mat, m] of Object.entries(MATS)) {
  shaped(['MMM', ' S ', ' S '], { M: m, S: 'stick' }, `${mat}_pickaxe`);
  shaped(['MM', 'MS', ' S'], { M: m, S: 'stick' }, `${mat}_axe`);
  shaped(['M', 'S', 'S'], { M: m, S: 'stick' }, `${mat}_shovel`);
  shaped(['M', 'M', 'S'], { M: m, S: 'stick' }, `${mat}_sword`);
}
shaped(['SS', 'SS'], { S: 'sand' }, 'sandstone');
shaped(['SS', 'SS'], { S: 'stone' }, 'stone_bricks', 4);
shaped(['SS', 'SS'], { S: 'string' }, 'white_wool');
shaped(['GSG', 'SGS', 'GSG'], { G: 'gunpowder', S: 'sand' }, 'tnt');
shaped(['P', 'T'], { P: 'pumpkin', T: 'torch' }, 'jack_o_lantern');
shaped(['F', 'S', 'E'], { F: 'flint', S: 'stick', E: 'feather' }, 'arrow', 4);
shaped(['WWW'], { W: 'wheat' }, 'bread');
shaped([' SX', 'S X', ' SX'], { S: 'stick', X: 'string' }, 'bow');
shaped(['MMM', 'MMM', 'MMM'], { M: 'melon_slice' }, 'melon');
shaped(['PPP', 'LLL', 'PPP'], { P: PLANKS, L: 'leather' }, 'bookshelf');
shaped(['CV', 'VC'], { C: 'cobblestone', V: 'tall_grass' }, 'mossy_cobblestone', 2);
shapeless(['iron_ingot', 'flint'], 'flint_and_steel');
for (const [blk, ing] of [['iron_block', 'iron_ingot'], ['gold_block', 'gold_ingot'], ['diamond_block', 'diamond']]) {
  shaped(['MMM', 'MMM', 'MMM'], { M: ing }, blk);
  shapeless([blk], ing, 9);
}
shapeless(['white_wool', 'poppy'], 'red_wool');
shapeless(['white_wool', 'dandelion'], 'yellow_wool');
shapeless(['white_wool', 'cactus'], 'green_wool');
shapeless(['white_wool', 'coal'], 'black_wool');
shapeless(['white_wool', 'diamond'], 'blue_wool');

// grid: array of n*n item ids (0 = empty). Returns {id, count} or null.
export function matchRecipe(grid, n) {
  let minX = n, minY = n, maxX = -1, maxY = -1;
  const items = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const id = grid[y * n + x];
    if (id) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); items.push(id); }
  }
  if (!items.length) return null;
  const w = maxX - minX + 1, h = maxY - minY + 1;
  for (const r of RECIPES) {
    if (r.shapeless) {
      if (r.shapeless.length !== items.length) continue;
      const left = items.slice();
      let ok = true;
      for (const opts of r.shapeless) {
        const i = left.findIndex((id) => opts.includes(id));
        if (i < 0) { ok = false; break; }
        left.splice(i, 1);
      }
      if (ok) return { id: r.out, count: r.count };
      continue;
    }
    if (r.w !== w || r.h !== h) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let y = 0; y < h && ok; y++) for (let x = 0; x < w && ok; x++) {
        const ch = r.pattern[y][mirror ? w - 1 - x : x];
        const id = grid[(minY + y) * n + minX + x];
        if (ch === ' ') { if (id) ok = false; }
        else if (!r.key[ch].includes(id)) ok = false;
      }
      if (ok) return { id: r.out, count: r.count };
    }
  }
  return null;
}

// ---- stack helpers (a stack is {id, count, dur?} or null) ----
export function stack(id, count = 1, dur) {
  const s = { id, count };
  const it = ITEMS[id];
  if (it && it.durability) s.dur = dur !== undefined ? dur : it.durability;
  return s;
}

// Try to add a stack into slots[from..to). Returns leftover count.
export function addToSlots(slots, s, from = 0, to = slots.length, order) {
  let left = s.count;
  const max = maxStack(s.id);
  const idxs = order || [...Array(to - from).keys()].map((i) => i + from);
  if (max > 1) {
    for (const i of idxs) {
      const t = slots[i];
      if (t && t.id === s.id && t.count < max) {
        const n = Math.min(left, max - t.count);
        t.count += n; left -= n;
        if (!left) return 0;
      }
    }
  }
  for (const i of idxs) {
    if (!slots[i]) {
      const n = Math.min(left, max);
      slots[i] = { ...s, count: n };
      left -= n;
      if (!left) return 0;
    }
  }
  return left;
}

export function countItem(slots, id) {
  let n = 0;
  for (const s of slots) if (s && s.id === id) n += s.count;
  return n;
}
