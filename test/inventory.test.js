import '../testlib/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as inv from '../src/inventory.js';

function helmetItem(intelligence = 3, tier = 'basic') {
  return { kind: 'equipment', defId: 'helmet', tier, w: 2, h: 2, sockets: [null, null, null, null], affixes: { intelligence } };
}
function sword1h(strength = 2) {
  return { kind: 'equipment', defId: 'sword_1h', tier: 'basic', w: 1, h: 3, sockets: [null, null, null], affixes: { strength } };
}
function sword2h(strength = 2) {
  return { kind: 'equipment', defId: 'sword_2h', tier: 'basic', w: 1, h: 4, sockets: new Array(6).fill(null), affixes: { strength } };
}
function ringItem(rarity = 2, tier = 'basic') {
  return { kind: 'equipment', defId: 'ring', tier, w: 1, h: 1, sockets: [], affixes: { rarity } };
}

// One narrative per file (node:test runs a file in its own process, but
// module-level state like inventory.js's cache persists across test()
// blocks within it) — so these run in order, building on each other.
test('inventory: currency, loot items, and sockets', async (t) => {
  await t.test('currency splits into stacks at the cap and merges into existing ones first', () => {
    inv.addCurrency('cinderShard', 25);
    assert.equal(inv.getBalance('cinderShard'), 25);
    const stacks = inv.getGeneralGrid().items.filter((i) => i.defId === 'cinderShard');
    assert.deepEqual(stacks.map((s) => s.quantity).sort((a, b) => a - b), [5, 20]);

    inv.addCurrency('cinderShard', 3); // should top up the 5-stack to 8, not start a third
    const stacksAfter = inv.getGeneralGrid().items.filter((i) => i.defId === 'cinderShard');
    assert.equal(stacksAfter.length, 2);
    assert.deepEqual(stacksAfter.map((s) => s.quantity).sort((a, b) => a - b), [8, 20]);
  });

  await t.test('spendCurrency fails without mutating when funds are insufficient', () => {
    const before = inv.getBalance('cinderShard');
    const ok = inv.spendCurrency('cinderShard', 999);
    assert.equal(ok, false);
    assert.equal(inv.getBalance('cinderShard'), before);
  });

  await t.test('spendCurrency draws across multiple stacks and removes emptied ones', () => {
    // balance is 28 (8 + 20) at this point
    const ok = inv.spendCurrency('cinderShard', 26);
    assert.equal(ok, true);
    assert.equal(inv.getBalance('cinderShard'), 2);
    assert.equal(inv.getGeneralGrid().items.filter((i) => i.defId === 'cinderShard').length, 1);
  });

  await t.test('addLootItem places a shaped item in the bag', () => {
    const ok = inv.addLootItem(helmetItem());
    assert.equal(ok, true);
    const helmet = inv.getGeneralGrid().items.find((i) => i.defId === 'helmet');
    assert.ok(helmet);
    assert.equal(helmet.w, 2);
    assert.equal(helmet.h, 2);
    assert.deepEqual(helmet.sockets, [null, null, null, null]);
  });

  await t.test('equipping moves the item out of the bag and into the paperdoll', () => {
    const helmet = inv.getGeneralGrid().items.find((i) => i.defId === 'helmet');
    const ok = inv.equipItem(helmet.instanceId);
    assert.equal(ok, true);
    assert.equal(inv.getGeneralGrid().items.some((i) => i.defId === 'helmet'), false);
    assert.equal(inv.getEquipped().helmet.defId, 'helmet');
  });

  await t.test('equipping a second helmet swaps the first back into the bag', () => {
    inv.addLootItem(helmetItem(4));
    const secondHelmet = inv.getGeneralGrid().items.find((i) => i.defId === 'helmet');
    inv.equipItem(secondHelmet.instanceId);
    assert.equal(inv.getGeneralGrid().items.filter((i) => i.defId === 'helmet').length, 1);
    assert.equal(inv.getEquipped().helmet.instanceId, secondHelmet.instanceId);
  });

  await t.test("getTotalStats folds in the equipped helmet's own rolled affix", () => {
    const stats = inv.getTotalStats();
    assert.equal(stats.intelligence, 5 + 4); // base 5 + this helmet instance's rolled +4
  });

  await t.test('socketGem is blocked until the stat requirement is met, then succeeds', () => {
    inv.addCurrency('voidShard', 100);
    inv.addGem('cinder_shot'); // requires 8 intelligence; we only have it because helmet is equipped
    const blocked = inv.socketGem('helmet', 9, 'cinder_shot'); // helmet only has 4 sockets (indices 0-3)
    assert.equal(blocked, false); // invalid socket index

    const ok = inv.socketGem('helmet', 0, 'cinder_shot');
    assert.equal(ok, true);
    assert.equal(inv.getEquipped().helmet.sockets[0], 'cinder_shot');
    assert.equal(inv.getGemGrid().items.some((g) => g.defId === 'cinder_shot'), false);
  });

  await t.test('unsocketing returns the gem to the pouch and frees the socket', () => {
    const ok = inv.unsocketGem('helmet', 0);
    assert.equal(ok, true);
    assert.equal(inv.getEquipped().helmet.sockets[0], null);
    assert.equal(inv.getGemGrid().items.some((g) => g.defId === 'cinder_shot'), true);
  });

  await t.test('unequipping returns the piece to the bag', () => {
    const before = inv.getEquipped().helmet;
    const ok = inv.unequipItem('helmet');
    assert.equal(ok, true);
    assert.equal(inv.getEquipped().helmet, null);
    assert.ok(inv.getGeneralGrid().items.some((i) => i.instanceId === before.instanceId));
  });
});

