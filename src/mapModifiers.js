// The pool a Warped Sigil (see inventory.js) rolls from when used. Every
// entry shares one shape — `effects` is a dict of key -> [min, max] (rolled
// each use) or `true` (a flat flag) — so applying a rolled set is uniform
// regardless of how many effects it has or whether it's a blessing or a
// curse. Negative modifiers always bundle their own packSizePct/rarityBonus
// compensation alongside the drawback, PoE-sextant style: a harder map, but
// one that pays you for the risk.
//
// Effect keys, and what reads them:
//   packSizePct, spawnRatePct, monsterToughnessPct  -- combat.js's mapMods,
//     same keys/units the mapping talent tree already contributes (summed).
//   rarityBonus       -- flat points added to character.rarity for the run
//     (character.rarity already drives the 1 + rarity/100 drop-chance
//     multiplier, so this is just more of the same, not a new formula).
//   reducedDefensesPct -- shrinks getDefenseStats()'s armour/evasion/barrier
//     for the run only.
//   volatileDeaths    -- a flag: killed enemies burst, damaging the player
//     if they're standing too close (mitigated by armour/Barrier as normal).
export const MAP_MODIFIERS = [
  {
    id: 'bountiful',
    name: 'Bountiful',
    kind: 'positive',
    description: '+{packSizePct}% Pack Size',
    effects: { packSizePct: [10, 40] },
  },
  {
    id: 'glimmering',
    name: 'Glimmering',
    kind: 'positive',
    description: '+{rarityBonus}% Rarity of Drops',
    effects: { rarityBonus: [10, 40] },
  },
  {
    id: 'fortified_foes',
    name: 'Fortified Foes',
    kind: 'negative',
    description: 'Enemies are +{monsterToughnessPct}% tougher, but +{packSizePct}% Pack Size and +{rarityBonus}% Rarity',
    effects: { monsterToughnessPct: [15, 30], packSizePct: [10, 20], rarityBonus: [10, 20] },
  },
  {
    id: 'hasted',
    name: 'Hasted',
    kind: 'negative',
    description: 'Enemies spawn +{spawnRatePct}% faster, but +{packSizePct}% Pack Size and +{rarityBonus}% Rarity',
    effects: { spawnRatePct: [15, 30], packSizePct: [10, 20], rarityBonus: [10, 20] },
  },
  {
    id: 'weakening',
    name: 'Weakening',
    kind: 'negative',
    description: '-{reducedDefensesPct}% to your Armour/Evasion/Barrier, but +{packSizePct}% Pack Size and +{rarityBonus}% Rarity',
    effects: { reducedDefensesPct: [15, 30], packSizePct: [10, 20], rarityBonus: [10, 20] },
  },
  {
    id: 'volatile',
    name: 'Volatile',
    kind: 'negative',
    description: 'Slain enemies burst, damaging you if too close, but +{packSizePct}% Pack Size and +{rarityBonus}% Rarity',
    effects: { volatileDeaths: true, packSizePct: [15, 25], rarityBonus: [15, 25] },
  },
];

function rollValue(range) {
  if (range === true) return true;
  const [min, max] = range;
  return Math.round(min + Math.random() * (max - min));
}

function fillDescription(template, rolledEffects) {
  return template.replace(/\{(\w+)\}/g, (_, key) => rolledEffects[key]);
}

export function getMapModifierById(id) {
  return MAP_MODIFIERS.find((m) => m.id === id);
}

// Picks `count` distinct modifiers from the pool and rolls each one's
// effect ranges. Returns [{id, name, kind, description, effects}, ...] with
// `description` already filled in with this roll's actual numbers.
export function rollMapModifiers(count) {
  const pool = [...MAP_MODIFIERS];
  const target = Math.min(count, pool.length);
  const picked = [];
  while (picked.length < target) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked.map((def) => {
    const rolledEffects = Object.fromEntries(
      Object.entries(def.effects).map(([key, range]) => [key, rollValue(range)])
    );
    return {
      id: def.id,
      name: def.name,
      kind: def.kind,
      description: fillDescription(def.description, rolledEffects),
      effects: rolledEffects,
    };
  });
}

// Merges several rolled modifiers' effects into one flat object combat.js
// can read directly: numeric keys sum, the volatileDeaths flag ORs.
export function combineModifierEffects(rolledModifiers) {
  const combined = {
    packSizePct: 0, spawnRatePct: 0, monsterToughnessPct: 0,
    rarityBonus: 0, reducedDefensesPct: 0, volatileDeaths: false,
  };
  for (const mod of rolledModifiers) {
    for (const [key, value] of Object.entries(mod.effects)) {
      if (key === 'volatileDeaths') combined.volatileDeaths = combined.volatileDeaths || value;
      else combined[key] = (combined[key] || 0) + value;
    }
  }
  return combined;
}
