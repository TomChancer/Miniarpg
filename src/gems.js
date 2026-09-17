// Skill gems socket into equipped gear (see inventory.js) and, once socketed,
// each fires as its own independent automatic attack on its own base speed
// and mana cost. `scalingStat` is which stat boosts the skill's damage;
// `requirement` (stat + minimum total value) gates socketing it at all.
// Support gems will later link to a specific socketed skill gem to modify it.

// Punch is innate: everyone can always throw a punch, so it needs no
// requirement and isn't part of the socketable pool — it's always active
// even with zero gear equipped.
export const PUNCH_SKILL = {
  id: 'punch',
  name: 'Punch',
  description: 'A quick jab at your nearest foe.',
  kind: 'melee',
  range: 70,
  speed: 2,
  manaCost: 0,
  scalingStat: 'strength',
  requirement: null,
};

export const GEMS = [
  {
    id: 'cinder_shot',
    name: 'Cinder Shot',
    description: 'A ranged bolt at your nearest foe.',
    kind: 'projectile',
    range: 220,
    pierce: 0,
    speed: 1.8,
    manaCost: 6,
    scalingStat: 'intelligence',
    requirement: { stat: 'intelligence', value: 8 },
    cost: 12,
    currency: 'voidShard',
  },
  {
    id: 'crush',
    name: 'Crush',
    description: 'A sweeping line attack that hits everything in its path.',
    kind: 'line',
    range: 150,
    lineWidth: 34,
    speed: 1.1,
    manaCost: 10,
    scalingStat: 'strength',
    requirement: { stat: 'strength', value: 7 },
    cost: 18,
    currency: 'voidShard',
  },
  {
    id: 'slice_and_dice',
    name: 'Slice and Dice',
    description: 'Dash to a foe, strike, and return.',
    kind: 'dash',
    range: 180,
    speed: 1.3,
    manaCost: 8,
    scalingStat: 'dexterity',
    requirement: { stat: 'dexterity', value: 9 },
    cost: 18,
    currency: 'voidShard',
  },
];

export function getGemById(id) {
  return GEMS.find((g) => g.id === id);
}
