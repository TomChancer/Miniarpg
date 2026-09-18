import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_ITEMS, BASE_ITEM_IDS, SLOTS, SLOT_CATEGORY, getBaseItem } from '../src/equipment.js';

const VALID_CATEGORIES = ['helmet', 'chest', 'legs', 'ring', 'amulet', 'trinket', 'weapon'];
const VALID_STATS = ['strength', 'vitality', 'intelligence', 'dexterity', 'rarity', 'attackSpeedPct'];

test('every base item has a valid category, shape, socket cap, and non-empty stat pool', () => {
  for (const item of Object.values(BASE_ITEMS)) {
    assert.ok(VALID_CATEGORIES.includes(item.slotCategory), `${item.id} has an unknown slotCategory`);
    assert.ok(item.shape.w > 0 && item.shape.h > 0);
    assert.ok(item.socketCap >= 0);
    assert.ok(item.statPool.length > 0);
    for (const entry of item.statPool) {
      assert.ok(VALID_STATS.includes(entry.stat), `${item.id} pool has an unknown stat "${entry.stat}"`);
      assert.ok(entry.min <= entry.max);
    }
  }
});

test('jewelry has no sockets; armor and weapons do', () => {
  for (const id of ['ring', 'amulet', 'trinket']) {
    assert.equal(getBaseItem(id).socketCap, 0);
  }
  for (const id of ['helmet', 'legs']) assert.equal(getBaseItem(id).socketCap, 4);
  assert.equal(getBaseItem('chest').socketCap, 6);
});

test('weapon handedness matches the sockets/range rules: 1h caps at 3, 2h caps at 6', () => {
  assert.equal(getBaseItem('sword_1h').handedness, 'one');
  assert.equal(getBaseItem('sword_1h').socketCap, 3);

  for (const id of ['sword_2h', 'staff', 'bow']) {
    assert.equal(getBaseItem(id).handedness, 'two', `${id} should be two-handed`);
    assert.equal(getBaseItem(id).socketCap, 6);
  }
});

test('weapon range multipliers follow 1h < 2h sword < staff < bow', () => {
  const oneH = getBaseItem('sword_1h').rangeMultiplier;
  const twoH = getBaseItem('sword_2h').rangeMultiplier;
  const staff = getBaseItem('staff').rangeMultiplier;
  const bow = getBaseItem('bow').rangeMultiplier;
  assert.ok(oneH < twoH);
  assert.ok(twoH < staff);
  assert.ok(staff < bow);
});

test('SLOT_CATEGORY covers every paperdoll slot and matches ring/trinket/offhand semantics', () => {
  for (const slot of SLOTS) assert.ok(SLOT_CATEGORY[slot], `${slot} has no category mapping`);
  assert.equal(SLOT_CATEGORY.ring1, 'ring');
  assert.equal(SLOT_CATEGORY.ring2, 'ring');
  assert.equal(SLOT_CATEGORY.trinket1, 'trinket');
  assert.equal(SLOT_CATEGORY.trinket2, 'trinket');
  assert.equal(SLOT_CATEGORY.weapon, 'weapon');
  assert.equal(SLOT_CATEGORY.offhand, 'weapon');
});

test('getBaseItem resolves known ids and returns undefined for unknown ones', () => {
  assert.equal(getBaseItem('helmet').slotCategory, 'helmet');
  assert.equal(getBaseItem('not_real'), undefined);
  assert.equal(BASE_ITEM_IDS.includes('bow'), true);
});
