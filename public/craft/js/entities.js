// Physics, mobs (models + AI), dropped items, arrows, primed TNT, particles.

import { B, BLOCKS, I, ITEMS, SOLID } from './blocks.js';
import { TILES, ATLAS_TILES, tileUV } from './textures.js';
import * as M from './math.js';

const TS = 1 / ATLAS_TILES;
export function uvRect(name, px0 = 0, py0 = 0, px1 = 16, py1 = 16) {
  const [u, v] = tileUV(name);
  return [u + (px0 / 16) * TS + 0.0005, v + (py0 / 16) * TS + 0.0005, u + (px1 / 16) * TS - 0.0005, v + (py1 / 16) * TS - 0.0005];
}

// ---------- physics ----------
function blocksAABB(world, x0, y0, z0, x1, y1, z1, fn) {
  for (let y = Math.floor(y0); y <= Math.floor(y1); y++)
    for (let z = Math.floor(z0); z <= Math.floor(z1); z++)
      for (let x = Math.floor(x0); x <= Math.floor(x1); x++) if (fn(x, y, z)) return true;
  return false;
}

export function isSolidAt(world, x, y, z) {
  if (!world.isLoaded(x, z)) return true;
  return SOLID[world.get(x, y, z)] === 1;
}

function collides(world, e, x, y, z) {
  const w = e.w;
  return blocksAABB(world, x - w, y, z - w, x + w - 1e-6, y + e.h - 1e-6, z + w - 1e-6, (bx, by, bz) => isSolidAt(world, bx, by, bz));
}

// Moves an entity by its velocity with per-axis collision. Sets onGround,
// hitWall, inWater, inLava. Optional sneak edge-guard.
export function moveEntity(world, e, dt, sneakGuard = false) {
  let dx = e.vx * dt, dy = e.vy * dt, dz = e.vz * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.3));
  dx /= steps; dy /= steps; dz /= steps;
  e.onGround = false;
  e.hitWall = false;
  const wasGround = e._ground;
  for (let s = 0; s < steps; s++) {
    // Y
    if (dy) {
      if (!collides(world, e, e.x, e.y + dy, e.z)) e.y += dy;
      else {
        if (dy < 0) {
          e.y = Math.floor(e.y + dy) + 1;
          if (collides(world, e, e.x, e.y, e.z)) e.y = Math.ceil(e.y - 1e-3);
          e.onGround = true;
        } else {
          e.y = Math.ceil(e.y + e.h + dy) - 1 - e.h;
          if (collides(world, e, e.x, e.y, e.z)) e.y -= 0.001;
        }
        e.vy = 0;
        dy = 0;
      }
    }
    // X
    if (dx) {
      const nx = e.x + dx;
      if (collides(world, e, nx, e.y, e.z)) { e.hitWall = true; e.vx = 0; dx = 0; }
      else if (sneakGuard && wasGround && !collides(world, e, nx, e.y - 0.6, e.z)) { e.vx = 0; dx = 0; }
      else e.x = nx;
    }
    // Z
    if (dz) {
      const nz = e.z + dz;
      if (collides(world, e, e.x, e.y, nz)) { e.hitWall = true; e.vz = 0; dz = 0; }
      else if (sneakGuard && wasGround && !collides(world, e, e.x, e.y - 0.6, nz)) { e.vz = 0; dz = 0; }
      else e.z = nz;
    }
  }
  if (!e.onGround && e.vy <= 0 && collides(world, e, e.x, e.y - 0.01, e.z)) e.onGround = true;
  e._ground = e.onGround;
  const feet = world.get(Math.floor(e.x), Math.floor(e.y + 0.1), Math.floor(e.z));
  const body = world.get(Math.floor(e.x), Math.floor(e.y + e.h * 0.5), Math.floor(e.z));
  e.inWater = feet === B.water || body === B.water;
  e.inLava = feet === B.lava || body === B.lava;
  e.headInWater = world.get(Math.floor(e.x), Math.floor(e.y + e.h * 0.9), Math.floor(e.z)) === B.water;
}

