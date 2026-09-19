// Equipment is now loot: these are *generation templates*, not purchasable
// fixed items. loot.js rolls a concrete instance (tier + sockets + affixes)
// from one of these. `statPool` entries can repeat a stat to bias the odds
// of rolling it (a cheap stand-in for real weighted random).
//
// Each entry is tagged `prefix` (the four main attributes, plus the defensive
// stats below) or `suffix` (everything else — currently just Rarity and
// Attack Speed) so loot.js/craft logic can enforce per-tier caps on each
// affix type separately.
//
// Defence (see defense.js): armour-slot pieces (helmet/chest/legs, never
// weapons) carry a small intrinsic `defenseBase` plus LOCAL flat/% prefixes
// that scale that same piece's own base value: (defenseBase + Flat) * (1 +
// Pct). Jewelry (ring/amulet/trinket) can't roll those locals at all —
// instead it gets a GLOBAL % prefix (armourGlobalPct etc.) that scales the
// character's final total for that defence type. See
// inventory.js#getDefenseStats for the aggregation.
export const SLOTS = [
  'helmet', 'chest', 'legs',
  'ring1', 'ring2',
  'amulet',
  'trinket1', 'trinket2',
  'weapon', 'offhand',
];

// Which base-item slotCategory a given paperdoll slot accepts.
export const SLOT_CATEGORY = {
  helmet: 'helmet', chest: 'chest', legs: 'legs',
  ring1: 'ring', ring2: 'ring',
  amulet: 'amulet',
  trinket1: 'trinket', trinket2: 'trinket',
  weapon: 'weapon', offhand: 'weapon',
};

// Local defensive prefixes (flat + %) roll only on armor-slot pieces
// (helmet/chest/legs -- never weapons) and scale that SAME piece's own
// `defenseBase` value: (defenseBase + flat) * (1 + pct). Every armor piece
// gets a small intrinsic amount of Armour and Evasion (per the current
// one-item-per-slot design), but no intrinsic Barrier -- Barrier only comes
// from Intelligence's own contribution (see inventory.js) and rolled
// affixes, never as a free baseline. Since local barrier has no base to
// scale, it only gets a flat prefix (a local "% increased Barrier" would
// multiply zero); Barrier's own % scaling instead lives on jewelry's
// GLOBAL prefix, which multiplies the intelligence-derived total instead.
// DEFENSE_PREFIXES is shared by all three armor pieces so a future new base
// item just needs its own `defenseBase` + this same block.
const DEFENSE_PREFIXES = [
  { stat: 'armourFlat', min: 2, max: 5, type: 'prefix' },
  { stat: 'armourPct', min: 8, max: 15, type: 'prefix' },
  { stat: 'evasionFlat', min: 2, max: 5, type: 'prefix' },
  { stat: 'evasionPct', min: 8, max: 15, type: 'prefix' },
  { stat: 'barrierFlat', min: 3, max: 7, type: 'prefix' },
];

