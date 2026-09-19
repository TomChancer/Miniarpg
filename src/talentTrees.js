// Both passive trees share the same shape: a free 'start' node at the
// center, with spokes of small nodes radiating outward. A node can only be
// allocated once something it's connected to is already allocated (chained
// back to 'start'). Regular nodes grant a flat `stat` bonus (folded into
// inventory.js getTotalStats) or a percentage `mod` (a map-run modifier, or
// — for the player tree's new defence branches — a global armour/evasion/
// barrier % consumed by inventory.js getDefenseStats). A spoke's trunk can
// end in either a single keystone, or FORK into two divergent paths that
// each end in their own keystone — a real build choice, not just more
// points spent in the same direction.
//
// Layout is generated rather than hand-placed so every spoke/fork stays
// evenly spaced and consistent.

const RADIUS_STEP = 70;
const RADIUS_START = 90;

function placeNode(treeNodes, id, angleRad, radius, prevId, extra) {
  treeNodes[id] = {
    id,
    x: Math.round(Math.cos(angleRad) * radius),
    y: Math.round(Math.sin(angleRad) * radius),
    cost: extra.keystone ? 2 : 1,
    connections: [prevId],
    ...extra,
  };
  treeNodes[prevId].connections.push(id);
  return id;
}

// Builds one straight chain of nodes at a fixed angle, starting at `radius`
// and stepping outward by RADIUS_STEP per node. Returns the last node's id
// and the radius the NEXT node in the chain would land on (so a fork can
// carry on from exactly where the trunk left off).
function buildChain(treeNodes, idPrefix, angleRad, radius, prevId, steps) {
  for (let i = 0; i < steps.length; i++) {
    const id = `${idPrefix}${i + 1}`;
    placeNode(treeNodes, id, angleRad, radius, prevId, steps[i]);
    prevId = id;
    radius += RADIUS_STEP;
  }
  return { lastId: prevId, nextRadius: radius };
}

function buildSpoke(treeNodes, spoke) {
  const angleRad = (spoke.angle * Math.PI) / 180;
  const { lastId, nextRadius } = buildChain(treeNodes, spoke.id, angleRad, RADIUS_START, 'start', spoke.steps);

  if (spoke.keystone) {
    placeNode(treeNodes, `${spoke.id}_keystone`, angleRad, nextRadius, lastId, { ...spoke.keystone, keystone: true });
  } else if (spoke.fork) {
    for (const branch of spoke.fork.branches) {
      const branchAngleRad = ((spoke.angle + branch.angleOffset) * Math.PI) / 180;
      const { lastId: branchLastId, nextRadius: branchNextRadius } = buildChain(
        treeNodes, `${spoke.id}_${branch.id}`, branchAngleRad, nextRadius, lastId, branch.steps
      );
      placeNode(treeNodes, `${spoke.id}_${branch.id}_keystone`, branchAngleRad, branchNextRadius, branchLastId, { ...branch.keystone, keystone: true });
    }
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

// Same idea as modSteps, but for the three defence globals (armourGlobalPct
// etc.), which — like their gear-affix counterparts — are stored as
// fractions (0.15 = 15%) rather than whole percents, so they sum directly
// with jewelry's own global % prefixes in inventory.js getDefenseStats.
function defenseModSteps(defenseKey, label, percentEach, count) {
  return Array.from({ length: count }, () => ({
    name: `+${percentEach}% Total ${label}`,
    mod: defenseKey,
    amount: percentEach / 100,
  }));
}

function makeTree(spokes) {
  const nodes = { start: { id: 'start', x: 0, y: 0, cost: 0, connections: [] } };
  for (const spoke of spokes) {
    buildSpoke(nodes, spoke);
  }
  return { start: 'start', nodes };
}

export const PLAYER_TREE = makeTree([
  {
    id: 'str', angle: -90, steps: statSteps('strength', 2, 3),
    fork: {
      branches: [
        {
          id: 'berserker', angleOffset: -22, steps: statSteps('strength', 2, 1),
          keystone: {
            name: "Berserker's Heart",
            description: '+40% damage dealt, -30% max HP',
            mods: { damageMultiplier: 1.4, hpMultiplier: 0.7 },
          },
        },
        {
          id: 'juggernaut', angleOffset: 22, steps: defenseModSteps('armourGlobalPct', 'Armour', 15, 1),
          keystone: {
            name: 'Juggernaut',
            description: '+120% Total Armour, -15% Attack Speed',
            mods: { armourGlobalPct: 1.2, speedMultiplierBonus: -0.15 },
          },
        },
      ],
    },
  },
  {
    id: 'vit', angle: -18,
    steps: [
      ...statSteps('vitality', 2, 4),
      { name: '+1% Max HP regenerated per second', mod: 'hpRegenPct', amount: 1 },
      { name: '+1% Max HP regenerated per second', mod: 'hpRegenPct', amount: 1 },
      { name: 'Pay 25% of skill mana costs as life instead', mod: 'manaCostAsLifePct', amount: 25 },
    ],
    keystone: {
      name: 'Blood Font',
      description: '+5% Max HP regenerated per second, -25% Max Mana',
      mods: { hpRegenPct: 5, manaMultiplier: 0.75 },
    },
  },
  {
    id: 'int', angle: 54, steps: statSteps('intelligence', 2, 3),
    fork: {
      branches: [
        {
          id: 'overcharge', angleOffset: -22, steps: defenseModSteps('barrierGlobalPct', 'Barrier', 15, 1),
          keystone: {
            name: 'Overcharge',
            description: '+150% Total Barrier, -25% max HP',
            mods: { barrierGlobalPct: 1.5, hpMultiplier: 0.75 },
          },
        },
        {
          id: 'mindward', angleOffset: 22, steps: defenseModSteps('barrierGlobalPct', 'Barrier', 15, 1),
          keystone: {
            name: 'Mind Ward',
            description: '+60% Total Barrier, +60% Total Evasion, -20% max Mana',
            mods: { barrierGlobalPct: 0.6, evasionGlobalPct: 0.6, manaMultiplier: 0.8 },
          },
        },
      ],
    },
  },
  {
    id: 'dex', angle: 126, steps: [...statSteps('dexterity', 2, 4), ...defenseModSteps('evasionGlobalPct', 'Evasion', 15, 1)],
    keystone: {
      name: 'Phase Skin',
      description: '+120% Total Evasion, -25% max HP',
      mods: { evasionGlobalPct: 1.2, hpMultiplier: 0.75 },
    },
  },
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
  { id: 'tough', angle: 198, steps: modSteps('monsterToughnessPct', 'Monster Toughness', 3, 4) },
]);

export const TREES = { player: PLAYER_TREE, mapping: MAPPING_TREE };

export function getTree(treeId) {
  return TREES[treeId];
}

export function getNode(treeId, nodeId) {
  return TREES[treeId].nodes[nodeId];
}