export function touchingBlock(world, e, id) {
  const w = e.w + 0.02;
  return blocksAABB(world, e.x - w, e.y - 0.01, e.z - w, e.x + w, e.y + e.h, e.z + w, (x, y, z) => world.get(x, y, z) === id);
}

// ---------- mob models ----------
// Units are model pixels (1/16 block). Front faces +z.
function P(pivot, boxes, tiles, extra = {}) {
  return { pivot, boxes: Array.isArray(boxes[0]) ? boxes : [boxes], tiles, ...extra };
}
function faces(all, over = {}) {
  // order +x,-x,+y,-y,+z,-z
  const r = [all, all, all, all, all, all];
  if (over.front) r[4] = over.front;
  if (over.top) r[2] = over.top;
  if (over.bottom) r[3] = over.bottom;
  if (over.back) r[5] = over.back;
  return r;
}

const humanoid = (head, body, arm, leg, thin) => {
  const a = thin ? 1 : 2;
  return [
    P([0, 24, 0], [-4, 0, -4, 4, 8, 4], head, { name: 'head' }),
    P([0, 12, 0], [-4, 0, -2, 4, 12, 2], faces(body), { name: 'body' }),
    P([-5 - a + 1, 22, 0], [-a, -10, -a, a, 2, a], faces(arm), { name: 'armL', swing: 'arm', side: 1 }),
    P([5 + a - 1, 22, 0], [-a, -10, -a, a, 2, a], faces(arm), { name: 'armR', swing: 'arm', side: -1 }),
    P([-2, 12, 0], [-a, -12, -a, a, 0, a], faces(leg), { name: 'legL', swing: 1 }),
    P([2, 12, 0], [-a, -12, -a, a, 0, a], faces(leg), { name: 'legR', swing: -1 }),
  ];
};

