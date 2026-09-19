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

// Unique is reserved but not generated yet — no unique base items exist, and
// uniques can never be crafted on once they do. Rare's cap can later be
// extended to 6 (3 prefix/3 suffix) as a costlier crafting step; for now it
// stays capped at 4.
export const TIERS = ['basic', 'uncommon', 'rare', 'unique'];
export const TIER_AFFIX_CAPS = {
  basic: { total: 1, prefix: 1, suffix: 1 },
  uncommon: { total: 2, prefix: 1, suffix: 1 },
  rare: { total: 4, prefix: 2, suffix: 2 },
  unique: { total: 6, prefix: 3, suffix: 3 },
};

// Natural drop odds. Merchant stock rolls the same table but with 'uncommon'
// passed as maxTier, so Rare (and Unique, once it exists) never shows up in
// the shop.
function rollTier(maxTier = 'rare') {
  const roll = Math.random();
  if (maxTier === 'basic') return 'basic';
  if (maxTier === 'uncommon') return roll < 0.75 ? 'basic' : 'uncommon';
  if (roll < 0.7) return 'basic';
  if (roll < 0.95) return 'uncommon';
  return 'rare';
}

function rollInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function hasAvailableStat(base, type, existingAffixes) {
  return base.statPool.some((e) => e.type === type && !(e.stat in existingAffixes));
}

// How many affixes of each type an item currently carries, per its base
// template's prefix/suffix tagging.
export function affixCounts(item, base) {
  const counts = { prefix: 0, suffix: 0 };
  for (const stat of Object.keys(item.affixes)) {
    const entry = base.statPool.find((e) => e.stat === stat);
    if (entry) counts[entry.type] += 1;
  }
  return counts;
}

// Which affix type (if any) still has room on this item, both against its
// tier's per-type cap and against the base item actually offering an
// unused stat of that type. Returns null when nothing more can be added.
export function pickAffixType(item, base, tier) {
  const caps = TIER_AFFIX_CAPS[tier];
  const counts = affixCounts(item, base);
  if (counts.prefix + counts.suffix >= caps.total) return null;
  const eligible = ['prefix', 'suffix'].filter(
    (t) => counts[t] < caps[t] && hasAvailableStat(base, t, item.affixes)
  );
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

// The affix type this item is furthest short on — used by the tier-upgrade
// crafts, which always add "whichever is missing" rather than a random one.
export function pickMissingType(item, base) {
  const counts = affixCounts(item, base);
  const eligible = ['prefix', 'suffix'].filter((t) => hasAvailableStat(base, t, item.affixes));
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => counts[a] - counts[b]);
  return eligible[0];
}

export function rollOneAffix(base, type, existingAffixes) {
  const candidates = base.statPool.filter((e) => e.type === type && !(e.stat in existingAffixes));
  if (candidates.length === 0) return null;
  const distinctStats = [...new Set(candidates.map((e) => e.stat))];
  const stat = distinctStats[Math.floor(Math.random() * distinctStats.length)];
  const statCandidates = candidates.filter((e) => e.stat === stat);
  const { min, max } = statCandidates[Math.floor(Math.random() * statCandidates.length)];
  const rolled = rollInt(min, max);
  // Every "...Pct" stat (attackSpeedPct, armourPct, evasionGlobalPct, ...) is
  // rolled in whole percent but stored as a fraction, same convention as
  // attackSpeedPct originally used.
  return { stat, amount: stat.endsWith('Pct') ? rolled / 100 : rolled };
}

// Rolls up to the tier's total affix cap, respecting its prefix/suffix
// sub-caps, stopping early if the base item doesn't offer enough distinct
// stats of an eligible type (e.g. jewelry has only one suffix-tagged stat
// available per type in some slots).
function rollAffixes(statPool, tier) {
  const fakeBase = { statPool };
  const affixes = {};
  const fakeItem = { affixes };
  let type = pickAffixType(fakeItem, fakeBase, tier);
  while (type) {
    const rolled = rollOneAffix(fakeBase, type, affixes);
    if (!rolled) break;
    affixes[rolled.stat] = rolled.amount;
    type = pickAffixType(fakeItem, fakeBase, tier);
  }
  return affixes;
}

// Produces an unplaced item shape — no instanceId/x/y yet, those are
// assigned by inventory.js when it's actually placed in the bag.
export function generateLootItem(baseId, { maxTier = 'rare' } = {}) {
  const base = getBaseItem(baseId);
  const sockets = new Array(rollSocketCount(base.socketCap)).fill(null);
  const tier = rollTier(maxTier);
  return {
    kind: 'equipment',
    defId: baseId,
    tier,
    w: base.shape.w,
    h: base.shape.h,
    sockets,
    affixes: rollAffixes(base.statPool, tier),
  };
}

// Shared "how much is this worth" heuristic — used both for the Merchant's
// asking price and for the ~33% sell-back value. More sockets and bigger
// affix rolls cost more; percentage affixes (currently just attackSpeedPct,
// stored as a fraction) are scaled up so a "5" (5%) counts similarly to a
// flat "5" stat point.
export function itemValue(item) {
  const socketValue = item.sockets.length * 6;
  const affixValue = Object.values(item.affixes).reduce(
    (sum, amount) => sum + (amount < 1 ? amount * 100 : amount) * 3,
    0
  );
  return Math.max(10, Math.round(20 + socketValue + affixValue));
}

// A per-item defence breakdown, independent of the rest of the character's
// gear — used by the shop/inventory "expand for details" view so the local
// base+flat*(1+pct) math (or the jewelry global %) is visible up front
// instead of buried in a flat affix list. Only includes a defence type this
// specific item actually contributes to; an item with none returns {}.
export function itemDefenseBreakdown(item) {
  const base = getBaseItem(item.defId);
  const breakdown = {};
  for (const key of ['armour', 'evasion', 'barrier']) {
    const globalPct = item.affixes?.[`${key}GlobalPct`];
    if (base.defenseBase) {
      const baseVal = base.defenseBase[key] || 0;
      const flat = item.affixes?.[`${key}Flat`] || 0;
      const pct = item.affixes?.[`${key}Pct`] || 0;
      if (baseVal > 0 || flat > 0 || pct > 0) {
        breakdown[key] = { kind: 'local', base: baseVal, flat, pct, total: (baseVal + flat) * (1 + pct) };
      }
    } else if (globalPct) {
      breakdown[key] = { kind: 'global', pct: globalPct };
    }
  }
  return breakdown;
}
