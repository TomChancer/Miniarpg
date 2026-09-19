// Support gems socket into gear exactly like skill gems, but never fire on
// their own. Instead, a support modifies every skill gem sharing sockets on
// the SAME equipped item — provided at least one of that skill's `tags`
// (see gems.js) appears in the support's own `appliesToTags`. Multiple
// supports linked to one skill stack their multipliers together (see
// skillResolution.js). Moving a skill or support to a different item breaks
// the link, same as moving it out of range of a socket in any other looter.
export const SUPPORT_GEMS = [
  {
    id: 'support_added_might',
    name: 'Added Might Support',
    description: 'More damage, more mana cost. Applies to any attack.',
    gemType: 'support',
    appliesToTags: ['attack'],
    mods: { damageMultiplier: 1.25, manaCostMultiplier: 1.3 },
    requirement: null,
    cost: 14,
    currency: 'voidShard',
  },
  {
    id: 'support_swift',
    name: 'Swift Support',
    description: 'Faster attacks, more mana cost. Applies to any attack.',
    gemType: 'support',
    appliesToTags: ['attack'],
    mods: { speedMultiplier: 1.25, manaCostMultiplier: 1.15 },
    requirement: { stat: 'dexterity', value: 6 },
    cost: 16,
    currency: 'voidShard',
  },
  {
    id: 'support_volley',
    name: 'Volley Support',
    description: 'Fires an extra projectile, each hitting for less. Projectile skills only.',
    gemType: 'support',
    appliesToTags: ['projectile'],
    mods: { projectileCountAdd: 1, damageMultiplier: 0.75, manaCostMultiplier: 1.25 },
    requirement: { stat: 'intelligence', value: 8 },
    cost: 18,
    currency: 'voidShard',
  },
  {
    id: 'support_momentum',
    name: 'Momentum Support',
    description: 'Big melee damage, more mana cost. Melee skills only.',
    gemType: 'support',
    appliesToTags: ['melee'],
    mods: { damageMultiplier: 1.35, manaCostMultiplier: 1.2 },
    requirement: { stat: 'strength', value: 7 },
    cost: 18,
    currency: 'voidShard',
  },
  {
    id: 'support_widening',
    name: 'Widening Support',
    description: 'Larger area of effect, more mana cost. Area skills only.',
    gemType: 'support',
    appliesToTags: ['area'],
    mods: { areaMultiplier: 1.4, manaCostMultiplier: 1.2 },
    requirement: { stat: 'vitality', value: 6 },
    cost: 16,
    currency: 'voidShard',
  },
  {
    id: 'support_far_reach',
    name: 'Far Reach Support',
    description: 'Bigger range, but costs more to sustain -- faster mana drain on a pulsing aura, more mana reserved on an automatic one. Aura skills only.',
    gemType: 'support',
    appliesToTags: ['aura'],
    mods: { areaMultiplier: 1.5, manaCostMultiplier: 1.3 },
    requirement: { stat: 'dexterity', value: 8 },
    cost: 18,
    currency: 'voidShard',
  },
];

export function getSupportById(id) {
  return SUPPORT_GEMS.find((s) => s.id === id);
}
