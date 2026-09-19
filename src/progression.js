import { getTree, getNode } from './talentTrees.js';

// Bumped: the player tree's STR/INT spokes now fork into keystone choices,
// and DEX gained a keystone of its own — old saves' allocated node ids
// (e.g. the old single 'str_keystone') no longer exist.
const STATE_KEY = 'miniarpg.progression.v3';

const STAT_KEYS = ['strength', 'vitality', 'intelligence', 'dexterity', 'rarity'];
const PLAYER_MULTIPLIER_KEYS = ['damageMultiplier', 'hpMultiplier', 'manaMultiplier', 'manaRegenMultiplier', 'speedMultiplierBonus'];
// Additive player-tree percentages, distinct from the multiplicative keys
// above (those start at 1 and stack by multiplying; these start at 0 and
// stack by summing, like the mapping tree's own MAP_MOD_KEYS).
const PLAYER_ADDITIVE_KEYS = ['hpRegenPct', 'manaCostAsLifePct'];
const MAP_MOD_KEYS = ['packSizePct', 'xpPct', 'spawnRatePct', 'enemyDamagePct', 'monsterToughnessPct'];
// The player tree's defence branches grant these as fractions (0.15 = 15%),
// matching gear's own GlobalPct affix convention -- see inventory.js
// getDefenseStats, which sums this straight in alongside jewelry's own.
const DEFENSE_MOD_KEYS = ['armourGlobalPct', 'evasionGlobalPct', 'barrierGlobalPct'];

function defaultState() {
  return {
    level: 1,
    xp: 0,
    totalPlayerPoints: 0,
    totalMappingPoints: 0,
    allocated: { player: ['start'], mapping: ['start'] },
  };
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

// PoE-style escalating curve: XP required climbs steeply with level.
export function xpToNext(level) {
  return Math.round(20 * Math.pow(level, 2.2));
}

export function getLevel() {
  return load().level;
}

export function getXp() {
  return load().xp;
}

export function addXp(amount) {
  if (amount <= 0) return { levelsGained: 0 };
  const s = load();
  s.xp += amount;
  let levelsGained = 0;
  while (s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level += 1;
    s.totalPlayerPoints += 1;
    levelsGained += 1;
  }
  save();
  return { levelsGained, level: s.level };
}

export function awardMappingPoint() {
  const s = load();
  s.totalMappingPoints += 1;
  save();
}

function spentPoints(treeId) {
  const s = load();
  return s.allocated[treeId].reduce((sum, id) => sum + (getNode(treeId, id)?.cost || 0), 0);
}

export function getAvailablePoints(treeId) {
  const s = load();
  const total = treeId === 'player' ? s.totalPlayerPoints : s.totalMappingPoints;
  return total - spentPoints(treeId);
}

export function getAllocatedNodes(treeId) {
  return load().allocated[treeId];
}

export function isAllocated(treeId, nodeId) {
  return load().allocated[treeId].includes(nodeId);
}

export function canAllocate(treeId, nodeId) {
  const s = load();
  if (s.allocated[treeId].includes(nodeId)) return false;
  const node = getNode(treeId, nodeId);
  if (!node) return false;
  if (getAvailablePoints(treeId) < node.cost) return false;
  return node.connections.some((c) => s.allocated[treeId].includes(c));
}

export function allocateNode(treeId, nodeId) {
  if (!canAllocate(treeId, nodeId)) return false;
  const s = load();
  s.allocated[treeId].push(nodeId);
  save();
  return true;
}

export function resetTree(treeId) {
  const s = load();
  s.allocated[treeId] = ['start'];
  save();
}

// speedMultiplierBonus is additive (it's already an additive term where it's
// consumed — see combat.js); the other three keystone multipliers stack
// multiplicatively, since the player tree can now grant more than one
// keystone at once (e.g. a STR-fork keystone alongside DEX's Phase Skin).
function applyPlayerMod(playerMods, key, value) {
  if (key === 'speedMultiplierBonus') playerMods[key] = (playerMods[key] || 0) + value;
  else playerMods[key] = (playerMods[key] ?? 1) * value;
}

function collectNodeMods(treeId) {
  const tree = getTree(treeId);
  const stats = {};
  const mapMods = {};
  const playerMods = {};
  const defenseMods = {};
  const additiveMods = {};
  for (const nodeId of getAllocatedNodes(treeId)) {
    const node = tree.nodes[nodeId];
    if (!node || nodeId === 'start') continue;
    if (node.keystone) {
      for (const [key, value] of Object.entries(node.mods)) {
        if (STAT_KEYS.includes(key)) stats[key] = (stats[key] || 0) + value;
        else if (PLAYER_MULTIPLIER_KEYS.includes(key)) applyPlayerMod(playerMods, key, value);
        else if (PLAYER_ADDITIVE_KEYS.includes(key)) additiveMods[key] = (additiveMods[key] || 0) + value;
        else if (DEFENSE_MOD_KEYS.includes(key)) defenseMods[key] = (defenseMods[key] || 0) + value;
        else if (MAP_MOD_KEYS.includes(key)) mapMods[key] = (mapMods[key] || 0) + value;
      }
    } else if (node.stat) {
      stats[node.stat] = (stats[node.stat] || 0) + node.amount;
    } else if (DEFENSE_MOD_KEYS.includes(node.mod)) {
      defenseMods[node.mod] = (defenseMods[node.mod] || 0) + node.amount;
    } else if (PLAYER_ADDITIVE_KEYS.includes(node.mod)) {
      additiveMods[node.mod] = (additiveMods[node.mod] || 0) + node.amount;
    } else if (node.mod) {
      mapMods[node.mod] = (mapMods[node.mod] || 0) + node.amount;
    }
  }
  return { stats, mapMods, playerMods, defenseMods, additiveMods };
}

export function getPlayerStatBonuses() {
  return collectNodeMods('player').stats;
}

export function getMapStatBonuses() {
  return collectNodeMods('mapping').stats;
}

// The player tree's defence-branch nodes/keystones, as fractions -- summed
// directly into inventory.js getDefenseStats alongside jewelry's own
// GlobalPct affixes.
export function getPlayerDefenseBonuses() {
  const mods = collectNodeMods('player').defenseMods;
  return {
    armourGlobalPct: mods.armourGlobalPct || 0,
    evasionGlobalPct: mods.evasionGlobalPct || 0,
    barrierGlobalPct: mods.barrierGlobalPct || 0,
  };
}

export function getPlayerKeystoneMods() {
  const { playerMods: mods, additiveMods: additive } = collectNodeMods('player');
  return {
    damageMultiplier: mods.damageMultiplier || 1,
    hpMultiplier: mods.hpMultiplier || 1,
    manaMultiplier: mods.manaMultiplier || 1,
    manaRegenMultiplier: mods.manaRegenMultiplier || 1,
    speedMultiplierBonus: mods.speedMultiplierBonus || 0,
    hpRegenPct: additive.hpRegenPct || 0,
    manaCostAsLifePct: additive.manaCostAsLifePct || 0,
  };
}

export function getMapModifiers() {
  const mods = collectNodeMods('mapping').mapMods;
  return {
    packSizePct: mods.packSizePct || 0,
    xpPct: mods.xpPct || 0,
    spawnRatePct: mods.spawnRatePct || 0,
    enemyDamagePct: mods.enemyDamagePct || 0,
    monsterToughnessPct: mods.monsterToughnessPct || 0,
  };
}
