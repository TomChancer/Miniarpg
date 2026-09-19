import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSkill, supportsFor } from '../src/skillResolution.js';

const cinderShot = { id: 'cinder_shot', tags: ['attack', 'ranged', 'projectile'], speed: 2, manaCost: 10 };
const crush = { id: 'crush', tags: ['attack', 'melee', 'area'], speed: 1, manaCost: 10 };

const addedMight = { id: 'support_added_might', appliesToTags: ['attack'], mods: { damageMultiplier: 1.25, manaCostMultiplier: 1.3 } };
const swift = { id: 'support_swift', appliesToTags: ['attack'], mods: { speedMultiplier: 1.25, manaCostMultiplier: 1.15 } };
const volley = { id: 'support_volley', appliesToTags: ['projectile'], mods: { projectileCountAdd: 1, damageMultiplier: 0.75, manaCostMultiplier: 1.25 } };
const widening = { id: 'support_widening', appliesToTags: ['area'], mods: { areaMultiplier: 1.4, manaCostMultiplier: 1.2 } };

test('resolveSkill with no supports leaves the base skill untouched aside from default multipliers', () => {
  const resolved = resolveSkill(cinderShot, []);
  assert.equal(resolved.speed, cinderShot.speed);
  assert.equal(resolved.manaCost, cinderShot.manaCost);
  assert.equal(resolved.supportDamageMultiplier, 1);
  assert.equal(resolved.areaMultiplier, 1);
  assert.equal(resolved.projectileCount, 1);
  assert.deepEqual(resolved.appliedSupportIds, []);
});

test('resolveSkill stacks multiplier mods multiplicatively across several supports', () => {
  const resolved = resolveSkill(cinderShot, [addedMight, swift]);
  assert.equal(resolved.supportDamageMultiplier, 1.25);
  assert.equal(resolved.speed, cinderShot.speed * 1.25);
  assert.equal(resolved.manaCost, Math.round(cinderShot.manaCost * 1.3 * 1.15));
});

test('resolveSkill adds projectileCountAdd on top of the base single projectile', () => {
  const resolved = resolveSkill(cinderShot, [volley]);
  assert.equal(resolved.projectileCount, 2);
  assert.equal(resolved.supportDamageMultiplier, 0.75);
});

test('resolveSkill records exactly which supports were applied', () => {
  const resolved = resolveSkill(crush, [widening]);
  assert.deepEqual(resolved.appliedSupportIds, ['support_widening']);
  assert.equal(resolved.areaMultiplier, 1.4);
});

test('supportsFor only returns supports whose appliesToTags intersects the skill tags', () => {
  assert.deepEqual(supportsFor(cinderShot, [addedMight, volley, widening]), [addedMight, volley]);
  assert.deepEqual(supportsFor(crush, [addedMight, volley, widening]), [addedMight, widening]);
});

test('supportsFor returns an empty list when nothing matches', () => {
  const meleeOnlySupport = { id: 'support_momentum', appliesToTags: ['melee'], mods: {} };
  assert.deepEqual(supportsFor(cinderShot, [meleeOnlySupport]), []);
});