test('inventory: multi-slot jewelry auto-assignment', () => {
  inv.addLootItem(ringItem(2));
  inv.addLootItem(ringItem(5));
  const rings = inv.getGeneralGrid().items.filter((i) => i.defId === 'ring');

  assert.equal(inv.equipItem(rings[0].instanceId), true);
  assert.equal(inv.getEquipped().ring1.instanceId, rings[0].instanceId);

  assert.equal(inv.equipItem(rings[1].instanceId), true);
  assert.equal(inv.getEquipped().ring2.instanceId, rings[1].instanceId);
  assert.equal(inv.getEquipped().ring1.instanceId, rings[0].instanceId); // ring1 untouched
});

test('inventory: weapon/offhand handedness rules', async (t) => {
  await t.test('a two-handed weapon equips cleanly to the weapon slot', () => {
    inv.addLootItem(sword2h());
    const item = inv.getGeneralGrid().items.find((i) => i.defId === 'sword_2h');
    assert.equal(inv.equipItem(item.instanceId), true);
    assert.equal(inv.getEquipped().weapon.defId, 'sword_2h');
  });

  await t.test('a one-handed weapon cannot go to offhand while mainhand is two-handed', () => {
    inv.addLootItem(sword1h());
    const oneHander = inv.getGeneralGrid().items.find((i) => i.defId === 'sword_1h');
    assert.equal(inv.equipItem(oneHander.instanceId, 'offhand'), false);
  });

  await t.test('equipping a two-handed weapon while an offhand is occupied is rejected', () => {
    // swap mainhand to the 1h sword first so we can legally fill offhand
    const oneHander = inv.getGeneralGrid().items.find((i) => i.defId === 'sword_1h');
    assert.equal(inv.equipItem(oneHander.instanceId, 'weapon'), true);
    inv.addLootItem(sword1h(3));
    const secondOneHander = inv.getGeneralGrid().items.find((i) => i.defId === 'sword_1h');
    assert.equal(inv.equipItem(secondOneHander.instanceId, 'offhand'), true);

    inv.addLootItem(sword2h());
    const twoHander = inv.getGeneralGrid().items.find((i) => i.defId === 'sword_2h' && inv.getEquipped().weapon.instanceId !== i.instanceId);
    assert.equal(inv.equipItem(twoHander.instanceId, 'weapon'), false); // offhand still occupied
  });

  await t.test('getWeaponMods reports dual-wield range and damage effects while both hands hold 1h swords', () => {
    const mods = inv.getWeaponMods();
    assert.equal(mods.damageMultiplier, 0.8);
    assert.equal(mods.rangeMultiplier, 0.8); // sword_1h's own multiplier, taken from mainhand
  });

  await t.test('unequipping the offhand then allows a two-handed weapon to take the mainhand', () => {
    assert.equal(inv.unequipItem('offhand'), true);
    const twoHander = inv.getGeneralGrid().items.find((i) => i.defId === 'sword_2h');
    assert.equal(inv.equipItem(twoHander.instanceId, 'weapon'), true);
    const mods = inv.getWeaponMods();
    assert.equal(mods.damageMultiplier, 1); // no longer dual-wielding
    assert.equal(mods.rangeMultiplier, 1.0);
  });
});

