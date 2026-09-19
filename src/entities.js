import { armourMitigation, evasionChance, BARRIER_RECHARGE_DELAY_SEC, BARRIER_RECHARGE_PCT_PER_SEC } from './defense.js';

const MANA_REGEN_PCT_PER_SEC = 0.08;

export class Character {
  constructor(x, y, stats, mods = {}, defense = {}) {
    this.x = x;
    this.y = y;
    this.radius = 22;
    this.damage = 8;

    this.strength = stats.strength;
    this.vitality = stats.vitality;
    this.intelligence = stats.intelligence;
    this.dexterity = stats.dexterity;
    this.rarity = stats.rarity;

    this.globalDamageMultiplier = mods.damageMultiplier || 1;
    this.manaRegenMultiplier = mods.manaRegenMultiplier || 1;
    this.speedMultiplierBonus = mods.speedMultiplierBonus || 0;
    this.hpRegenPct = mods.hpRegenPct || 0;
    // A fraction of any skill's mana cost paid as life instead, shifting
    // resource pressure from mana onto HP (see combat.js's _castSkill).
    this.manaCostAsLifePct = mods.manaCostAsLifePct || 0;

    this.maxHp = (60 + this.vitality * 8) * (mods.hpMultiplier || 1);
    this.hp = this.maxHp;
    this.maxMana = (20 + this.intelligence * 6) * (mods.manaMultiplier || 1);
    this.mana = this.maxMana;

    // Armour and Evasion mitigate/avoid a hit; Barrier is a separate
    // shield-like pool that absorbs damage before HP (see defense.js).
    this.armour = defense.armour || 0;
    this.evasion = defense.evasion || 0;
    this.armourMitigation = armourMitigation(this.armour);
    this.evasionChance = evasionChance(this.evasion);
    this.maxBarrier = defense.barrierCapacity || 0;
    this.barrier = this.maxBarrier;
    this.barrierRechargeDelayTimer = 0;
  }

  isAlive() {
    return this.hp > 0;
  }

  damageMultiplier(stat) {
    return (1 + (this[stat] || 0) * 0.05) * this.globalDamageMultiplier;
  }

  regenMana(dt) {
    this.mana = Math.min(
      this.maxMana,
      this.mana + this.maxMana * MANA_REGEN_PCT_PER_SEC * this.manaRegenMultiplier * dt
    );
  }

  regenHp(dt) {
    if (this.hpRegenPct <= 0) return;
    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * (this.hpRegenPct / 100) * dt);
  }

  // Recharges only once `barrierRechargeDelayTimer` has fully counted down --
  // any hit that reaches the barrier resets that timer (see combat.js).
  regenBarrier(dt) {
    if (this.barrierRechargeDelayTimer > 0) {
      this.barrierRechargeDelayTimer = Math.max(0, this.barrierRechargeDelayTimer - dt);
      return;
    }
    if (this.barrier < this.maxBarrier) {
      this.barrier = Math.min(this.maxBarrier, this.barrier + this.maxBarrier * BARRIER_RECHARGE_PCT_PER_SEC * dt);
    }
  }

  // Applies one hit through the full defence pipeline (armour mitigation,
  // then Barrier absorption, then HP) and resets the recharge delay. Evasion
  // is checked by the caller beforehand -- an evaded hit never reaches this.
  takeHit(rawDamage) {
    let remaining = rawDamage * (1 - this.armourMitigation);
    if (this.barrier > 0) {
      const absorbed = Math.min(this.barrier, remaining);
      this.barrier -= absorbed;
      remaining -= absorbed;
    }
    this.barrierRechargeDelayTimer = BARRIER_RECHARGE_DELAY_SEC;
    this.hp = Math.max(0, this.hp - remaining);
  }
}

const ENEMY_TYPES = {
  husk: { radius: 14, speed: 55, color: '#7fae5a', hpMul: 1, dmgMul: 1, value: 1, xpValue: 2 },
  elite: { radius: 20, speed: 40, color: '#c76b3f', hpMul: 4.5, dmgMul: 2.2, value: 5, xpValue: 10 },
  boss: { radius: 36, speed: 30, color: '#e0455f', hpMul: 25, dmgMul: 4, value: 20, xpValue: 150 },
};

export class Enemy {
  // toughnessPct makes an enemy tankier and harder-hitting, but also worth
  // more loot rolls and XP when it dies — a risk/reward knob on individual
  // monsters, distinct from enemyDamagePct (a pure drawback from Overrun).
  constructor(x, y, wave, type = 'husk', enemyDamagePct = 0, toughnessPct = 0) {
    const def = ENEMY_TYPES[type];
    const toughMul = 1 + toughnessPct / 100;
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = def.radius;
    this.speed = def.speed;
    this.color = def.color;
    this.maxHp = Math.round((10 + wave * 4) * def.hpMul * toughMul);
    this.hp = this.maxHp;
    this.damage = Math.round((3 + wave * 0.8) * def.dmgMul * (1 + enemyDamagePct / 100) * toughMul);
    this.value = Math.max(1, Math.round(def.value * toughMul));
    this.xpValue = Math.round(def.xpValue * toughMul);
    this.attackCooldown = 0.8;
    this.attackTimer = Math.random() * this.attackCooldown;

    // Set by a Repulse Aura hit (see combat.js's _applyKnockback): while
    // knockbackTimer counts down, the enemy slides away instead of homing in
    // or attacking -- the "moment of reprieve" the aura is meant to buy.
    this.knockbackTimer = 0;
    this.knockbackVx = 0;
    this.knockbackVy = 0;
  }

  isAlive() {
    return this.hp > 0;
  }
}

export class Projectile {
  constructor(x, y, targetX, targetY, damage, pierce = 0) {
    this.x = x;
    this.y = y;
    this.radius = 5;
    this.speed = 480;
    this.damage = damage;
    this.dead = false;
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy) || 1;
    this.vx = (dx / dist) * this.speed;
    this.vy = (dy / dist) * this.speed;
    this.traveled = 0;
    this.maxRange = 900;
    this.pierceRemaining = pierce;
    this.hitEnemies = new Set();
  }
}

export function buildWave(waveNumber, packSizePct = 0) {
  const baseCount = 4 + Math.floor(waveNumber * 1.8);
  const count = Math.max(1, Math.round(baseCount * (1 + packSizePct / 100)));
  const spawnInterval = Math.max(0.35, 1.1 - waveNumber * 0.04);
  const spawnsEliteAt = waveNumber % 5 === 0;
  const queue = [];
  for (let i = 0; i < count; i++) {
    const isElite = spawnsEliteAt && i === count - 1;
    queue.push({ delay: spawnInterval, type: isElite ? 'elite' : 'husk' });
  }
  return queue;
}
