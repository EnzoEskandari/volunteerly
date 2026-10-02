// Block and item registry. Blocks occupy ids 0-255 (and double as items);
// non-block items start at 256.

export const B = Object.create(null); // block name -> id
export const BLOCKS = []; // id -> block def
export const I = Object.create(null); // item name -> id (blocks included)
export const ITEMS = []; // id -> item def

const TOOL_TIERS = { wooden: 1, stone: 2, iron: 3, diamond: 4, golden: 1 };
const TOOL_SPEED = { wooden: 2, stone: 4, iron: 6, diamond: 8, golden: 12 };
const TOOL_DUR = { wooden: 59, stone: 131, iron: 250, diamond: 1561, golden: 32 };

function block(id, name, display, o = {}) {
  const t = o.tiles || name;
  const tiles = typeof t === 'string' ? { top: t, bottom: t, side: t } : { ...t };
  if (!tiles.side) tiles.side = tiles.top;
  if (!tiles.top) tiles.top = tiles.side;
  if (!tiles.bottom) tiles.bottom = tiles.top;
  if (!tiles.front) tiles.front = tiles.side;
  const d = {
    id,
    name,
    display,
    tiles,
    shape: o.shape || 'cube',
    solid: o.solid !== undefined ? o.solid : true,
    opaque: o.opaque !== undefined ? o.opaque : true,
    cutout: !!o.cutout,
    translucent: !!o.translucent,
    liquid: !!o.liquid,
    hardness: o.hardness !== undefined ? o.hardness : 1,
    tool: o.tool || null,
    tier: o.tier || 0,
    light: o.light || 0,
    filter: o.filter || 0, // extra light attenuation for non-opaque blocks
    gravity: !!o.gravity,
    replaceable: !!o.replaceable,
    orient: !!o.orient,
    drops: o.drops,
    needsSupport: !!o.needsSupport,
    sound: o.sound || 'stone',
    container: o.container || null,
    sameCull: o.sameCull !== undefined ? o.sameCull : false,
  };
  BLOCKS[id] = d;
  B[name] = id;
  I[name] = id;
  ITEMS[id] = { id, name, display, block: id, stack: 64 };
  return d;
}

