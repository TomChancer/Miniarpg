import { Character, Enemy, Projectile, buildWave } from './entities.js';

const WAVE_CLEAR_PAUSE = 1.4;

export class CombatScene {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;
    this.running = false;
    this._resize = this._resize.bind(this);
    this._frame = this._frame.bind(this);
  }

  start() {
    window.addEventListener('resize', this._resize);
    this._resize();

    this.character = new Character(this.width / 2, this.height * 0.62);
    this.enemies = [];
    this.projectiles = [];
    this.wave = 1;
    this.spawnQueue = buildWave(this.wave);
    this.spawnTimer = 0.5;
    this.waveClearTimer = 0;

    this.callbacks.onWaveChange(this.wave);
    this.callbacks.onHpChange(this.character.hp, this.character.maxHp);

    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this._resize);
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.character) {
      this.character.x = this.width / 2;
      this.character.y = this.height * 0.62;
    }
  }

  _frame(now) {
    if (!this.running) return;
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(dt, 0.05);

    this._update(dt);
    this._render();

    if (this.running) this.rafId = requestAnimationFrame(this._frame);
  }

  _spawnPosition() {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(this.width, this.height) * 0.62;
    return {
      x: this.character.x + Math.cos(angle) * dist,
      y: this.character.y + Math.sin(angle) * dist,
    };
  }

  _update(dt) {
    const ch = this.character;

    // --- spawning ---
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const next = this.spawnQueue.shift();
        const pos = this._spawnPosition();
        this.enemies.push(new Enemy(pos.x, pos.y, this.wave, next.type));
        this.spawnTimer = next.delay;
      }
    } else if (this.enemies.length === 0) {
      this.waveClearTimer += dt;
      if (this.waveClearTimer >= WAVE_CLEAR_PAUSE) {
        this.wave += 1;
        this.spawnQueue = buildWave(this.wave);
        this.spawnTimer = 0.6;
        this.waveClearTimer = 0;
        this.callbacks.onWaveChange(this.wave);
      }
    }

    // --- enemies ---
    for (const enemy of this.enemies) {
      const dx = ch.x - enemy.x;
      const dy = ch.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      const stopDist = ch.radius + enemy.radius + 4;
      if (dist > stopDist) {
        enemy.x += (dx / dist) * enemy.speed * dt;
        enemy.y += (dy / dist) * enemy.speed * dt;
      } else {
        enemy.attackTimer -= dt;
        if (enemy.attackTimer <= 0) {
          enemy.attackTimer = enemy.attackCooldown;
          ch.hp = Math.max(0, ch.hp - enemy.damage);
          this.callbacks.onHpChange(ch.hp, ch.maxHp);
        }
      }
    }

    // --- character auto-attack ---
    ch.attackTimer -= dt;
    if (ch.attackTimer <= 0) {
      const target = this._nearestEnemyInRange(ch);
      if (target) {
        this.projectiles.push(new Projectile(ch.x, ch.y, target.x, target.y, ch.damage));
        ch.attackTimer = 1 / ch.attacksPerSecond;
      }
    }

    // --- projectiles ---
    for (const p of this.projectiles) {
      const step = p.speed * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.traveled += step;
      if (p.traveled > p.maxRange) { p.dead = true; continue; }
      for (const enemy of this.enemies) {
        if (!enemy.isAlive()) continue;
        const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
        if (d < enemy.radius + p.radius) {
          enemy.hp -= p.damage;
          p.dead = true;
          break;
        }
      }
    }

    this.projectiles = this.projectiles.filter((p) => !p.dead);
    this.enemies = this.enemies.filter((e) => e.isAlive());

    if (ch.hp <= 0 && this.running) {
      this.callbacks.onDeath(this.wave);
    }
  }

  _nearestEnemyInRange(ch) {
    let best = null;
    let bestDist = ch.range;
    for (const enemy of this.enemies) {
      const d = Math.hypot(enemy.x - ch.x, enemy.y - ch.y);
      if (d <= bestDist) {
        bestDist = d;
        best = enemy;
      }
    }
    return best;
  }

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // arena ground
    const ch = this.character;
    const grad = ctx.createRadialGradient(ch.x, ch.y, 20, ch.x, ch.y, Math.max(this.width, this.height) * 0.6);
    grad.addColorStop(0, '#241d38');
    grad.addColorStop(1, '#0c0914');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.strokeStyle = 'rgba(216, 176, 84, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ch.x, ch.y, ch.range, 0, Math.PI * 2);
    ctx.stroke();

    // character
    ctx.fillStyle = '#d8b054';
    ctx.beginPath();
    ctx.arc(ch.x, ch.y, ch.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e04f4f';
    ctx.beginPath();
    ctx.arc(ch.x, ch.y, ch.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // enemies
    for (const enemy of this.enemies) {
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();

      const barW = enemy.radius * 2;
      const hpPct = Math.max(0, enemy.hp / enemy.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(enemy.x - barW / 2, enemy.y - enemy.radius - 10, barW, 4);
      ctx.fillStyle = '#e04f4f';
      ctx.fillRect(enemy.x - barW / 2, enemy.y - enemy.radius - 10, barW * hpPct, 4);
    }

    // projectiles
    ctx.fillStyle = '#fff3c4';
    for (const p of this.projectiles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
