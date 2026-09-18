import '../testlib/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as merchant from '../src/merchant.js';
import { BASE_ITEM_IDS } from '../src/equipment.js';

test('merchant starts with empty stock until refreshed', () => {
  assert.deepEqual(merchant.getStock(), []);
});

test('refreshStock generates between 4 and 10 items, each priced and shaped like real gear', () => {
  merchant.refreshStock();
  const stock = merchant.getStock();
  assert.ok(stock.length >= 4 && stock.length <= 10, `got ${stock.length} items`);
  for (const item of stock) {
    assert.ok(BASE_ITEM_IDS.includes(item.defId));
    assert.ok(item.price > 0);
    assert.ok(Array.isArray(item.sockets));
    assert.ok(typeof item.stockId === 'number');
  }
});

test('stockIds are unique even across multiple refreshes', () => {
  const before = merchant.getStock().map((i) => i.stockId);
  merchant.refreshStock();
  const after = merchant.getStock().map((i) => i.stockId);
  const allSeen = [...before, ...after];
  assert.equal(new Set(allSeen).size, allSeen.length);
});

test('removeFromStock removes exactly the targeted item', () => {
  const stock = merchant.getStock();
  const target = stock[0];
  const ok = merchant.removeFromStock(target.stockId);
  assert.equal(ok, true);
  assert.equal(merchant.getStock().some((i) => i.stockId === target.stockId), false);
  assert.equal(merchant.getStock().length, stock.length - 1);
});

test('removeFromStock on an unknown id is a no-op that reports failure', () => {
  const before = merchant.getStock().length;
  const ok = merchant.removeFromStock(999999);
  assert.equal(ok, false);
  assert.equal(merchant.getStock().length, before);
});
