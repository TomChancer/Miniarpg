import { Character, Enemy, Projectile, buildWave } from './entities.js';
import { PUNCH_SKILL, getGemById } from './gems.js';
import {
  getSocketedGemGroups, getSpeedMultiplier, getTotalStats, getDefenseStats, meetsRequirement, getWeaponMods, CURRENCIES,
  getPendingMapModifiers, clearPendingMapModifiers,
} from './inventory.js';
import { resolveSkill, supportsFor } from './skillResolution.js';
import { getPlayerKeystoneMods, getMapModifiers } from './progression.js';
import { getMapDef, getMapToughnessBasePct } from './maps.js';
import { combineModifierEffects } from './mapModifiers.js';
import { BASE_ITEM_IDS } from './equipment.js';
import { generateLootItem } from './loot.js';

const WAVE_CLEAR_PAUSE = 1.4;
const EVADE_FLASH_DURATION = 0.15;
const DASH_DURATION = 0.35;
// Every point of Rarity multiplies each currency's base drop chance by 1%.
const RARITY_SCALE = 100;
// Trash mobs have a small independent chance to drop a random gear item
// (rarity-scaled, same formula as currency); bosses always drop one.
const GEAR_DROP_CHANCE = 0.015;

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

    // A Warped Sigil's rolled modifiers apply to this one run and are
    // consumed the instant it starts, win or lose.
    this.activeMapModifiers = getPendingMapModifiers();
    clearPendingMapModifiers();
    const modEffects = combineModifierEffects(this.activeMapModifiers);
    this.volatileDeaths = modEffects.volatileDeaths;

    const treeMapMods = getMapModifiers();
    this.mapMods = {
      ...treeMapMods,
      packSizePct: treeMapMods.packSizePct + modEffects.packSizePct,
      spawnRatePct: treeMapMods.spawnRatePct + modEffects.spawnRatePct,
      // Map tier difficulty and a sigil's own "tougher enemies" drawback
      // both fold into the same toughness knob the mapping tree already
      // uses (see entities.js's Enemy) -- hp/damage/value/xp all scale together.
      monsterToughnessPct: treeMapMods.monsterToughnessPct + modEffects.monsterToughnessPct + getMapToughnessBasePct(mapId),
    };

    const baseStats = getTotalStats();
    const stats = { ...baseStats, rarity: baseStats.rarity + modEffects.rarityBonus };
    const defenseStats = getDefenseStats();
    const defenseShrink = 1 - modEffects.reducedDefensesPct / 100;
    if (defenseShrink < 1) {
      defenseStats.armour *= defenseShrink;
      defenseStats.evasion *= defenseShrink;
      defenseStats.barrierCapacity *= defenseShrink;
    }
    const keystoneMods = getPlayerKeystoneMods();
    const weaponMods = getWeaponMods();
    this.weaponRangeMultiplier = weaponMods.rangeMultiplier;
    const combinedMods = {
      ...keystoneMods,
      damageMultiplier: keystoneMods.damageMultiplier * weaponMods.damageMultiplier,
    };
    this.character = new Character(this.width / 2, this.height * 0.62, stats, combinedMods, defenseStats);
    this.enemies = [];
    this.projectiles = [];
    this.effects = [];
    this.dash = null;
    this.evadeFlashTimer = 0;
    this.wave = 1;
    this.bossPhase = false;
    // Distinct from `running` (which just tracks the rAF loop): `ended`
    // marks that onDeath/onMapComplete has already fired, so a stray extra
    // _update call — however it's driven — never fires it twice.
    this.ended = false;
    this.spawnQueue = buildWave(this.wave, this.mapMods.packSizePct);
    this.spawnTimer = 0.5;
    this.waveClearTimer = 0;
    this.currencyEarned = Object.fromEntries(Object.keys(CURRENCIES).map((id) => [id, 0]));
    this.xpEarned = 0;
    this.itemsEarned = [];

    this.speedMultiplier = getSpeedMultiplier() + this.character.speedMultiplierBonus;
    // Punch is innate; every other skill comes from socketed gems, grouped by
    // the equipped item they're socketed in — a support gem only links to
    // skill gems sharing sockets on that SAME item (see skillResolution.js).
    // A gem only counts if its stat requirement is still met (handles gear
    // being unequipped after a gem was socketed) and it still resolves to a
    // known gem at all.
    const resolvedSkills = [];
    for (const ids of getSocketedGemGroups()) {
      const defs = ids.map((id) => getGemById(id)).filter((def) => def && meetsRequirement(def.requirement));
      const skillsInGroup = defs.filter((def) => def.gemType !== 'support');
      const supportsInGroup = defs.filter((def) => def.gemType === 'support');
      for (const skillDef of skillsInGroup) {
        resolvedSkills.push(resolveSkill(skillDef, supportsFor(skillDef, supportsInGroup)));
      }
    }
    // Punch is a zero-gear fallback, not an extra attack: once any real
    // skill gem is socketed, it takes over and Punch stops firing.
    const skillDefs = resolvedSkills.length > 0 ? resolvedSkills : [PUNCH_SKILL];
    this.skills = skillDefs.map((def) => ({
      def,
      timer: Math.random() * (1 / (def.speed * this.speedMultiplier)),
    }));

    this.callbacks.onWaveChange(this.wave);
    this.callbacks.onHpChange(this.character.hp, this.character.maxHp);
    this.callbacks.onManaChange(this.character.mana, this.character.maxMana);
    this.callbacks.onBarrierChange(this.character.barrier, this.character.maxBarrier);
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
          if (!this.ended) {
            this.ended = true;
            this.callbacks.onMapComplete(this.currencyEarned, this.xpEarned, this.itemsEarned);
          }
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
            ch.takeHit(enemy.damage);
            this.callbacks.onHpChange(ch.hp, ch.maxHp);
            this.callbacks.onBarrierChange(ch.barrier, ch.maxBarrier);
          }
        }
      }
    }

    // --- mana & barrier regen ---
    ch.regenMana(dt);
    this.callbacks.onManaChange(ch.mana, ch.maxMana);
    ch.regenBarrier(dt);
    this.callbacks.onBarrierChange(ch.barrier, ch.maxBarrier);

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

    if (ch.hp <= 0 && !this.ended) {
      this.ended = true;
      this.callbacks.onDeath(this.wave, this.currencyEarned, this.xpEarned, this.itemsEarned);
    }
  }

  _castSkill(def) {
    const ch = this.character;
    if (ch.mana < def.manaCost) return false;
    const dmg = ch.damage * ch.damageMultiplier(def.scalingStat) * (def.supportDamageMultiplier || 1);
    // Punch is gear-independent; every other skill's range is scaled by the
    // equipped weapon type (1h shortest -> 2h sword -> staff -> bow longest).
    const range = def.innate ? def.range : def.range * this.weaponRangeMultiplier;
    const area = def.areaMultiplier || 1;

    if (def.kind === 'projectile') {
      const target = this._nearestEnemy(range);
      if (!target) return false;
      // A Volley-style support fans extra projectiles around the direct
      // line to the nearest enemy rather than stacking them all on one path.
      const count = def.projectileCount || 1;
      const baseAngle = Math.atan2(target.y - ch.y, target.x - ch.x);
      const spreadStep = Math.PI / 12;
      for (let i = 0; i < count; i++) {
        const angle = baseAngle + (i - (count - 1) / 2) * spreadStep;
        const tx = ch.x + Math.cos(angle) * range;
        const ty = ch.y + Math.sin(angle) * range;
        this.projectiles.push(new Projectile(ch.x, ch.y, tx, ty, dmg, def.pierce || 0));
      }
    } else if (def.kind === 'melee') {
      const target = this._nearestEnemy(range);
      if (!target) return false;
      this._damageEnemy(target, dmg);
      this.effects.push({
        type: 'hit', x: target.x, y: target.y, radius: target.radius + 6,
        life: 0.15, maxLife: 0.15,
      });
    } else if (def.kind === 'line') {
      const target = this._nearestEnemy(range);
      if (!target) return false;
      const angle = Math.atan2(target.y - ch.y, target.x - ch.x);
      const width = def.lineWidth * area;
      const hits = this._enemiesInLine(angle, range, width / 2);
      for (const enemy of hits) this._damageEnemy(enemy, dmg);
      this.effects.push({
        type: 'line', x: ch.x, y: ch.y, angle, range, width,
        life: 0.2, maxLife: 0.2,
      });
    } else if (def.kind === 'dash') {
      const target = this._nearestEnemy(range);
      if (!target) return false;
      this._damageEnemy(target, dmg);
      this.dash = { toX: target.x, toY: target.y, elapsed: 0, duration: DASH_DURATION };
    } else if (def.kind === 'nova') {
      const radius = range * area;
      const hits = this._enemiesInRadius(radius);
      if (hits.length === 0) return false;
      for (const enemy of hits) this._damageEnemy(enemy, dmg);
      this.effects.push({ type: 'nova', x: ch.x, y: ch.y, radius, life: 0.25, maxLife: 0.25 });
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
      this._rollGearDrop(enemy);
      this.xpEarned += enemy.xpValue * (1 + this.mapMods.xpPct / 100);
      if (this.volatileDeaths) this._volatileBurst(enemy);
      enemy.value = 0; // guard against double-counting a kill within the same frame
    }
  }

  // The Volatile map modifier's drawback: a slain enemy bursts, hitting the
  // player if they're standing close enough. Goes through the normal
  // evasion/armour/Barrier pipeline like any other hit, just triggered by a
  // kill instead of an enemy's own attack.
  _volatileBurst(enemy) {
    const ch = this.character;
    const burstRadius = enemy.radius + 70;
    const dist = Math.hypot(enemy.x - ch.x, enemy.y - ch.y);
    if (dist > burstRadius) return;
    if (Math.random() < ch.evasionChance) {
      this.evadeFlashTimer = EVADE_FLASH_DURATION;
      return;
    }
    ch.takeHit(enemy.damage * 1.5);
    this.callbacks.onHpChange(ch.hp, ch.maxHp);
    this.callbacks.onBarrierChange(ch.barrier, ch.maxBarrier);
  }

  _rollGearDrop(enemy) {
    const rarityMul = 1 + this.character.rarity / RARITY_SCALE;
    const guaranteed = enemy.type === 'boss';
    if (!guaranteed && Math.random() >= GEAR_DROP_CHANCE * rarityMul) return;
    const baseId = BASE_ITEM_IDS[Math.floor(Math.random() * BASE_ITEM_IDS.length)];
    this.itemsEarned.push(generateLootItem(baseId));
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

  _enemiesInRadius(radius) {
    const ch = this.character;
    return this.enemies.filter((enemy) => Math.hypot(enemy.x - ch.x, enemy.y - ch.y) <= radius + enemy.radius);
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

    // nova bursts, on top of everything
    for (const fx of this.effects) {
      if (fx.type !== 'nova') continue;
      const alpha = Math.max(0, fx.life / fx.maxLife);
      ctx.strokeStyle = `rgba(224, 169, 90, ${alpha * 0.8})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
      ctx.stroke();
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