export const BASE_ITEMS = {
  helmet: {
    id: 'helmet', name: 'Helmet', slotCategory: 'helmet', shape: { w: 2, h: 2 }, socketCap: 4,
    defenseBase: { armour: 2, evasion: 2, barrier: 0 },
    statPool: [
      { stat: 'intelligence', min: 2, max: 5, type: 'prefix' }, { stat: 'intelligence', min: 2, max: 5, type: 'prefix' },
      { stat: 'vitality', min: 1, max: 3, type: 'prefix' },
      ...DEFENSE_PREFIXES,
      { stat: 'rarity', min: 1, max: 3, type: 'suffix' },
      { stat: 'attackSpeedPct', min: 2, max: 5, type: 'suffix' },
    ],
  },
  chest: {
    id: 'chest', name: 'Chestplate', slotCategory: 'chest', shape: { w: 2, h: 3 }, socketCap: 6,
    defenseBase: { armour: 5, evasion: 2, barrier: 0 },
    statPool: [
      { stat: 'strength', min: 2, max: 5, type: 'prefix' }, { stat: 'strength', min: 2, max: 5, type: 'prefix' },
      { stat: 'vitality', min: 2, max: 5, type: 'prefix' }, { stat: 'vitality', min: 2, max: 5, type: 'prefix' },
      ...DEFENSE_PREFIXES,
      { stat: 'rarity', min: 1, max: 3, type: 'suffix' },
      { stat: 'attackSpeedPct', min: 2, max: 5, type: 'suffix' },
    ],
  },
  legs: {
    id: 'legs', name: 'Leggings', slotCategory: 'legs', shape: { w: 2, h: 2 }, socketCap: 4,
    defenseBase: { armour: 2, evasion: 5, barrier: 0 },
    statPool: [
      { stat: 'dexterity', min: 2, max: 5, type: 'prefix' }, { stat: 'dexterity', min: 2, max: 5, type: 'prefix' },
      { stat: 'vitality', min: 1, max: 3, type: 'prefix' },
      ...DEFENSE_PREFIXES,
      { stat: 'rarity', min: 1, max: 3, type: 'suffix' },
      { stat: 'attackSpeedPct', min: 2, max: 5, type: 'suffix' },
    ],
  },
  ring: {
    id: 'ring', name: 'Ring', slotCategory: 'ring', shape: { w: 1, h: 1 }, socketCap: 0,
    statPool: [
      { stat: 'strength', min: 1, max: 3, type: 'prefix' }, { stat: 'vitality', min: 1, max: 3, type: 'prefix' },
      { stat: 'intelligence', min: 1, max: 3, type: 'prefix' }, { stat: 'dexterity', min: 1, max: 3, type: 'prefix' },
      { stat: 'armourGlobalPct', min: 5, max: 10, type: 'prefix' },
      { stat: 'evasionGlobalPct', min: 5, max: 10, type: 'prefix' },
      { stat: 'barrierGlobalPct', min: 5, max: 10, type: 'prefix' },
      { stat: 'rarity', min: 1, max: 3, type: 'suffix' }, { stat: 'attackSpeedPct', min: 1, max: 3, type: 'suffix' },
    ],
  },
  amulet: {
    id: 'amulet', name: 'Amulet', slotCategory: 'amulet', shape: { w: 1, h: 1 }, socketCap: 0,
    statPool: [
      { stat: 'strength', min: 2, max: 4, type: 'prefix' }, { stat: 'vitality', min: 2, max: 4, type: 'prefix' },
      { stat: 'intelligence', min: 2, max: 4, type: 'prefix' }, { stat: 'dexterity', min: 2, max: 4, type: 'prefix' },
      { stat: 'armourGlobalPct', min: 6, max: 12, type: 'prefix' },
      { stat: 'evasionGlobalPct', min: 6, max: 12, type: 'prefix' },
      { stat: 'barrierGlobalPct', min: 6, max: 12, type: 'prefix' },
      { stat: 'rarity', min: 2, max: 4, type: 'suffix' }, { stat: 'attackSpeedPct', min: 2, max: 4, type: 'suffix' },
    ],
  },
  trinket: {
    id: 'trinket', name: 'Trinket', slotCategory: 'trinket', shape: { w: 1, h: 1 }, socketCap: 0,
    statPool: [
      { stat: 'rarity', min: 2, max: 5, type: 'suffix' }, { stat: 'rarity', min: 2, max: 5, type: 'suffix' }, { stat: 'rarity', min: 2, max: 5, type: 'suffix' },
      { stat: 'strength', min: 1, max: 2, type: 'prefix' }, { stat: 'vitality', min: 1, max: 2, type: 'prefix' },
      { stat: 'intelligence', min: 1, max: 2, type: 'prefix' }, { stat: 'dexterity', min: 1, max: 2, type: 'prefix' },
      { stat: 'armourGlobalPct', min: 5, max: 10, type: 'prefix' },
      { stat: 'evasionGlobalPct', min: 5, max: 10, type: 'prefix' },
      { stat: 'barrierGlobalPct', min: 5, max: 10, type: 'prefix' },
    ],
  },
  sword_1h: {
    id: 'sword_1h', name: 'Shortsword', slotCategory: 'weapon', shape: { w: 1, h: 3 }, socketCap: 3,
    handedness: 'one', rangeMultiplier: 0.8,
    statPool: [
      { stat: 'strength', min: 2, max: 5, type: 'prefix' }, { stat: 'strength', min: 2, max: 5, type: 'prefix' }, { stat: 'strength', min: 2, max: 5, type: 'prefix' },
      { stat: 'vitality', min: 1, max: 3, type: 'prefix' }, { stat: 'attackSpeedPct', min: 2, max: 5, type: 'suffix' },
    ],
  },
  sword_2h: {
    id: 'sword_2h', name: 'Greatsword', slotCategory: 'weapon', shape: { w: 1, h: 4 }, socketCap: 6,
    handedness: 'two', rangeMultiplier: 1.0,
    statPool: [
      { stat: 'strength', min: 3, max: 6, type: 'prefix' }, { stat: 'strength', min: 3, max: 6, type: 'prefix' }, { stat: 'strength', min: 3, max: 6, type: 'prefix' },
      { stat: 'vitality', min: 2, max: 4, type: 'prefix' }, { stat: 'attackSpeedPct', min: 2, max: 5, type: 'suffix' },
    ],
  },
  staff: {
    id: 'staff', name: 'Staff', slotCategory: 'weapon', shape: { w: 1, h: 4 }, socketCap: 6,
    handedness: 'two', rangeMultiplier: 1.2,
    statPool: [
      { stat: 'intelligence', min: 3, max: 6, type: 'prefix' }, { stat: 'intelligence', min: 3, max: 6, type: 'prefix' }, { stat: 'intelligence', min: 3, max: 6, type: 'prefix' },
      { stat: 'rarity', min: 1, max: 3, type: 'suffix' }, { stat: 'attackSpeedPct', min: 2, max: 5, type: 'suffix' },
    ],
  },
  bow: {
    id: 'bow', name: 'Bow', slotCategory: 'weapon', shape: { w: 1, h: 4 }, socketCap: 6,
    handedness: 'two', rangeMultiplier: 1.5,
    statPool: [
      { stat: 'dexterity', min: 3, max: 6, type: 'prefix' }, { stat: 'dexterity', min: 3, max: 6, type: 'prefix' }, { stat: 'dexterity', min: 3, max: 6, type: 'prefix' },
      { stat: 'vitality', min: 1, max: 3, type: 'prefix' }, { stat: 'attackSpeedPct', min: 2, max: 5, type: 'suffix' },
    ],
  },
};

export const BASE_ITEM_IDS = Object.keys(BASE_ITEMS);

export function getBaseItem(id) {
  return BASE_ITEMS[id];
}
