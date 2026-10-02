// localStorage persistence for worlds and settings. Every access is guarded:
// private browsing or a full quota must never crash the game.

const INDEX = 'blockcraft.worlds';
const SETTINGS = 'blockcraft.settings';

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn('Save failed', e);
    return false;
  }
}

export function listWorlds() {
  return read(INDEX, []).sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
}

export function createWorld(name, seedText, mode) {
  let seed;
  if (seedText && seedText.trim()) {
    const t = seedText.trim();
    seed = /^-?\d+$/.test(t) ? parseInt(t, 10) | 0 : [...t].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
  } else seed = (Math.random() * 2 ** 31) | 0;
  const meta = { id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name || 'New World', seed, mode, created: Date.now(), lastPlayed: Date.now() };
  const list = read(INDEX, []);
  list.push(meta);
  write(INDEX, list);
  return meta;
}

export function touchWorld(id, patch = {}) {
  const list = read(INDEX, []);
  const w = list.find((x) => x.id === id);
  if (w) { Object.assign(w, patch, { lastPlayed: Date.now() }); write(INDEX, list); }
}

export function loadWorldData(id) { return read('blockcraft.world.' + id, null); }
export function saveWorldData(id, data) { return write('blockcraft.world.' + id, data); }

export function deleteWorld(id) {
  write(INDEX, read(INDEX, []).filter((w) => w.id !== id));
  try { localStorage.removeItem('blockcraft.world.' + id); } catch (e) { /* ignore */ }
}

export function loadSettings(defaults) { return { ...defaults, ...read(SETTINGS, {}) }; }
export function saveSettings(s) { write(SETTINGS, s); }
