import { getBaseItem } from './equipment.js';

// Chance of rolling the Nth socket, given the (N-1)th was already rolled.
// Shared by every slot and weapon regardless of its cap — "exceptionally
// more rare beyond the third" is the steep drop after index 2.
const SOCKET_STEP_CHANCE = [0.6, 0.45, 0.3, 0.08, 0.04, 0.02];

export function rollSocketCount(cap) {
  let count = 0;
  for (let i = 0; i < cap; i++) {
    if (Math.random() < SOCKET_STEP_CHANCE[i]) count += 1;
    else break;
  }
  return count;
}

function rollInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function rollAffixes(statPool) {
  const affixCount = Math.random() < 0.6 ? 1 : 2;
  const distinctStats = [...new Set(statPool.map((entry) => entry.stat))];
  const chosenStats = [];
  while (chosenStats.length < Math.min(affixCount, distinctStats.length)) {
    const entry = statPool[Math.floor(Math.random() * statPool.length)];
    if (!chosenStats.includes(entry.stat)) chosenStats.push(entry.stat);
  }

  const affixes = {};
  for (const stat of chosenStats) {
    const candidates = statPool.filter((entry) => entry.stat === stat);
    const { min, max } = candidates[Math.floor(Math.random() * candidates.length)];
    const rolled = rollInt(min, max);
    affixes[stat] = stat === 'attackSpeedPct' ? rolled / 100 : rolled;
  }
  return affixes;
}

// Produces an unplaced item shape — no instanceId/x/y yet, those are
// assigned by inventory.js when it's actually placed in the bag.
export function generateLootItem(baseId) {
  const base = getBaseItem(baseId);
  const sockets = new Array(rollSocketCount(base.socketCap)).fill(null);
  return {
    kind: 'equipment',
    defId: baseId,
    w: base.shape.w,
    h: base.shape.h,
    sockets,
    affixes: rollAffixes(base.statPool),
  };
}
