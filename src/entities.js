export class Character {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 22;
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.damage = 8;
    this.range = 220;
    this.attacksPerSecond = 2;
    this.attackTimer = 0;
  }

  isAlive() {
    return this.hp > 0;
  }
}

const ENEMY_TYPES = {
  husk: { radius: 14, speed: 55, color: '#7fae5a', hpMul: 1, dmgMul: 1 },
  elite: { radius: 20, speed: 40, color: '#c76b3f', hpMul: 4.5, dmgMul: 2.2 },
};

export class Enemy {
  constructor(x, y, wave, type = 'husk') {
    const def = ENEMY_TYPES[type];
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = def.radius;
    this.speed = def.speed;
    this.color = def.color;
    this.maxHp = Math.round((10 + wave * 4) * def.hpMul);
    this.hp = this.maxHp;
    this.damage = Math.round((3 + wave * 0.8) * def.dmgMul);
    this.attackCooldown = 0.8;
    this.attackTimer = Math.random() * this.attackCooldown;
  }

  isAlive() {
    return this.hp > 0;
  }
}

export class Projectile {
  constructor(x, y, targetX, targetY, damage) {
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
  }
}

export function buildWave(waveNumber) {
  const count = 4 + Math.floor(waveNumber * 1.8);
  const spawnInterval = Math.max(0.35, 1.1 - waveNumber * 0.04);
  const spawnsEliteAt = waveNumber % 5 === 0;
  const queue = [];
  for (let i = 0; i < count; i++) {
    const isElite = spawnsEliteAt && i === count - 1;
    queue.push({ delay: spawnInterval, type: isElite ? 'elite' : 'husk' });
  }
  return queue;
}