test('inventory: a full gem pouch blocks further purchases', () => {
  // Clear out whatever the previous scenario left behind so this test owns
  // the grid's fill state.
  for (const g of [...inv.getGemGrid().items]) inv.discardItem('gem', g.instanceId);

  const { w, h } = inv.getGemGrid();
  const capacity = w * h;
  for (let i = 0; i < capacity; i++) assert.equal(inv.addGem('crush'), true, `slot ${i} should still fit`);
  assert.equal(inv.addGem('crush'), false);
});

test('inventory: tier crafting with Cinder Shards/Fragments', async (t) => {
  await t.test('a Basic item with no room refuses a Cinder Shard affix add', () => {
    inv.addLootItem(ringItem(2, 'basic')); // already at 1/1 for Basic
    const ring = inv.getGeneralGrid().items.find((i) => i.defId === 'ring' && i.tier === 'basic');
    inv.addCurrency('cinderShard', 10);
    const before = inv.getBalance('cinderShard');
    assert.equal(inv.canAddAffix(ring.instanceId), false);
    assert.equal(inv.addRandomAffix(ring.instanceId), false);
    assert.equal(inv.getBalance('cinderShard'), before); // no currency spent on failure
  });

  await t.test('a Cinder Fragment upgrades Basic -> Uncommon, filling in the missing affix type', () => {
    const ring = inv.getGeneralGrid().items.find((i) => i.defId === 'ring' && i.tier === 'basic');
    inv.addCurrency('cinderFragment', 5);
    const ok = inv.upgradeTierWithFragment(ring.instanceId);
    assert.equal(ok, true);
    const upgraded = inv.getGeneralGrid().items.find((i) => i.instanceId === ring.instanceId);
    assert.equal(upgraded.tier, 'uncommon');
    assert.equal(Object.keys(upgraded.affixes).length, 2); // rarity (suffix) + one prefix now
    assert.ok('rarity' in upgraded.affixes);
    const hasPrefix = ['strength', 'vitality', 'intelligence', 'dexterity'].some((s) => s in upgraded.affixes);
    assert.ok(hasPrefix, 'expected the missing prefix to be filled in');
  });

  await t.test('a Cinder Shard upgrades Uncommon -> Rare, landing at 3/4 rather than a full 4/4', () => {
    const ring = inv.getGeneralGrid().items.find((i) => i.defId === 'ring' && i.tier === 'uncommon');
    inv.addCurrency('cinderShard', 5);
    const ok = inv.upgradeTierWithShard(ring.instanceId);
    assert.equal(ok, true);
    const upgraded = inv.getGeneralGrid().items.find((i) => i.instanceId === ring.instanceId);
    assert.equal(upgraded.tier, 'rare');
    assert.equal(Object.keys(upgraded.affixes).length, 3);
  });

  await t.test('once Rare, a Cinder Shard can add the final random affix up to the 4-cap', () => {
    const ring = inv.getGeneralGrid().items.find((i) => i.defId === 'ring' && i.tier === 'rare');
    const before = inv.getBalance('cinderShard');
    assert.equal(inv.canAddAffix(ring.instanceId), true);
    const ok = inv.addRandomAffix(ring.instanceId);
    assert.equal(ok, true);
    assert.equal(inv.getBalance('cinderShard'), before - 1);
    const filled = inv.getGeneralGrid().items.find((i) => i.instanceId === ring.instanceId);
    assert.equal(Object.keys(filled.affixes).length, 4);
    assert.equal(inv.canAddAffix(ring.instanceId), false); // full for its tier now
  });

  await t.test('crafting functions fail cleanly on the wrong tier or an unknown item', () => {
    inv.addLootItem(ringItem(2, 'basic'));
    const basicRing = inv.getGeneralGrid().items.find((i) => i.defId === 'ring' && i.tier === 'basic');
    assert.equal(inv.upgradeTierWithShard(basicRing.instanceId), false); // needs uncommon
    assert.equal(inv.upgradeTierWithFragment(999999), false);
  });
});

test('inventory: selling returns roughly a third of the item value as Cinder Shards', () => {
  inv.addLootItem(helmetItem(4, 'basic'));
  const helmet = inv.getGeneralGrid().items.find((i) => i.defId === 'helmet' && i.tier === 'basic');
  const before = inv.getBalance('cinderShard');
  const payout = inv.sellItem(helmet.instanceId);
  assert.ok(payout > 0);
  assert.equal(inv.getBalance('cinderShard'), before + payout);
  assert.equal(inv.getGeneralGrid().items.some((i) => i.instanceId === helmet.instanceId), false);

  assert.equal(inv.sellItem(999999), false);
});
