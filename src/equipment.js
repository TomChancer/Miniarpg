// Equipment shapes follow D2-style proportions for the inventory grid.
// `stats` are flat bonuses applied while the piece is equipped (see
// inventory.js getSpeedMultiplier / getTotalStats). Sockets hold skill gems.
// `requirement` gates equipping the piece itself (null = no requirement);
// none of the current starter gear needs one, but heavier armor later will.
export const SLOTS = ['helmet', 'chest', 'boots'];

export const EQUIPMENT_ITEMS = [
  {
    id: 'worn_helmet',
    slot: 'helmet',
    name: 'Worn Helmet',
    sockets: 3,
    shape: { w: 2, h: 2 },
    cost: 15,
    requirement: null,
    stats: { intelligence: 3, attackSpeedPct: 0.05 },
  },
  {
    id: 'worn_chest',
    slot: 'chest',
    name: 'Worn Chestplate',
    sockets: 6,
    shape: { w: 2, h: 3 },
    cost: 30,
    requirement: null,
    stats: { strength: 2, vitality: 3, attackSpeedPct: 0.08 },
  },
  {
    id: 'worn_boots',
    slot: 'boots',
    name: 'Worn Boots',
    sockets: 2,
    shape: { w: 2, h: 2 },
    cost: 15,
    requirement: null,
    stats: { dexterity: 4, attackSpeedPct: 0.05 },
  },
];

export function getEquipmentDef(id) {
  return EQUIPMENT_ITEMS.find((e) => e.id === id);
}
