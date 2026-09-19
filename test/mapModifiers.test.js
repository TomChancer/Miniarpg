import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAP_MODIFIERS, rollMapModifiers, combineModifierEffects, getMapModifierById } from '../src/mapModifiers.js';

const VALID_EFFECT_KEYS = ['packSizePct', 'spawnRatePct', 'monsterToughnessPct', 'rarityBonus', 'reducedDefensesPct', 'volatileDeaths'];

test('every modifier definition has a valid kind, at least one effect, and a description referencing every effect key', () => {
  for (const mod of MAP_MODIFIERS) {
    assert.ok(['positive', 'negative'].includes(mod.kind), `${mod.id} has an unknown kind`);
    assert.ok(Object.keys(mod.effects).length > 0, `${mod.id} has no effects`);
    for (const [key, range] of Object.entries(mod.effects)) {
      assert.ok(VALID_EFFECT_KEYS.includes(key), `${mod.id} has an unknown effect key "${key}"`);
      // Numeric ranges get interpolated into the description; a flat boolean
      // flag (e.g. volatileDeaths) has nothing to interpolate.
      if (range !== true) assert.ok(mod.description.includes(`{${key}}`), `${mod.id}'s description doesn't mention {${key}}`);
    }
  }
});

test('negative modifiers always bundle their own packSizePct and rarityBonus compensation', () => {
  for (const mod of MAP_MODIFIERS.filter((m) => m.kind === 'negative')) {
    assert.ok('packSizePct' in mod.effects, `${mod.id} should compensate with packSizePct`);
    assert.ok('rarityBonus' in mod.effects, `${mod.id} should compensate with rarityBonus`);
  }
});

test('rollMapModifiers returns the requested count of DISTINCT modifiers with ranges respected and the description filled in', () => {
  for (let i = 0; i < 50; i++) {
    const rolled = rollMapModifiers(3);
    assert.equal(rolled.length, 3);
    assert.equal(new Set(rolled.map((m) => m.id)).size, 3, 'rolled modifiers should be distinct');
    for (const mod of rolled) {
      const def = getMapModifierById(mod.id);
      assert.ok(!mod.description.includes('{'), `${mod.id}'s description should have its placeholders filled in`);
      for (const [key, value] of Object.entries(mod.effects)) {
        const range = def.effects[key];
        if (range === true) assert.equal(value, true);
        else assert.ok(value >= range[0] && value <= range[1], `${mod.id}.${key}=${value} out of range [${range}]`);
      }
    }
  }
});

test('rollMapModifiers clamps to the pool size rather than erroring if asked for more than exists', () => {
  const rolled = rollMapModifiers(999);
  assert.equal(rolled.length, MAP_MODIFIERS.length);
});

test('combineModifierEffects sums numeric effects across modifiers and ORs the volatileDeaths flag', () => {
  const combined = combineModifierEffects([
    { id: 'a', effects: { packSizePct: 15, rarityBonus: 10 } },
    { id: 'b', effects: { packSizePct: 20, monsterToughnessPct: 25 } },
    { id: 'c', effects: { volatileDeaths: true } },
  ]);
  assert.equal(combined.packSizePct, 35);
  assert.equal(combined.rarityBonus, 10);
  assert.equal(combined.monsterToughnessPct, 25);
  assert.equal(combined.spawnRatePct, 0);
  assert.equal(combined.reducedDefensesPct, 0);
  assert.equal(combined.volatileDeaths, true);
});

test('combineModifierEffects returns all-zero/false defaults for an empty list', () => {
  const combined = combineModifierEffects([]);
  assert.deepEqual(combined, {
    packSizePct: 0, spawnRatePct: 0, monsterToughnessPct: 0,
    rarityBonus: 0, reducedDefensesPct: 0, volatileDeaths: false,
  });
});
