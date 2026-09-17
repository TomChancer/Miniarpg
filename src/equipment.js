// Equipment shapes follow D2-style proportions for the inventory grid.
// `stats` are flat bonuses applied while the piece is equipped (see
// inventory.js getSpeedMultiplier). Sockets hold skill gems.
export const SLOTS = ['helmet', 'chest', 'boots'];

export const EQUIPMENT_ITEMS = [
  {
    id: 'worn_helmet',
    slot: 'helmet',
    name: 'Worn Helmet',
    sockets: 3,
    shape: { w: 2, h: 2 },
    cost: 15,
    stats: { attackSpeedPct: 0.05 },
  },
  {
    id: 'worn_chest',
    slot: 'chest',
    name: 'Worn Chestplate',
    sockets: 6,
    shape: { w: 2, h: 3 },
    cost: 30,
    stats: { attackSpeedPct: 0.08 },
  },
  {
    id: 'worn_boots',
    slot: 'boots',
    name: 'Worn Boots',
    sockets: 2,
    shape: { w: 2, h: 2 },
    cost: 15,
    stats: { attackSpeedPct: 0.05 },
  },
];

export function getEquipmentDef(id) {
  return EQUIPMENT_ITEMS.find((e) => e.id === id);
}
