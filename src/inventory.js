import { findFreeSpot } from './grid.js';
import { SLOTS, SLOT_CATEGORY, getBaseItem } from './equipment.js';
import { getGemById } from './gems.js';
import { getPlayerStatBonuses, getMapStatBonuses } from './progression.js';
import { pickAffixType, pickMissingType, rollOneAffix, itemValue } from './loot.js';

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

// Bumped: gear items now carry a `tier` (Basic/Uncommon/Rare/Unique) driving
// their affix caps.
const STATE_KEY = 'miniarpg.inventory.v5';

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

// --- crafting & selling (bag items only — unequip first to craft or sell) ---

function findBagGear(s, instanceId) {
  return s.general.find((it) => it.instanceId === instanceId && it.kind === 'equipment');
}

// Cinder Shard: adds one random affix of whichever type still has room,
// gated by the item's current tier cap and its base item actually offering
// an unused stat of that type. Unique items (once they exist) can never be
// crafted on.
export function canAddAffix(instanceId) {
  const s = load();
  const item = findBagGear(s, instanceId);
  if (!item || item.tier === 'unique') return false;
  return pickAffixType(item, getBaseItem(item.defId), item.tier) !== null;
}

export function addRandomAffix(instanceId) {
  const s = load();
  const item = findBagGear(s, instanceId);
  if (!item || item.tier === 'unique') return false;
  const base = getBaseItem(item.defId);
  const type = pickAffixType(item, base, item.tier);
  if (!type) return false;
  const rolled = rollOneAffix(base, type, item.affixes);
  if (!rolled) return false;
  if (!spendCurrency('cinderShard', 1)) return false;
  item.affixes[rolled.stat] = rolled.amount;
  save();
  return true;
}

// Cinder Fragment: Basic -> Uncommon, adding whichever affix type the item
// is missing so it lands at 2/2.
export function upgradeTierWithFragment(instanceId) {
  const s = load();
  const item = findBagGear(s, instanceId);
  if (!item || item.tier !== 'basic') return false;
  const base = getBaseItem(item.defId);
  const type = pickMissingType(item, base);
  const rolled = type ? rollOneAffix(base, type, item.affixes) : null;
  if (!spendCurrency('cinderFragment', 1)) return false;
  if (rolled) item.affixes[rolled.stat] = rolled.amount;
  item.tier = 'uncommon';
  save();
  return true;
}

// Cinder Shard: Uncommon -> Rare, adding 1 of whichever affix type is
// missing — the item lands at 3/4, not automatically filled out to 4/4.
export function upgradeTierWithShard(instanceId) {
  const s = load();
  const item = findBagGear(s, instanceId);
  if (!item || item.tier !== 'uncommon') return false;
  const base = getBaseItem(item.defId);
  const type = pickMissingType(item, base);
  const rolled = type ? rollOneAffix(base, type, item.affixes) : null;
  if (!spendCurrency('cinderShard', 1)) return false;
  if (rolled) item.affixes[rolled.stat] = rolled.amount;
  item.tier = 'rare';
  save();
  return true;
}

// Sells a bag item back for ~33% of its rolled value, credited as Cinder Shards.
export function sellItem(instanceId) {
  const s = load();
  const idx = s.general.findIndex((it) => it.instanceId === instanceId && it.kind === 'equipment');
  if (idx === -1) return false;
  const item = s.general[idx];
  const payout = Math.round(itemValue(item) * 0.33);
  s.general.splice(idx, 1);
  save();
  addCurrency('cinderShard', payout);
  return payout;
}

// --- combat-facing derived stats ---

// One array of gem ids per equipped item that has at least one filled
// socket — combat.js needs items kept separate (not flattened) because a
// support gem only links to skill gems sharing sockets on the SAME item.
export function getSocketedGemGroups() {
  const s = load();
  const groups = [];
  for (const slot of SLOTS) {
    const item = s.equipped[slot];
    if (!item) continue;
    const ids = item.sockets.filter(Boolean);
    if (ids.length > 0) groups.push(ids);
  }
  return groups;
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

// How much of each defence type a point of its "tied" attribute grants,
// on top of whatever gear rolls -- Armour~Strength, Evasion~Dexterity,
// Barrier~Intelligence, mirroring how those attributes already feed HP/mana.
const ARMOUR_PER_STRENGTH = 2;
const EVASION_PER_DEXTERITY = 2;
const BARRIER_PER_INTELLIGENCE = 3;
const DEFENSE_TYPES = ['armour', 'evasion', 'barrier'];

// Local flat/% defensive prefixes only ever roll on armor-slot pieces (see
// equipment.js), and scale that SAME piece's own defenseBase: (defenseBase +
// Flat) * (1 + Pct). Jewelry's GlobalPct prefixes instead scale the whole
// character's final total for that defence type, checked across every slot.
export function getDefenseStats() {
  const s = load();
  const local = { armour: 0, evasion: 0, barrier: 0 };
  const globalPct = { armour: 0, evasion: 0, barrier: 0 };

  for (const slot of SLOTS) {
    const item = s.equipped[slot];
    if (!item) continue;
    const base = getBaseItem(item.defId);
    if (base.defenseBase) {
      for (const key of DEFENSE_TYPES) {
        const flat = base.defenseBase[key] + (item.affixes?.[`${key}Flat`] || 0);
        const pctMul = 1 + (item.affixes?.[`${key}Pct`] || 0);
        local[key] += flat * pctMul;
      }
    }
    for (const key of DEFENSE_TYPES) {
      globalPct[key] += item.affixes?.[`${key}GlobalPct`] || 0;
    }
  }

  const stats = getTotalStats();
  return {
    armour: (local.armour + stats.strength * ARMOUR_PER_STRENGTH) * (1 + globalPct.armour),
    evasion: (local.evasion + stats.dexterity * EVASION_PER_DEXTERITY) * (1 + globalPct.evasion),
    barrierCapacity: (local.barrier + stats.intelligence * BARRIER_PER_INTELLIGENCE) * (1 + globalPct.barrier),
  };
}

export function meetsRequirement(requirement) {
  if (!requirement) return true;
  return getTotalStats()[requirement.stat] >= requirement.value;
}
