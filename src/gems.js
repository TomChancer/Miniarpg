// Skill gems socket into equipped gear (see inventory.js) and, once socketed,
// each fires as its own independent automatic attack on its own base speed
// and mana cost. `scalingStat` is which stat boosts the skill's damage;
// `requirement` (stat + minimum total value) gates socketing it at all.
//
// `tags` describe what a skill IS, independent of its `kind` (which governs
// its actual hit-detection mechanics). Support gems (see supports.js) only
// modify a skill if one of the skill's tags appears in the support's own
// appliesToTags — that's the whole modularity hook. Current tags in use:
//   attack     - any offensive skill (every skill gem has this except a
//                purely-utility aura like Repulse Aura, which deals no damage)
//   melee      - short, point-blank reach
//   ranged     - reaches out from a distance
//   projectile - fires a physical projectile (gates projectile-count supports)
//   area       - can hit more than one enemy per cast
//   dash       - repositions the character
//   aura       - an automatic, always-on effect around the player rather
//                than something fired at a target (see combat.js's
//                _updatePulseAura/_updateRepulseAura, driven outside the
//                normal per-skill cast-timer loop)
import { SUPPORT_GEMS } from './supports.js';

// Punch is innate: everyone can always throw a punch, so it needs no
// requirement and isn't part of the socketable pool — it's always active
// even with zero gear equipped.
export const PUNCH_SKILL = {
  id: 'punch',
  name: 'Punch',
  description: 'A quick jab at your nearest foe.',
  gemType: 'skill',
  tags: ['attack', 'melee'],
  kind: 'melee',
  range: 70,
  speed: 2,
  manaCost: 0,
  scalingStat: 'strength',
  requirement: null,
  innate: true, // gear-independent: no weapon range multiplier applies to it either
};

export const GEMS = [
  {
    id: 'cinder_shot',
    name: 'Cinder Shot',
    description: 'A ranged bolt at your nearest foe.',
    gemType: 'skill',
    tags: ['attack', 'ranged', 'projectile'],
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
    gemType: 'skill',
    tags: ['attack', 'melee', 'area'],
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
    gemType: 'skill',
    tags: ['attack', 'melee', 'dash'],
    kind: 'dash',
    range: 180,
    speed: 1.3,
    manaCost: 8,
    scalingStat: 'dexterity',
    requirement: { stat: 'dexterity', value: 9 },
    cost: 18,
    currency: 'voidShard',
  },
  {
    id: 'cinder_nova',
    name: 'Cinder Nova',
    description: 'A burst of force around you, striking every nearby foe.',
    gemType: 'skill',
    tags: ['attack', 'area'],
    kind: 'nova',
    range: 130,
    speed: 0.9,
    manaCost: 14,
    scalingStat: 'intelligence',
    requirement: { stat: 'intelligence', value: 10 },
    cost: 20,
    currency: 'voidShard',
  },
  {
    id: 'barrage',
    name: 'Barrage',
    description: 'A quick ranged shot that punches through one extra foe.',
    gemType: 'skill',
    tags: ['attack', 'ranged', 'projectile'],
    kind: 'projectile',
    range: 200,
    pierce: 1,
    speed: 1.6,
    manaCost: 7,
    scalingStat: 'dexterity',
    requirement: { stat: 'dexterity', value: 8 },
    cost: 16,
    currency: 'voidShard',
  },
  {
    id: 'ember_aura',
    name: 'Ember Aura',
    description: 'A constant pulsing field of flame that siphons mana to burn nearby foes. Shuts off once your mana runs dry, and relights once it\'s full again.',
    gemType: 'skill',
    tags: ['attack', 'area', 'aura'],
    kind: 'aura_pulse',
    range: 110,
    speed: 2, // pulses per second
    manaCost: 0, // no per-cast cost; see manaCostPerSec, drained continuously while lit
    manaCostPerSec: 10,
    scalingStat: 'intelligence',
    requirement: { stat: 'intelligence', value: 12 },
    cost: 24,
    currency: 'voidShard',
  },
  {
    id: 'repulse_aura',
    name: 'Repulse Aura',
    description: 'An automatic ward that periodically knocks back nearby foes, buying you a moment of reprieve. Reserves 50% of your mana while active.',
    gemType: 'skill',
    tags: ['area', 'aura'],
    kind: 'aura_repulse',
    range: 100,
    speed: 1, // unused (no per-cast timer); kept for shape parity with other gems
    manaCost: 0, // no per-cast cost; the aura instead reserves manaReservePct at all times
    cooldown: 4,
    manaReservePct: 50,
    knockbackForce: 260,
    knockbackDuration: 0.4,
    requirement: { stat: 'vitality', value: 10 },
    cost: 24,
    currency: 'voidShard',
  },
];

export function getGemById(id) {
  return GEMS.find((g) => g.id === id) || SUPPORT_GEMS.find((g) => g.id === id);
}
