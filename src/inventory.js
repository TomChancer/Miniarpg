import { findFreeSpot } from './grid.js';
import { getEquipmentDef, SLOTS } from './equipment.js';

export const CURRENCY = { id: 'cinderShards', name: 'Cinder Shards', stackCap: 20 };

const GENERAL_W = 6;
const GENERAL_H = 8;
const GEM_W = 5;
const GEM_H = 6;

const STATE_KEY = 'miniarpg.inventory.v1';

function defaultState() {
  return {
    general: [], // { instanceId, kind: 'currency'|'equipment', defId, x, y, w, h, quantity?, sockets? }
    gems: [], // { instanceId, defId, x, y }  (always 1x1)
    equipped: { helmet: null, chest: null, boots: null },
  };
}

let cachedState = null;
let nextInstanceId = 1;

function load() {
  if (cachedState) return cachedState;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    cachedState = raw ? JSON.parse(raw) : defaultState();
  } catch {
    cachedState = defaultState();
  }
  const allIds = [
    ...cachedState.general.map((i) => i.instanceId),
    ...cachedState.gems.map((i) => i.instanceId),
    ...SLOTS.map((s) => cachedState.equipped[s]?.instanceId).filter(Boolean),
  ];
  nextInstanceId = allIds.length ? Math.max(...allIds) + 1 : 1;
  return cachedState;
}

function save() {
  localStorage.setItem(STATE_KEY, JSON.stringify(cachedState));
}

function makeId() {
  return nextInstanceId++;
}

export function getGeneralGrid() {
  const s = load();
  return { w: GENERAL_W, h: GENERAL_H, items: s.general };
}

export function getGemGrid() {
  const s = load();
  return { w: GEM_W, h: GEM_H, items: s.gems };
}

export function getEquipped() {
  return load().equipped;
}

// --- currency ---

export function getBalance() {
  const s = load();
  return s.general
    .filter((it) => it.kind === 'currency')
    .reduce((sum, it) => sum + it.quantity, 0);
}

export function addCurrency(amount) {
  if (amount <= 0) return 0;
  const s = load();
  let remaining = amount;

  for (const it of s.general) {
    if (remaining <= 0) break;
    if (it.kind !== 'currency') continue;
    const space = CURRENCY.stackCap - it.quantity;
    if (space <= 0) continue;
    const add = Math.min(space, remaining);
    it.quantity += add;
    remaining -= add;
  }

  while (remaining > 0) {
    const spot = findFreeSpot(s.general, GENERAL_W, GENERAL_H, 1, 1);
    if (!spot) break; // bag is full, remainder is lost
    const add = Math.min(CURRENCY.stackCap, remaining);
    s.general.push({
      instanceId: makeId(),
      kind: 'currency',
      defId: CURRENCY.id,
      x: spot.x,
      y: spot.y,
      w: 1,
      h: 1,
      quantity: add,
    });
    remaining -= add;
  }

  save();
  return amount - remaining;
}

export function spendCurrency(amount) {
  const s = load();
  if (getBalance() < amount) return false;
  let remaining = amount;
  for (const it of s.general) {
    if (remaining <= 0) break;
    if (it.kind !== 'currency') continue;
    const take = Math.min(it.quantity, remaining);
    it.quantity -= take;
    remaining -= take;
  }
  s.general = s.general.filter((it) => !(it.kind === 'currency' && it.quantity <= 0));
  save();
  return true;
}

// --- gems ---

export function addGem(defId) {
  const s = load();
  const spot = findFreeSpot(s.gems, GEM_W, GEM_H, 1, 1);
  if (!spot) return false;
  s.gems.push({ instanceId: makeId(), defId, x: spot.x, y: spot.y });
  save();
  return true;
}

function removeOneGemByDef(defId) {
  const s = load();
  const idx = s.gems.findIndex((g) => g.defId === defId);
  if (idx === -1) return false;
  s.gems.splice(idx, 1);
  save();
  return true;
}

// --- equipment ---

export function buyEquipment(defId) {
  const def = getEquipmentDef(defId);
  const s = load();
  const spot = findFreeSpot(s.general, GENERAL_W, GENERAL_H, def.shape.w, def.shape.h);
  if (!spot) return false;
  s.general.push({
    instanceId: makeId(),
    kind: 'equipment',
    defId,
    x: spot.x,
    y: spot.y,
    w: def.shape.w,
    h: def.shape.h,
    sockets: new Array(def.sockets).fill(null),
  });
  save();
  return true;
}

export function equipItem(instanceId) {
  const s = load();
  const idx = s.general.findIndex((it) => it.instanceId === instanceId);
  if (idx === -1) return false;
  const item = s.general[idx];
  const def = getEquipmentDef(item.defId);
  const slot = def.slot;
  const current = s.equipped[slot];

  s.general.splice(idx, 1);

  if (current) {
    const spot = findFreeSpot(s.general, GENERAL_W, GENERAL_H, current.w, current.h);
    if (!spot) {
      s.general.splice(idx, 0, item);
      return false;
    }
    current.x = spot.x;
    current.y = spot.y;
    s.general.push(current);
  }

  delete item.x;
  delete item.y;
  s.equipped[slot] = item;
  save();
  return true;
}

export function unequipItem(slot) {
  const s = load();
  const item = s.equipped[slot];
  if (!item) return false;
  const spot = findFreeSpot(s.general, GENERAL_W, GENERAL_H, item.w, item.h);
  if (!spot) return false;
  item.x = spot.x;
  item.y = spot.y;
  s.general.push(item);
  s.equipped[slot] = null;
  save();
  return true;
}

export function socketGem(slot, socketIndex, gemDefId) {
  const s = load();
  const item = s.equipped[slot];
  if (!item || item.sockets[socketIndex] !== null) return false;
  if (!removeOneGemByDef(gemDefId)) return false;
  item.sockets[socketIndex] = gemDefId;
  save();
  return true;
}

export function unsocketGem(slot, socketIndex) {
  const s = load();
  const item = s.equipped[slot];
  if (!item || !item.sockets[socketIndex]) return false;
  const defId = item.sockets[socketIndex];
  if (!addGem(defId)) return false;
  item.sockets[socketIndex] = null;
  save();
  return true;
}

export function discardItem(kind, instanceId) {
  const s = load();
  if (kind === 'gem') {
    s.gems = s.gems.filter((g) => g.instanceId !== instanceId);
  } else {
    s.general = s.general.filter((it) => it.instanceId !== instanceId);
  }
  save();
}

// --- combat-facing derived stats ---

export function getSocketedGemDefIds() {
  const s = load();
  const ids = [];
  for (const slot of SLOTS) {
    const item = s.equipped[slot];
    if (!item) continue;
    for (const gemId of item.sockets) {
      if (gemId) ids.push(gemId);
    }
  }
  return ids;
}

export function getSpeedMultiplier() {
  const s = load();
  let bonus = 0;
  for (const slot of SLOTS) {
    const item = s.equipped[slot];
    if (!item) continue;
    const def = getEquipmentDef(item.defId);
    bonus += def.stats?.attackSpeedPct || 0;
  }
  return 1 + bonus;
}
