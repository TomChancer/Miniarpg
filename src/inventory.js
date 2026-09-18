import { findFreeSpot } from './grid.js';
import { SLOTS, SLOT_CATEGORY, getBaseItem } from './equipment.js';
import { getGemById } from './gems.js';
import { getPlayerStatBonuses, getMapStatBonuses } from './progression.js';

// Cinder currency buys gear; Void currency buys skill gems. Shards are the
// common/base tier of each family, Fragments the rare tier — dropChance is
// the base per-roll chance before the character's Rarity stat scales it up
// (see combat.js). stackCap is how many sit in one inventory grid stack.
export const CURRENCIES = {
  cinderShard: { id: 'cinderShard', name: 'Cinder Shard', stackCap: 20, dropChance: 0.1, color: '#d8b054' },
  cinderFragment: { id: 'cinderFragment', name: 'Cinder Fragment', stackCap: 20, dropChance: 0.05, color: '#e0824f' },
  voidShard: { id: 'voidShard', name: 'Void Shard', stackCap: 20, dropChance: 0.05, color: '#7a6fe0' },
  voidFragment: { id: 'voidFragment', name: 'Void Fragment', stackCap: 20, dropChance: 0.0025, color: '#c14fe0' },
};

export const BASE_STATS = { strength: 5, vitality: 5, intelligence: 5, dexterity: 5, rarity: 0 };

const GENERAL_W = 6;
const GENERAL_H = 8;
const GEM_W = 5;
const GEM_H = 6;

// Bumped: gear is now rolled loot (per-instance sockets/affixes) instead of
// fixed purchasable defs, and the equipped shape grew from 3 slots to 10.
const STATE_KEY = 'miniarpg.inventory.v4';

