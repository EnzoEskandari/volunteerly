// Blockcraft — main game: loop, player, interaction, mobs AI, survival,
// day/night, chunk streaming, saving.

import { B, BLOCKS, I, ITEMS, SOLID, OPAQUE, SMELTING, breakTime, blockDrops, maxStack } from './blocks.js';
import { getAtlasCanvas, makeCloudCanvas, tileDataURL } from './textures.js';
import { World, CS, CH, SEA, ckey } from './world.js';
import { buildChunkMesh } from './mesher.js';
import { Renderer, Batch } from './renderer.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { addToSlots } from './crafting.js';
import * as store from './storage.js';
import { initAudio, sfx, setVolume } from './audio.js';
import * as M from './math.js';
import {
  MOBS, Mob, ItemEntity, Arrow, PrimedTNT, Particles, moveEntity, touchingBlock,
  drawMob, drawItem, drawArrow, drawTNT, uvRect, blockFaceUVs, isCubeItem, itemUV,
} from './entities.js';

const $ = (id) => document.getElementById(id);
const DAY = 1200; // seconds per day, like Minecraft (20 min)
const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;

const DEFAULTS = {
  renderDistance: isTouch ? 5 : 7,
  fov: 70,
  sensitivity: 1,
  gamma: 0.6,
  resolution: isTouch ? 0.8 : 1,
  volume: 0.6,
  difficulty: 'normal',
  clouds: true,
  bobbing: true,
  showFps: false,
  autoJump: 'touch',
};

