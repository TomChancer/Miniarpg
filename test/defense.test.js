import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armourMitigation, evasionChance, ARMOUR_K, EVASION_K } from '../src/defense.js';

test('armourMitigation is zero with no armour, and rises with diminishing returns toward the 90% soft cap', () => {
  assert.equal(armourMitigation(0), 0);
  assert.equal(armourMitigation(-5), 0);

  const at100 = armourMitigation(ARMOUR_K); // half-value point -> exactly 45%
  assert.ok(Math.abs(at100 - 0.45) < 1e-9);

  const at300 = armourMitigation(ARMOUR_K * 3);
  const at900 = armourMitigation(ARMOUR_K * 9);
  assert.ok(at300 > at100);
  assert.ok(at900 > at300);

  // Diminishing returns: the SAME +K armour added at a higher starting point
  // gains less mitigation than adding it from zero.
  const gainFromZero = armourMitigation(ARMOUR_K) - armourMitigation(0);
  const gainFromHigh = armourMitigation(ARMOUR_K * 10 + ARMOUR_K) - armourMitigation(ARMOUR_K * 10);
  assert.ok(gainFromHigh < gainFromZero);

  // Never reaches, let alone exceeds, the 90% soft cap -- even absurd armour.
  assert.ok(armourMitigation(1_000_000) < 0.9);
  assert.ok(armourMitigation(1_000_000) > 0.899);
});

test('evasionChance follows the identical curve shape, independently of armour', () => {
  assert.equal(evasionChance(0), 0);
  const at100 = evasionChance(EVASION_K);
  assert.ok(Math.abs(at100 - 0.45) < 1e-9);
  assert.ok(evasionChance(1_000_000) < 0.9);
});
