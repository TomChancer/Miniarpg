import { Character, Enemy, Projectile, buildWave } from './entities.js';
import { PUNCH_SKILL, getGemById } from './gems.js';
import { getSocketedGemDefIds, getSpeedMultiplier, getTotalStats, meetsRequirement, CURRENCIES } from './inventory.js';
import { getPlayerKeystoneMods, getMapModifiers } from './progression.js';
import { getMapDef } from './maps.js';

const WAVE_CLEAR_PAUSE = 1.4;
const EVADE_FLASH_DURATION = 0.15;
const DASH_DURATION = 0.35;
// Every point of Rarity multiplies each currency's base drop chance by 1%.
const RARITY_SCALE = 100;

export class CombatScene {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;
    this.running = false;
    this._resize = this._resize.bind(this);
    this._frame = this._frame.bind(this);
  }

  start(mapId = 'ashen_grove') {
    window.addEventListener('resize', this._resize);
    this._resize();

    this.mapDef = getMapDef(mapId);
    this.mapMods = getMapModifiers();

    const stats = getTotalStats();
    const keystoneMods = getPlayerKeystoneMods();
    this.character = new Character(this.width / 2, this.height * 0.62, stats, keystoneMods);
    this.enemies = [];
    this.projectiles = [];
    this.effects = [];
    this.dash = null;
    this.evadeFlashTimer = 0;
    this.wave = 1;
    this.bossPhase = false;
    this.spawnQueue = buildWave(this.wave, this.mapMods.packSizePct);
    this.spawnTimer = 0.5;
    this.waveClearTimer = 0;
    this.currencyEarned = Object.fromEntries(Object.keys(CURRENCIES).map((id) => [id, 0]));
    this.xpEarned = 0;

    this.speedMultiplier = getSpeedMultiplier() + this.character.speedMultiplierBonus;
    // Punch is innate; socketed gems only count if their stat requirement is
    // still met (handles gear being unequipped after a gem was socketed) and
    // if the id still resolves to a known gem at all.
    const gemDefs = getSocketedGemDefIds()
      .map((id) => getGemById(id))
      .filter((def) => def && meetsRequirement(def.requirement));
    const skillDefs = [PUNCH_SKILL, ...gemDefs];
    this.skills = skillDefs.map((def) => ({
      def,
      timer: Math.random() * (1 / (def.speed * this.speedMultiplier)),
    }));

    this.callbacks.onWaveChange(this.wave);
    this.callbacks.onHpChange(this.character.hp, this.character.maxHp);
    this.callbacks.onManaChange(this.character.mana, this.character.maxMana);
    this.callbacks.onCurrencyChange(0);

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
    const hasteMul = 1 + this.mapMods.spawnRatePct / 100;
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const next = this.spawnQueue.shift();
        const pos = this._spawnPosition();
        this.enemies.push(
          new Enemy(pos.x, pos.y, this.wave, next.type, this.mapMods.enemyDamagePct, this.mapMods.monsterToughnessPct)
        );
        this.spawnTimer = next.delay / hasteMul;
      }
    } else if (this.enemies.length === 0) {
      this.waveClearTimer += dt;
      if (this.waveClearTimer >= WAVE_CLEAR_PAUSE) {
        if (this.bossPhase) {
          this.callbacks.onMapComplete(this.currencyEarned, this.xpEarned);
          return;
        }
        this.wave += 1;
        this.waveClearTimer = 0;
        if (this.wave > this.mapDef.rounds) {
          this.bossPhase = true;
          this.spawnQueue = [{ delay: 0.6, type: 'boss' }];
          this.spawnTimer = 0.6 / hasteMul;
          this.callbacks.onWaveChange('Boss');
        } else {
          this.spawnQueue = buildWave(this.wave, this.mapMods.packSizePct);
          this.spawnTimer = 0.6 / hasteMul;
          this.callbacks.onWaveChange(this.wave);
        }
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
          if (Math.random() < ch.evasionChance) {
            this.evadeFlashTimer = EVADE_FLASH_DURATION;
          } else {
            ch.hp = Math.max(0, ch.hp - enemy.damage);
            this.callbacks.onHpChange(ch.hp, ch.maxHp);
          }
        }
      }
    }

    // --- mana regen ---
    ch.regenMana(dt);
    this.callbacks.onManaChange(ch.mana, ch.maxMana);

    // --- character auto-attack: every active skill fires independently ---
    for (const skill of this.skills) {
      skill.timer -= dt;
      if (skill.timer <= 0) {
        if (this._castSkill(skill.def)) {
          skill.timer = 1 / (skill.def.speed * this.speedMultiplier);
        }
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
        if (!enemy.isAlive() || p.hitEnemies.has(enemy)) continue;
        const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
        if (d < enemy.radius + p.radius) {
          this._damageEnemy(enemy, p.damage);
          p.hitEnemies.add(enemy);
          if (p.pierceRemaining > 0) {
            p.pierceRemaining -= 1;
          } else {
            p.dead = true;
          }
          break;
        }
      }
    }

    this.projectiles = this.projectiles.filter((p) => !p.dead);
    this.enemies = this.enemies.filter((e) => e.isAlive());

    // --- transient visuals ---
    for (const fx of this.effects) fx.life -= dt;
    this.effects = this.effects.filter((fx) => fx.life > 0);
    if (this.dash) {
      this.dash.elapsed += dt;
      if (this.dash.elapsed >= this.dash.duration) this.dash = null;
    }
    if (this.evadeFlashTimer > 0) this.evadeFlashTimer -= dt;

    if (ch.hp <= 0 && this.running) {
      this.callbacks.onDeath(this.wave, this.currencyEarned, this.xpEarned);
    }
  }

  _castSkill(def) {
    const ch = this.character;
    if (ch.mana < def.manaCost) return false;
    const dmg = ch.damage * ch.damageMultiplier(def.scalingStat);

    if (def.kind === 'projectile') {
      const target = this._nearestEnemy(def.range);
      if (!target) return false;
      this.projectiles.push(new Projectile(ch.x, ch.y, target.x, target.y, dmg, def.pierce || 0));
    } else if (def.kind === 'melee') {
      const target = this._nearestEnemy(def.range);
      if (!target) return false;
      this._damageEnemy(target, dmg);
      this.effects.push({
        type: 'hit', x: target.x, y: target.y, radius: target.radius + 6,
        life: 0.15, maxLife: 0.15,
      });
    } else if (def.kind === 'line') {
      const target = this._nearestEnemy(def.range);
      if (!target) return false;
      const angle = Math.atan2(target.y - ch.y, target.x - ch.x);
      const hits = this._enemiesInLine(angle, def.range, def.lineWidth / 2);
      for (const enemy of hits) this._damageEnemy(enemy, dmg);
      this.effects.push({
        type: 'line', x: ch.x, y: ch.y, angle, range: def.range, width: def.lineWidth,
        life: 0.2, maxLife: 0.2,
      });
    } else if (def.kind === 'dash') {
      const target = this._nearestEnemy(def.range);
      if (!target) return false;
      this._damageEnemy(target, dmg);
      this.dash = { toX: target.x, toY: target.y, elapsed: 0, duration: DASH_DURATION };
    } else {
      return false;
    }

    ch.mana -= def.manaCost;
    return true;
  }

  _damageEnemy(enemy, damage) {
    enemy.hp -= damage;
    if (enemy.hp <= 0 && enemy.value) {
      this._rollDrops(enemy.value);
      this.xpEarned += enemy.xpValue * (1 + this.mapMods.xpPct / 100);
      enemy.value = 0; // guard against double-counting a kill within the same frame
    }
  }

  // enemy.value is how many independent drop rolls a kill gets per currency
  // (elites are worth more just by rolling more times, not bigger rewards).
  _rollDrops(rolls) {
    const rarityMul = 1 + this.character.rarity / RARITY_SCALE;
    let totalDropped = 0;
    for (const currency of Object.values(CURRENCIES)) {
      const chance = currency.dropChance * rarityMul;
      let dropped = 0;
      for (let i = 0; i < rolls; i++) {
        if (Math.random() < chance) dropped += 1;
      }
      if (dropped > 0) {
        this.currencyEarned[currency.id] += dropped;
        totalDropped += dropped;
      }
    }
    if (totalDropped > 0) {
      const total = Object.values(this.currencyEarned).reduce((a, b) => a + b, 0);
      this.callbacks.onCurrencyChange(total);
    }
  }

  _nearestEnemy(range) {
    const ch = this.character;
    let best = null;
    let bestDist = range;
    for (const enemy of this.enemies) {
      const d = Math.hypot(enemy.x - ch.x, enemy.y - ch.y);
      if (d <= bestDist) {
        bestDist = d;
        best = enemy;
      }
    }
    return best;
  }

  _enemiesInLine(angle, range, halfWidth) {
    const ch = this.character;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    return this.enemies.filter((enemy) => {
      const relX = enemy.x - ch.x;
      const relY = enemy.y - ch.y;
      const along = relX * dx + relY * dy;
      if (along < 0 || along > range) return false;
      const perp = Math.abs(relX * dy - relY * dx);
      return perp <= halfWidth + enemy.radius;
    });
  }

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const ch = this.character;
    const grad = ctx.createRadialGradient(ch.x, ch.y, 20, ch.x, ch.y, Math.max(this.width, this.height) * 0.6);
    grad.addColorStop(0, '#241d38');
    grad.addColorStop(1, '#0c0914');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // line-attack sweeps, drawn under everything else like a ground effect
    for (const fx of this.effects) {
      if (fx.type !== 'line') continue;
      const alpha = Math.max(0, fx.life / fx.maxLife);
      ctx.save();
      ctx.translate(fx.x, fx.y);
      ctx.rotate(fx.angle);
      ctx.fillStyle = `rgba(224, 169, 90, ${alpha * 0.55})`;
      ctx.fillRect(0, -fx.width / 2, fx.range, fx.width);
      ctx.restore();
    }

    // character (visually offset mid-dash; real x/y never moves)
    let renderX = ch.x;
    let renderY = ch.y;
    if (this.dash) {
      const t = Math.min(1, this.dash.elapsed / this.dash.duration);
      const outT = t < 0.5 ? t / 0.5 : 1 - (t - 0.5) / 0.5;
      const eased = outT * outT * (3 - 2 * outT);
      renderX = ch.x + (this.dash.toX - ch.x) * eased;
      renderY = ch.y + (this.dash.toY - ch.y) * eased;
    }

    ctx.fillStyle = '#d8b054';
    ctx.beginPath();
    ctx.arc(renderX, renderY, ch.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e04f4f';
    ctx.beginPath();
    ctx.arc(renderX, renderY, ch.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();

    if (this.evadeFlashTimer > 0) {
      const alpha = this.evadeFlashTimer / EVADE_FLASH_DURATION;
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ch.x, ch.y, ch.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

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

    // melee/dash hit flashes, on top of everything
    for (const fx of this.effects) {
      if (fx.type !== 'hit') continue;
      const alpha = Math.max(0, fx.life / fx.maxLife);
      ctx.strokeStyle = `rgba(255,243,196,${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
