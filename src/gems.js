// Skill gems socket into equipped gear (see inventory.js) and, once socketed,
// each fires as its own independent automatic attack on its own base speed.
// Support gems will later link to a specific socketed skill gem to modify it.
export const GEMS = [
  {
    id: 'cinder_twinshot',
    name: 'Cinder Twinshot',
    description: 'Fires at two nearest enemies at once.',
    cost: 12,
    projectiles: 2,
    pierce: 0,
    speed: 1.6,
  },
  {
    id: 'piercing_shard',
    name: 'Piercing Shard',
    description: 'Your bolt punches through up to 2 extra enemies.',
    cost: 20,
    projectiles: 1,
    pierce: 2,
    speed: 1.8,
  },
];

export function getGemById(id) {
  return GEMS.find((g) => g.id === id);
}