function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let tmin = 0, tmax = Infinity;
  for (const [o, d, a, b] of [[ox, dx, x0, x1], [oy, dy, y0, y1], [oz, dz, z0, z1]]) {
    if (Math.abs(d) < 1e-9) { if (o < a || o > b) return Infinity; continue; }
    let t1 = (a - o) / d, t2 = (b - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

class Player {
  constructor() {
    this.x = 0; this.y = 80; this.z = 0;
    this.vx = this.vy = this.vz = 0;
    this.w = 0.3; this.h = 1.8;
    this.yaw = 0; this.pitch = 0;
    this.health = 20; this.food = 20; this.sat = 5; this.exh = 0; this.air = 15;
    this.inv = new Array(36).fill(null);
    this.sel = 0;
    this.flying = false;
    this.fallStart = null;
    this.hurtCd = 0; this.regenT = 0; this.starveT = 0; this.fire = 0; this.fireT = 0; this.lavaT = 0; this.cactusT = 0; this.drownT = 0;
    this.dead = false;
    this.spawn = null;
    this.walkDist = 0; this.stepDist = 0; this.bob = 0; this.bobAmt = 0;
    this.swing = 0;
    this.breakT = null; this.breakP = 0; this.breakSound = 0;
    this.attackCd = 0; this.useCd = 0; this.placeCd = 0;
    this.bowCharge = 0;
    this.fovMul = 1;
    this.invDirty = true;
  }
  get held() { return this.inv[this.sel]; }
  serialize() {
    return {
      x: this.x, y: this.y, z: this.z, yaw: this.yaw, pitch: this.pitch,
      health: this.health, food: this.food, sat: this.sat, air: this.air,
      inv: this.inv, sel: this.sel, flying: this.flying, spawn: this.spawn,
    };
  }
}

class Game {
  constructor() {
    this.canvas = $('gl');
    this.settings = store.loadSettings(DEFAULTS);
    this.renderer = new Renderer(this.canvas);
    this.renderer.setAtlas(getAtlasCanvas());
    this.renderer.setClouds(makeCloudCanvas());
    this.input = new Input(this.canvas, $('touch'));
    this.input.onPause = () => this.pause();
    this.input.onModeChange = () => this.updateTouchUI();
    this.player = new Player();
    this.ui = new UI(this);
    this.skyBatch = new Batch();
    this.entityBatch = new Batch();
    this.decalBatch = new Batch();
    this.handBatch = new Batch();
    this.cloudBatch = new Batch();
    this.particles = new Particles();
    this.mobs = []; this.items = []; this.arrows = []; this.tnts = [];
    this.state = 'title';
    this.time = 0;
    this.last = performance.now();
    this.fps = 60; this.fpsAcc = 0; this.fpsN = 0;
    this.spiral = null; this.spiralR = -1;
    this.unloadT = 0; this.spawnT = 0; this.saveT = 0;
    this.debug = false;
    this.stars = this.makeStars();
    document.documentElement.style.setProperty('--dirt', `url(${tileDataURL('dirt', 4)})`);
    document.documentElement.style.setProperty('--stone', `url(${tileDataURL('stone', 4)})`);
    this.applySettings();
    this.startTitleWorld();
    this.ui.show('menu-title');
    this.updateTouchUI();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.save(); if (this.state === 'playing') this.pause(); }
    });
    window.addEventListener('pagehide', () => this.save());
    const unlock = () => initAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
    requestAnimationFrame((t) => this.loop(t));
  }

  makeStars() {
    const s = [];
    let seed = 7;
    const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 260; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, q = Math.sqrt(1 - u * u);
      s.push([q * Math.cos(th), u, q * Math.sin(th), 0.15 + r() * 0.25]);
    }
    return s;
  }

  applySettings() {
    const s = this.settings;
    this.input.sensitivity = s.sensitivity;
    setVolume(s.volume);
    $('debug').style.display = s.showFps || this.debug ? 'block' : 'none';
  }

  updateTouchUI() {
    const touch = this.input.mode === 'touch';
    document.body.classList.toggle('touch', touch);
    document.body.classList.toggle('creative', !!this.creative);
  }

  // ---------- world lifecycle ----------
  clearWorld() {
    for (const k of [...this.renderer.chunkMeshes.keys()]) this.renderer.deleteChunk(k);
    this.world = null;
    this.mobs = []; this.items = []; this.arrows = []; this.tnts = [];
    this.particles.list.length = 0;
  }

  startTitleWorld() {
    this.clearWorld();
    this.world = new World(1234);
    const s = this.world.findSpawn();
    this.titleCam = { x: s.x, y: Math.max(s.y + 12, SEA + 18), z: s.z, yaw: 0, pitch: -0.12 };
    this.time = DAY * 0.08;
    this.creative = false;
  }

  startWorld(meta) {
    this.ui.show('menu-loading');
    setTimeout(() => this._startWorld(meta), 30);
  }

  _startWorld(meta) {
    this.clearWorld();
    const data = store.loadWorldData(meta.id);
    this.meta = meta;
    const world = new World(meta.seed, data || {});
    this.world = world;
    world.onDrop = (x, y, z, id, count, extra) => this.spawnItem(id, count, x + 0.5, y + 0.3, z + 0.5, extra);
    this.creative = (data && data.mode ? data.mode : meta.mode) === 'creative';
    const p = new Player();
    this.player = p;
    this.time = data && data.time !== undefined ? data.time : DAY * 0.02;
    if (data && data.player) {
      Object.assign(p, data.player);
      p.inv = (data.player.inv || []).slice(0, 36);
      while (p.inv.length < 36) p.inv.push(null);
    } else {
      const s = world.findSpawn();
      p.x = s.x; p.y = s.y; p.z = s.z;
      p.spawn = { x: s.x, y: s.y, z: s.z };
      if (this.creative) this.fillCreativeHotbar();
    }
    // Generate the area around the player before dropping them in.
    const pcx = Math.floor(p.x) >> 4, pcz = Math.floor(p.z) >> 4;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) world.generate(pcx + dx, pcz + dz);
    if (!data || !data.player) {
      const sy = world.surfaceY(Math.floor(p.x), Math.floor(p.z));
      p.y = sy + 1;
      p.spawn.y = p.y;
    }
    // Make sure we never spawn inside blocks.
    while (p.y < CH - 2 && this.collidesPlayer(p)) p.y += 1;
    this.state = 'playing';
    this.ui.show(null);
    $('hud').classList.remove('hidden');
    this.input.active = true;
    this.updateTouchUI();
    this.ui.updateHotbar();
    this.ui.lastBars = '';
    this.ui.updateBars();
    store.touchWorld(meta.id);
    if (this.input.mode === 'desktop') this.input.requestLock();
    this.ui.toast(this.input.mode === 'touch' ? 'Drag right side to look · tap to place · hold to mine' : 'Click to play · WASD move · E inventory · Esc pause');
  }

  collidesPlayer(p) {
    for (let y = Math.floor(p.y); y <= Math.floor(p.y + p.h); y++)
      for (let x = Math.floor(p.x - p.w); x <= Math.floor(p.x + p.w); x++)
        for (let z = Math.floor(p.z - p.w); z <= Math.floor(p.z + p.w); z++) if (SOLID[this.world.get(x, y, z)]) return true;
    return false;
  }

  fillCreativeHotbar() {
    const ids = ['grass', 'stone', 'oak_planks', 'oak_log', 'glass', 'bricks', 'torch', 'tnt', 'diamond_pickaxe'];
    ids.forEach((n, i) => {
      const it = ITEMS[I[n]];
      this.player.inv[i] = it.durability ? { id: it.id, count: 1, dur: it.durability } : { id: it.id, count: maxStack(it.id) };
    });
  }

  save() {
    if (!this.world || !this.meta || this.state === 'title') return;
    const data = {
      ...this.world.serialize(),
      player: this.player.serialize(),
      time: this.time,
      mode: this.creative ? 'creative' : 'survival',
    };
    if (!store.saveWorldData(this.meta.id, data)) this.ui.toast('Could not save — browser storage is full');
    store.touchWorld(this.meta.id, { mode: data.mode });
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.active = false;
    this.input.releaseAll();
    this.input.exitLock();
    this.save();
    $('btn-gamemode').textContent = 'Game Mode: ' + (this.creative ? 'Creative' : 'Survival');
    this.ui.show('menu-pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.show(null);
    this.input.active = true;
    this.last = performance.now();
    if (this.input.mode === 'desktop') this.input.requestLock();
  }

  quitToTitle() {
    this.save();
    this.state = 'title';
    this.input.active = false;
    this.input.exitLock();
    this.ui.close();
    $('hud').classList.add('hidden');
    this.meta = null;
    this.startTitleWorld();
    this.ui.show('menu-title');
  }

  toggleGameMode() {
    this.creative = !this.creative;
    if (!this.creative) this.player.flying = false;
    $('btn-gamemode').textContent = 'Game Mode: ' + (this.creative ? 'Creative' : 'Survival');
    this.updateTouchUI();
    this.ui.lastBars = '';
    this.ui.updateBars();
  }

  // ---------- inventory ----------
  openPlayerInventory() {
    if (this.state !== 'playing') return;
    this.openUI(this.creative ? 'creative' : 'player');
  }
  openUI(kind, te) {
    this.state = 'inventory';
    this.input.active = false;
    this.input.releaseAll();
    this.input.exitLock();
    this.ui.open(kind, te);
  }
  closeInventory() {
    if (this.state !== 'inventory') return;
    this.ui.close();
    this.state = 'playing';
    this.input.active = true;
    if (this.input.mode === 'desktop') this.input.requestLock();
  }
  giveOrDrop(s) {
    const left = addToSlots(this.player.inv, s);
    if (left) this.dropFromPlayer({ ...s, count: left });
    this.player.invDirty = true;
  }
  dropFromPlayer(s) {
    const p = this.player;
    const it = new ItemEntity(s.id, s.count, p.x, p.y + 1.4, p.z, s.dur !== undefined ? { dur: s.dur } : null);
    const fx = -Math.sin(p.yaw) * Math.cos(p.pitch), fy = Math.sin(p.pitch), fz = -Math.cos(p.yaw) * Math.cos(p.pitch);
    it.vx = fx * 5; it.vy = fy * 5 + 2; it.vz = fz * 5;
    it.pickup = 1.5;
    this.items.push(it);
  }
  selectSlot(i) {
    const p = this.player;
    if (!(i >= 0 && i < 9) || p.sel === i) return;
    p.sel = i;
    p.breakT = null; p.breakP = 0; p.bowCharge = 0;
    this.ui.updateHotbar();
    this.ui.showHeldName(p.held ? p.held.id : 0);
  }
  furnaceTaken() { sfx.pop(); }

  spawnItem(id, count, x, y, z, extra) {
    if (!id || !count || !ITEMS[id]) return;
    const e = new ItemEntity(id, count, x, y, z, extra);
    e.vx *= 0.6; e.vz *= 0.6; e.vy = 3;
    this.items.push(e);
  }

  // ---------- main loop ----------
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) return;
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
    this.input.poll();
    try {
      if (this.state === 'title') {
        this.time += dt * 2;
        this.titleCam.yaw += dt * 0.04;
        this.stream(this.titleCam.x, this.titleCam.z, Math.min(this.settings.renderDistance, 6), 4);
        this.renderFrame(this.titleCam, dt);
      } else if (this.world) {
        if (this.state === 'playing') this.handleInput(dt);
        if (this.state === 'inventory' && (this.input.pressed('KeyE') || this.input.pressed('Escape'))) this.closeInventory();
        else if (this.state === 'paused' && this.input.pressed('Escape')) this.resume();
        if (this.state !== 'paused') this.update(dt);
        this.stream(this.player.x, this.player.z, this.settings.renderDistance, isTouch ? 5 : 7);
        this.renderFrame(this.cameraFor(dt), dt);
        if (this.state === 'inventory') this.ui.tick();
        this.updateHUD();
      }
    } catch (err) {
      console.error(err);
    }
    this.input.endFrame();
  }

  // ---------- chunk streaming ----------
  buildSpiral(R) {
    const out = [];
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) out.push([dx, dz, dx * dx + dz * dz]);
    out.sort((a, b) => a[2] - b[2]);
    this.spiral = out;
    this.spiralR = R;
  }

  stream(px, pz, R, budgetMs) {
    const world = this.world;
    if (this.spiralR !== R + 2) this.buildSpiral(R + 2);
    const pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4;
    const t0 = performance.now();
    const R2 = (R + 2) * (R + 2);
    // Generate (one ring beyond what is meshed, so meshes see their neighbours).
    for (const [dx, dz, d2] of this.spiral) {
      if (d2 > R2) continue;
      const cx = pcx + dx, cz = pcz + dz;
      if (!world.chunk(cx, cz)) {
        const c = world.generate(cx, cz);
        if (c.fresh && this.state !== 'title') this.spawnAnimalsIn(c);
        if (performance.now() - t0 > budgetMs) break;
      }
    }
    // Mesh (always allow at least the nearest dirty chunk).
    let meshed = 0;
    const r2 = (R + 0.5) * (R + 0.5);
    for (const [dx, dz, d2] of this.spiral) {
      if (d2 > r2) continue;
      const cx = pcx + dx, cz = pcz + dz;
      const c = world.chunk(cx, cz);
      if (!c || !c.dirty) continue;
      let ok = true;
      for (let oz = -1; oz <= 1 && ok; oz++) for (let ox = -1; ox <= 1; ox++) if (!world.chunk(cx + ox, cz + oz)) { ok = false; break; }
      if (!ok) continue;
      const mesh = buildChunkMesh(world, c);
      this.renderer.uploadChunk(c, mesh);
      c.dirty = false;
      meshed++;
      if (meshed >= 1 && performance.now() - t0 > budgetMs + 4) break;
    }
    // Unload far chunks occasionally.
    this.unloadT -= 1 / 60;
    if (this.unloadT <= 0) {
      this.unloadT = 1;
      const lim = R + 3;
      for (const c of [...world.chunks.values()]) {
        if (Math.abs(c.cx - pcx) > lim || Math.abs(c.cz - pcz) > lim) {
          this.renderer.deleteChunk(c.key);
          world.unload(c.cx, c.cz);
        } else if ((Math.abs(c.cx - pcx) > R + 1 || Math.abs(c.cz - pcz) > R + 1) && c.mesh) {
          this.renderer.deleteChunk(c.key);
          c.mesh = null;
          c.dirty = true;
        }
      }
      this.mobs = this.mobs.filter((m) => world.isLoaded(Math.floor(m.x), Math.floor(m.z)));
      this.items = this.items.filter((m) => world.isLoaded(Math.floor(m.x), Math.floor(m.z)));
    }
  }

  // ---------- input / interaction ----------
  handleInput(dt) {
    const inp = this.input, p = this.player;
    if (p.dead) return;
    const sens = 0.0024 * this.settings.sensitivity;
    p.yaw -= inp.lookDX * sens;
    p.pitch -= inp.lookDY * sens;
    p.pitch = Math.max(-1.56, Math.min(1.56, p.pitch));
    if (inp.wheel) this.selectSlot((((p.sel + inp.wheel) % 9) + 9) % 9);
    for (let i = 1; i <= 9; i++) if (inp.pressed('Digit' + i)) this.selectSlot(i - 1);
    if (inp.pressed('KeyE')) { this.openPlayerInventory(); return; }
    if (inp.pressed('Escape') && !inp.locked) { this.pause(); return; }
    if (inp.pressed('F3')) { this.debug = !this.debug; this.applySettings(); }
    if (inp.pressed('KeyQ') && p.held) {
      const h = p.held;
      const n = inp.keys.has('ControlLeft') ? h.count : 1;
      this.dropFromPlayer({ ...h, count: n });
      h.count -= n;
      if (h.count <= 0) p.inv[p.sel] = null;
      p.invDirty = true;
    }
    if (inp.flyToggle && this.creative) { p.flying = !p.flying; if (p.flying) p.vy = 0; }
    this.interact(dt);
  }

  target() {
    const p = this.player;
    const eye = this.eyeY();
    const fx = -Math.sin(p.yaw) * Math.cos(p.pitch), fy = Math.sin(p.pitch), fz = -Math.cos(p.yaw) * Math.cos(p.pitch);
    const reach = this.creative ? 5 : 4.5;
    const hit = this.world.raycast(p.x, eye, p.z, fx, fy, fz, reach, (id) => !BLOCKS[id].liquid);
    let mob = null, mt = this.creative ? 5 : 3.2;
    if (hit) mt = Math.min(mt, hit.t);
    for (const m of this.mobs) {
      if (m.dead) continue;
      const t = rayBox(p.x, eye, p.z, fx, fy, fz, m.x - m.w, m.y, m.z - m.w, m.x + m.w, m.y + m.h, m.z + m.w);
      if (t < mt) { mt = t; mob = m; }
    }
    return { block: mob ? null : hit, mob, dir: [fx, fy, fz] };
  }

  interact(dt) {
    const inp = this.input, p = this.player, world = this.world;
    const tgt = this.target();
    this.tgt = tgt;
    p.attackCd -= dt; p.useCd -= dt; p.placeCd -= dt;
    const held = p.held;
    const heldItem = held ? ITEMS[held.id] : null;
    const touch = inp.mode === 'touch';

    // Bow: hold use (or hold on touch) to draw, release to shoot.
    if (heldItem && heldItem.name === 'bow') {
      const drawing = inp.use || (touch && inp.touchBreaking);
      if (drawing) { p.bowCharge += dt; }
      else if (p.bowCharge > 0) {
        if (p.bowCharge > 0.15 && (this.creative || this.consumeItem(I.arrow))) this.shootArrow(Math.min(1, p.bowCharge));
        p.bowCharge = 0;
      }
      if (inp.attackPressed && tgt.mob) this.attackMob(tgt.mob);
      return;
    }
    p.bowCharge = 0;

    // Attack / break.
    const attackEdge = inp.attackPressed || (touch && inp.tap && tgt.mob);
    if (tgt.mob) {
      if (attackEdge || (inp.attackHeld && p.attackCd <= 0)) this.attackMob(tgt.mob);
      p.breakT = null; p.breakP = 0;
    } else if (inp.attackHeld && tgt.block) {
      const b = tgt.block;
      const key = `${b.x},${b.y},${b.z}`;
      if (this.creative) {
        if (inp.attackPressed || p.attackCd <= 0) {
          this.breakBlock(b.x, b.y, b.z, b.id);
          p.attackCd = 0.22;
        }
      } else {
        if (p.breakT !== key) { p.breakT = key; p.breakP = 0; }
        const bt = breakTime(b.id, held ? held.id : 0);
        p.breakP += dt / bt;
        p.swing = Math.max(p.swing, 0.6);
        p.breakSound -= dt;
        if (p.breakSound <= 0) {
          p.breakSound = 0.22;
          sfx.hit(BLOCKS[b.id].sound);
          this.particles.hit(b.id, b.x, b.y, b.z, b.nx, b.ny, b.nz);
        }
        if (p.breakP >= 1) {
          this.breakBlock(b.x, b.y, b.z, b.id);
          p.breakT = null; p.breakP = 0;
          p.attackCd = 0.15;
        }
      }
    } else {
      p.breakT = null; p.breakP = 0;
      if (inp.attackPressed) p.swing = 1;
    }

    // Use / place.
    const useEdge = inp.usePressed || (touch && inp.tap && !tgt.mob);
    if (useEdge || (inp.use && p.placeCd <= 0)) {
      if (this.use(tgt, useEdge)) p.placeCd = 0.22;
    }

    // Pick block (creative middle click).
    if (inp.pickPressed && tgt.block && this.creative) {
      const id = tgt.block.id === B.furnace_lit ? B.furnace : tgt.block.id;
      const ex = p.inv.findIndex((s, i) => i < 9 && s && s.id === id);
      if (ex >= 0) this.selectSlot(ex);
      else { p.inv[p.sel] = { id, count: maxStack(id) }; p.invDirty = true; }
    }
  }

  consumeItem(id) {
    const p = this.player;
    for (let i = 0; i < 36; i++) {
      const s = p.inv[i];
      if (s && s.id === id) { s.count--; if (s.count <= 0) p.inv[i] = null; p.invDirty = true; return true; }
    }
    return false;
  }

  damageHeld(n) {
    const p = this.player;
    const h = p.held;
    if (!h || this.creative || h.dur === undefined) return;
    h.dur -= n;
    if (h.dur <= 0) { p.inv[p.sel] = null; sfx.dig('glass'); this.ui.toast(`${ITEMS[h.id].display} broke!`); }
    p.invDirty = true;
  }

  breakBlock(x, y, z, id) {
    const p = this.player;
    const b = BLOCKS[id];
    if (b.hardness < 0 && !this.creative) return;
    const held = p.held;
    this.world.set(x, y, z, 0);
    if (id === B.ice && !this.creative && SOLID[this.world.get(x, y - 1, z)]) this.world.set(x, y, z, B.water);
    this.particles.blockBreak(id, x, y, z);
    if (b.sound === 'glass') sfx.glass(); else sfx.dig(b.sound);
    p.swing = 1;
    if (!this.creative) {
      for (const [did, n] of blockDrops(id, held ? held.id : 0, Math.random)) if (n > 0) this.spawnItem(did, n, x + 0.5, y + 0.3, z + 0.5);
      if (b.hardness > 0) this.damageHeld(held && ITEMS[held.id].tool && ITEMS[held.id].tool.type === 'sword' ? 2 : 1);
      p.exh += 0.005;
    }
  }

  facingFromYaw() {
    const p = this.player;
    const lx = -Math.sin(p.yaw), lz = -Math.cos(p.yaw);
    if (Math.abs(lz) > Math.abs(lx)) return lz < 0 ? 0 : 2;
    return lx < 0 ? 3 : 1;
  }

  use(tgt, edge) {
    const p = this.player, world = this.world;
    const held = p.held;
    const it = held ? ITEMS[held.id] : null;
    const tb = tgt.block;
    if (tb) {
      const b = BLOCKS[tb.id];
      if (b.container && !this.input.sneak && edge) {
        p.swing = 1;
        this.openContainer(tb.x, tb.y, tb.z, b);
        return true;
      }
      if (tb.id === B.tnt && it && it.name === 'flint_and_steel') {
        world.set(tb.x, tb.y, tb.z, 0);
        this.primeTNT(tb.x, tb.y, tb.z, 4);
        this.damageHeld(1);
        p.swing = 1;
        return true;
      }
      if (it && it.block) return this.place(tb, held);
    }
    if (it && it.food && edge && (p.food < 20 || this.creative) && p.useCd <= 0) {
      p.food = Math.min(20, p.food + it.food);
      p.sat = Math.min(p.food, p.sat + it.food * 0.6);
      if (!this.creative) { held.count--; if (held.count <= 0) p.inv[p.sel] = null; }
      p.invDirty = true;
      p.useCd = 0.6;
      sfx.eat();
      setTimeout(() => sfx.burp(), 450);
      this.particles.burst(p.x, this.eyeY() - 0.3, p.z, it.tile, 8);
      return true;
    }
    return false;
  }

  place(tb, held) {
    const p = this.player, world = this.world;
    const id = ITEMS[held.id].block;
    const blk = BLOCKS[id];
    let x = tb.x, y = tb.y, z = tb.z;
    if (!BLOCKS[tb.id].replaceable) { x += tb.nx; y += tb.ny; z += tb.nz; }
    if (y < 0 || y >= CH) return false;
    const cur = world.get(x, y, z);
    if (cur !== 0 && !BLOCKS[cur].replaceable) return false;
    if (cur === id) return false;
    if (blk.needsSupport) {
      const below = world.get(x, y - 1, z);
      if (!SOLID[below] || !OPAQUE[below]) return false;
      if ((blk.shape === 'cross') && below !== B.grass && below !== B.dirt && below !== B.snowy_grass) return false;
    }
    if (id === B.cactus) {
      const below = world.get(x, y - 1, z);
      if (below !== B.sand && below !== B.cactus) return false;
    }
    if (blk.solid) {
      const hits = (e) => x + 1 > e.x - e.w && x < e.x + e.w && z + 1 > e.z - e.w && z < e.z + e.w && y + 1 > e.y && y < e.y + e.h;
      if (hits(p)) return false;
      for (const m of this.mobs) if (!m.dead && hits(m)) return false;
    }
    world.set(x, y, z, id);
    if (blk.orient) {
      const te = world.tileEntity(x, y, z, () => ({}));
      te.facing = this.facingFromYaw();
      world.markDirty(x, y, z);
    }
    if (blk.gravity) world.fall(x, y, z);
    if (!this.creative) { held.count--; if (held.count <= 0) p.inv[p.sel] = null; }
    p.invDirty = true;
    p.swing = 1;
    sfx.place(blk.sound);
    return true;
  }

  openContainer(x, y, z, b) {
    if (b.container === 'crafting') return this.openUI('crafting');
    const te = this.world.tileEntity(x, y, z, () => ({}));
    te.x = x; te.y = y; te.z = z;
    if (b.container === 'furnace') {
      if (!te.slots) Object.assign(te, { type: 'furnace', slots: [null, null, null], burn: 0, burnMax: 0, cook: 0 });
      this.openUI('furnace', te);
    } else if (b.container === 'chest') {
      if (!te.slots) Object.assign(te, { type: 'chest', slots: new Array(27).fill(null) });
      this.openUI('chest', te);
    }
  }

  attackMob(m) {
    const p = this.player;
    const held = p.held;
    const it = held ? ITEMS[held.id] : null;
    let dmg = it && it.damage ? it.damage : 1;
    const crit = !p.onGround && p.vy < 0 && !p.flying;
    if (crit) { dmg *= 1.5; this.particles.burst(m.x, m.y + m.h * 0.7, m.z, 'white', 10); }
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    this.damageMob(m, dmg, fx, fz, 1);
    p.swing = 1;
    p.attackCd = 0.45;
    if (it && it.tool) this.damageHeld(it.tool.type === 'sword' ? 1 : 2);
    p.exh += 0.1;
  }

  damageMob(m, amount, kx, kz, kb) {
    if (m.dead || m.hurtTime > 0) return;
    m.health -= amount;
    m.hurtTime = 0.45;
    const l = Math.hypot(kx, kz) || 1;
    m.vx = (kx / l) * 7 * kb; m.vz = (kz / l) * 7 * kb; m.vy = 5.5 * Math.min(1, kb);
    sfx.mobHurt(m.type);
    if (m.def.passive) m.panic = 5;
    m.aggro = 20;
    if (m.health <= 0) { m.dead = true; m.deathTime = 0; }
  }

  shootArrow(power) {
    const p = this.player;
    const [fx, fy, fz] = [-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch)];
    const s = 50 * power;
    const a = new Arrow(p.x + fx * 0.5, this.eyeY() - 0.1 + fy * 0.5, p.z + fz * 0.5, fx * s, fy * s, fz * s, 'player');
    a.damage = Math.round(2 + 7 * power);
    this.arrows.push(a);
    sfx.bow();
    this.damageHeld(1);
  }

  primeTNT(x, y, z, fuse) {
    this.tnts.push(new PrimedTNT(x + 0.5, y, z + 0.5, fuse));
    sfx.hiss();
  }

  explode(x, y, z, power) {
    const world = this.world;
    sfx.explode();
    this.particles.smoke(x, y, z, 50, power * 0.5, 2.5);
    this.shake = Math.max(this.shake || 0, 0.6);
    const r = Math.ceil(power);
    const pick = I.diamond_pickaxe;
    for (let dy = r; dy >= -r; dy--) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > power * (0.7 + Math.random() * 0.5)) continue;
      const bx = Math.floor(x) + dx, by = Math.floor(y) + dy, bz = Math.floor(z) + dz;
      const id = world.get(bx, by, bz);
      if (!id || id === B.bedrock || id === B.obsidian || id === B.water || id === B.lava) continue;
      if (id === B.tnt) { world.set(bx, by, bz, 0); this.primeTNT(bx, by, bz, 0.5 + Math.random()); continue; }
      world.set(bx, by, bz, 0);
      if (Math.random() < 0.3 && !this.creative) for (const [did, n] of blockDrops(id, pick, Math.random)) this.spawnItem(did, n, bx + 0.5, by + 0.5, bz + 0.5);
    }
    const hurt = (e, isPlayer) => {
      const ex = e.x - x, ey = e.y + e.h / 2 - y, ez = e.z - z;
      const d = Math.hypot(ex, ey, ez);
      if (d > power * 2) return;
      const impact = 1 - d / (power * 2);
      const dmg = ((impact * impact + impact) / 2) * 7 * power * 2 + 1;
      const k = impact * 14 / (d || 1);
      if (isPlayer) { this.damagePlayer(dmg, null, true); e.vx += ex * k; e.vy += Math.max(4, ey * k); e.vz += ez * k; }
      else { e.hurtTime = 0; this.damageMob(e, dmg, ex, ez, impact * 2); }
    };
    hurt(this.player, true);
    for (const m of this.mobs) hurt(m, false);
    this.items = this.items.filter((it) => Math.hypot(it.x - x, it.y - y, it.z - z) > power);
  }

  damagePlayer(amount, src, explosion) {
    const p = this.player;
    if (this.creative || p.dead || (p.hurtCd > 0 && !explosion)) return;
    if (src && !explosion) {
      const diff = this.settings.difficulty;
      if (diff === 'peaceful') return;
      if (diff === 'easy') amount = Math.min(amount, amount / 2 + 1);
      if (diff === 'hard') amount *= 1.5;
    }
    p.health -= amount;
    p.hurtCd = 0.5;
    sfx.hurt();
    this.ui.flashHurt();
    this.hurtTilt = 1;
    if (src) {
      const dx = p.x - src.x, dz = p.z - src.z, l = Math.hypot(dx, dz) || 1;
      p.vx += (dx / l) * 8; p.vz += (dz / l) * 8; p.vy = Math.max(p.vy, 5);
    }
    p.exh += 0.1;
    if (p.health <= 0) this.die();
  }

  die() {
    const p = this.player;
    p.health = 0;
    p.dead = true;
    for (let i = 0; i < 36; i++) {
      const s = p.inv[i];
      if (s) { this.spawnItem(s.id, s.count, p.x, p.y + 1, p.z, s.dur !== undefined ? { dur: s.dur } : null); p.inv[i] = null; }
    }
    p.invDirty = true;
    this.state = 'dead';
    this.input.active = false;
    this.input.releaseAll();
    this.input.exitLock();
    this.ui.show('menu-death');
  }

  respawn() {
    const p = this.player;
    const s = p.spawn || this.world.findSpawn();
    Object.assign(p, { x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0, health: 20, food: 20, sat: 5, air: 15, dead: false, fire: 0, fallStart: null });
    const cx = Math.floor(p.x) >> 4, cz = Math.floor(p.z) >> 4;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) this.world.generate(cx + dx, cz + dz);
    while (p.y < CH - 2 && this.collidesPlayer(p)) p.y += 1;
    this.state = 'playing';
    this.ui.show(null);
    this.input.active = true;
    this.ui.lastBars = '';
    if (this.input.mode === 'desktop') this.input.requestLock();
  }

  // ---------- simulation ----------
  eyeY() {
    const p = this.player;
    return p.y + (this.input.sneak && !p.flying ? 1.27 : 1.62);
  }

  dayInfo() {
    const t = ((this.time % DAY) + DAY) % DAY / DAY;
    const a = t * Math.PI * 2;
    const sunH = Math.sin(a);
    const day = Math.max(0, Math.min(1, sunH * 3 + 0.35));
    return { t, a, sunH, day };
  }

  update(dt) {
    const world = this.world, p = this.player;
    this.time += dt;
    if (!p.dead) this.updatePlayer(dt);
    for (const m of this.mobs) this.updateMob(m, dt);
    this.mobs = this.mobs.filter((m) => !m.removed);
    this.updateItems(dt);
    this.updateArrows(dt);
    this.updateTNT(dt);
    this.particles.update(world, dt);
    this.updateFurnaces(dt);
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawnT = 0.5; this.spawnMobs(); }
    this.saveT += dt;
    if (this.saveT > 45) { this.saveT = 0; this.save(); }
    if (p.invDirty) { p.invDirty = false; this.ui.updateHotbar(); }
  }

  updatePlayer(dt) {
    const p = this.player, inp = this.input, world = this.world;
    const playing = this.state === 'playing';
    const fwd = playing ? inp.moveForward : 0, str = playing ? inp.moveStrafe : 0;
    const jump = playing && inp.jump, sneak = playing && inp.sneak;
    let sprint = playing && inp.sprint && fwd > 0.5 && (p.food > 6 || this.creative) && !sneak;
    p.sprinting = sprint;
    if (!world.isLoaded(Math.floor(p.x), Math.floor(p.z))) return; // wait for terrain
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    let wx = -sin * fwd + cos * str, wz = -cos * fwd - sin * str;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    p.hurtCd -= dt;

    if (p.flying) {
      const sp = sprint ? 21 : 10.9;
      const k = 1 - Math.exp(-dt * 8);
      p.vx += (wx * sp - p.vx) * k;
      p.vz += (wz * sp - p.vz) * k;
      const vy = (jump ? 7.5 : 0) - (sneak ? 7.5 : 0);
      p.vy += (vy - p.vy) * k;
      moveEntity(world, p, dt);
      if (p.onGround && !jump) p.flying = false;
      p.fallStart = null;
    } else {
      let sp = sneak ? 1.3 : sprint ? 5.6 : 4.317;
      if (p.inWater || p.inLava) sp = p.inLava ? 1.2 : sprint ? 3.5 : 2.2;
      const k = 1 - Math.exp(-dt * (p.onGround ? 16 : p.inWater ? 6 : 2.5));
      p.vx += (wx * sp - p.vx) * k;
      p.vz += (wz * sp - p.vz) * k;
      if (p.inWater || p.inLava) {
        p.vy -= (p.inLava ? 6 : 9) * dt;
        p.vy *= Math.pow(0.15, dt);
        if (jump) p.vy = Math.min(p.vy + 28 * dt, p.headInWater ? 3.5 : 4.2);
        p.fallStart = null;
      } else {
        p.vy -= 32 * dt;
        if (p.vy < -78) p.vy = -78;
        if (jump && p.onGround) {
          p.vy = 9;
          if (sprint) { p.vx += wx * 2; p.vz += wz * 2; p.exh += 0.2; } else p.exh += 0.05;
        }
      }
      const auto = this.settings.autoJump === 'always' || (this.settings.autoJump === 'touch' && inp.mode === 'touch');
      const prevY = p.y;
      const prevOnGround = p.onGround;
      moveEntity(world, p, dt, sneak && p.onGround);
      if (auto && p.hitWall && prevOnGround && wl > 0.3 && !p.inWater) {
        // Step up a single block like Bedrock auto-jump.
        const ax = Math.floor(p.x + wx * 0.6), az = Math.floor(p.z + wz * 0.6), fy = Math.floor(p.y);
        if (SOLID[world.get(ax, fy, az)] && !SOLID[world.get(ax, fy + 1, az)] && !SOLID[world.get(ax, fy + 2, az)]) p.vy = 9;
      }
      // Fall damage.
      if (!p.onGround && !p.inWater) {
        if (p.fallStart === null || p.y > p.fallStart) p.fallStart = Math.max(p.y, p.fallStart ?? p.y);
      } else {
        if (p.fallStart !== null && !this.creative) {
          const d = p.fallStart - p.y;
          if (d > 3.4 && !p.inWater) { this.damagePlayer(Math.floor(d - 3), null, true); sfx.dig('stone'); }
        }
        p.fallStart = null;
      }
      void prevY;
    }

    // Movement side effects.
    const hs = Math.hypot(p.vx, p.vz);
    if (p.onGround && hs > 0.5) {
      p.stepDist += hs * dt;
      p.bob += hs * dt * 2.2;
      if (p.stepDist > 1.8) {
        p.stepDist = 0;
        const under = world.get(Math.floor(p.x), Math.floor(p.y - 0.2), Math.floor(p.z));
        if (under) sfx.step(BLOCKS[under].sound);
      }
    }
    p.bobAmt += ((p.onGround && hs > 0.5 ? Math.min(1, hs / 4.3) : 0) - p.bobAmt) * Math.min(1, dt * 10);
    if (sprint) p.exh += hs * dt * 0.1;
    if (p.inWater && hs > 0.5 && Math.random() < dt * 2) sfx.splash();
    p.swing = Math.max(0, p.swing - dt * 4);
    const fovTarget = (sprint ? 1.12 : 1) * (p.flying && sprint ? 1.1 : 1);
    p.fovMul += (fovTarget - p.fovMul) * Math.min(1, dt * 8);
    if (this.hurtTilt) this.hurtTilt = Math.max(0, this.hurtTilt - dt * 3);
    if (this.shake) this.shake = Math.max(0, this.shake - dt);

    if (this.creative) { p.health = 20; p.food = 20; p.air = 15; p.fire = 0; return; }

    // Hazards.
    if (p.headInWater) {
      p.air -= dt;
      if (p.air <= 0) { p.air = 0; p.drownT += dt; if (p.drownT > 1) { p.drownT = 0; this.damagePlayer(2, null, true); } }
    } else p.air = Math.min(15, p.air + dt * 5);
    if (p.inLava) { p.fire = 8; p.lavaT -= dt; if (p.lavaT <= 0) { p.lavaT = 0.5; this.damagePlayer(4, null, true); } }
    if (p.inWater) p.fire = 0;
    if (p.fire > 0) { p.fire -= dt; p.fireT -= dt; if (p.fireT <= 0) { p.fireT = 1; this.damagePlayer(1, null, true); } }
    p.cactusT -= dt;
    if (p.cactusT <= 0 && touchingBlock(world, p, B.cactus)) { p.cactusT = 0.5; this.damagePlayer(1, null, true); }
    if (p.y < -20) this.damagePlayer(4, null, true);

    // Hunger and regeneration.
    if (this.settings.difficulty === 'peaceful') {
      p.regenT += dt;
      if (p.regenT > 1) { p.regenT = 0; p.health = Math.min(20, p.health + 1); p.food = Math.min(20, p.food + 1); }
    }
    while (p.exh >= 4) {
      p.exh -= 4;
      if (p.sat > 0) p.sat = Math.max(0, p.sat - 1); else if (this.settings.difficulty !== 'peaceful') p.food = Math.max(0, p.food - 1);
    }
    if (p.food >= 18 && p.health < 20) {
      p.regenT += dt;
      if (p.regenT >= (p.sat > 0 ? 1 : 4)) { p.regenT = 0; p.health = Math.min(20, p.health + 1); p.exh += 6; }
    } else if (p.food <= 0) {
      p.starveT += dt;
      const floor = this.settings.difficulty === 'hard' ? 0 : this.settings.difficulty === 'normal' ? 1 : 10;
      if (p.starveT >= 4) { p.starveT = 0; if (p.health > floor) this.damagePlayer(1, null, true); }
    }
  }

  lineOfSight(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return true;
    const hit = this.world.raycast(ax, ay, az, dx / d, dy / d, dz / d, d, (id) => OPAQUE[id] === 1);
    return !hit;
  }

  updateMob(m, dt) {
    const world = this.world, p = this.player, d = m.def;
    m.age += dt;
    if (m.hurtTime > 0) m.hurtTime -= dt;
    m.cool -= dt;
    if (m.dead) {
      m.deathTime += dt;
      m.vx *= 0.9; m.vz *= 0.9; m.vy -= 32 * dt;
      moveEntity(world, m, dt);
      if (m.deathTime > 0.9) {
        m.removed = true;
        this.particles.smoke(m.x, m.y + m.h / 2, m.z, 12, m.w);
        for (const [n, c] of d.drops(Math.random, m.fire > 0)) if (c > 0) this.spawnItem(I[n], c, m.x, m.y + 0.5, m.z);
      }
      return;
    }
    const dx = p.x - m.x, dz = p.z - m.z, dy = p.y - m.y;
    const hd = Math.hypot(dx, dz);
    const dist = Math.hypot(hd, dy);
    const info = this.dayInfo();
    const hx = Math.floor(m.x), hy = Math.floor(m.y + m.h * 0.8), hz = Math.floor(m.z);
    let mx = 0, mz = 0, speed = d.speed, look = false;
    const canTarget = d.hostile && !p.dead && !this.creative && this.settings.difficulty !== 'peaceful' && this.state !== 'title';
    let hostile = canTarget && dist < 24;
    if (d.climbs && hostile) {
      const lit = Math.max(world.sky(hx, hy, hz) * info.day, world.blockLight(hx, hy, hz));
      if (lit > 10 && m.aggro <= 0) hostile = false;
    }
    if (m.aggro > 0) m.aggro -= dt;

    if (hostile) {
      look = true;
      const eye = m.y + m.h * 0.85;
      const sees = dist < 16 && this.lineOfSight(m.x, eye, m.z, p.x, this.eyeY(), p.z);
      const nx = dx / (hd || 1), nz = dz / (hd || 1);
      if (d.ranged) {
        if (hd > 11 || !sees) { mx = nx; mz = nz; }
        else if (hd < 5) { mx = -nx; mz = -nz; }
        else { const s = Math.sin(m.age * 0.7) > 0 ? 1 : -1; mx = -nz * s * 0.5; mz = nx * s * 0.5; }
        if (sees && m.cool <= 0 && hd < 15) {
          m.cool = this.settings.difficulty === 'hard' ? 1.5 : 2.2;
          const ex = m.x + nx * 0.6, ey = m.y + 1.5, ez = m.z + nz * 0.6;
          const tx = p.x - ex, ty = p.y + 1.1 - ey, tz = p.z - ez;
          const tl = Math.hypot(tx, ty, tz);
          const s = 24;
          const t = tl / s;
          const inacc = this.settings.difficulty === 'hard' ? 0.02 : 0.06;
          const a = new Arrow(ex, ey, ez, (tx / t) + (Math.random() - 0.5) * s * inacc, ty / t + 10 * t + (Math.random() - 0.5) * s * inacc, tz / t + (Math.random() - 0.5) * s * inacc, m);
          a.damage = 3;
          this.arrows.push(a);
          sfx.bow();
        }
      } else if (d.explodes) {
        if (dist < 3.2 && sees) {
          if (m.fuse === 0) sfx.hiss();
          m.fuse += dt;
          speed = 0.3;
        } else m.fuse = Math.max(0, m.fuse - dt);
        mx = nx; mz = nz;
        if (m.fuse >= 1.5) {
          m.removed = true;
          this.explode(m.x, m.y + 0.8, m.z, 3);
          return;
        }
      } else {
        mx = nx; mz = nz;
        if (hd < 1.2 + d.w && Math.abs(dy) < 1.6 && m.cool <= 0) {
          m.cool = 1;
          this.damagePlayer(d.damage, m);
        }
        if (d.climbs && hd < 4 && hd > 1.5 && m.onGround && Math.random() < dt * 1.5) {
          m.vy = 6; m.vx = nx * 6; m.vz = nz * 6;
        }
      }
    } else if (m.panic > 0) {
      m.panic -= dt;
      m.wanderT -= dt;
      if (m.wanderT <= 0) { const a = Math.random() * Math.PI * 2; m.mx = Math.sin(a); m.mz = Math.cos(a); m.wanderT = 0.6 + Math.random(); }
      mx = m.mx; mz = m.mz; speed *= 2;
    } else {
      m.wanderT -= dt;
      if (m.wanderT <= 0) {
        if (Math.random() < 0.55) { const a = Math.random() * Math.PI * 2; m.mx = Math.sin(a); m.mz = Math.cos(a); }
        else { m.mx = 0; m.mz = 0; }
        m.wanderT = 2 + Math.random() * 5;
      }
      mx = m.mx; mz = m.mz;
      look = dist < 6 && d.passive;
      speed *= 0.7;
    }

    // Don't walk off cliffs (passive mobs).
    if ((mx || mz) && d.passive && m.onGround) {
      const ax = Math.floor(m.x + mx * 0.9), az = Math.floor(m.z + mz * 0.9);
      let ground = false;
      for (let k = 0; k <= 3; k++) if (SOLID[world.get(ax, Math.floor(m.y) - k, az)]) { ground = true; break; }
      const water = world.get(ax, Math.floor(m.y), az) === B.water || world.get(ax, Math.floor(m.y) - 1, az) === B.water;
      if (!ground || (water && m.panic <= 0)) { mx = 0; mz = 0; m.wanderT = 0; }
    }

    const k = 1 - Math.exp(-dt * (m.onGround ? 10 : 2));
    if (m.hurtTime <= 0.2) {
      m.vx += (mx * speed - m.vx) * k;
      m.vz += (mz * speed - m.vz) * k;
    }
    if (m.inWater || m.inLava) {
      m.vy += (m.headInWater || m.inLava ? 14 : 4) * dt;
      m.vy *= Math.pow(0.2, dt);
      m.vy -= 9 * dt;
    } else m.vy -= 32 * dt;
    if (d.flutter && !m.onGround && m.vy < -2.5) m.vy = -2.5;
    const wasWall = m.hitWall;
    moveEntity(world, m, dt);
    if ((m.hitWall || wasWall) && (mx || mz)) {
      if (d.climbs) m.vy = 3.5;
      else if (m.onGround) m.vy = 8.6;
    }
    // Push out of the player.
    if (hd < m.w + p.w && Math.abs(dy) < 1.5 && !p.dead) {
      const push = (m.w + p.w - hd) * 4;
      m.vx -= (dx / (hd || 1)) * push; m.vz -= (dz / (hd || 1)) * push;
    }
    // Facing and animation.
    const hsp = Math.hypot(m.vx, m.vz);
    if (hsp > 0.3) {
      const ty = Math.atan2(m.vx, m.vz);
      let diff = ty - m.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      m.yaw += diff * Math.min(1, dt * 8);
    }
    if (look) {
      let hy2 = Math.atan2(dx, dz) - m.yaw;
      hy2 = Math.atan2(Math.sin(hy2), Math.cos(hy2));
      m.headYaw += (Math.max(-1.2, Math.min(1.2, hy2)) - m.headYaw) * Math.min(1, dt * 6);
      m.headPitch += (Math.atan2(this.eyeY() - (m.y + m.h * 0.85), hd) * 0.8 - m.headPitch) * Math.min(1, dt * 6);
    } else { m.headYaw *= 1 - Math.min(1, dt * 3); m.headPitch *= 1 - Math.min(1, dt * 3); }
    m.walkAmt += ((hsp > 0.2 ? 1 : 0) - m.walkAmt) * Math.min(1, dt * 8);
    m.walk += hsp * dt * 3.2;

    // Sunlight burns undead.
    if (d.burns && info.day > 0.6 && !m.inWater && world.sky(hx, hy, hz) >= 15) m.fire = Math.max(m.fire, 1.5);
    if (m.inLava) m.fire = 8;
    if (m.inWater) m.fire = 0;
    if (m.fire > 0) {
      m.fire -= dt;
      m.burnT = (m.burnT || 0) - dt;
      if (m.burnT <= 0) { m.burnT = 1; m.hurtTime = 0; this.damageMob(m, m.inLava ? 4 : 1, 0, 0, 0); }
    }
    if (m.y < -10) m.removed = true;
    if (dist < 16 && Math.random() < dt / 9) sfx.mobSay(m.type);
    // Despawn far hostiles.
    if (d.hostile && (dist > 80 || (dist > 36 && Math.random() < dt / 30))) m.removed = true;
  }

  spawnAnimalsIn(c) {
    if (this.mobs.filter((m) => m.def.passive).length > 50) return;
    if (Math.random() > 0.14) return;
    const types = ['pig', 'cow', 'sheep', 'chicken'];
    const type = types[(Math.random() * types.length) | 0];
    const lx = 2 + ((Math.random() * 12) | 0), lz = 2 + ((Math.random() * 12) | 0);
    const n = 2 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const x = c.cx * CS + lx + ((Math.random() * 3) | 0), z = c.cz * CS + lz + ((Math.random() * 3) | 0);
      if ((x >> 4) !== c.cx || (z >> 4) !== c.cz) continue;
      const y = c.height[(x & 15) | ((z & 15) << 4)];
      const top = c.blocks[(x & 15) | ((z & 15) << 4) | (y << 8)];
      if (top !== B.grass && top !== B.snowy_grass) continue;
      if (y + 2 >= CH || c.blocks[(x & 15) | ((z & 15) << 4) | ((y + 1) << 8)] !== 0) continue;
      this.mobs.push(new Mob(type, x + 0.5, y + 1, z + 0.5));
    }
  }

  spawnMobs() {
    const world = this.world, p = this.player;
    if (this.creative || this.settings.difficulty === 'peaceful') return;
    const hostiles = this.mobs.filter((m) => m.def.hostile).length;
    const cap = this.settings.difficulty === 'hard' ? 26 : this.settings.difficulty === 'normal' ? 20 : 14;
    if (hostiles >= cap) return;
    const info = this.dayInfo();
    for (let attempt = 0; attempt < 4; attempt++) {
      const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 26;
      const x = Math.floor(p.x + Math.cos(a) * r), z = Math.floor(p.z + Math.sin(a) * r);
      if (!world.isLoaded(x, z)) continue;
      const top = world.surfaceY(x, z);
      // Either the surface or a random cave pocket.
      const y = Math.random() < 0.5 ? top + 1 : 3 + Math.floor(Math.random() * Math.max(1, top - 3));
      if (y <= 1 || y + 2 >= CH) continue;
      if (!SOLID[world.get(x, y - 1, z)] || !OPAQUE[world.get(x, y - 1, z)]) continue;
      if (world.get(x, y, z) !== 0 || world.get(x, y + 1, z) !== 0) continue;
      const sky = world.sky(x, y, z) * (info.day > 0.5 ? 1 : 4 / 15);
      if (world.blockLight(x, y, z) > 0 || sky > 7) continue;
      const types = ['zombie', 'zombie', 'skeleton', 'creeper', 'spider'];
      const type = types[(Math.random() * types.length) | 0];
      const def = MOBS[type];
      if (def.w > 0.5 && (SOLID[world.get(x + 1, y, z)] || SOLID[world.get(x, y, z + 1)])) continue;
      this.mobs.push(new Mob(type, x + 0.5, y, z + 0.5));
      return;
    }
  }

  updateItems(dt) {
    const p = this.player, world = this.world;
    for (const e of this.items) {
      e.age += dt;
      e.pickup -= dt;
      const dx = p.x - e.x, dy = p.y + 0.8 - e.y, dz = p.z - e.z;
      const d = Math.hypot(dx, dy, dz);
      if (!p.dead && e.pickup <= 0 && d < 1.8) {
        if (d < 0.9) {
          const left = addToSlots(p.inv, e.extra && e.extra.dur !== undefined ? { id: e.id, count: e.count, dur: e.extra.dur } : { id: e.id, count: e.count });
          if (left < e.count) { sfx.pop(); p.invDirty = true; }
          e.count = left;
          if (!left) { e.removed = true; continue; }
        } else {
          e.vx += (dx / d) * 30 * dt; e.vy += (dy / d) * 30 * dt; e.vz += (dz / d) * 30 * dt;
        }
      }
      e.vy -= 18 * dt;
      if (e.inWater) { e.vy += 22 * dt; e.vy *= 0.9; }
      const f = e.onGround ? Math.pow(0.02, dt) : Math.pow(0.6, dt);
      e.vx *= f; e.vz *= f;
      moveEntity(world, e, dt);
      if (e.age > 300 || e.y < -10) e.removed = true;
    }
    if (this.items.some((e) => e.removed)) this.items = this.items.filter((e) => !e.removed);
  }

  updateArrows(dt) {
    const p = this.player, world = this.world;
    for (const a of this.arrows) {
      a.age += dt;
      if (a.stuck) {
        if (a.age > 30) a.removed = true;
        else if (a.owner === 'player' && !this.creative && Math.hypot(p.x - a.x, p.y + 0.9 - a.y, p.z - a.z) < 1.3) {
          if (!addToSlots(p.inv, { id: I.arrow, count: 1 })) { a.removed = true; sfx.pop(); p.invDirty = true; }
        }
        continue;
      }
      a.vy -= 20 * dt;
      const sp = Math.hypot(a.vx, a.vy, a.vz);
      const step = sp * dt;
      const hit = world.raycast(a.x, a.y, a.z, a.vx / sp, a.vy / sp, a.vz / sp, step, (id) => SOLID[id] === 1);
      // Entities.
      const nx = a.x + a.vx * dt, ny = a.y + a.vy * dt, nz = a.z + a.vz * dt;
      const tryHit = (e) => nx > e.x - e.w - 0.1 && nx < e.x + e.w + 0.1 && nz > e.z - e.w - 0.1 && nz < e.z + e.w + 0.1 && ny > e.y && ny < e.y + e.h;
      if (a.owner !== 'player' && !p.dead && tryHit(p)) {
        this.damagePlayer(a.damage || 3, { x: a.x - a.vx, z: a.z - a.vz });
        a.removed = true; continue;
      }
      if (a.owner === 'player') {
        const m = this.mobs.find((mm) => !mm.dead && tryHit(mm));
        if (m) { this.damageMob(m, a.damage || 4, a.vx, a.vz, 0.6); a.removed = true; continue; }
      }
      if (hit) {
        a.x += (a.vx / sp) * hit.t; a.y += (a.vy / sp) * hit.t; a.z += (a.vz / sp) * hit.t;
        a.stuck = true; a.age = 0;
        if (hit.id === B.tnt) { world.set(hit.x, hit.y, hit.z, 0); this.primeTNT(hit.x, hit.y, hit.z, 4); }
      } else { a.x = nx; a.y = ny; a.z = nz; }
      if (a.age > 20 || a.y < -10) a.removed = true;
    }
    if (this.arrows.some((a) => a.removed)) this.arrows = this.arrows.filter((a) => !a.removed);
  }

  updateTNT(dt) {
    for (const t of this.tnts) {
      t.fuse -= dt;
      t.vy -= 20 * dt;
      t.vx *= Math.pow(0.1, dt); t.vz *= Math.pow(0.1, dt);
      moveEntity(this.world, t, dt);
      if (Math.random() < dt * 20) this.particles.smoke(t.x, t.y + 1.1, t.z, 1, 0.1, 0.4);
      if (t.fuse <= 0) { t.removed = true; this.explode(t.x, t.y + 0.5, t.z, 4); }
    }
    if (this.tnts.some((t) => t.removed)) this.tnts = this.tnts.filter((t) => !t.removed);
  }

  updateFurnaces(dt) {
    const world = this.world;
    for (const te of world.tileEntities.values()) {
      if (te.type !== 'furnace' || te.x === undefined || !world.isLoaded(te.x, te.z)) continue;
      const [inp, fuel, out] = te.slots;
      const res = inp && SMELTING[ITEMS[inp.id].name];
      const outId = res ? I[res] : 0;
      const can = outId && (!out || (out.id === outId && out.count < maxStack(outId)));
      if (te.burn > 0) te.burn -= dt;
      if (te.burn <= 0 && can && fuel && ITEMS[fuel.id].fuel) {
        te.burn = te.burnMax = ITEMS[fuel.id].fuel;
        fuel.count--;
        if (fuel.count <= 0) te.slots[1] = null;
      }
      if (te.burn > 0 && can) {
        te.cook += dt;
        if (te.cook >= 10) {
          te.cook = 0;
          inp.count--;
          if (inp.count <= 0) te.slots[0] = null;
          if (out) out.count++; else te.slots[2] = { id: outId, count: 1 };
        }
      } else te.cook = Math.max(0, te.cook - dt * 2);
      const lit = te.burn > 0;
      const cur = world.get(te.x, te.y, te.z);
      if (lit && cur === B.furnace) world.set(te.x, te.y, te.z, B.furnace_lit);
      else if (!lit && cur === B.furnace_lit) world.set(te.x, te.y, te.z, B.furnace);
    }
  }

  // ---------- rendering ----------
  cameraFor() {
    const p = this.player;
    let y = this.eyeY();
    let x = p.x, z = p.z;
    if (this.settings.bobbing && !p.flying) {
      const b = Math.sin(p.bob * Math.PI) * 0.06 * p.bobAmt;
      y += Math.abs(b) - 0.03 * p.bobAmt;
      x += Math.cos(p.yaw) * b * 0.5;
      z -= Math.sin(p.yaw) * b * 0.5;
    }
    let pitch = p.pitch, yaw = p.yaw;
    if (this.shake) { pitch += (Math.random() - 0.5) * this.shake * 0.05; yaw += (Math.random() - 0.5) * this.shake * 0.05; }
    if (p.dead) y = p.y + 0.3;
    return { x, y, z, yaw, pitch };
  }

  lightAt(x, y, z) {
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    return [this.world.sky(fx, fy, fz) / 15, this.world.blockLight(fx, fy, fz) / 15];
  }

  renderFrame(cam, dt) {
    const world = this.world, s = this.settings, info = this.dayInfo();
    this.renderer.resize(s.resolution);
    const underwater = world.get(Math.floor(cam.x), Math.floor(cam.y), Math.floor(cam.z)) === B.water;
    const inLava = world.get(Math.floor(cam.x), Math.floor(cam.y), Math.floor(cam.z)) === B.lava;
    // Sky colours.
    const day = info.day;
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    let top = mix([0.01, 0.01, 0.04], [0.47, 0.65, 1.0], day);
    let fog = mix([0.02, 0.03, 0.08], [0.75, 0.85, 1.0], day);
    const sunset = Math.max(0, 1 - Math.abs(info.sunH) * 4) * (Math.cos(info.a) > 0 ? 1 : 0.85);
    fog = mix(fog, [0.95, 0.55, 0.3], sunset * 0.45);
    let fogFar = s.renderDistance * 16 - 6, fogNear = fogFar * 0.55;
    if (underwater) { fog = [0.04 * (0.3 + day), 0.12 * (0.3 + day), 0.38 * (0.3 + day)]; fogNear = 0; fogFar = 16; }
    if (inLava) { fog = [0.8, 0.25, 0.02]; fogNear = 0; fogFar = 2; }
    const blind = world.sky(Math.floor(cam.x), Math.floor(cam.y), Math.floor(cam.z));
    if (!underwater && cam.y < SEA - 8 && blind < 4) { const k = Math.max(0, Math.min(1, (SEA - 8 - cam.y) / 20)); fog = mix(fog, [0.01, 0.01, 0.02], k * 0.85); top = mix(top, [0, 0, 0], k); }

    // Sun, moon, stars.
    const sb = this.skyBatch; sb.reset();
    const sx = Math.cos(info.a), sy = Math.sin(info.a);
    const celestial = (dx, dy, size, tile) => {
      const cx = dx * 100, cy = dy * 100;
      const ux = 0, uz = size; // along z
      const vx = -dy * size, vy = dx * size;
      sb.quad([cx - vx - ux, cy - vy, -uz, cx - vx + ux, cy - vy, uz, cx + vx + ux, cy + vy, uz, cx + vx - ux, cy + vy, -uz], uvRect(tile), 1, 0, 1);
    };
    celestial(sx, sy, 11, 'sun');
    celestial(-sx, -sy, 8, 'moon');
    if (day < 0.5) {
      const uv = uvRect('white', 6, 6, 10, 10);
      const rot = info.a;
      const cr = Math.cos(rot), sr = Math.sin(rot);
      for (const [x, y, z, sz] of this.stars) {
        const rx = x * cr - y * sr, ry = x * sr + y * cr;
        if (ry < -0.05) continue;
        const cx = rx * 100, cy = ry * 100, cz = z * 100;
        const a = sz * (1 - day * 2);
        // Billboard approximately facing the origin.
        const ux = -cz, uz = cx, ul = Math.hypot(ux, uz) || 1;
        const px = (ux / ul) * a, pz = (uz / ul) * a;
        sb.quad([cx - px, cy - a, cz - pz, cx + px, cy - a, cz + pz, cx + px, cy + a, cz + pz, cx - px, cy + a, cz - pz], uv, 1, 0, 1);
      }
    }

    // Entities.
    const eb = this.entityBatch; eb.reset();
    const t = performance.now() / 1000;
    for (const m of this.mobs) drawMob(eb, m, this.lightAt(m.x, m.y + m.h * 0.7, m.z), t);
    for (const it of this.items) drawItem(eb, it, this.lightAt(it.x, it.y + 0.2, it.z), t);
    for (const a of this.arrows) drawArrow(eb, a, this.lightAt(a.x, a.y, a.z));
    for (const tn of this.tnts) drawTNT(eb, tn, this.lightAt(tn.x, tn.y + 0.5, tn.z));

    // Particles + cracks.
    const db = this.decalBatch; db.reset();
    const cy = Math.cos(cam.yaw), sy2 = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    // Camera right/up vectors.
    const rx = cy, ry = 0, rz = -sy2;
    const ux = sy2 * sp, uy = cp, uz = cy * sp;
    this.particles.draw(db, world, rx, ry, rz, ux, uy, uz);
    let outline = null;
    const p = this.player;
    if (this.state !== 'title' && this.tgt && this.tgt.block && !p.dead) {
      const b = this.tgt.block, bl = BLOCKS[b.id];
      if (bl.shape === 'cross') outline = [b.x + 0.15, b.y, b.z + 0.15, b.x + 0.85, b.y + 0.85, b.z + 0.85];
      else if (bl.shape === 'torch') outline = [b.x + 0.4, b.y, b.z + 0.4, b.x + 0.6, b.y + 0.65, b.z + 0.6];
      else outline = [b.x, b.y, b.z, b.x + 1, b.y + 1, b.z + 1];
      if (p.breakP > 0 && p.breakT === `${b.x},${b.y},${b.z}`) {
        const st = Math.min(9, Math.floor(p.breakP * 10));
        const uv = uvRect('destroy_' + st);
        const m = M.identity(M.mat4());
        M.translate(m, b.x + 0.5, b.y, b.z + 0.5);
        const L = this.lightAt(b.x + b.nx + 0.5, b.y + b.ny + 0.5, b.z + b.nz + 0.5);
        db.box(m, -0.501, -0.001, -0.501, 0.501, 1.001, 0.501, [uv, uv, uv, uv, uv, uv], Math.max(0.6, L[0]), L[1], 1);
      }
    }

    // Clouds.
    const cb = this.cloudBatch; cb.reset();
    if (s.clouds && !underwater) {
      const H = 112.33, S = 384, scale = 12 * 128;
      const drift = this.time * 0.6;
      const x0 = cam.x - S, x1 = cam.x + S, z0 = cam.z - S, z1 = cam.z + S;
      const u0 = (x0 + drift) / scale, u1 = (x1 + drift) / scale, v0 = z0 / scale, v1 = z1 / scale;
      cb.quad([x0, H, z1, x1, H, z1, x1, H, z0, x0, H, z0], [u0, v0, u1, v1], 1, 0, 1);
    }

    // Hand / held item.
    const hb = this.handBatch; hb.reset();
    if (this.state !== 'title' && !p.dead) this.drawHand(hb, info);

    this.renderer.render({
      cam, fov: (s.fov * Math.PI / 180) * p.fovMul * (underwater ? 0.92 : 1),
      fog, skyTop: top, day: 0.2 + day * 0.8, minLight: 0.03 + s.gamma * 0.05, gamma: s.gamma * 0.7,
      fogNear, fogFar, underwater: underwater || inLava,
      skyBatch: sb, entityBatch: eb, decalBatch: db, cloudBatch: cb, handBatch: hb, outline,
    });
  }

  drawHand(hb, info) {
    const p = this.player;
    const L = this.lightAt(p.x, this.eyeY(), p.z);
    const m = M.identity(M.mat4());
    const sw = p.swing;
    const swA = Math.sin(Math.min(1, 1 - sw) * Math.PI);
    const bob = this.settings.bobbing ? Math.sin(p.bob * Math.PI) * 0.03 * p.bobAmt : 0;
    const bobY = this.settings.bobbing ? -Math.abs(Math.cos(p.bob * Math.PI)) * 0.03 * p.bobAmt : 0;
    const held = p.held;
    const draw = p.bowCharge > 0 ? Math.min(1, p.bowCharge) : 0;
    M.translate(m, 0.56 + bob - swA * 0.2, -0.52 + bobY + swA * 0.12, -0.72 - swA * 0.1);
    M.rotateX(m, -swA * 0.9);
    M.rotateY(m, swA * 0.3);
    void info;
    if (!held) {
      const skin = uvRect('sheep_skin');
      M.rotateX(m, 0.1);
      M.rotateY(m, -0.35);
      M.rotateZ(m, 0.1);
      hb.box(m, -0.1, -0.1, -0.2, 0.1, 0.1, 0.55, [skin, skin, skin, skin, skin, skin], L[0], L[1], 1);
    } else if (isCubeItem(held.id)) {
      M.translate(m, -0.05, 0.05, 0);
      M.rotateY(m, Math.PI / 4);
      hb.box(m, -0.2, -0.2, -0.2, 0.2, 0.2, 0.2, blockFaceUVs(ITEMS[held.id].block), L[0], L[1], 1);
    } else {
      const uv = itemUV(held.id);
      M.translate(m, 0.0, 0.1, 0);
      if (ITEMS[held.id].name === 'bow') {
        M.translate(m, -0.25 - draw * 0.1, 0.05, draw * 0.15);
        M.rotateY(m, -1.2);
        M.rotateZ(m, -0.3);
      } else {
        M.rotateY(m, -Math.PI / 2 + 0.25);
        M.rotateZ(m, 0.35);
      }
      const flip = [uv[2], uv[1], uv[0], uv[3]];
      hb.box(m, -0.3, -0.3, -0.015, 0.3, 0.3, 0.015, [uv, uv, uv, uv, uv, flip], L[0], L[1], 1);
    }
  }

  updateHUD() {
    const p = this.player;
    this.ui.updateBars();
    const showDbg = this.settings.showFps || this.debug;
    if (showDbg && this.world) {
      let txt = `${Math.round(this.fps)} fps`;
      if (this.debug) {
        const col = this.world.column(Math.floor(p.x), Math.floor(p.z));
        const fx = Math.floor(p.x), fy = Math.floor(p.y), fz = Math.floor(p.z);
        txt += `\nXYZ: ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`;
        txt += `\nChunk: ${fx >> 4} ${fz >> 4}  loaded ${this.world.chunks.size}  drawn ${this.renderer.stats.chunks}`;
        txt += `\nTriangles: ${this.renderer.stats.tris}`;
        txt += `\nBiome: ${col.biome}  Light: sky ${this.world.sky(fx, fy, fz)} block ${this.world.blockLight(fx, fy, fz)}`;
        txt += `\nMobs: ${this.mobs.length}  Items: ${this.items.length}`;
        txt += `\nTime: day ${Math.floor(this.time / DAY) + 1}, ${Math.round(this.dayInfo().t * 24000)}`;
        txt += `\nWebGL${this.renderer.webgl2 ? '2' : '1'}  ${this.renderer.canvas.width}x${this.renderer.canvas.height}`;
      }
      $('debug').textContent = txt;
    }
    $('crosshair').style.display = this.state === 'playing' ? '' : 'none';
  }
}

function boot() {
  try {
    window.game = new Game();
  } catch (e) {
    console.error(e);
    const el = $('fatal');
    el.textContent = 'Blockcraft could not start: ' + (e && e.message ? e.message : e);
    el.style.display = 'flex';
  }
}

boot();

export { ckey };
