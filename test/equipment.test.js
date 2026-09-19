import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_ITEMS, BASE_ITEM_IDS, SLOTS, SLOT_CATEGORY, getBaseItem } from '../src/equipment.js';

const VALID_CATEGORIES = ['helmet', 'chest', 'legs', 'ring', 'amulet', 'trinket', 'weapon'];
const ARMOR_SLOTS = ['helmet', 'chest', 'legs'];
const ARCHETYPES = ['armour', 'evasion', 'barrier'];
// Every armor slot comes in three pure base-type variants now (see equipment.js).
const ARMOR_ARCHETYPE_IDS = ARMOR_SLOTS.flatMap((slot) => ARCHETYPES.map((a) => `${slot}_${a}`));
const ARCHETYPE_ATTRIBUTE = { armour: 'strength', evasion: 'dexterity', barrier: 'intelligence' };
const JEWELRY_IDS = ['ring', 'amulet', 'trinket'];
const WEAPON_IDS = ['sword_1h', 'sword_2h', 'staff', 'bow'];
const LOCAL_DEFENSE_STATS = ['armourFlat', 'armourPct', 'evasionFlat', 'evasionPct', 'barrierFlat', 'barrierPct'];
const GLOBAL_DEFENSE_STATS = ['armourGlobalPct', 'evasionGlobalPct', 'barrierGlobalPct'];
const VALID_STATS = [
  'strength', 'vitality', 'intelligence', 'dexterity', 'rarity', 'attackSpeedPct',
  ...LOCAL_DEFENSE_STATS, ...GLOBAL_DEFENSE_STATS,
];
// Main attributes and all defensive stats are prefixes; everything else
// (currently just Rarity and Attack Speed) is a suffix.
const EXPECTED_AFFIX_TYPE = {
  strength: 'prefix', vitality: 'prefix', intelligence: 'prefix', dexterity: 'prefix',
  rarity: 'suffix', attackSpeedPct: 'suffix',
  ...Object.fromEntries([...LOCAL_DEFENSE_STATS, ...GLOBAL_DEFENSE_STATS].map((s) => [s, 'prefix'])),
};

test('every base item has a valid category, shape, socket cap, and non-empty stat pool', () => {
  for (const item of Object.values(BASE_ITEMS)) {
    assert.ok(VALID_CATEGORIES.includes(item.slotCategory), `${item.id} has an unknown slotCategory`);
    assert.ok(item.shape.w > 0 && item.shape.h > 0);
    assert.ok(item.socketCap >= 0);
    assert.ok(item.statPool.length > 0);
    for (const entry of item.statPool) {
      assert.ok(VALID_STATS.includes(entry.stat), `${item.id} pool has an unknown stat "${entry.stat}"`);
      assert.ok(entry.min <= entry.max);
      assert.equal(entry.type, EXPECTED_AFFIX_TYPE[entry.stat], `${item.id}'s ${entry.stat} entry has the wrong prefix/suffix tag`);
    }
  }
});

test('each armor slot has exactly one pure base type per defence archetype, sharing shape/socketCap but not affix pools', () => {
  for (const slot of ARMOR_SLOTS) {
    const variants = ARCHETYPES.map((a) => getBaseItem(`${slot}_${a}`));
    for (const item of variants) {
      assert.ok(item, `${slot} is missing an archetype variant`);
      assert.equal(item.slotCategory, slot);
    }
    // All three variants of one slot share the same physical footprint.
    assert.equal(variants[1].shape.w, variants[0].shape.w);
    assert.equal(variants[1].shape.h, variants[0].shape.h);
    assert.equal(variants[2].socketCap, variants[0].socketCap);
  }
});

test('an armor piece only carries defenseBase + local prefixes for its OWN archetype, never the other two', () => {
  for (const slot of ARMOR_SLOTS) {
    for (const archetype of ARCHETYPES) {
      const item = getBaseItem(`${slot}_${archetype}`);
      assert.ok(item.defenseBase, `${item.id} should have a defenseBase`);
      assert.ok(item.defenseBase[archetype] > 0, `${item.id}'s own defenseBase.${archetype} should be positive`);
      for (const other of ARCHETYPES) {
        if (other === archetype) continue;
        assert.equal(item.defenseBase[other] || 0, 0, `${item.id} should have no ${other} baseline`);
      }

      const stats = item.statPool.map((e) => e.stat);
      assert.ok(stats.includes(`${archetype}Flat`), `${item.id} should roll its own ${archetype}Flat`);
      assert.ok(stats.includes(`${archetype}Pct`), `${item.id} should roll its own ${archetype}Pct`);
      for (const other of ARCHETYPES) {
        if (other === archetype) continue;
        assert.ok(!stats.includes(`${other}Flat`), `${item.id} should NOT roll ${other}Flat`);
        assert.ok(!stats.includes(`${other}Pct`), `${item.id} should NOT roll ${other}Pct`);
      }
      // Each archetype leans the attribute that thematically governs it.
      assert.ok(stats.includes(ARCHETYPE_ATTRIBUTE[archetype]), `${item.id} should favor ${ARCHETYPE_ATTRIBUTE[archetype]}`);
      for (const other of ARCHETYPES) {
        if (other === archetype) continue;
        assert.ok(!stats.includes(ARCHETYPE_ATTRIBUTE[other]), `${item.id} should not favor ${ARCHETYPE_ATTRIBUTE[other]}`);
      }
      for (const stat of GLOBAL_DEFENSE_STATS) assert.ok(!stats.includes(stat), `${item.id} should NOT roll the jewelry-only ${stat}`);
    }
  }
});

test('jewelry rolls global % prefixes for any of the three defence types, unrestricted; weapons get none at all', () => {
  for (const id of JEWELRY_IDS) {
    const item = getBaseItem(id);
    assert.ok(!item.defenseBase, `${id} should have no defenseBase`);
    const stats = item.statPool.map((e) => e.stat);
    for (const stat of GLOBAL_DEFENSE_STATS) assert.ok(stats.includes(stat), `${id} should be able to roll ${stat}`);
    for (const stat of LOCAL_DEFENSE_STATS) assert.ok(!stats.includes(stat), `${id} should NOT roll the armor-local ${stat}`);
  }

  for (const id of WEAPON_IDS) {
    const item = getBaseItem(id);
    assert.ok(!item.defenseBase, `${id} should have no defenseBase`);
    const stats = item.statPool.map((e) => e.stat);
    for (const stat of [...LOCAL_DEFENSE_STATS, ...GLOBAL_DEFENSE_STATS]) {
      assert.ok(!stats.includes(stat), `${id} (a weapon) should not roll any defensive stat`);
    }
  }
});

test('jewelry has no sockets; armor and weapons do', () => {
  for (const id of JEWELRY_IDS) {
    assert.equal(getBaseItem(id).socketCap, 0);
  }
  for (const id of ARMOR_ARCHETYPE_IDS) {
    const expected = id.startsWith('chest_') ? 6 : 4;
    assert.equal(getBaseItem(id).socketCap, expected, `${id} has an unexpected socketCap`);
  }
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
  assert.equal(getBaseItem('helmet_armour').slotCategory, 'helmet');
  assert.equal(getBaseItem('not_real'), undefined);
  assert.equal(BASE_ITEM_IDS.includes('bow'), true);
});
