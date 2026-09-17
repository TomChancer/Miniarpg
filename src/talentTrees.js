// Both passive trees share the same shape: a free 'start' node at the
// center, with spokes of small nodes radiating outward. A node can only be
// allocated once something it's connected to is already allocated (chained
// back to 'start'). Regular nodes grant a flat `stat` bonus (folded into
// inventory.js getTotalStats) or a percentage `mod` (a map-run modifier
// consumed directly by combat.js). One node per tree is a keystone: a much
// bigger, build-defining effect with a real drawback, gated behind its
// whole spoke.
//
// Layout is generated rather than hand-placed so every spoke stays evenly
// spaced and consistent.

const RADIUS_STEP = 70;
const RADIUS_START = 90;
const KEYSTONE_RADIUS = 370;

function buildSpoke(treeNodes, spokeId, angleDeg, steps, keystone) {
  const rad = (angleDeg * Math.PI) / 180;
  let prevId = 'start';
  for (let i = 0; i < steps.length; i++) {
    const id = `${spokeId}${i + 1}`;
    const radius = RADIUS_START + i * RADIUS_STEP;
    treeNodes[id] = {
      id,
      x: Math.round(Math.cos(rad) * radius),
      y: Math.round(Math.sin(rad) * radius),
      cost: 1,
      connections: [prevId],
      ...steps[i],
    };
    treeNodes[prevId].connections.push(id);
    prevId = id;
  }
  if (keystone) {
    const id = `${spokeId}_keystone`;
    treeNodes[id] = {
      id,
      x: Math.round(Math.cos(rad) * KEYSTONE_RADIUS),
      y: Math.round(Math.sin(rad) * KEYSTONE_RADIUS),
      cost: 2,
      keystone: true,
      connections: [prevId],
      ...keystone,
    };
    treeNodes[prevId].connections.push(id);
  }
}

function statSteps(stat, amount, count) {
  return Array.from({ length: count }, () => ({
    name: `+${amount} ${stat[0].toUpperCase()}${stat.slice(1)}`,
    stat,
    amount,
  }));
}

function modSteps(mod, label, amount, count) {
  return Array.from({ length: count }, () => ({
    name: `+${amount}% ${label}`,
    mod,
    amount,
  }));
}

function makeTree(spokes) {
  const nodes = { start: { id: 'start', x: 0, y: 0, cost: 0, connections: [] } };
  for (const spoke of spokes) {
    buildSpoke(nodes, spoke.id, spoke.angle, spoke.steps, spoke.keystone);
  }
  return { start: 'start', nodes };
}

export const PLAYER_TREE = makeTree([
  { id: 'str', angle: -90, steps: statSteps('strength', 2, 4), keystone: {
    name: "Berserker's Heart",
    description: '+40% damage dealt, -30% max HP',
    mods: { damageMultiplier: 1.4, hpMultiplier: 0.7 },
  } },
  { id: 'vit', angle: -18, steps: statSteps('vitality', 2, 4) },
  { id: 'int', angle: 54, steps: statSteps('intelligence', 2, 4) },
  { id: 'dex', angle: 126, steps: statSteps('dexterity', 2, 4) },
  { id: 'rar', angle: 198, steps: statSteps('rarity', 2, 4) },
]);

export const MAPPING_TREE = makeTree([
  { id: 'pack', angle: -90, steps: modSteps('packSizePct', 'Pack Size', 5, 4), keystone: {
    name: 'Overrun',
    description: '+50% Pack Size, +30 Rarity, but enemies deal +25% damage',
    mods: { packSizePct: 50, rarity: 30, enemyDamagePct: 25 },
  } },
  { id: 'rar', angle: -18, steps: statSteps('rarity', 3, 4) },
  { id: 'xp', angle: 54, steps: modSteps('xpPct', 'Fortune', 8, 4) },
  { id: 'haste', angle: 126, steps: modSteps('spawnRatePct', 'Haste', 5, 4) },
  { id: 'vit', angle: 198, steps: statSteps('vitality', 3, 4) },
]);

export const TREES = { player: PLAYER_TREE, mapping: MAPPING_TREE };

export function getTree(treeId) {
  return TREES[treeId];
}

export function getNode(treeId, nodeId) {
  return TREES[treeId].nodes[nodeId];
}
