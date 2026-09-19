import '../testlib/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character, Enemy, buildWave } from '../src/entities.js';
import { armourMitigation, evasionChance, BARRIER_RECHARGE_DELAY_SEC } from '../src/defense.js';

test('buildWave scales enemy count with wave number and packSizePct', () => {
  const base = buildWave(1);
  assert.equal(base.length, 4 + Math.floor(1 * 1.8)); // 5

  const packed = buildWave(1, 50); // +50%
  assert.equal(packed.length, Math.round(5 * 1.5)); // 8

  // count never drops below 1 even with a large negative pack size
  const shrunk = buildWave(1, -100);
  assert.equal(shrunk.length, 1);
});

test('buildWave spawns exactly one elite on every 5th wave, as the last entry', () => {
  const wave5 = buildWave(5);
  assert.equal(wave5[wave5.length - 1].type, 'elite');
  assert.equal(wave5.slice(0, -1).every((e) => e.type === 'husk'), true);

  const wave4 = buildWave(4);
  assert.equal(wave4.every((e) => e.type === 'husk'), true);
});

test('Enemy stats scale with wave, enemyDamagePct, and toughnessPct', () => {
  const baseline = new Enemy(0, 0, 5, 'elite');
  assert.equal(baseline.maxHp, Math.round((10 + 5 * 4) * 4.5)); // 135
  assert.equal(baseline.damage, Math.round((3 + 5 * 0.8) * 2.2)); // 15
  assert.equal(baseline.value, 5);
  assert.equal(baseline.xpValue, 10);

  const toughened = new Enemy(0, 0, 5, 'elite', 0, 12); // +12% toughness
  assert.equal(toughened.maxHp, Math.round(135 * 1.12));
  assert.equal(toughened.value, Math.round(5 * 1.12));
  assert.equal(toughened.xpValue, Math.round(10 * 1.12));

  const angrier = new Enemy(0, 0, 5, 'husk', 25, 0); // Overrun's +25% enemy damage
  const plainHusk = new Enemy(0, 0, 5, 'husk');
  assert.equal(angrier.damage, Math.round(plainHusk.damage * 1.25));
});

test('Enemy value never rounds down to zero even at very low toughness', () => {
  const e = new Enemy(0, 0, 1, 'husk', 0, -90);
  assert.ok(e.value >= 1);
});

test('Character derives HP/mana from stats, and armour/evasion/barrier from the defense param', () => {
  const stats = { strength: 5, vitality: 10, intelligence: 8, dexterity: 40, rarity: 0 };
  const plain = new Character(0, 0, stats);
  assert.equal(plain.maxHp, 60 + 10 * 8); // 140
  assert.equal(plain.maxMana, 20 + 8 * 6); // 68
  // No defense param supplied: everything defaults to zero, not the old
  // dexterity-derived formula -- Evasion is now purely gear/defense-stat driven.
  assert.equal(plain.armourMitigation, 0);
  assert.equal(plain.evasionChance, 0);
  assert.equal(plain.maxBarrier, 0);
  assert.equal(plain.barrier, 0);

  const withKeystone = new Character(0, 0, stats, { damageMultiplier: 1.4, hpMultiplier: 0.7 });
  assert.equal(withKeystone.maxHp, 140 * 0.7);
  assert.equal(withKeystone.damageMultiplier('strength'), (1 + 5 * 0.05) * 1.4);

  const defended = new Character(0, 0, stats, {}, { armour: 150, evasion: 60, barrierCapacity: 40 });
  assert.equal(defended.armourMitigation, armourMitigation(150));
  assert.equal(defended.evasionChance, evasionChance(60));
  assert.equal(defended.maxBarrier, 40);
  assert.equal(defended.barrier, 40); // starts full
});

test('Character.takeHit applies armour mitigation, then drains Barrier before HP, and resets its recharge delay', () => {
  const stats = { strength: 5, vitality: 10, intelligence: 8, dexterity: 5, rarity: 0 };
  const ch = new Character(0, 0, stats, {}, { armour: 100, evasion: 0, barrierCapacity: 20 });
  const mitigation = armourMitigation(100);
  assert.ok(mitigation > 0 && mitigation < 0.9);

  // A hit smaller than the mitigated damage's overlap with Barrier: fully absorbed.
  const hpBefore = ch.hp;
  ch.takeHit(10);
  const mitigatedFirst = 10 * (1 - mitigation);
  assert.ok(mitigatedFirst <= 20, 'test assumes this hit fits inside the 20-capacity barrier');
  assert.equal(ch.barrier, 20 - mitigatedFirst);
  assert.equal(ch.hp, hpBefore); // fully absorbed, HP untouched
  assert.equal(ch.barrierRechargeDelayTimer, BARRIER_RECHARGE_DELAY_SEC);

  // A big hit that exhausts the remaining barrier and spills over into HP.
  ch.takeHit(1000);
  assert.equal(ch.barrier, 0);
  assert.ok(ch.hp < hpBefore);
});

