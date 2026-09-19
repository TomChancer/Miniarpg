// The map tree: a branching, weaving web (not a single chain) — each map
// connects to at least 1 and at most 3 other maps, and clearing a map
// unlocks whatever it connects to (see mapProgress.js). Data-driven so
// higher tiers can later add their own enemy types/bosses without touching
// combat.js — for now every tier is just a re-skinned, harder Ashen Grove.
//
// `x`/`y` are absolute positions in the map screen's canvas (see app.js's
// drawMapTree), laid out as one row per tier so the web reads top-to-bottom
// with paths crossing between rows — MAP_TREE_SIZE is that canvas's fixed
// pixel dimensions, exported so the two never drift apart.
//
// `toughnessBasePct` is this tier's baseline difficulty, folded into the
// same enemy toughness formula (hp/damage/value/xp all scale together) that
// the mapping talent tree's own Monster Toughness spoke and map-modifier
// sigils also feed — see combat.js. Each tier is roughly 12% harder than
// the last (within the requested 10-15% band), compounding: 0, 12, 25, 40,
// 57, 76.
const TIER_TOUGHNESS_PCT = [0, 12, 25, 40, 57, 76];

export const MAP_TREE_SIZE = { width: 600, height: 940 };

export const MAPS = {
  // Tier 1 — the root.
  ashen_grove: { id: 'ashen_grove', name: 'Ashen Grove', tier: 1, rounds: 3, x: 300, y: 70, connections: ['ashen_hollow', 'ashen_thicket', 'ashen_scar'] },

  // Tier 2.
  ashen_hollow: { id: 'ashen_hollow', name: 'Ashen Hollow', tier: 2, rounds: 3, x: 90, y: 230, connections: ['ashen_grove', 'cinder_wastes', 'cinder_marsh'] },
  ashen_thicket: { id: 'ashen_thicket', name: 'Ashen Thicket', tier: 2, rounds: 3, x: 300, y: 230, connections: ['ashen_grove', 'cinder_marsh', 'cinder_ridge'] },
  ashen_scar: { id: 'ashen_scar', name: 'Ashen Scar', tier: 2, rounds: 3, x: 510, y: 230, connections: ['ashen_grove', 'cinder_ridge', 'cinder_hollow'] },

  // Tier 3.
  cinder_wastes: { id: 'cinder_wastes', name: 'Cinder Wastes', tier: 3, rounds: 3, x: 90, y: 390, connections: ['ashen_hollow', 'cinder_expanse', 'ember_basin'] },
  cinder_marsh: { id: 'cinder_marsh', name: 'Cinder Marsh', tier: 3, rounds: 3, x: 230, y: 390, connections: ['ashen_hollow', 'ashen_thicket', 'ember_basin'] },
  cinder_ridge: { id: 'cinder_ridge', name: 'Cinder Ridge', tier: 3, rounds: 3, x: 370, y: 390, connections: ['ashen_thicket', 'ashen_scar', 'smoldering_flats'] },
  cinder_hollow: { id: 'cinder_hollow', name: 'Cinder Hollow', tier: 3, rounds: 3, x: 510, y: 390, connections: ['ashen_scar', 'smoldering_flats', 'ember_scar'] },

  // Tier 4.
  cinder_expanse: { id: 'cinder_expanse', name: 'Cinder Expanse', tier: 4, rounds: 3, x: 90, y: 550, connections: ['cinder_wastes', 'smoldering_reach', 'smoldering_scar'] },
  ember_basin: { id: 'ember_basin', name: 'Ember Basin', tier: 4, rounds: 3, x: 230, y: 550, connections: ['cinder_wastes', 'cinder_marsh', 'smoldering_reach'] },
  smoldering_flats: { id: 'smoldering_flats', name: 'Smoldering Flats', tier: 4, rounds: 3, x: 370, y: 550, connections: ['cinder_ridge', 'cinder_hollow', 'smoldering_rift'] },
  ember_scar: { id: 'ember_scar', name: 'Ember Scar', tier: 4, rounds: 3, x: 510, y: 550, connections: ['cinder_hollow', 'smoldering_scar', 'smoldering_rift'] },

  // Tier 5.
  smoldering_reach: { id: 'smoldering_reach', name: 'Smoldering Reach', tier: 5, rounds: 3, x: 90, y: 710, connections: ['cinder_expanse', 'ember_basin', 'smoldering_abyss'] },
  smoldering_scar: { id: 'smoldering_scar', name: 'Smoldering Scar', tier: 5, rounds: 3, x: 300, y: 710, connections: ['cinder_expanse', 'ember_scar', 'smoldering_abyss'] },
  smoldering_rift: { id: 'smoldering_rift', name: 'Smoldering Rift', tier: 5, rounds: 3, x: 510, y: 710, connections: ['smoldering_flats', 'ember_scar', 'smoldering_abyss'] },

  // Tier 6 — the current end of the web; every tier-5 map converges here.
  smoldering_abyss: { id: 'smoldering_abyss', name: 'Smoldering Abyss', tier: 6, rounds: 3, x: 300, y: 870, connections: ['smoldering_reach', 'smoldering_scar', 'smoldering_rift'] },
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
