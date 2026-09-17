import '../testlib/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character, Enemy, buildWave } from '../src/entities.js';

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

test('Character derives HP/mana/evasion from stats and applies keystone mods', () => {
  const stats = { strength: 5, vitality: 10, intelligence: 8, dexterity: 40, rarity: 0 };
  const plain = new Character(0, 0, stats);
  assert.equal(plain.maxHp, 60 + 10 * 8); // 140
  assert.equal(plain.maxMana, 20 + 8 * 6); // 68
  assert.equal(plain.evasionChance, 0.6); // capped, 40*0.02=0.8 would exceed cap

  const withKeystone = new Character(0, 0, stats, { damageMultiplier: 1.4, hpMultiplier: 0.7 });
  assert.equal(withKeystone.maxHp, 140 * 0.7);
  assert.equal(withKeystone.damageMultiplier('strength'), (1 + 5 * 0.05) * 1.4);
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
