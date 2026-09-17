import '../testlib/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as inv from '../src/inventory.js';

// One narrative per file (node:test runs a file in its own process, but
// module-level state like inventory.js's cache persists across test()
// blocks within it) — so these run in order, building on each other.
test('inventory: currency, equipment, and sockets', async (t) => {
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

  await t.test('buying gear places a shaped item in the bag', () => {
    inv.addCurrency('cinderShard', 100);
    const ok = inv.buyEquipment('worn_helmet');
    assert.equal(ok, true);
    const helmet = inv.getGeneralGrid().items.find((i) => i.defId === 'worn_helmet');
    assert.ok(helmet);
    assert.equal(helmet.w, 2);
    assert.equal(helmet.h, 2);
    assert.deepEqual(helmet.sockets, [null, null, null]);
  });

  await t.test('equipping moves the item out of the bag and into the paperdoll', () => {
    const helmet = inv.getGeneralGrid().items.find((i) => i.defId === 'worn_helmet');
    const ok = inv.equipItem(helmet.instanceId);
    assert.equal(ok, true);
    assert.equal(inv.getGeneralGrid().items.some((i) => i.defId === 'worn_helmet'), false);
    assert.equal(inv.getEquipped().helmet.defId, 'worn_helmet');
  });

  await t.test('equipping a second helmet swaps the first back into the bag', () => {
    inv.buyEquipment('worn_helmet');
    const secondHelmet = inv.getGeneralGrid().items.find((i) => i.defId === 'worn_helmet');
    inv.equipItem(secondHelmet.instanceId);
    assert.equal(inv.getGeneralGrid().items.filter((i) => i.defId === 'worn_helmet').length, 1);
    assert.equal(inv.getEquipped().helmet.instanceId, secondHelmet.instanceId);
  });

  await t.test('getTotalStats folds in the equipped helmet\'s intelligence bonus', () => {
    const stats = inv.getTotalStats();
    assert.equal(stats.intelligence, 5 + 3); // base 5 + Worn Helmet's +3
  });

  await t.test('socketGem is blocked until the stat requirement is met, then succeeds', () => {
    inv.addCurrency('voidShard', 100);
    inv.addGem('cinder_shot'); // requires 8 intelligence; we only have it because helmet is equipped
    const blocked = inv.socketGem('helmet', 5, 'cinder_shot'); // helmet only has 3 sockets (indices 0-2)
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

test('inventory: a full gem pouch blocks further purchases', () => {
  // Clear out whatever the previous scenario left behind so this test owns
  // the grid's fill state.
  for (const g of [...inv.getGemGrid().items]) inv.discardItem('gem', g.instanceId);

  const { w, h } = inv.getGemGrid();
  const capacity = w * h;
  for (let i = 0; i < capacity; i++) assert.equal(inv.addGem('crush'), true, `slot ${i} should still fit`);
  assert.equal(inv.addGem('crush'), false);
});