export const MOBS = {
  pig: {
    name: 'Pig', w: 0.45, h: 0.9, health: 10, speed: 1.2, passive: true,
    drops: (r, burned) => [[burned ? 'cooked_porkchop' : 'porkchop', 1 + Math.floor(r() * 3)]],
    parts: [
      P([0, 6, 0], [-5, 0, -8, 5, 8, 8], faces('pig_skin')),
      P([0, 11, 7], [-4, -4, 0, 4, 4, 8], faces('pig_skin', { front: 'pig_face' }), { name: 'head' }),
      P([-3, 6, 5], [-2, -6, -2, 2, 0, 2], faces('pig_skin'), { swing: 1 }),
      P([3, 6, 5], [-2, -6, -2, 2, 0, 2], faces('pig_skin'), { swing: -1 }),
      P([-3, 6, -5], [-2, -6, -2, 2, 0, 2], faces('pig_skin'), { swing: -1 }),
      P([3, 6, -5], [-2, -6, -2, 2, 0, 2], faces('pig_skin'), { swing: 1 }),
    ],
  },
  cow: {
    name: 'Cow', w: 0.45, h: 1.4, health: 10, speed: 1.0, passive: true,
    drops: (r, burned) => [[burned ? 'steak' : 'beef', 1 + Math.floor(r() * 3)], ['leather', Math.floor(r() * 3)]],
    parts: [
      P([0, 12, 0], [-6, 0, -9, 6, 10, 9], faces('cow_skin')),
      P([0, 19, 9], [[-4, -4, 0, 4, 4, 6], [-6, 2, 1, -4, 5, 3], [4, 2, 1, 6, 5, 3]], faces('cow_skin', { front: 'cow_face' }), { name: 'head' }),
      P([-4, 12, 6], [-2, -12, -2, 2, 0, 2], faces('cow_skin'), { swing: 1 }),
      P([4, 12, 6], [-2, -12, -2, 2, 0, 2], faces('cow_skin'), { swing: -1 }),
      P([-4, 12, -7], [-2, -12, -2, 2, 0, 2], faces('cow_skin'), { swing: -1 }),
      P([4, 12, -7], [-2, -12, -2, 2, 0, 2], faces('cow_skin'), { swing: 1 }),
    ],
  },
  sheep: {
    name: 'Sheep', w: 0.45, h: 1.3, health: 8, speed: 1.1, passive: true,
    drops: (r, burned) => [['white_wool', 1], [burned ? 'cooked_mutton' : 'mutton', 1 + Math.floor(r() * 2)]],
    parts: [
      P([0, 11, 0], [-6, 0, -9, 6, 10, 9], faces('sheep_wool')),
      P([0, 17, 8], [-3, -3, 0, 3, 4, 7], faces('sheep_wool', { front: 'sheep_face' }), { name: 'head' }),
      ...[[-3, 6, 1], [3, 6, -1], [-3, -6, -1], [3, -6, 1]].map(([x, z, s]) =>
        P([x, 12, z], [[-2.5, -6, -2.5, 2.5, 0, 2.5], [-2, -12, -2, 2, -6, 2]], faces('sheep_wool'), { swing: s, lowTiles: faces('sheep_skin') })),
    ],
  },
  chicken: {
    name: 'Chicken', w: 0.25, h: 0.7, health: 4, speed: 1.0, passive: true, flutter: true,
    drops: (r, burned) => [[burned ? 'cooked_chicken' : 'chicken', 1], ['feather', Math.floor(r() * 3)]],
    parts: [
      P([0, 5, 0], [-3, 0, -4, 3, 6, 4], faces('chicken_white')),
      P([0, 9, 3], [[-2, 0, 0, 2, 6, 3]], faces('chicken_white', { front: 'chicken_head' }), { name: 'head' }),
      P([0, 9, 3], [[-2, 2.5, 3, 2, 4.5, 5]], faces('chicken_beak'), { name: 'beak', follow: 'head' }),
      P([0, 9, 3], [[-1, 0.5, 3, 1, 2.5, 4]], faces('chicken_wattle'), { name: 'wattle', follow: 'head' }),
      P([-3, 10, 0], [-1, -4, -3, 0, 0, 3], faces('chicken_white'), { wing: 1 }),
      P([3, 10, 0], [0, -4, -3, 1, 0, 3], faces('chicken_white'), { wing: -1 }),
      P([-1.5, 5, 0], [[-0.5, -5, -0.5, 0.5, 0, 0.5], [-1.5, -5, -1, 1.5, -4.5, 1.5]], faces('chicken_leg'), { swing: 1 }),
      P([1.5, 5, 0], [[-0.5, -5, -0.5, 0.5, 0, 0.5], [-1.5, -5, -1, 1.5, -4.5, 1.5]], faces('chicken_leg'), { swing: -1 }),
    ],
  },
  zombie: {
    name: 'Zombie', w: 0.3, h: 1.95, health: 20, speed: 2.3, hostile: true, burns: true, damage: 3,
    drops: (r) => [['rotten_flesh', Math.floor(r() * 3)], ...(r() < 0.03 ? [['iron_ingot', 1]] : [])],
    parts: humanoid(faces('zombie_skin', { front: 'zombie_face', top: 'zombie_hair' }), 'zombie_shirt', 'zombie_skin', 'zombie_pants'),
    armsForward: true,
  },
  skeleton: {
    name: 'Skeleton', w: 0.3, h: 1.99, health: 20, speed: 2.4, hostile: true, burns: true, ranged: true,
    drops: (r) => [['bone', Math.floor(r() * 3)], ['arrow', Math.floor(r() * 3)]],
    parts: humanoid(faces('skeleton_bone', { front: 'skeleton_face' }), 'skeleton_bone', 'skeleton_bone', 'skeleton_bone', true),
    armsForward: true,
  },
  creeper: {
    name: 'Creeper', w: 0.3, h: 1.7, health: 20, speed: 2.0, hostile: true, explodes: true,
    drops: (r) => [['gunpowder', Math.floor(r() * 3)]],
    parts: [
      P([0, 18, 0], [-4, 0, -4, 4, 8, 4], faces('creeper_skin', { front: 'creeper_face' }), { name: 'head' }),
      P([0, 6, 0], [-4, 0, -2, 4, 12, 2], faces('creeper_skin')),
      P([-2, 6, 4], [-2, -6, -2, 2, 0, 2], faces('creeper_skin'), { swing: 1 }),
      P([2, 6, 4], [-2, -6, -2, 2, 0, 2], faces('creeper_skin'), { swing: -1 }),
      P([-2, 6, -4], [-2, -6, -2, 2, 0, 2], faces('creeper_skin'), { swing: -1 }),
      P([2, 6, -4], [-2, -6, -2, 2, 0, 2], faces('creeper_skin'), { swing: 1 }),
    ],
  },
  spider: {
    name: 'Spider', w: 0.7, h: 0.9, health: 16, speed: 3.0, hostile: true, climbs: true, damage: 2,
    drops: (r) => [['string', Math.floor(r() * 3)]],
    parts: [
      P([0, 9, 0], [-3, -3, -3, 3, 3, 3], faces('spider_body')),
      P([0, 9, 3], [-4, -4, 0, 4, 4, 8], faces('spider_body', { front: 'spider_face' }), { name: 'head' }),
      P([0, 9, -3], [-5, -4, -12, 5, 4, 0], faces('spider_body')),
      ...[2, 1, 0, -1].flatMap((z, i) => [
        P([3, 9, z], [0, -1, -1, 15, 1, 1], faces('spider_body'), { leg: 1, legIdx: i }),
        P([-3, 9, z], [-15, -1, -1, 0, 1, 1], faces('spider_body'), { leg: -1, legIdx: i }),
      ]),
    ],
  },
};

