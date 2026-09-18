import '../testlib/env.js';
import { withFixedRandom } from '../testlib/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rollSocketCount,
  generateLootItem,
  TIER_AFFIX_CAPS,
  affixCounts,
  pickAffixType,
  pickMissingType,
  rollOneAffix,
  itemValue,
} from '../src/loot.js';
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

test('generateLootItem produces a correctly shaped, unplaced item with a tier', () => {
  for (const baseId of BASE_ITEM_IDS) {
    const item = generateLootItem(baseId);
    const base = getBaseItem(baseId);
    assert.equal(item.kind, 'equipment');
    assert.equal(item.defId, baseId);
    assert.ok(['basic', 'uncommon', 'rare'].includes(item.tier), `unexpected tier "${item.tier}"`);
    assert.equal(item.w, base.shape.w);
    assert.equal(item.h, base.shape.h);
    assert.ok(item.sockets.length <= base.socketCap);
    assert.ok(item.sockets.every((s) => s === null));
    assert.ok('instanceId' in item === false); // placement is inventory.js's job, not loot.js's
  }
});

test('generateLootItem with maxTier:"uncommon" never rolls rare (merchant stock rule)', () => {
  for (let i = 0; i < 200; i++) {
    const item = generateLootItem('ring', { maxTier: 'uncommon' });
    assert.notEqual(item.tier, 'rare');
  }
});

test("an item's affix count never exceeds its tier's total cap, and respects the prefix/suffix sub-caps", () => {
  for (let i = 0; i < 300; i++) {
    const item = generateLootItem('chest');
    const base = getBaseItem('chest');
    const caps = TIER_AFFIX_CAPS[item.tier];
    const entries = Object.entries(item.affixes);
    assert.ok(entries.length <= caps.total, `tier ${item.tier} rolled ${entries.length} affixes, cap is ${caps.total}`);
    const counts = affixCounts(item, base);
    assert.ok(counts.prefix <= caps.prefix);
    assert.ok(counts.suffix <= caps.suffix);
    for (const [stat, amount] of entries) {
      const candidates = base.statPool.filter((e) => e.stat === stat);
      assert.ok(candidates.length > 0, `${stat} isn't in chest's pool at all`);
      const value = stat === 'attackSpeedPct' ? amount * 100 : amount;
      assert.ok(candidates.some((c) => value >= c.min && value <= c.max), `${stat}=${value} out of range`);
    }
  }
});

test('a rare-tier item can roll up to its full 4-affix cap (2 prefix + 2 suffix)', () => {
  // Chest has 2 distinct prefix stats (str/vit) and 2 distinct suffix stats
  // (rarity/attackSpeedPct), so a rare roll should be able to reach 4/4.
  let sawFour = false;
  for (let i = 0; i < 500 && !sawFour; i++) {
    const item = generateLootItem('chest');
    if (item.tier === 'rare' && Object.keys(item.affixes).length === 4) sawFour = true;
  }
  assert.ok(sawFour, 'never saw a rare chest roll all 4 affixes across 500 tries');
});

test('jewelry always rolls zero sockets (socketCap 0)', () => {
  for (const baseId of ['ring', 'amulet', 'trinket']) {
    for (let i = 0; i < 20; i++) {
      assert.equal(generateLootItem(baseId).sockets.length, 0);
    }
  }
});

test('pickAffixType returns null once an item is full for its tier', () => {
  const base = getBaseItem('ring');
  const fullBasic = { affixes: { strength: 2 } };
  assert.equal(pickAffixType(fullBasic, base, 'basic'), null);

  const fullUncommon = { affixes: { strength: 2, rarity: 3 } };
  assert.equal(pickAffixType(fullUncommon, base, 'uncommon'), null);

  const partialRare = { affixes: { strength: 2, rarity: 3 } };
  assert.ok(['prefix', 'suffix'].includes(pickAffixType(partialRare, base, 'rare')));
});

test('pickMissingType prefers whichever affix type the item has fewer of', () => {
  const base = getBaseItem('ring');
  assert.equal(pickMissingType({ affixes: { strength: 2 } }, base), 'suffix');
  assert.equal(pickMissingType({ affixes: { rarity: 2 } }, base), 'prefix');
});

test('rollOneAffix never repeats a stat the item already has', () => {
  const base = getBaseItem('ring');
  for (let i = 0; i < 50; i++) {
    const rolled = rollOneAffix(base, 'prefix', { strength: 1, vitality: 1, intelligence: 1 });
    assert.equal(rolled.stat, 'dexterity');
  }
});

test('rollOneAffix returns null when no eligible stat remains', () => {
  const base = getBaseItem('ring');
  const rolled = rollOneAffix(base, 'suffix', { rarity: 1, attackSpeedPct: 0.02 });
  assert.equal(rolled, null);
});

test('itemValue grows with sockets and affix count', () => {
  const bare = { sockets: [], affixes: {} };
  const socketed = { sockets: [null, null, null], affixes: {} };
  const affixed = { sockets: [], affixes: { strength: 5, vitality: 5 } };
  assert.ok(itemValue(socketed) > itemValue(bare));
  assert.ok(itemValue(affixed) > itemValue(bare));
});
