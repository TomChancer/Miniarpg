import { getTree, getNode } from './talentTrees.js';

const STATE_KEY = 'miniarpg.progression.v1';

const STAT_KEYS = ['strength', 'vitality', 'intelligence', 'dexterity', 'rarity'];
const PLAYER_MULTIPLIER_KEYS = ['damageMultiplier', 'hpMultiplier', 'manaMultiplier', 'manaRegenMultiplier', 'speedMultiplierBonus'];
const MAP_MOD_KEYS = ['packSizePct', 'xpPct', 'spawnRatePct', 'enemyDamagePct'];

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

function collectNodeMods(treeId) {
  const tree = getTree(treeId);
  const stats = {};
  const mapMods = {};
  const playerMods = {};
  for (const nodeId of getAllocatedNodes(treeId)) {
    const node = tree.nodes[nodeId];
    if (!node || nodeId === 'start') continue;
    if (node.keystone) {
      for (const [key, value] of Object.entries(node.mods)) {
        if (STAT_KEYS.includes(key)) stats[key] = (stats[key] || 0) + value;
        else if (PLAYER_MULTIPLIER_KEYS.includes(key)) playerMods[key] = value;
        else if (MAP_MOD_KEYS.includes(key)) mapMods[key] = (mapMods[key] || 0) + value;
      }
    } else if (node.stat) {
      stats[node.stat] = (stats[node.stat] || 0) + node.amount;
    } else if (node.mod) {
      mapMods[node.mod] = (mapMods[node.mod] || 0) + node.amount;
    }
  }
  return { stats, mapMods, playerMods };
}

export function getPlayerStatBonuses() {
  return collectNodeMods('player').stats;
}

export function getMapStatBonuses() {
  return collectNodeMods('mapping').stats;
}

export function getPlayerKeystoneMods() {
  const mods = collectNodeMods('player').playerMods;
  return {
    damageMultiplier: mods.damageMultiplier || 1,
    hpMultiplier: mods.hpMultiplier || 1,
    manaMultiplier: mods.manaMultiplier || 1,
    manaRegenMultiplier: mods.manaRegenMultiplier || 1,
    speedMultiplierBonus: mods.speedMultiplierBonus || 0,
  };
}

export function getMapModifiers() {
  const mods = collectNodeMods('mapping').mapMods;
  return {
    packSizePct: mods.packSizePct || 0,
    xpPct: mods.xpPct || 0,
    spawnRatePct: mods.spawnRatePct || 0,
    enemyDamagePct: mods.enemyDamagePct || 0,
  };
}
