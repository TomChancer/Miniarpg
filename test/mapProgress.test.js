import '../testlib/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as prog from '../src/mapProgress.js';

test('the root map starts unlocked; everything else starts locked', () => {
  assert.equal(prog.isUnlocked('ashen_grove'), true);
  assert.equal(prog.isUnlocked('ashen_hollow'), false);
  assert.equal(prog.isUnlocked('smoldering_abyss'), false);
});

test('clearing a map unlocks whatever connects back to it, without re-locking the root', () => {
  assert.equal(prog.isCleared('ashen_grove'), false);
  prog.markCleared('ashen_grove');
  assert.equal(prog.isCleared('ashen_grove'), true);
  assert.equal(prog.isUnlocked('ashen_hollow'), true);
  assert.equal(prog.isUnlocked('cinder_wastes'), false); // still two hops away
  assert.equal(prog.isUnlocked('ashen_grove'), true);
});

test('marking the same map cleared twice does not duplicate it', () => {
  prog.markCleared('ashen_grove');
  assert.deepEqual(prog.getClearedMaps().filter((id) => id === 'ashen_grove').length, 1);
});

test('unlocking chains along the tree as each subsequent map is cleared', () => {
  prog.markCleared('ashen_hollow');
  assert.equal(prog.isUnlocked('cinder_wastes'), true);
  assert.equal(prog.isUnlocked('cinder_expanse'), false);
});

test('an unknown map id is neither cleared nor unlockable', () => {
  assert.equal(prog.isCleared('not_a_real_map'), false);
  assert.equal(prog.isUnlocked('not_a_real_map'), false);
});
