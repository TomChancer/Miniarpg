import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EQUIPMENT_ITEMS, SLOTS, getEquipmentDef } from '../src/equipment.js';

test('every equipment item has a valid slot, shape, sockets, and currency', () => {
  for (const item of EQUIPMENT_ITEMS) {
    assert.ok(SLOTS.includes(item.slot), `${item.id} has an unknown slot "${item.slot}"`);
    assert.ok(item.sockets > 0);
    assert.ok(item.shape.w > 0 && item.shape.h > 0);
    assert.equal(item.currency, 'cinderShard');
    assert.ok(item.cost > 0);
  }
});

test('exactly one item exists per slot (no gaps, no duplicates)', () => {
  const slotsCovered = EQUIPMENT_ITEMS.map((i) => i.slot).sort();
  assert.deepEqual(slotsCovered, [...SLOTS].sort());
});

test('getEquipmentDef resolves known ids and returns undefined for unknown ones', () => {
  assert.equal(getEquipmentDef('worn_helmet').slot, 'helmet');
  assert.equal(getEquipmentDef('not_real'), undefined);
});
