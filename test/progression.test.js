import '../testlib/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as prog from '../src/progression.js';
import * as inv from '../src/inventory.js';

test('xpToNext follows the PoE-style curve at pinned reference levels', () => {
  assert.equal(prog.xpToNext(1), 20);
  assert.equal(prog.xpToNext(5), 690);
  assert.equal(prog.xpToNext(10), 3170);
});

test('progression: XP, leveling, and both trees', async (t) => {
  await t.test('addXp levels up exactly once when given exactly enough XP', () => {
    assert.equal(prog.getLevel(), 1);
    const result = prog.addXp(prog.xpToNext(1));
    assert.equal(result.levelsGained, 1);
    assert.equal(prog.getLevel(), 2);
    assert.equal(prog.getXp(), 0);
    assert.equal(prog.getAvailablePoints('player'), 1);
  });

  await t.test('addXp can trigger multiple level-ups from one large grant', () => {
    const before = prog.getLevel();
    const needed = prog.xpToNext(2) + prog.xpToNext(3) + prog.xpToNext(4) + 5; // 3 full levels + leftover
    const result = prog.addXp(needed);
    assert.equal(result.levelsGained, 3);
    assert.equal(prog.getLevel(), before + 3);
    assert.equal(prog.getXp(), 5);
  });

  await t.test('canAllocate requires connectivity to an already-allocated node', () => {
    assert.equal(prog.isAllocated('player', 'start'), true);
    assert.equal(prog.canAllocate('player', 'str2'), false); // str1 not allocated yet
    assert.equal(prog.canAllocate('player', 'str1'), true);
  });

  await t.test('allocateNode spends a point and unlocks the next node in the spoke', () => {
    const pointsBefore = prog.getAvailablePoints('player');
    assert.equal(prog.allocateNode('player', 'str1'), true);
    assert.equal(prog.getAvailablePoints('player'), pointsBefore - 1);
    assert.equal(prog.canAllocate('player', 'str2'), pointsBefore - 1 >= 1);
  });

  await t.test('allocateNode fails outright on an unaffordable or already-allocated node', () => {
    assert.equal(prog.allocateNode('player', 'str1'), false); // already allocated
    // spend down to 0 to test the insufficient-points path
    while (prog.getAvailablePoints('player') > 0) {
      const next = ['str2', 'str3', 'str4', 'vit1', 'int1', 'dex1', 'rar1'].find((id) => prog.canAllocate('player', id));
      if (!next) break;
      prog.allocateNode('player', next);
    }
    assert.equal(prog.getAvailablePoints('player'), 0);
    assert.equal(prog.canAllocate('player', 'vit2') || prog.canAllocate('player', 'int2'), false);
  });

  await t.test("Berserker's Heart keystone contributes damage/HP multipliers once fully allocated", () => {
    prog.addXp(10000); // plenty of points to finish the STR spoke + keystone
    prog.allocateNode('player', 'str2');
    prog.allocateNode('player', 'str3');
    prog.allocateNode('player', 'str4');
    assert.equal(prog.canAllocate('player', 'str_keystone'), true);
    assert.equal(prog.allocateNode('player', 'str_keystone'), true);

    const mods = prog.getPlayerKeystoneMods();
    assert.equal(mods.damageMultiplier, 1.4);
    assert.equal(mods.hpMultiplier, 0.7);
  });

  await t.test('resetTree refunds every spent point and clears allocation', () => {
    const spentBefore = prog.getAllocatedNodes('player').length - 1; // exclude free 'start'
    const availableBefore = prog.getAvailablePoints('player');
    prog.resetTree('player');
    assert.deepEqual(prog.getAllocatedNodes('player'), ['start']);
    assert.equal(prog.getPlayerKeystoneMods().damageMultiplier, 1); // keystone effect gone
    assert.ok(spentBefore > 0); // sanity: there was actually something to refund
    assert.equal(prog.getAvailablePoints('player') > availableBefore, true);
  });

  await t.test('Overrun keystone (mapping tree) combines a stat bonus with map modifiers', () => {
    for (let i = 0; i < 6; i++) prog.awardMappingPoint();
    prog.allocateNode('mapping', 'pack1');
    prog.allocateNode('mapping', 'pack2');
    prog.allocateNode('mapping', 'pack3');
    prog.allocateNode('mapping', 'pack4');
    assert.equal(prog.allocateNode('mapping', 'pack_keystone'), true);

    const mapMods = prog.getMapModifiers();
    assert.equal(mapMods.packSizePct, 20 + 50); // 4 nodes * 5% + keystone's 50%
    assert.equal(mapMods.enemyDamagePct, 25);
    assert.equal(inv.getTotalStats().rarity, 30); // keystone's rarity bonus, folded into stats
  });
});
