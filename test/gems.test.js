import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GEMS, PUNCH_SKILL, getGemById } from '../src/gems.js';

const VALID_KINDS = ['melee', 'projectile', 'line', 'dash'];
const VALID_STATS = ['strength', 'vitality', 'intelligence', 'dexterity', 'rarity'];

test('Punch is innate: no requirement, no mana cost', () => {
  assert.equal(PUNCH_SKILL.requirement, null);
  assert.equal(PUNCH_SKILL.manaCost, 0);
  assert.ok(VALID_KINDS.includes(PUNCH_SKILL.kind));
});

test('every purchasable gem has a valid kind, requirement, cost, and currency', () => {
  for (const gem of GEMS) {
    assert.ok(VALID_KINDS.includes(gem.kind), `${gem.id} has an unknown kind "${gem.kind}"`);
    assert.ok(VALID_STATS.includes(gem.scalingStat), `${gem.id} has an unknown scalingStat`);
    assert.ok(gem.requirement, `${gem.id} should require a stat to socket`);
    assert.ok(VALID_STATS.includes(gem.requirement.stat));
    assert.ok(gem.cost > 0);
    assert.equal(gem.currency, 'voidShard');
    assert.ok(gem.manaCost >= 0);
    assert.ok(gem.speed > 0);
  }
});

test('getGemById resolves known ids and returns undefined for unknown ones', () => {
  assert.equal(getGemById('cinder_shot').name, 'Cinder Shot');
  assert.equal(getGemById('not_a_real_gem'), undefined);
});