// Resolve tile names to uv rects once.
for (const def of Object.values(MOBS)) {
  for (const p of def.parts) {
    p.uv = p.tiles.map((t) => uvRect(t));
    if (p.lowTiles) p.lowUv = p.lowTiles.map((t) => uvRect(t));
  }
}

let nextId = 1;
export class Mob {
  constructor(type, x, y, z) {
    const d = MOBS[type];
    this.id = nextId++;
    this.type = type;
    this.def = d;
    this.x = x; this.y = y; this.z = z;
    this.vx = this.vy = this.vz = 0;
    this.w = d.w; this.h = d.h;
    this.yaw = Math.random() * Math.PI * 2;
    this.headYaw = 0; this.headPitch = 0;
    this.health = d.health;
    this.hurtTime = 0;
    this.deathTime = 0;
    this.dead = false;
    this.walk = 0; this.walkAmt = 0;
    this.wanderT = 0; this.mx = 0; this.mz = 0;
    this.panic = 0;
    this.fuse = 0;
    this.cool = 0;
    this.burnT = 0;
    this.fire = 0;
    this.aggro = 0;
    this.age = 0;
    this.lastHitBy = null;
  }
}

export class ItemEntity {
  constructor(id, count, x, y, z, extra) {
    this.id = id; this.count = count;
    this.extra = extra || null; // e.g. tool durability
    this.x = x; this.y = y; this.z = z;
    this.vx = (Math.random() - 0.5) * 3; this.vy = 4; this.vz = (Math.random() - 0.5) * 3;
    this.w = 0.125; this.h = 0.25;
    this.age = 0; this.pickup = 0.5;
    this.spin = Math.random() * 6;
  }
}

export class Arrow {
  constructor(x, y, z, vx, vy, vz, owner) {
    this.x = x; this.y = y; this.z = z; this.vx = vx; this.vy = vy; this.vz = vz;
    this.owner = owner; this.stuck = false; this.age = 0;
  }
}

