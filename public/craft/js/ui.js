// DOM user interface: HUD, hotbar, inventory / crafting / furnace / chest /
// creative screens, and the title, world, pause, options and death menus.

import { ITEMS, BLOCKS, B, I, maxStack, SMELTING } from './blocks.js';
import { itemIcon } from './textures.js';
import { matchRecipe, addToSlots } from './crafting.js';
import * as store from './storage.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);

function pix(rows, pal, scale = 3) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = h * scale;
  const x = c.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const col = pal[rows[j][i]];
    if (!col) continue;
    x.fillStyle = col;
    x.fillRect(i * scale, j * scale, scale, scale);
  }
  return c.toDataURL();
}
const HEART = ['.KK.KK.', 'KRRKRRK', 'KRWRRRK', 'KRRRRRK', '.KRRRK.', '..KRK..', '...K...'];
const HEART_HALF = ['.KK.KK.', 'KRRKDDK', 'KRWKDDK', 'KRRKDDK', '.KRKDK.', '..KRK..', '...K...'];
const HEART_EMPTY = ['.KK.KK.', 'KDDKDDK', 'KDDDDDK', 'KDDDDDK', '.KDDDK.', '..KDK..', '...K...'];
const FOOD = ['....KKK.', '...KBBBK', '..KBWBBK', '.KBBBBK.', 'KWKBBK..', 'KWWKK...', '.KK.....'];
const FOOD_HALF = ['....KKK.', '...KBBBK', '..KBWBBK', '.KDDDDK.', 'KDKDDK..', 'KDDKK...', '.KK.....'];
const FOOD_EMPTY = ['....KKK.', '...KDDDK', '..KDDDDK', '.KDDDDK.', 'KDKDDK..', 'KDDKK...', '.KK.....'];
const BUBBLE = ['.KKK.', 'KWB.K', 'KB..K', 'K...K', '.KKK.'];
const PAL = { K: '#1a0606', R: '#d51818', W: '#ffd0d0', D: '#3a1a1a', B: '#b8692c', '.': null };
const ICONS = {};

const FURNACE_TIME = 10;

export class UI {
  constructor(game) {
    this.g = game;
    this.cursor = null;
    this.kind = null; // open inventory kind
    this.te = null;
    this.craft = [];
    this.craftN = 2;
    this.refs = [];
    ICONS.heart = pix(HEART, PAL); ICONS.heartHalf = pix(HEART_HALF, PAL); ICONS.heartEmpty = pix(HEART_EMPTY, PAL);
    ICONS.food = pix(FOOD, PAL); ICONS.foodHalf = pix(FOOD_HALF, PAL); ICONS.foodEmpty = pix(FOOD_EMPTY, { ...PAL });
    ICONS.bubble = pix(BUBBLE, { K: '#1a3a8a', W: '#ffffff', B: '#8ac8ff' });
    this.buildHUD();
    this.bindMenus();
    this.tooltip = $('tooltip');
    document.addEventListener('pointermove', (e) => this.moveCursor(e.clientX, e.clientY));
  }

