import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GEMS, PUNCH_SKILL, getGemById } from '../src/gems.js';
import { SUPPORT_GEMS } from '../src/supports.js';

const VALID_KINDS = ['melee', 'projectile', 'line', 'dash', 'nova'];
const VALID_STATS = ['strength', 'vitality', 'intelligence', 'dexterity', 'rarity'];
const VALID_TAGS = ['attack', 'melee', 'ranged', 'projectile', 'area', 'dash'];

test('Punch is innate: no requirement, no mana cost, tagged as a melee attack', () => {
  assert.equal(PUNCH_SKILL.requirement, null);
  assert.equal(PUNCH_SKILL.manaCost, 0);
  assert.ok(VALID_KINDS.includes(PUNCH_SKILL.kind));
  assert.equal(PUNCH_SKILL.gemType, 'skill');
  assert.ok(PUNCH_SKILL.tags.includes('attack'));
});

test('every purchasable skill gem has a valid kind, tags, requirement, cost, and currency', () => {
  for (const gem of GEMS) {
    assert.equal(gem.gemType, 'skill');
    assert.ok(VALID_KINDS.includes(gem.kind), `${gem.id} has an unknown kind "${gem.kind}"`);
    assert.ok(VALID_STATS.includes(gem.scalingStat), `${gem.id} has an unknown scalingStat`);
    assert.ok(gem.requirement, `${gem.id} should require a stat to socket`);
    assert.ok(VALID_STATS.includes(gem.requirement.stat));
    assert.ok(gem.cost > 0);
    assert.equal(gem.currency, 'voidShard');
    assert.ok(gem.manaCost >= 0);
    assert.ok(gem.speed > 0);
    assert.ok(Array.isArray(gem.tags) && gem.tags.length > 0, `${gem.id} needs at least one tag`);
    assert.ok(gem.tags.includes('attack'), `${gem.id} should be tagged 'attack'`);
    for (const tag of gem.tags) assert.ok(VALID_TAGS.includes(tag), `${gem.id} has an unknown tag "${tag}"`);
  }
});

test('every support gem targets at least one known tag and has a cost/currency', () => {
  for (const support of SUPPORT_GEMS) {
    assert.equal(support.gemType, 'support');
    assert.ok(Array.isArray(support.appliesToTags) && support.appliesToTags.length > 0, `${support.id} needs appliesToTags`);
    for (const tag of support.appliesToTags) assert.ok(VALID_TAGS.includes(tag), `${support.id} targets an unknown tag "${tag}"`);
    assert.ok(support.mods && Object.keys(support.mods).length > 0, `${support.id} should have at least one mod`);
    assert.ok(support.cost > 0);
    assert.equal(support.currency, 'voidShard');
  }
});

test('getGemById resolves both skill and support gems, and returns undefined for unknown ones', () => {
  assert.equal(getGemById('cinder_shot').name, 'Cinder Shot');
  assert.equal(getGemById('support_volley').name, 'Volley Support');
  assert.equal(getGemById('not_a_real_gem'), undefined);
});
