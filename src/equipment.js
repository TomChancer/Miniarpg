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
// Defence (see defense.js): each armor slot (helmet/chest/legs) comes in
// three pure base-type variants — `<slot>_armour`, `<slot>_evasion`,
// `<slot>_barrier` — sharing the same slotCategory/shape/socketCap but each
// with an intrinsic `defenseBase` for ONLY its own type, scaled by that same
// piece's LOCAL flat/% prefixes: (defenseBase + Flat) * (1 + Pct). Weapons
// carry no defence at all. Jewelry (ring/amulet/trinket) can't roll those
// locals — instead it gets a GLOBAL % prefix (armourGlobalPct etc., any of
// the three, unrestricted) that scales the character's final total for that
// defence type. See inventory.js#getDefenseStats for the aggregation.
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

// Armor-slot pieces (helmet/chest/legs, never weapons) now come in three
// PURE base types per slot, PoE-style: an Armour piece only ever rolls
// Armour's local prefixes (and leans Strength), an Evasion piece only rolls
// Evasion's (leans Dexterity), a Barrier piece only rolls Barrier's (leans
// Intelligence). Each has a real intrinsic `defenseBase` for its own type
// only, which its local flat/% prefixes scale: (defenseBase + Flat) * (1 +
// Pct). No piece is a hybrid — pick your archetype by which item you wear,
// not by which affixes happened to roll. Vitality stays universal across
// all three since it isn't one of the three defence-governing attributes.
function armourPrefixes(flatRange) {
  return [
    { stat: 'armourFlat', min: flatRange[0], max: flatRange[1], type: 'prefix' },
    { stat: 'armourPct', min: 8, max: 15, type: 'prefix' },
  ];
}
function evasionPrefixes(flatRange) {
  return [
    { stat: 'evasionFlat', min: flatRange[0], max: flatRange[1], type: 'prefix' },
    { stat: 'evasionPct', min: 8, max: 15, type: 'prefix' },
  ];
}
function barrierPrefixes(flatRange) {
  return [
    { stat: 'barrierFlat', min: flatRange[0], max: flatRange[1], type: 'prefix' },
    { stat: 'barrierPct', min: 8, max: 15, type: 'prefix' },
  ];
}

// name: [Armour, Evasion, Barrier] flavor names per slot, and per-slot shape.
const ARMOR_SLOTS = {
  helmet: { names: ['Great Helm', 'Leather Cap', 'Circlet'], shape: { w: 2, h: 2 }, socketCap: 4, base: 5, flatRange: [3, 6] },
  chest: { names: ['Plate Armor', 'Leather Armor', 'Silk Robe'], shape: { w: 2, h: 3 }, socketCap: 6, base: 8, flatRange: [4, 8] },
  legs: { names: ['Plate Greaves', 'Leather Leggings', 'Silk Leggings'], shape: { w: 2, h: 2 }, socketCap: 4, base: 5, flatRange: [3, 6] },
};

const ARMOR_ARCHETYPE_ITEMS = {};
for (const [slotCategory, { names, shape, socketCap, base, flatRange }] of Object.entries(ARMOR_SLOTS)) {
  const [armourName, evasionName, barrierName] = names;
  ARMOR_ARCHETYPE_ITEMS[`${slotCategory}_armour`] = {
    id: `${slotCategory}_armour`, name: armourName, slotCategory, shape, socketCap,
    defenseBase: { armour: base },
    statPool: [
      { stat: 'strength', min: 2, max: 5, type: 'prefix' }, { stat: 'strength', min: 2, max: 5, type: 'prefix' },
      { stat: 'vitality', min: 1, max: 3, type: 'prefix' },
      ...armourPrefixes(flatRange),
      { stat: 'rarity', min: 1, max: 3, type: 'suffix' },
      { stat: 'attackSpeedPct', min: 2, max: 5, type: 'suffix' },
    ],
  };
  ARMOR_ARCHETYPE_ITEMS[`${slotCategory}_evasion`] = {
    id: `${slotCategory}_evasion`, name: evasionName, slotCategory, shape, socketCap,
    defenseBase: { evasion: base },
    statPool: [
      { stat: 'dexterity', min: 2, max: 5, type: 'prefix' }, { stat: 'dexterity', min: 2, max: 5, type: 'prefix' },
      { stat: 'vitality', min: 1, max: 3, type: 'prefix' },
      ...evasionPrefixes(flatRange),
      { stat: 'rarity', min: 1, max: 3, type: 'suffix' },
      { stat: 'attackSpeedPct', min: 2, max: 5, type: 'suffix' },
    ],
  };
  ARMOR_ARCHETYPE_ITEMS[`${slotCategory}_barrier`] = {
    id: `${slotCategory}_barrier`, name: barrierName, slotCategory, shape, socketCap,
    defenseBase: { barrier: base },
    statPool: [
      { stat: 'intelligence', min: 2, max: 5, type: 'prefix' }, { stat: 'intelligence', min: 2, max: 5, type: 'prefix' },
      { stat: 'vitality', min: 1, max: 3, type: 'prefix' },
      ...barrierPrefixes(flatRange),
      { stat: 'rarity', min: 1, max: 3, type: 'suffix' },
      { stat: 'attackSpeedPct', min: 2, max: 5, type: 'suffix' },
    ],
  };
}

export const BASE_ITEMS = {
  ...ARMOR_ARCHETYPE_ITEMS,
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
