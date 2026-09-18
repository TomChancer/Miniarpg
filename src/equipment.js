// Equipment is now loot: these are *generation templates*, not purchasable
// fixed items. loot.js rolls a concrete instance (sockets + affixes) from
// one of these. `statPool` entries can repeat a stat to bias the odds of
// rolling it (a cheap stand-in for real weighted random).
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

export const BASE_ITEMS = {
  helmet: {
    id: 'helmet', name: 'Helmet', slotCategory: 'helmet', shape: { w: 2, h: 2 }, socketCap: 4,
    statPool: [
      { stat: 'intelligence', min: 2, max: 5 }, { stat: 'intelligence', min: 2, max: 5 },
      { stat: 'vitality', min: 1, max: 3 },
      { stat: 'rarity', min: 1, max: 3 },
      { stat: 'attackSpeedPct', min: 2, max: 5 },
    ],
  },
  chest: {
    id: 'chest', name: 'Chestplate', slotCategory: 'chest', shape: { w: 2, h: 3 }, socketCap: 6,
    statPool: [
      { stat: 'strength', min: 2, max: 5 }, { stat: 'strength', min: 2, max: 5 },
      { stat: 'vitality', min: 2, max: 5 }, { stat: 'vitality', min: 2, max: 5 },
      { stat: 'rarity', min: 1, max: 3 },
      { stat: 'attackSpeedPct', min: 2, max: 5 },
    ],
  },
  legs: {
    id: 'legs', name: 'Leggings', slotCategory: 'legs', shape: { w: 2, h: 2 }, socketCap: 4,
    statPool: [
      { stat: 'dexterity', min: 2, max: 5 }, { stat: 'dexterity', min: 2, max: 5 },
      { stat: 'vitality', min: 1, max: 3 },
      { stat: 'rarity', min: 1, max: 3 },
      { stat: 'attackSpeedPct', min: 2, max: 5 },
    ],
  },
  ring: {
    id: 'ring', name: 'Ring', slotCategory: 'ring', shape: { w: 1, h: 1 }, socketCap: 0,
    statPool: [
      { stat: 'strength', min: 1, max: 3 }, { stat: 'vitality', min: 1, max: 3 },
      { stat: 'intelligence', min: 1, max: 3 }, { stat: 'dexterity', min: 1, max: 3 },
      { stat: 'rarity', min: 1, max: 3 }, { stat: 'attackSpeedPct', min: 1, max: 3 },
    ],
  },
  amulet: {
    id: 'amulet', name: 'Amulet', slotCategory: 'amulet', shape: { w: 1, h: 1 }, socketCap: 0,
    statPool: [
      { stat: 'strength', min: 2, max: 4 }, { stat: 'vitality', min: 2, max: 4 },
      { stat: 'intelligence', min: 2, max: 4 }, { stat: 'dexterity', min: 2, max: 4 },
      { stat: 'rarity', min: 2, max: 4 }, { stat: 'attackSpeedPct', min: 2, max: 4 },
    ],
  },
  trinket: {
    id: 'trinket', name: 'Trinket', slotCategory: 'trinket', shape: { w: 1, h: 1 }, socketCap: 0,
    statPool: [
      { stat: 'rarity', min: 2, max: 5 }, { stat: 'rarity', min: 2, max: 5 }, { stat: 'rarity', min: 2, max: 5 },
      { stat: 'strength', min: 1, max: 2 }, { stat: 'vitality', min: 1, max: 2 },
      { stat: 'intelligence', min: 1, max: 2 }, { stat: 'dexterity', min: 1, max: 2 },
    ],
  },
  sword_1h: {
    id: 'sword_1h', name: 'Shortsword', slotCategory: 'weapon', shape: { w: 1, h: 3 }, socketCap: 3,
    handedness: 'one', rangeMultiplier: 0.8,
    statPool: [
      { stat: 'strength', min: 2, max: 5 }, { stat: 'strength', min: 2, max: 5 }, { stat: 'strength', min: 2, max: 5 },
      { stat: 'vitality', min: 1, max: 3 }, { stat: 'attackSpeedPct', min: 2, max: 5 },
    ],
  },
  sword_2h: {
    id: 'sword_2h', name: 'Greatsword', slotCategory: 'weapon', shape: { w: 1, h: 4 }, socketCap: 6,
    handedness: 'two', rangeMultiplier: 1.0,
    statPool: [
      { stat: 'strength', min: 3, max: 6 }, { stat: 'strength', min: 3, max: 6 }, { stat: 'strength', min: 3, max: 6 },
      { stat: 'vitality', min: 2, max: 4 }, { stat: 'attackSpeedPct', min: 2, max: 5 },
    ],
  },
  staff: {
    id: 'staff', name: 'Staff', slotCategory: 'weapon', shape: { w: 1, h: 4 }, socketCap: 6,
    handedness: 'two', rangeMultiplier: 1.2,
    statPool: [
      { stat: 'intelligence', min: 3, max: 6 }, { stat: 'intelligence', min: 3, max: 6 }, { stat: 'intelligence', min: 3, max: 6 },
      { stat: 'rarity', min: 1, max: 3 }, { stat: 'attackSpeedPct', min: 2, max: 5 },
    ],
  },
  bow: {
    id: 'bow', name: 'Bow', slotCategory: 'weapon', shape: { w: 1, h: 4 }, socketCap: 6,
    handedness: 'two', rangeMultiplier: 1.5,
    statPool: [
      { stat: 'dexterity', min: 3, max: 6 }, { stat: 'dexterity', min: 3, max: 6 }, { stat: 'dexterity', min: 3, max: 6 },
      { stat: 'vitality', min: 1, max: 3 }, { stat: 'attackSpeedPct', min: 2, max: 5 },
    ],
  },
};

export const BASE_ITEM_IDS = Object.keys(BASE_ITEMS);

export function getBaseItem(id) {
  return BASE_ITEMS[id];
}
