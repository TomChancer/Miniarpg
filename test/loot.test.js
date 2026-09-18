import '../testlib/env.js';
import { withFixedRandom } from '../testlib/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollSocketCount, generateLootItem } from '../src/loot.js';
import { BASE_ITEM_IDS, getBaseItem } from '../src/equipment.js';

test('rollSocketCount stops at the first failed step and never exceeds cap', () => {
  // steps: [0.6, 0.45, 0.3, 0.08, 0.04, 0.02] — succeed, succeed, fail -> 2 sockets
  const count = withFixedRandom([0.1, 0.1, 0.9, 0, 0, 0], () => rollSocketCount(6));
  assert.equal(count, 2);
});

test('rollSocketCount never rolls beyond the item cap even on an endless success streak', () => {
  const count = withFixedRandom([0, 0, 0, 0, 0, 0, 0, 0], () => rollSocketCount(3));
  assert.equal(count, 3);
});

test('rollSocketCount can roll zero sockets', () => {
  const count = withFixedRandom([0.99], () => rollSocketCount(4));
  assert.equal(count, 0);
});

test('getting a socket beyond the third is meaningfully rarer than the first three, regardless of cap', () => {
  // Sample many rolls at a generous cap and confirm the distribution shape:
  // most items land at 0-3 sockets, very few reach 4+.
  let atLeast3 = 0;
  let atLeast4 = 0;
  const trials = 20000;
  for (let i = 0; i < trials; i++) {
    const count = rollSocketCount(6);
    if (count >= 3) atLeast3++;
    if (count >= 4) atLeast4++;
  }
  // P(>=3) ~= 0.6*0.45*0.3 = 0.081; P(>=4) ~= that * 0.08 = 0.00648 — roughly
  // an order of magnitude rarer. Assert the ratio loosely rather than pin
  // exact probabilities, to tolerate sampling noise.
  assert.ok(atLeast4 < atLeast3 / 5, `expected >=4 sockets to be much rarer than >=3 (got ${atLeast4} vs ${atLeast3})`);
});

test('generateLootItem produces a correctly shaped, unplaced item', () => {
  for (const baseId of BASE_ITEM_IDS) {
    const item = generateLootItem(baseId);
    const base = getBaseItem(baseId);
    assert.equal(item.kind, 'equipment');
    assert.equal(item.defId, baseId);
    assert.equal(item.w, base.shape.w);
    assert.equal(item.h, base.shape.h);
    assert.ok(item.sockets.length <= base.socketCap);
    assert.ok(item.sockets.every((s) => s === null));
    assert.ok('instanceId' in item === false); // placement is inventory.js's job, not loot.js's
  }
});

test('generateLootItem rolls 1-2 affixes, each within its stat pool range', () => {
  for (let i = 0; i < 200; i++) {
    const item = generateLootItem('ring');
    const base = getBaseItem('ring');
    const affixEntries = Object.entries(item.affixes);
    assert.ok(affixEntries.length >= 1 && affixEntries.length <= 2, `rolled ${affixEntries.length} affixes`);
    for (const [stat, amount] of affixEntries) {
      const candidates = base.statPool.filter((e) => e.stat === stat);
      assert.ok(candidates.length > 0, `${stat} isn't in ring's pool at all`);
      const value = stat === 'attackSpeedPct' ? amount * 100 : amount;
      assert.ok(candidates.some((c) => value >= c.min && value <= c.max), `${stat}=${value} out of range`);
    }
  }
});

test('jewelry always rolls zero sockets (socketCap 0)', () => {
  for (const baseId of ['ring', 'amulet', 'trinket']) {
    for (let i = 0; i < 20; i++) {
      assert.equal(generateLootItem(baseId).sockets.length, 0);
    }
  }
});