test('Character.regenBarrier only recharges once the delay has fully elapsed, and clamps to max', () => {
  const stats = { strength: 5, vitality: 10, intelligence: 8, dexterity: 5, rarity: 0 };
  const ch = new Character(0, 0, stats, {}, { armour: 0, evasion: 0, barrierCapacity: 50 });
  ch.takeHit(1000); // drains barrier to 0 and sets the full recharge delay
  assert.equal(ch.barrier, 0);
  assert.equal(ch.barrierRechargeDelayTimer, BARRIER_RECHARGE_DELAY_SEC);

  ch.regenBarrier(BARRIER_RECHARGE_DELAY_SEC - 0.5); // not through the delay yet
  assert.equal(ch.barrier, 0);
  assert.ok(ch.barrierRechargeDelayTimer > 0);

  ch.regenBarrier(1); // finishes counting down the delay (that tick is spent on the delay itself)
  assert.equal(ch.barrierRechargeDelayTimer, 0);
  assert.equal(ch.barrier, 0);

  ch.regenBarrier(0.1); // delay is clear now, so this tick actually regenerates
  assert.ok(ch.barrier > 0);

  ch.regenBarrier(1000); // large dt should clamp to max, not overshoot
  assert.equal(ch.barrier, ch.maxBarrier);

  // Taking damage again mid-recharge halts it by resetting the delay.
  ch.takeHit(1);
  assert.equal(ch.barrierRechargeDelayTimer, BARRIER_RECHARGE_DELAY_SEC);
});

test('Character.regenHp does nothing at zero hpRegenPct, and heals a % of max HP per second otherwise', () => {
  const stats = { strength: 5, vitality: 10, intelligence: 5, dexterity: 5, rarity: 0 };
  const plain = new Character(0, 0, stats);
  plain.hp = 1;
  plain.regenHp(10);
  assert.equal(plain.hp, 1); // hpRegenPct defaults to 0 -- no change

  const regenerating = new Character(0, 0, stats, { hpRegenPct: 5 });
  regenerating.hp = 0;
  regenerating.regenHp(1); // 1 second at 5%/s
  assert.ok(Math.abs(regenerating.hp - regenerating.maxHp * 0.05) < 1e-9);

  regenerating.regenHp(1000); // large dt should clamp to max, not overshoot
  assert.equal(regenerating.hp, regenerating.maxHp);
});

test('Character reads manaCostAsLifePct from mods, defaulting to 0', () => {
  const stats = { strength: 5, vitality: 5, intelligence: 5, dexterity: 5, rarity: 0 };
  const plain = new Character(0, 0, stats);
  assert.equal(plain.manaCostAsLifePct, 0);

  const bloodMage = new Character(0, 0, stats, { manaCostAsLifePct: 25 });
  assert.equal(bloodMage.manaCostAsLifePct, 25);
});

test('a fresh Enemy starts with no knockback applied', () => {
  const enemy = new Enemy(0, 0, 1, 'husk');
  assert.equal(enemy.knockbackTimer, 0);
  assert.equal(enemy.knockbackVx, 0);
  assert.equal(enemy.knockbackVy, 0);
});

test('Character.regenMana respects max and the regen multiplier', () => {
  const stats = { strength: 5, vitality: 5, intelligence: 5, dexterity: 5, rarity: 0 };
  const ch = new Character(0, 0, stats, { manaRegenMultiplier: 2 });
  ch.mana = 0;
  ch.regenMana(1); // 1 second at 8%/s * 2x = 16% of max
  assert.equal(Math.round(ch.mana), Math.round(ch.maxMana * 0.16));

  ch.mana = ch.maxMana - 1;
  ch.regenMana(10); // large dt should still clamp to max, not overshoot
  assert.equal(ch.mana, ch.maxMana);
});
