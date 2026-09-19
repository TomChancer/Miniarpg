import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, MAP_IDS, ROOT_MAP_ID, MAP_TREE_SIZE, getMapDef, getMapToughnessBasePct } from '../src/maps.js';

test('every map tier 1-6 is represented, and only the root is tier 1', () => {
  const tiers = Object.values(MAPS).map((m) => m.tier);
  for (let tier = 1; tier <= 6; tier++) {
    assert.ok(tiers.includes(tier), `no map found for tier ${tier}`);
  }
  assert.ok(tiers.every((t) => t >= 1 && t <= 6));
  assert.deepEqual(Object.values(MAPS).filter((m) => m.tier === 1).map((m) => m.id), [ROOT_MAP_ID]);
});

test('the root map is tier 1 and always Ashen Grove', () => {
  assert.equal(ROOT_MAP_ID, 'ashen_grove');
  assert.equal(getMapDef(ROOT_MAP_ID).tier, 1);
});

test('every map has between 1 and 3 connections, none to itself or a duplicate', () => {
  for (const map of Object.values(MAPS)) {
    assert.ok(map.connections.length >= 1 && map.connections.length <= 3, `${map.id} has ${map.connections.length} connections`);
    assert.ok(!map.connections.includes(map.id), `${map.id} connects to itself`);
    assert.equal(new Set(map.connections).size, map.connections.length, `${map.id} has a duplicate connection`);
  }
});

test('every map connection is bidirectional (a proper web, not one-way arrows)', () => {
  for (const map of Object.values(MAPS)) {
    for (const otherId of map.connections) {
      const other = MAPS[otherId];
      assert.ok(other, `${map.id} connects to unknown map "${otherId}"`);
      assert.ok(other.connections.includes(map.id), `${otherId} is missing the reverse edge back to ${map.id}`);
    }
  }
});

test('every map is reachable from the root by following connections', () => {
  const seen = new Set([ROOT_MAP_ID]);
  const queue = [ROOT_MAP_ID];
  while (queue.length) {
    const id = queue.shift();
    for (const nextId of MAPS[id].connections) {
      if (!seen.has(nextId)) {
        seen.add(nextId);
        queue.push(nextId);
      }
    }
  }
  assert.deepEqual(MAP_IDS.filter((id) => !seen.has(id)), []);
});

test('every map has a position within the map tree canvas bounds', () => {
  for (const map of Object.values(MAPS)) {
    assert.ok(map.x >= 0 && map.x <= MAP_TREE_SIZE.width, `${map.id}'s x (${map.x}) is outside the canvas`);
    assert.ok(map.y >= 0 && map.y <= MAP_TREE_SIZE.height, `${map.id}'s y (${map.y}) is outside the canvas`);
  }
});

test('toughness base % increases with tier and tier 1 has no bonus', () => {
  let prev = -1;
  for (let tier = 1; tier <= 6; tier++) {
    const id = Object.values(MAPS).find((m) => m.tier === tier).id;
    const pct = getMapToughnessBasePct(id);
    assert.ok(pct > prev, `tier ${tier}'s toughness bonus (${pct}%) should exceed tier ${tier - 1}'s (${prev}%)`);
    prev = pct;
  }
  assert.equal(getMapToughnessBasePct(ROOT_MAP_ID), 0);
});

test('each tier-over-tier toughness jump is roughly the requested 10-15%, compounding', () => {
  const pctByTier = [1, 2, 3, 4, 5, 6].map((tier) => {
    const id = Object.values(MAPS).find((m) => m.tier === tier).id;
    return getMapToughnessBasePct(id);
  });
  for (let i = 1; i < pctByTier.length; i++) {
    const growth = (1 + pctByTier[i] / 100) / (1 + pctByTier[i - 1] / 100);
    assert.ok(growth > 1.08 && growth < 1.18, `tier ${i} -> ${i + 1} grew by ${((growth - 1) * 100).toFixed(1)}%, expected ~10-15%`);
  }
});