block(0, 'air', 'Air', { solid: false, opaque: false, hardness: 0 });
block(1, 'grass', 'Grass Block', { tiles: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' }, hardness: 0.6, tool: 'shovel', drops: 'dirt', sound: 'grass' });
block(2, 'dirt', 'Dirt', { hardness: 0.5, tool: 'shovel', sound: 'gravel' });
block(3, 'stone', 'Stone', { hardness: 1.5, tool: 'pickaxe', tier: 1, drops: 'cobblestone' });
block(4, 'cobblestone', 'Cobblestone', { hardness: 2, tool: 'pickaxe', tier: 1 });
block(5, 'bedrock', 'Bedrock', { hardness: -1 });
block(6, 'sand', 'Sand', { hardness: 0.5, tool: 'shovel', gravity: true, sound: 'sand' });
block(7, 'gravel', 'Gravel', {
  hardness: 0.6, tool: 'shovel', gravity: true, sound: 'gravel',
  drops: (r) => (r() < 0.1 ? [['flint', 1]] : [['gravel', 1]]),
});
block(8, 'oak_log', 'Oak Log', { tiles: { top: 'oak_log_top', side: 'oak_log' }, hardness: 2, tool: 'axe', sound: 'wood' });
block(9, 'oak_leaves', 'Oak Leaves', {
  opaque: false, cutout: true, hardness: 0.2, filter: 1, sound: 'grass', sameCull: false,
  drops: (r) => (r() < 0.06 ? [['apple', 1]] : r() < 0.05 ? [['stick', 1]] : []),
});
block(10, 'oak_planks', 'Oak Planks', { hardness: 2, tool: 'axe', sound: 'wood' });
block(11, 'glass', 'Glass', { opaque: false, cutout: true, hardness: 0.3, drops: () => [], sound: 'glass', sameCull: true });
block(12, 'water', 'Water', { solid: false, opaque: false, translucent: true, liquid: true, hardness: -1, filter: 2, replaceable: true, sameCull: true, drops: () => [] });
block(13, 'coal_ore', 'Coal Ore', { hardness: 3, tool: 'pickaxe', tier: 1, drops: 'coal' });
block(14, 'iron_ore', 'Iron Ore', { hardness: 3, tool: 'pickaxe', tier: 2 });
block(15, 'gold_ore', 'Gold Ore', { hardness: 3, tool: 'pickaxe', tier: 3 });
block(16, 'diamond_ore', 'Diamond Ore', { hardness: 3, tool: 'pickaxe', tier: 3, drops: 'diamond' });
block(17, 'snow_block', 'Snow Block', { tiles: 'snow', hardness: 0.2, tool: 'shovel', sound: 'snow' });
block(18, 'cactus', 'Cactus', { tiles: { top: 'cactus_top', side: 'cactus_side', bottom: 'cactus_bottom' }, hardness: 0.4, sound: 'wool' });
block(19, 'bricks', 'Bricks', { hardness: 2, tool: 'pickaxe', tier: 1 });
block(20, 'crafting_table', 'Crafting Table', {
  tiles: { top: 'crafting_table_top', side: 'crafting_table_side', front: 'crafting_table_front', bottom: 'oak_planks' },
  hardness: 2.5, tool: 'axe', orient: true, container: 'crafting', sound: 'wood',
});
block(21, 'furnace', 'Furnace', {
  tiles: { top: 'furnace_top', side: 'furnace_side', front: 'furnace_front', bottom: 'furnace_top' },
  hardness: 3.5, tool: 'pickaxe', tier: 1, orient: true, container: 'furnace',
});
block(22, 'furnace_lit', 'Furnace', {
  tiles: { top: 'furnace_top', side: 'furnace_side', front: 'furnace_front_on', bottom: 'furnace_top' },
  hardness: 3.5, tool: 'pickaxe', tier: 1, orient: true, container: 'furnace', light: 13, drops: 'furnace',
});
block(23, 'white_wool', 'White Wool', { hardness: 0.8, sound: 'wool' });
block(24, 'birch_log', 'Birch Log', { tiles: { top: 'birch_log_top', side: 'birch_log' }, hardness: 2, tool: 'axe', sound: 'wood' });
block(25, 'birch_leaves', 'Birch Leaves', {
  opaque: false, cutout: true, hardness: 0.2, filter: 1, sound: 'grass',
  drops: (r) => (r() < 0.05 ? [['stick', 1]] : []),
});
block(26, 'birch_planks', 'Birch Planks', { hardness: 2, tool: 'axe', sound: 'wood' });
block(27, 'sandstone', 'Sandstone', { tiles: { top: 'sandstone_top', side: 'sandstone_side', bottom: 'sandstone_bottom' }, hardness: 0.8, tool: 'pickaxe', tier: 1 });
block(28, 'stone_bricks', 'Stone Bricks', { hardness: 1.5, tool: 'pickaxe', tier: 1 });
block(29, 'tall_grass', 'Grass', { shape: 'cross', solid: false, opaque: false, cutout: true, hardness: 0, replaceable: true, needsSupport: true, sound: 'grass', drops: () => [] });
block(30, 'dandelion', 'Dandelion', { shape: 'cross', solid: false, opaque: false, cutout: true, hardness: 0, needsSupport: true, sound: 'grass' });
block(31, 'poppy', 'Poppy', { shape: 'cross', solid: false, opaque: false, cutout: true, hardness: 0, needsSupport: true, sound: 'grass' });
block(32, 'bookshelf', 'Bookshelf', { tiles: { top: 'oak_planks', side: 'bookshelf' }, hardness: 1.5, tool: 'axe', sound: 'wood' });
block(33, 'obsidian', 'Obsidian', { hardness: 50, tool: 'pickaxe', tier: 4 });
block(34, 'ice', 'Ice', { opaque: false, translucent: true, hardness: 0.5, tool: 'pickaxe', filter: 1, sameCull: true, drops: () => [], sound: 'glass' });
block(35, 'clay', 'Clay', { hardness: 0.6, tool: 'shovel', sound: 'gravel' });
block(36, 'torch', 'Torch', { shape: 'torch', solid: false, opaque: false, cutout: true, hardness: 0, light: 14, needsSupport: true, sound: 'wood' });
block(37, 'snowy_grass', 'Snowy Grass Block', { tiles: { top: 'snow', side: 'grass_snow_side', bottom: 'dirt' }, hardness: 0.6, tool: 'shovel', drops: 'dirt', sound: 'snow' });
block(38, 'spruce_log', 'Spruce Log', { tiles: { top: 'spruce_log_top', side: 'spruce_log' }, hardness: 2, tool: 'axe', sound: 'wood' });
block(39, 'spruce_leaves', 'Spruce Leaves', {
  opaque: false, cutout: true, hardness: 0.2, filter: 1, sound: 'grass',
  drops: (r) => (r() < 0.05 ? [['stick', 1]] : []),
});
block(40, 'red_wool', 'Red Wool', { hardness: 0.8, sound: 'wool' });
block(41, 'yellow_wool', 'Yellow Wool', { hardness: 0.8, sound: 'wool' });
block(42, 'blue_wool', 'Blue Wool', { hardness: 0.8, sound: 'wool' });
block(43, 'green_wool', 'Green Wool', { hardness: 0.8, sound: 'wool' });
block(44, 'black_wool', 'Black Wool', { hardness: 0.8, sound: 'wool' });
block(45, 'spruce_planks', 'Spruce Planks', { hardness: 2, tool: 'axe', sound: 'wood' });
block(46, 'iron_block', 'Block of Iron', { hardness: 5, tool: 'pickaxe', tier: 2 });
block(47, 'gold_block', 'Block of Gold', { hardness: 3, tool: 'pickaxe', tier: 3 });
block(48, 'diamond_block', 'Block of Diamond', { hardness: 5, tool: 'pickaxe', tier: 3 });
block(49, 'mossy_cobblestone', 'Mossy Cobblestone', { hardness: 2, tool: 'pickaxe', tier: 1 });
block(50, 'glowstone', 'Glowstone', { hardness: 0.3, light: 15, sound: 'glass' });
block(51, 'tnt', 'TNT', { tiles: { top: 'tnt_top', side: 'tnt_side', bottom: 'tnt_bottom' }, hardness: 0, sound: 'grass' });
block(52, 'chest', 'Chest', {
  tiles: { top: 'chest_top', side: 'chest_side', front: 'chest_front', bottom: 'chest_top' },
  hardness: 2.5, tool: 'axe', orient: true, container: 'chest', sound: 'wood',
});
block(53, 'pumpkin', 'Pumpkin', { tiles: { top: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_face', bottom: 'pumpkin_top' }, hardness: 1, tool: 'axe', orient: true, sound: 'wood' });
block(54, 'jack_o_lantern', "Jack o'Lantern", { tiles: { top: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_face_on', bottom: 'pumpkin_top' }, hardness: 1, tool: 'axe', orient: true, light: 15, sound: 'wood' });
block(55, 'melon', 'Melon', { tiles: { top: 'melon_top', side: 'melon_side' }, hardness: 1, tool: 'axe', sound: 'wood', drops: (r) => [['melon_slice', 3 + Math.floor(r() * 5)]] });
block(56, 'lava', 'Lava', { solid: false, opaque: false, liquid: true, hardness: -1, light: 15, replaceable: true, sameCull: true, drops: () => [] });
block(57, 'stone_slab_block', 'Smooth Stone', { tiles: 'smooth_stone', hardness: 2, tool: 'pickaxe', tier: 1 });

// ---- non-block items ----
let nextItem = 256;
function item(name, display, o = {}) {
  const id = nextItem++;
  const d = { id, name, display, tile: o.tile || name, stack: o.stack || 64, ...o };
  ITEMS[id] = d;
  I[name] = id;
  return d;
}

item('stick', 'Stick', { fuel: 5 });
item('coal', 'Coal', { fuel: 80 });
item('iron_ingot', 'Iron Ingot');
item('gold_ingot', 'Gold Ingot');
item('diamond', 'Diamond');
item('flint', 'Flint');
item('apple', 'Apple', { food: 4 });
item('porkchop', 'Raw Porkchop', { food: 3 });
item('cooked_porkchop', 'Cooked Porkchop', { food: 8 });
item('beef', 'Raw Beef', { food: 3 });
item('steak', 'Steak', { food: 8 });
item('chicken', 'Raw Chicken', { food: 2 });
item('cooked_chicken', 'Cooked Chicken', { food: 6 });
item('mutton', 'Raw Mutton', { food: 2 });
item('cooked_mutton', 'Cooked Mutton', { food: 6 });
item('rotten_flesh', 'Rotten Flesh', { food: 4 });
item('melon_slice', 'Melon Slice', { food: 2 });
item('bread', 'Bread', { food: 5 });
item('bone', 'Bone');
item('arrow', 'Arrow');
item('string', 'String');
item('gunpowder', 'Gunpowder');
item('feather', 'Feather');
item('leather', 'Leather');
item('flint_and_steel', 'Flint and Steel', { stack: 1, durability: 64 });
item('wheat', 'Wheat');
item('bow', 'Bow', { stack: 1, durability: 384, fuel: 0 });

for (const mat of ['wooden', 'stone', 'iron', 'golden', 'diamond']) {
  const nice = mat[0].toUpperCase() + mat.slice(1);
  const base = { wooden: 0, stone: 1, iron: 2, golden: 0, diamond: 3 }[mat];
  for (const [type, label, dmg] of [
    ['pickaxe', 'Pickaxe', 2 + base],
    ['axe', 'Axe', 3 + base * 1.5],
    ['shovel', 'Shovel', 1.5 + base],
    ['sword', 'Sword', 4 + base],
  ]) {
    item(`${mat}_${type}`, `${nice} ${label}`, {
      stack: 1,
      tool: { type, tier: TOOL_TIERS[mat], speed: TOOL_SPEED[mat], material: mat },
      durability: TOOL_DUR[mat],
      damage: Math.round(dmg),
      fuel: mat === 'wooden' ? 10 : 0,
    });
  }
}

// Fuel values for block items (seconds of burn).
ITEMS[B.oak_planks].fuel = 15;
ITEMS[B.birch_planks].fuel = 15;
ITEMS[B.spruce_planks].fuel = 15;
ITEMS[B.oak_log].fuel = 15;
ITEMS[B.birch_log].fuel = 15;
ITEMS[B.spruce_log].fuel = 15;
ITEMS[B.crafting_table].fuel = 15;
ITEMS[B.bookshelf].fuel = 15;
ITEMS[B.chest].fuel = 15;
// Things you can't hold as items.
ITEMS[B.air] = null;
ITEMS[B.furnace_lit] = null;

export const SMELTING = {
  iron_ore: 'iron_ingot',
  gold_ore: 'gold_ingot',
  sand: 'glass',
  cobblestone: 'stone',
  stone: 'stone_slab_block',
  clay: 'bricks',
  porkchop: 'cooked_porkchop',
  beef: 'steak',
  chicken: 'cooked_chicken',
  mutton: 'cooked_mutton',
  oak_log: 'coal',
  birch_log: 'coal',
  spruce_log: 'coal',
  cactus: 'green_wool',
  wheat: 'bread',
};

export function itemDef(id) {
  return ITEMS[id] || null;
}

export function maxStack(id) {
  const d = ITEMS[id];
  return d ? d.stack : 64;
}

// Seconds needed to break `blockId` holding item `toolId` (or null).
export function breakTime(blockId, toolId) {
  const b = BLOCKS[blockId];
  if (!b || b.hardness < 0) return Infinity;
  if (b.hardness === 0) return 0.05;
  const tool = toolId ? ITEMS[toolId] && ITEMS[toolId].tool : null;
  let speed = 1;
  const right = tool && b.tool === tool.type;
  if (right) speed = tool.speed;
  if (tool && tool.type === 'sword' && (b.name.includes('leaves') || b.name === 'cactus')) speed = 1.5;
  if (tool && tool.type === 'axe' && b.name.includes('leaves')) speed = tool.speed;
  const canHarvest = b.tier === 0 || (right && tool.tier >= b.tier);
  return (b.hardness * (canHarvest ? 1.5 : 5)) / speed;
}

export function canHarvest(blockId, toolId) {
  const b = BLOCKS[blockId];
  if (b.tier === 0) return true;
  const tool = toolId ? ITEMS[toolId] && ITEMS[toolId].tool : null;
  return !!(tool && tool.type === b.tool && tool.tier >= b.tier);
}

export function blockDrops(blockId, toolId, rand) {
  const b = BLOCKS[blockId];
  if (!canHarvest(blockId, toolId)) return [];
  if (b.drops === undefined) return [[blockId, 1]];
  if (typeof b.drops === 'string') return [[I[b.drops], 1]];
  return b.drops(rand).map(([n, c]) => [typeof n === 'string' ? I[n] : n, c]);
}

// Simple lookup tables for the hot paths.
export const SOLID = new Uint8Array(256);
export const OPAQUE = new Uint8Array(256);
export const LIGHT = new Uint8Array(256);
export const FILTER = new Uint8Array(256);
for (const b of BLOCKS) {
  if (!b) continue;
  SOLID[b.id] = b.solid ? 1 : 0;
  OPAQUE[b.id] = b.opaque ? 1 : 0;
  LIGHT[b.id] = b.light;
  FILTER[b.id] = b.opaque ? 15 : b.filter;
}