export class PrimedTNT {
  constructor(x, y, z, fuse = 4) {
    this.x = x; this.y = y; this.z = z; this.vx = (Math.random() - 0.5); this.vy = 3; this.vz = (Math.random() - 0.5);
    this.w = 0.49; this.h = 0.98; this.fuse = fuse;
  }
}

// ---------- drawing helpers ----------
const tmpM = M.mat4();
const partM = M.mat4();

export function drawMob(batch, mob, light, t) {
  const d = mob.def;
  const base = M.identity(tmpM);
  M.translate(base, mob.x, mob.y, mob.z);
  M.rotateY(base, mob.yaw);
  if (mob.dead) M.rotateZ(base, Math.min(1, mob.deathTime * 2.5) * Math.PI / 2);
  let sc = 1 / 16;
  if (d.explodes && mob.fuse > 0) sc *= 1 + Math.min(1, mob.fuse / 1.5) * 0.15 + Math.sin(mob.fuse * 30) * 0.01;
  M.scale(base, sc, sc, sc);
  let shade = 1;
  if (mob.hurtTime > 0 || mob.dead) shade = -1;
  else if (d.explodes && mob.fuse > 0 && Math.floor(mob.fuse * 8) % 2 === 0) shade = 11;
  const swing = Math.sin(mob.walk) * 0.9 * mob.walkAmt;
  const [sky, blk] = light;
  for (const p of d.parts) {
    const m = M.copy(partM, base);
    M.translate(m, p.pivot[0], p.pivot[1], p.pivot[2]);
    if (p.name === 'head' || p.follow === 'head') {
      M.rotateY(m, mob.headYaw);
      M.rotateX(m, -mob.headPitch);
    }
    if (p.swing === 'arm') {
      if (d.armsForward) M.rotateX(m, -Math.PI / 2 + Math.sin(t * 2 + p.side) * 0.05 + (mob.cool > 0.6 ? -0.4 : 0));
      else M.rotateX(m, swing * p.side);
    } else if (p.swing) M.rotateX(m, swing * p.swing);
    if (p.wing) M.rotateZ(m, p.wing * (mob.onGround ? 0 : 0.5 + Math.sin(t * 30) * 0.5));
    if (p.leg) {
      const ph = mob.walk + p.legIdx * Math.PI / 2;
      M.rotateY(m, (p.leg > 0 ? 1 : -1) * ((p.legIdx - 1.5) * -0.35 + Math.sin(ph) * 0.35 * mob.walkAmt));
      M.rotateZ(m, p.leg * (-0.6 + Math.abs(Math.cos(ph)) * 0.25 * mob.walkAmt));
    }
    p.boxes.forEach((b, i) => {
      const uv = i > 0 && p.lowUv ? p.lowUv : p.uv;
      batch.box(m, b[0], b[1], b[2], b[3], b[4], b[5], uv, sky, blk, shade);
    });
  }
  if (mob.fire > 0) drawFlames(batch, mob, t);
}

function drawFlames(batch, e, t) {
  const uv = uvRect('flame');
  const s = e.w + 0.1, h = e.h;
  const y0 = e.y, y1 = e.y + h;
  const f = Math.floor(t * 10) % 2 ? 0 : 0.05;
  batch.quad([e.x - s, y0, e.z - s - f, e.x + s, y0, e.z - s - f, e.x + s, y1, e.z - s - f, e.x - s, y1, e.z - s - f], uv, 1, 1, 1);
  batch.quad([e.x - s - f, y0, e.z + s, e.x - s - f, y0, e.z - s, e.x - s - f, y1, e.z - s, e.x - s - f, y1, e.z + s], uv, 1, 1, 1);
  batch.quad([e.x + s, y0, e.z + s + f, e.x - s, y0, e.z + s + f, e.x - s, y1, e.z + s + f, e.x + s, y1, e.z + s + f], uv, 1, 1, 1);
  batch.quad([e.x + s + f, y0, e.z - s, e.x + s + f, y0, e.z + s, e.x + s + f, y1, e.z + s, e.x + s + f, y1, e.z - s], uv, 1, 1, 1);
}

