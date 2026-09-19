import { MAPS, ROOT_MAP_ID } from './maps.js';

// Which maps the player has cleared at least once — the only thing that
// gates unlocking the next node(s) in the map tree. Separate from maps.js
// (static tree shape) the same way progression.js is separate from
// talentTrees.js (static tree shape vs dynamic allocation state).
const STATE_KEY = 'miniarpg.mapProgress.v1';

function defaultState() {
  return { cleared: [] };
}

let cached = null;

function load() {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    cached = raw ? JSON.parse(raw) : defaultState();
  } catch {
    cached = defaultState();
  }
  return cached;
}

function save() {
  localStorage.setItem(STATE_KEY, JSON.stringify(cached));
}

export function getClearedMaps() {
  return load().cleared;
}

export function isCleared(mapId) {
  return load().cleared.includes(mapId);
}

export function markCleared(mapId) {
  const s = load();
  if (!s.cleared.includes(mapId)) {
    s.cleared.push(mapId);
    save();
  }
}

// The root is always open; anything else needs at least one of the maps it
// connects back to already cleared.
export function isUnlocked(mapId) {
  if (mapId === ROOT_MAP_ID) return true;
  const def = MAPS[mapId];
  if (!def) return false;
  return def.connections.some((id) => isCleared(id));
}
