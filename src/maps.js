// The map tree: a chain of maps, each one unlocked by clearing the map(s)
// it connects back to (see mapProgress.js). Data-driven so higher tiers can
// later add their own enemy types/bosses without touching combat.js — for
// now every tier is just a re-skinned, harder Ashen Grove.
//
// `toughnessBasePct` is this tier's baseline difficulty, folded into the
// same enemy toughness formula (hp/damage/value/xp all scale together) that
// the mapping talent tree's own Monster Toughness spoke and map-modifier
// sigils also feed — see combat.js. Each tier is roughly 12% harder than
// the last (within the requested 10-15% band), compounding: 0, 12, 25, 40,
// 57, 76.
const TIER_TOUGHNESS_PCT = [0, 12, 25, 40, 57, 76];

export const MAPS = {
  ashen_grove: { id: 'ashen_grove', name: 'Ashen Grove', tier: 1, rounds: 3, connections: ['ashen_hollow'] },
  ashen_hollow: { id: 'ashen_hollow', name: 'Ashen Hollow', tier: 2, rounds: 3, connections: ['ashen_grove', 'cinder_wastes'] },
  cinder_wastes: { id: 'cinder_wastes', name: 'Cinder Wastes', tier: 3, rounds: 3, connections: ['ashen_hollow', 'cinder_expanse'] },
  cinder_expanse: { id: 'cinder_expanse', name: 'Cinder Expanse', tier: 4, rounds: 3, connections: ['cinder_wastes', 'smoldering_reach'] },
  smoldering_reach: { id: 'smoldering_reach', name: 'Smoldering Reach', tier: 5, rounds: 3, connections: ['cinder_expanse', 'smoldering_abyss'] },
  smoldering_abyss: { id: 'smoldering_abyss', name: 'Smoldering Abyss', tier: 6, rounds: 3, connections: ['smoldering_reach'] },
};

export const MAP_IDS = Object.keys(MAPS);
export const ROOT_MAP_ID = 'ashen_grove';

export function getMapDef(id) {
  return MAPS[id];
}

export function getMapToughnessBasePct(id) {
  const def = getMapDef(id);
  return TIER_TOUGHNESS_PCT[def.tier - 1] ?? 0;
}