export function blockFaceUVs(id) {
  const b = BLOCKS[id];
  const s = uvRect(b.tiles.side), t = uvRect(b.tiles.top), bo = uvRect(b.tiles.bottom), f = uvRect(b.tiles.front);
  return [s, s, t, bo, f, s];
}

const flatCache = new Map();
export function itemUV(id) {
  let r = flatCache.get(id);
  if (!r) {
    const it = ITEMS[id];
    const name = it.block ? BLOCKS[it.block].tiles.side : it.tile;
    r = uvRect(name);
    flatCache.set(id, r);
  }
  return r;
}

export function isCubeItem(id) {
  const it = ITEMS[id];
  return !!(it && it.block && BLOCKS[it.block].shape === 'cube');
}

// Dropped items: spinning mini-blocks or flat sprites.
export function drawItem(batch, e, light, t) {
  const m = M.identity(tmpM);
  const bob = Math.sin(e.age * 2.5 + e.spin) * 0.06 + 0.1;
  M.translate(m, e.x, e.y + bob, e.z);
  M.rotateY(m, e.age * 1.6 + e.spin);
  const n = e.count > 16 ? 3 : e.count > 1 ? 2 : 1;
  for (let k = 0; k < n; k++) {
    const mm = M.copy(partM, m);
    M.translate(mm, k * 0.06, k * 0.06, k * 0.05);
    if (isCubeItem(e.id)) {
      batch.box(mm, -0.125, 0, -0.125, 0.125, 0.25, 0.125, blockFaceUVs(e.id), light[0], light[1], 1);
    } else {
      const uv = itemUV(e.id);
      batch.box(mm, -0.2, 0, -0.01, 0.2, 0.4, 0.01, [uv, uv, uv, uv, uv, [uv[2], uv[1], uv[0], uv[3]]], light[0], light[1], 1);
    }
  }
}

export function drawArrow(batch, a, light) {
  const m = M.identity(tmpM);
  M.translate(m, a.x, a.y, a.z);
  const yaw = Math.atan2(a.vx, a.vz);
  const pitch = Math.atan2(a.vy, Math.hypot(a.vx, a.vz));
  M.rotateY(m, a.stuck ? a.yaw : yaw);
  M.rotateX(m, -(a.stuck ? a.pitch : pitch));
  if (!a.stuck) { a.yaw = yaw; a.pitch = pitch; }
  const shaft = uvRect('oak_planks', 0, 0, 16, 2);
  const tip = uvRect('iron_block');
  const fl = uvRect('white');
  batch.box(m, -0.03, -0.03, -0.45, 0.03, 0.03, 0.05, [shaft, shaft, shaft, shaft, shaft, shaft], light[0], light[1], 1);
  batch.box(m, -0.04, -0.04, 0.05, 0.04, 0.04, 0.12, [tip, tip, tip, tip, tip, tip], light[0], light[1], 1);
  batch.box(m, -0.07, -0.01, -0.45, 0.07, 0.01, -0.3, [fl, fl, fl, fl, fl, fl], light[0], light[1], 1);
}

export function drawTNT(batch, e, light) {
  const m = M.identity(tmpM);
  const s = 1 + Math.max(0, 0.4 - e.fuse) * 0.4;
  M.translate(m, e.x, e.y, e.z);
  M.scale(m, s, s, s);
  const shade = Math.floor(e.fuse * 4) % 2 ? 11 : 1;
  batch.box(m, -0.5, 0, -0.5, 0.5, 1, 0.5, blockFaceUVs(B.tnt), light[0], light[1], shade);
}

