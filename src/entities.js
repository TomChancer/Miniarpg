const MANA_REGEN_PCT_PER_SEC = 0.08;

export class Character {
  constructor(x, y, stats, mods = {}) {
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

    this.maxHp = (60 + this.vitality * 8) * (mods.hpMultiplier || 1);
    this.hp = this.maxHp;
    this.maxMana = (20 + this.intelligence * 6) * (mods.manaMultiplier || 1);
    this.mana = this.maxMana;
    this.evasionChance = Math.min(0.6, this.dexterity * 0.02);
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