  // ---------- HUD ----------
  buildHUD() {
    const hb = $('hotbar');
    this.hotSlots = [];
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('div');
      s.className = 'hslot';
      s.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.g.selectSlot(i); }, { passive: false });
      s.addEventListener('mousedown', (e) => { if (!this.g.input.locked) { e.stopPropagation(); this.g.selectSlot(i); } });
      hb.appendChild(s);
      this.hotSlots.push(s);
    }
    this.hotSel = document.createElement('div');
    this.hotSel.id = 'hotsel';
    hb.appendChild(this.hotSel);
    const inv = $('btn-inv');
    const openInv = (e) => { e.preventDefault(); e.stopPropagation(); this.g.openPlayerInventory(); };
    inv.addEventListener('touchstart', openInv, { passive: false });
    inv.addEventListener('click', openInv);
    const pause = $('btn-pause');
    const doPause = (e) => { e.preventDefault(); e.stopPropagation(); this.g.pause(); };
    pause.addEventListener('touchstart', doPause, { passive: false });
    pause.addEventListener('click', doPause);
    this.hearts = []; this.foods = []; this.bubbles = [];
    for (let i = 0; i < 10; i++) {
      const h = document.createElement('img'); h.className = 'icon'; $('hearts').appendChild(h); this.hearts.push(h);
      const f = document.createElement('img'); f.className = 'icon'; $('food').appendChild(f); this.foods.push(f);
      const b = document.createElement('img'); b.className = 'icon'; b.src = ICONS.bubble; $('air').appendChild(b); this.bubbles.push(b);
    }
    this.lastBars = '';
  }

  renderSlot(el, s) {
    if (!s) { el.innerHTML = ''; el._k = ''; return; }
    const k = s.id + ':' + s.count + ':' + (s.dur || 0);
    if (el._k === k) return;
    el._k = k;
    const it = ITEMS[s.id];
    let html = `<img src="${itemIcon(s.id)}" draggable="false">`;
    if (s.count > 1) html += `<span class="count">${s.count}</span>`;
    if (it && it.durability && s.dur < it.durability) {
      const f = s.dur / it.durability;
      html += `<span class="dur"><i style="width:${Math.round(f * 100)}%;background:hsl(${Math.round(f * 120)},90%,45%)"></i></span>`;
    }
    el.innerHTML = html;
  }

  updateHotbar() {
    const p = this.g.player;
    for (let i = 0; i < 9; i++) this.renderSlot(this.hotSlots[i], p.inv[i]);
    const sel = this.hotSlots[p.sel];
    this.hotSel.style.left = sel.offsetLeft - 2 + 'px';
  }

  updateBars() {
    const p = this.g.player;
    const creative = this.g.creative;
    const key = [Math.ceil(p.health), Math.ceil(p.food), Math.ceil(p.air), creative, p.headInWater].join(',');
    if (key === this.lastBars) return;
    this.lastBars = key;
    $('bars').style.display = creative ? 'none' : '';
    const hp = Math.ceil(p.health), fd = Math.ceil(p.food);
    for (let i = 0; i < 10; i++) {
      const v = hp - i * 2;
      this.hearts[i].src = v >= 2 ? ICONS.heart : v === 1 ? ICONS.heartHalf : ICONS.heartEmpty;
      const f = fd - (9 - i) * 2;
      this.foods[i].src = f >= 2 ? ICONS.food : f === 1 ? ICONS.foodHalf : ICONS.foodEmpty;
    }
    const air = Math.ceil((p.air / 15) * 10);
    $('air').style.display = p.headInWater || p.air < 15 ? 'flex' : 'none';
    for (let i = 0; i < 10; i++) this.bubbles[9 - i].style.visibility = i < air ? 'visible' : 'hidden';
    if (hp <= 4) $('hearts').classList.add('low'); else $('hearts').classList.remove('low');
  }

  showHeldName(id) {
    const el = $('held-name');
    if (!id) { el.classList.remove('show'); return; }
    el.textContent = ITEMS[id].display;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  flashHurt() {
    const el = $('hurt');
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  // ---------- inventory screens ----------
  get isOpen() { return !!this.kind; }

  open(kind, te) {
    this.kind = kind;
    this.te = te || null;
    this.craftN = kind === 'crafting' ? 3 : 2;
    this.craft = new Array(this.craftN * this.craftN).fill(null);
    this.build();
    $('screen-inv').classList.remove('hidden');
  }

  close() {
    if (!this.kind) return;
    const p = this.g.player;
    for (const s of this.craft) if (s) this.g.giveOrDrop(s);
    this.craft = [];
    if (this.cursor) { this.g.giveOrDrop(this.cursor); this.cursor = null; }
    this.kind = null; this.te = null;
    $('screen-inv').classList.add('hidden');
    this.tooltip.style.display = 'none';
    this.renderCursor();
    this.updateHotbar();
    p.invDirty = true;
  }

  build() {
    const p = this.g.player;
    const panel = $('inv-panel');
    panel.innerHTML = '';
    panel.className = 'panel ' + this.kind;
    this.refs = [];
    const grid = (cls, n) => { const d = document.createElement('div'); d.className = 'grid ' + cls; d.style.gridTemplateColumns = `repeat(${n}, var(--slot))`; return d; };
    const title = (t) => { const h = document.createElement('div'); h.className = 'ptitle'; h.textContent = t; panel.appendChild(h); };
    const slot = (ref, parent) => {
      const el = document.createElement('div');
      el.className = 'slot' + (ref.cls ? ' ' + ref.cls : '');
      ref.el = el;
      this.refs.push(ref);
      this.bindSlot(el, ref);
      parent.appendChild(el);
      return el;
    };
    const arr = (a, i, opts = {}) => ({ get: () => a[i], set: (v) => { a[i] = v; }, ...opts });
    const top = document.createElement('div');
    top.className = 'ptop';

    if (this.kind === 'creative') {
      title('Creative Inventory');
      const wrap = document.createElement('div');
      wrap.className = 'palette';
      const g = grid('', 9);
      for (const it of ITEMS) {
        if (!it || it.id === B.furnace_lit) continue;
        slot({ get: () => ({ id: it.id, count: 1 }), set: () => {}, palette: it.id }, g);
      }
      wrap.appendChild(g);
      panel.appendChild(wrap);
      const trash = document.createElement('div');
      trash.className = 'hint';
      trash.textContent = this.g.input.mode === 'touch' ? 'Tap an item to pick it up · tap the palette to delete what you hold' : 'Click to pick up · shift-click sends to hotbar · drop on palette to delete';
      panel.appendChild(trash);
    } else {
      if (this.kind === 'player' || this.kind === 'crafting') {
        title(this.kind === 'player' ? 'Crafting' : 'Crafting Table');
        const cg = grid('craft', this.craftN);
        for (let i = 0; i < this.craft.length; i++) slot(arr(this.craft, i, { craft: true }), cg);
        top.appendChild(cg);
        const ar = document.createElement('div'); ar.className = 'arrow'; top.appendChild(ar);
        const rg = grid('', 1);
        slot({ get: () => this.craftResult(), set: () => {}, result: true, cls: 'big' }, rg);
        top.appendChild(rg);
        panel.appendChild(top);
      } else if (this.kind === 'furnace') {
        title('Furnace');
        const te = this.te;
        const col = document.createElement('div'); col.className = 'fcol';
        const g1 = grid('', 1); slot(arr(te.slots, 0), g1); col.appendChild(g1);
        const fl = document.createElement('div'); fl.className = 'flame'; fl.innerHTML = '<i></i>'; col.appendChild(fl); this.flameEl = fl.firstChild;
        const g2 = grid('', 1); slot(arr(te.slots, 1, { accept: (s) => !!ITEMS[s.id].fuel }), g2); col.appendChild(g2);
        top.appendChild(col);
        const ar = document.createElement('div'); ar.className = 'arrow progress'; ar.innerHTML = '<i></i>'; top.appendChild(ar); this.arrowEl = ar.firstChild;
        const rg = grid('', 1); slot(arr(te.slots, 2, { takeOnly: true, cls: 'big' }), rg); top.appendChild(rg);
        panel.appendChild(top);
      } else if (this.kind === 'chest') {
        title('Chest');
        const g = grid('', 9);
        for (let i = 0; i < 27; i++) slot(arr(this.te.slots, i, { chest: true }), g);
        panel.appendChild(g);
      }
      const h = document.createElement('div'); h.className = 'ptitle small'; h.textContent = 'Inventory'; panel.appendChild(h);
      const main = grid('', 9);
      for (let i = 9; i < 36; i++) slot(arr(p.inv, i, { main: true }), main);
      panel.appendChild(main);
    }
    const hot = grid('hot', 9);
    for (let i = 0; i < 9; i++) slot(arr(p.inv, i, { hot: true }), hot);
    panel.appendChild(hot);
    const close = document.createElement('button');
    close.className = 'mc close-btn';
    close.textContent = 'Done';
    close.addEventListener('click', () => this.g.closeInventory());
    panel.appendChild(close);
    this.refresh();
  }

  craftResult() {
    if (this.kind !== 'player' && this.kind !== 'crafting') return null;
    const r = matchRecipe(this.craft.map((s) => (s ? s.id : 0)), this.craftN);
    if (!r) return null;
    const it = ITEMS[r.id];
    return it.durability ? { id: r.id, count: r.count, dur: it.durability } : { id: r.id, count: r.count };
  }

  bindSlot(el, ref) {
    let t0 = 0;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.pointerType === 'mouse') this.click(ref, e.button === 2 ? 2 : 0, e.shiftKey);
      else { t0 = performance.now(); this.moveCursor(e.clientX, e.clientY); }
    });
    el.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse') return;
      e.preventDefault();
      this.click(ref, performance.now() - t0 > 380 ? 2 : 0, false);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      const s = ref.get();
      if (s) { this.tooltip.textContent = ITEMS[s.id].display; this.tooltip.style.display = 'block'; }
    });
    el.addEventListener('pointerleave', () => { this.tooltip.style.display = 'none'; });
  }

  click(ref, button, shift) {
    const p = this.g.player;
    const cur = this.cursor;
    const s = ref.get();
    sfx.click();
    if (ref.palette) {
      if (cur) this.cursor = null;
      else if (shift) addToSlots(p.inv, this.full(ref.palette), 0, 9);
      else this.cursor = this.full(ref.palette);
      return this.refresh();
    }
    if (ref.result) {
      if (!s) return;
      if (shift) {
        // Craft as many as fit.
        for (let n = 0; n < 64; n++) {
          const r = this.craftResult();
          if (!r) break;
          if (addToSlots(p.inv, r, 0, 36, [...Array(27).keys()].map((i) => i + 9).concat([...Array(9).keys()])) > 0) break;
          this.consumeCraft();
        }
      } else {
        if (cur && (cur.id !== s.id || cur.count + s.count > maxStack(s.id))) return;
        this.cursor = cur ? { ...cur, count: cur.count + s.count } : s;
        this.consumeCraft();
      }
      return this.refresh();
    }
    if (shift && s) {
      this.quickMove(ref, s);
      return this.refresh();
    }
    if (ref.takeOnly) {
      if (!s) return;
      if (!cur) { this.cursor = s; ref.set(null); }
      else if (cur.id === s.id && cur.count + s.count <= maxStack(s.id)) { cur.count += s.count; ref.set(null); }
      if (this.kind === 'furnace') this.g.furnaceTaken(this.te, s);
      return this.refresh();
    }
    const accepts = (st) => !ref.accept || ref.accept(st);
    if (button === 0) {
      if (!cur) { if (s) { this.cursor = s; ref.set(null); } }
      else if (!s) { if (accepts(cur)) { ref.set(cur); this.cursor = null; } }
      else if (s.id === cur.id && maxStack(s.id) > 1) {
        const n = Math.min(cur.count, maxStack(s.id) - s.count);
        s.count += n; cur.count -= n;
        if (!cur.count) this.cursor = null;
      } else if (accepts(cur)) { ref.set(cur); this.cursor = s; }
    } else {
      if (!cur && s) {
        const half = Math.ceil(s.count / 2);
        this.cursor = { ...s, count: half };
        s.count -= half;
        if (!s.count) ref.set(null);
      } else if (cur && accepts(cur)) {
        if (!s) { ref.set({ ...cur, count: 1 }); cur.count--; }
        else if (s.id === cur.id && s.count < maxStack(s.id)) { s.count++; cur.count--; }
        if (cur.count <= 0) this.cursor = null;
      }
    }
    this.refresh();
  }

  full(id) {
    const it = ITEMS[id];
    return it.durability ? { id, count: 1, dur: it.durability } : { id, count: maxStack(id) };
  }

  consumeCraft() {
    for (let i = 0; i < this.craft.length; i++) {
      const s = this.craft[i];
      if (!s) continue;
      s.count--;
      if (s.count <= 0) this.craft[i] = null;
    }
  }

  quickMove(ref, s) {
    const p = this.g.player;
    let left;
    if (this.kind === 'creative') { ref.set(null); return; }
    if (ref.chest || ref.craft || ref.takeOnly || (this.kind === 'furnace' && !ref.hot && !ref.main)) {
      left = addToSlots(p.inv, s, 0, 36, [...Array(9).keys()].concat([...Array(27).keys()].map((i) => i + 9)));
    } else if (this.kind === 'chest') {
      left = addToSlots(this.te.slots, s);
    } else if (this.kind === 'furnace') {
      const ts = this.te.slots;
      if (SMELTING[ITEMS[s.id].name] && (!ts[0] || ts[0].id === s.id)) left = addToSlots(ts, s, 0, 1);
      else if (ITEMS[s.id].fuel && (!ts[1] || ts[1].id === s.id)) left = addToSlots(ts, s, 1, 2);
      else left = s.count;
    } else if (ref.hot) left = addToSlots(p.inv, s, 9, 36);
    else left = addToSlots(p.inv, s, 0, 9);
    if (left === s.count) return;
    if (left) s.count = left; else ref.set(null);
  }

  refresh() {
    for (const r of this.refs) {
      if (r.palette) { if (!r.el._k) this.renderSlot(r.el, { id: r.palette, count: 1 }); continue; }
      this.renderSlot(r.el, r.get());
    }
    this.renderCursor();
    this.updateHotbar();
    this.g.player.invDirty = true;
  }

  tick() {
    if (this.kind !== 'furnace' || !this.te) return;
    const te = this.te;
    if (this.flameEl) this.flameEl.style.height = (te.burn > 0 ? Math.max(0.05, te.burn / (te.burnMax || 1)) * 100 : 0) + '%';
    if (this.arrowEl) this.arrowEl.style.width = (te.cook / FURNACE_TIME) * 100 + '%';
    for (const r of this.refs) if (!r.palette) this.renderSlot(r.el, r.get());
  }

  renderCursor() {
    const el = $('cursor-item');
    if (!this.cursor) { el.style.display = 'none'; el._k = ''; return; }
    el.style.display = 'block';
    this.renderSlot(el, this.cursor);
  }

  moveCursor(x, y) {
    const el = $('cursor-item');
    el.style.transform = `translate(${x - 22}px, ${y - 22}px)`;
    if (this.tooltip && this.tooltip.style.display === 'block') this.tooltip.style.transform = `translate(${x + 14}px, ${y - 30}px)`;
  }

  // ---------- menus ----------
  show(id) {
    for (const m of document.querySelectorAll('.menu')) m.classList.add('hidden');
    if (id) $(id).classList.remove('hidden');
  }

  bindMenus() {
    const g = this.g;
    const on = (id, fn) => $(id).addEventListener('click', (e) => { e.preventDefault(); sfx.click(); fn(); });
    on('btn-single', () => { this.renderWorlds(); this.show('menu-worlds'); });
    on('btn-options-title', () => { this.optionsBack = 'menu-title'; this.renderOptions(); this.show('menu-options'); });
    on('btn-new-world', () => {
      $('world-name').value = 'New World';
      $('world-seed').value = '';
      this.newMode = 'survival';
      $('btn-mode').textContent = 'Game Mode: Survival';
      this.show('menu-create');
    });
    on('btn-worlds-back', () => this.show('menu-title'));
    on('btn-mode', () => {
      this.newMode = this.newMode === 'survival' ? 'creative' : 'survival';
      $('btn-mode').textContent = 'Game Mode: ' + (this.newMode === 'survival' ? 'Survival' : 'Creative');
    });
    on('btn-create', () => {
      const meta = store.createWorld($('world-name').value.trim() || 'New World', $('world-seed').value, this.newMode);
      g.startWorld(meta);
    });
    on('btn-create-back', () => this.show('menu-worlds'));
    on('btn-resume', () => g.resume());
    on('btn-options-pause', () => { this.optionsBack = 'menu-pause'; this.renderOptions(); this.show('menu-options'); });
    on('btn-quit', () => g.quitToTitle());
    on('btn-options-done', () => { this.show(this.optionsBack || 'menu-title'); g.applySettings(); store.saveSettings(g.settings); });
    on('btn-respawn', () => g.respawn());
    on('btn-death-quit', () => g.quitToTitle());
    on('btn-gamemode', () => g.toggleGameMode());
  }

  renderWorlds() {
    const list = $('world-list');
    list.innerHTML = '';
    const worlds = store.listWorlds();
    if (!worlds.length) {
      list.innerHTML = '<div class="empty">No worlds yet. Create one!</div>';
      return;
    }
    for (const w of worlds) {
      const row = document.createElement('div');
      row.className = 'world-row';
      const d = new Date(w.lastPlayed || w.created);
      row.innerHTML = `<div class="wname"></div><div class="wmeta"></div><button class="mc small del">Delete</button>`;
      row.querySelector('.wname').textContent = w.name;
      row.querySelector('.wmeta').textContent = `${w.mode === 'creative' ? 'Creative' : 'Survival'} · ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      row.addEventListener('click', (e) => {
        if (e.target.classList.contains('del')) return;
        sfx.click();
        this.g.startWorld(w);
      });
      row.querySelector('.del').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete "${w.name}"? This cannot be undone.`)) { store.deleteWorld(w.id); this.renderWorlds(); }
      });
      list.appendChild(row);
    }
  }

  renderOptions() {
    const s = this.g.settings;
    const box = $('options-list');
    box.innerHTML = '';
    const slider = (label, key, min, max, step, fmt) => {
      const row = document.createElement('label');
      row.className = 'opt';
      const span = document.createElement('span');
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = s[key];
      const upd = () => { span.textContent = `${label}: ${fmt(+inp.value)}`; };
      inp.addEventListener('input', () => { s[key] = +inp.value; upd(); this.g.applySettings(); });
      upd();
      row.appendChild(span); row.appendChild(inp);
      box.appendChild(row);
    };
    const cycle = (label, key, values, names) => {
      const b = document.createElement('button');
      b.className = 'mc';
      const upd = () => { b.textContent = `${label}: ${names[values.indexOf(s[key])] ?? s[key]}`; };
      b.addEventListener('click', () => { sfx.click(); s[key] = values[(values.indexOf(s[key]) + 1) % values.length]; upd(); this.g.applySettings(); });
      upd();
      box.appendChild(b);
    };
    slider('Render Distance', 'renderDistance', 2, 12, 1, (v) => `${v} chunks`);
    slider('FOV', 'fov', 50, 110, 1, (v) => (v === 70 ? 'Normal' : v));
    slider('Sensitivity', 'sensitivity', 0.2, 3, 0.05, (v) => Math.round(v * 100) + '%');
    slider('Brightness', 'gamma', 0, 1, 0.05, (v) => (v === 0 ? 'Moody' : v === 1 ? 'Bright' : Math.round(v * 100) + '%'));
    slider('Resolution', 'resolution', 0.4, 1, 0.05, (v) => Math.round(v * 100) + '%');
    slider('Volume', 'volume', 0, 1, 0.05, (v) => Math.round(v * 100) + '%');
    cycle('Difficulty', 'difficulty', ['peaceful', 'easy', 'normal', 'hard'], ['Peaceful', 'Easy', 'Normal', 'Hard']);
    cycle('Clouds', 'clouds', [true, false], ['On', 'Off']);
    cycle('View Bobbing', 'bobbing', [true, false], ['On', 'Off']);
    cycle('Show FPS', 'showFps', [false, true], ['Off', 'On']);
    cycle('Auto-Jump', 'autoJump', ['touch', 'always', 'off'], ['Touch only', 'Always', 'Off']);
  }
}

export { I, BLOCKS };