function defaultState() {
  return {
    general: [], // { instanceId, kind: 'currency'|'equipment', defId, x, y, w, h, quantity?, sockets?, affixes? }
    gems: [], // { instanceId, defId, x, y, w:1, h:1 }
    equipped: Object.fromEntries(SLOTS.map((s) => [s, null])),
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

function placeInBag(s, item) {
  const spot = findFreeSpot(s.general, GENERAL_W, GENERAL_H, item.w, item.h);
  if (!spot) return false;
  item.x = spot.x;
  item.y = spot.y;
  s.general.push(item);
  return true;
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

export function getBalance(currencyId) {
  const s = load();
  return s.general
    .filter((it) => it.kind === 'currency' && it.defId === currencyId)
    .reduce((sum, it) => sum + it.quantity, 0);
}

export function addCurrency(currencyId, amount) {
  if (amount <= 0) return 0;
  const stackCap = CURRENCIES[currencyId].stackCap;
  const s = load();
  let remaining = amount;

  for (const it of s.general) {
    if (remaining <= 0) break;
    if (it.kind !== 'currency' || it.defId !== currencyId) continue;
    const space = stackCap - it.quantity;
    if (space <= 0) continue;
    const add = Math.min(space, remaining);
    it.quantity += add;
    remaining -= add;
  }

  while (remaining > 0) {
    const spot = findFreeSpot(s.general, GENERAL_W, GENERAL_H, 1, 1);
    if (!spot) break; // bag is full, remainder is lost
    const add = Math.min(stackCap, remaining);
    s.general.push({
      instanceId: makeId(),
      kind: 'currency',
      defId: currencyId,
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

export function spendCurrency(currencyId, amount) {
  const s = load();
  if (getBalance(currencyId) < amount) return false;
  let remaining = amount;
  for (const it of s.general) {
    if (remaining <= 0) break;
    if (it.kind !== 'currency' || it.defId !== currencyId) continue;
    const take = Math.min(it.quantity, remaining);
    it.quantity -= take;
    remaining -= take;
  }
  s.general = s.general.filter((it) => !(it.kind === 'currency' && it.defId === currencyId && it.quantity <= 0));
  save();
  return true;
}

// --- gems ---

export function addGem(defId) {
  const s = load();
  const spot = findFreeSpot(s.gems, GEM_W, GEM_H, 1, 1);
  if (!spot) return false;
  s.gems.push({ instanceId: makeId(), defId, x: spot.x, y: spot.y, w: 1, h: 1 });
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

// --- equipment (rolled loot instances, see loot.js) ---

export function addLootItem(item) {
  const s = load();
  const spot = findFreeSpot(s.general, GENERAL_W, GENERAL_H, item.w, item.h);
  if (!spot) return false;
  s.general.push({ ...item, instanceId: makeId(), x: spot.x, y: spot.y });
  save();
  return true;
}

export function equipItem(instanceId, targetSlot = null) {
  const s = load();
  const idx = s.general.findIndex((it) => it.instanceId === instanceId);
  if (idx === -1) return false;
  const item = s.general[idx];
  const base = getBaseItem(item.defId);

  let slot = targetSlot;
  if (!slot) {
    if (base.slotCategory === 'ring') slot = s.equipped.ring1 ? 'ring2' : 'ring1';
    else if (base.slotCategory === 'trinket') slot = s.equipped.trinket1 ? 'trinket2' : 'trinket1';
    else if (base.slotCategory === 'weapon') slot = 'weapon';
    else slot = base.slotCategory;
  }

  if (!SLOTS.includes(slot) || SLOT_CATEGORY[slot] !== base.slotCategory) return false;
  if (slot === 'offhand' && base.handedness !== 'one') return false;
  if (slot === 'offhand' && getBaseItem(s.equipped.weapon?.defId)?.handedness !== 'one') return false;
  if (slot === 'weapon' && base.handedness === 'two' && s.equipped.offhand) return false; // unequip offhand first

  const current = s.equipped[slot];
  s.general.splice(idx, 1);

  if (current && !placeInBag(s, current)) {
    s.general.splice(idx, 0, item); // no room to swap out the current piece — undo
    return false;
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
  if (!placeInBag(s, item)) return false;
  s.equipped[slot] = null;
  save();
  return true;
}

export function socketGem(slot, socketIndex, gemDefId) {
  const s = load();
  const item = s.equipped[slot];
  if (!item || item.sockets[socketIndex] !== null) return false;
  const gemDef = getGemById(gemDefId);
  const req = gemDef?.requirement;
  if (req && getTotalStats()[req.stat] < req.value) return false;
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
    bonus += item.affixes?.attackSpeedPct || 0;
  }
  return 1 + bonus;
}

// Weapon type sets the range multiplier applied to socketed (non-innate)
// skills; dual-wielding two one-handed weapons trades a damage penalty for
// the extra stat affixes and sockets of a second weapon.
export function getWeaponMods() {
  const s = load();
  const weapon = s.equipped.weapon;
  const offhand = s.equipped.offhand;
  const weaponBase = weapon ? getBaseItem(weapon.defId) : null;
  const offhandBase = offhand ? getBaseItem(offhand.defId) : null;
  const dualWielding = !!(weaponBase?.handedness === 'one' && offhandBase?.handedness === 'one');
  return {
    rangeMultiplier: weaponBase ? weaponBase.rangeMultiplier : 1,
    damageMultiplier: dualWielding ? 0.8 : 1,
  };
}

export function getTotalStats() {
  const s = load();
  const stats = { ...BASE_STATS };
  for (const slot of SLOTS) {
    const item = s.equipped[slot];
    if (!item) continue;
    for (const key of Object.keys(BASE_STATS)) {
      stats[key] += item.affixes?.[key] || 0;
    }
  }
  const playerBonuses = getPlayerStatBonuses();
  const mapBonuses = getMapStatBonuses();
  for (const key of Object.keys(BASE_STATS)) {
    stats[key] += (playerBonuses[key] || 0) + (mapBonuses[key] || 0);
  }
  return stats;
}

export function meetsRequirement(requirement) {
  if (!requirement) return true;
  return getTotalStats()[requirement.stat] >= requirement.value;
}