// ---------- particles ----------
export class Particles {
  constructor() { this.list = []; }
  blockBreak(id, x, y, z, n = 24) {
    const b = BLOCKS[id];
    if (!b) return;
    const tile = b.tiles.side;
    for (let i = 0; i < n; i++) {
      const px = (Math.random() * 12) | 0, py = (Math.random() * 12) | 0;
      this.list.push({
        x: x + Math.random(), y: y + Math.random(), z: z + Math.random(),
        vx: (Math.random() - 0.5) * 4, vy: Math.random() * 4, vz: (Math.random() - 0.5) * 4,
        life: 0.5 + Math.random() * 0.6, size: 0.06 + Math.random() * 0.05, g: 14,
        uv: uvRect(tile, px, py, px + 4, py + 4),
      });
    }
  }
  hit(id, x, y, z, nx, ny, nz) {
    const b = BLOCKS[id];
    if (!b) return;
    for (let i = 0; i < 2; i++) {
      const px = (Math.random() * 12) | 0, py = (Math.random() * 12) | 0;
      this.list.push({
        x: x + 0.5 + nx * 0.52 + (ny || nz ? Math.random() - 0.5 : 0) , y: y + 0.5 + ny * 0.52 + (nx || nz ? Math.random() - 0.5 : 0), z: z + 0.5 + nz * 0.52 + (nx || ny ? Math.random() - 0.5 : 0),
        vx: nx * 1.5 + (Math.random() - 0.5), vy: ny * 1.5 + Math.random(), vz: nz * 1.5 + (Math.random() - 0.5),
        life: 0.4, size: 0.05, g: 14, uv: uvRect(b.tiles.side, px, py, px + 3, py + 3),
      });
    }
  }
  smoke(x, y, z, n, spread = 1, big = 1) {
    for (let i = 0; i < n; i++) {
      this.list.push({
        x: x + (Math.random() - 0.5) * spread * 2, y: y + (Math.random() - 0.5) * spread * 2, z: z + (Math.random() - 0.5) * spread * 2,
        vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 2,
        life: 0.6 + Math.random() * 0.8, size: (0.2 + Math.random() * 0.4) * big, g: -1, grow: 1, uv: uvRect('smoke'),
      });
    }
  }
  burst(x, y, z, tile, n) {
    for (let i = 0; i < n; i++) {
      this.list.push({
        x, y, z, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 3,
        life: 0.4 + Math.random() * 0.4, size: 0.08, g: 6, uv: uvRect(tile, 4, 4, 12, 12),
      });
    }
  }
  update(world, dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { L[i] = L[L.length - 1]; L.pop(); continue; }
      p.vy -= p.g * dt;
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
      if (p.g > 0 && SOLID[world.get(Math.floor(nx), Math.floor(ny), Math.floor(nz))]) {
        p.vx *= 0.3; p.vz *= 0.3; p.vy = 0;
      } else { p.x = nx; p.y = ny; p.z = nz; }
      if (p.grow) p.size += dt * 0.3;
    }
    if (L.length > 1500) L.splice(0, L.length - 1500);
  }
  draw(batch, world, rx, ry, rz, ux, uy, uz) {
    for (const p of this.list) {
      const s = p.size;
      const ax = rx * s, ay = ry * s, az = rz * s, bx = ux * s, by = uy * s, bz = uz * s;
      const fx = Math.floor(p.x), fy = Math.floor(p.y), fz = Math.floor(p.z);
      const sky = world.sky(fx, fy, fz) / 15, blk = world.blockLight(fx, fy, fz) / 15;
      batch.quad([
        p.x - ax - bx, p.y - ay - by, p.z - az - bz,
        p.x + ax - bx, p.y + ay - by, p.z + az - bz,
        p.x + ax + bx, p.y + ay + by, p.z + az + bz,
        p.x - ax + bx, p.y - ay + by, p.z - az + bz,
      ], p.uv, sky, blk, 1);
    }
  }
}

export { I };
