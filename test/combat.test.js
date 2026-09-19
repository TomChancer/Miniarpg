import '../testlib/env.js';
import { makeFakeCanvas, withFixedRandom } from '../testlib/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CombatScene } from '../src/combat.js';
import { Enemy } from '../src/entities.js';
import * as inv from '../src/inventory.js';
import * as prog from '../src/progression.js';
import { getGemById, PUNCH_SKILL } from '../src/gems.js';
import { SLOTS } from '../src/equipment.js';
import { evasionChance as computeEvasionChance } from '../src/defense.js';
import { combineModifierEffects } from '../src/mapModifiers.js';

// A handful of tests below need a clean bag to reliably place larger/taller
// shapes (e.g. a 1x4 staff) — earlier tests in this file leave it fragmented
// with leftover swapped-out gear, same idea as inventory.test.js's gem-pouch
// tests owning their own grid state.
function clearBag() {
  for (const it of [...inv.getGeneralGrid().items]) inv.discardItem('general', it.instanceId);
}

// Same idea, for equipped gear: a couple of the aura tests need to be sure
// no OTHER skill gem (socketed on some other slot by an earlier test in this
// file) is still equipped and contributing an extra skill/aura.
function clearGear() {
  for (const slot of SLOTS) inv.unequipItem(slot);
}

function makeScene(callbackOverrides = {}, mapId = undefined) {
  const scene = new CombatScene(makeFakeCanvas(), {
    onHpChange() {}, onWaveChange() {}, onCurrencyChange() {}, onManaChange() {}, onBarrierChange() {},
    onDeath() {}, onMapComplete() {},
    ...callbackOverrides,
  });
  scene.start(mapId);
  scene.stop(); // cancel the internal rAF loop; tests drive _update manually
  return scene;
}

test('a fresh character (zero gear) can still kill with Punch alone', () => {
  const scene = makeScene();
  assert.equal(scene.skills.length, 1);
  assert.equal(scene.skills[0].def.id, 'punch');

  const enemy = new Enemy(scene.character.x, scene.character.y - 10, 1, 'husk');
  enemy.hp = 1;
  scene.enemies = [enemy];
  const fired = scene._castSkill(PUNCH_SKILL);
  assert.equal(fired, true);
  assert.ok(enemy.hp <= 0);
});

test('Punch steps aside the instant a real skill gem is socketed, so it never fires alongside one', () => {
  clearBag();
  inv.addLootItem({ kind: 'equipment', defId: 'helmet_armour', w: 2, h: 2, sockets: [null], affixes: { intelligence: 20 } });
  const helmet = inv.getGeneralGrid().items.find((i) => i.defId === 'helmet_armour' && i.affixes.intelligence === 20);
  assert.equal(inv.equipItem(helmet.instanceId), true);
  inv.addGem('cinder_shot');
  assert.equal(inv.socketGem('helmet', 0, 'cinder_shot'), true);

  const scene = makeScene();
  assert.equal(scene.skills.length, 1);
  assert.equal(scene.skills[0].def.id, 'cinder_shot');
  assert.ok(scene.skills.every((s) => s.def.id !== 'punch'));
});

test('currency drop rolls are deterministic given a fixed RNG sequence', () => {
  const scene = makeScene();
  assert.equal(scene.character.rarity, 0); // base stats, nothing allocated

  // Order matches Object.values(CURRENCIES): cinderShard, cinderFragment, voidShard, voidFragment, warpedSigil
  // thresholds:                              0.1          0.05            0.05        0.0025        0.02
  withFixedRandom([0.05, 0.05, 0.5, 0.001, 0.5], () => scene._rollDrops(1));

  assert.deepEqual(scene.currencyEarned, {
    cinderShard: 1, // 0.05 < 0.1
    cinderFragment: 0, // 0.05 is not < 0.05
    voidShard: 0, // 0.5 not < 0.05
    voidFragment: 1, // 0.001 < 0.0025
    warpedSigil: 0, // 0.5 not < 0.02
  });
});

test('evasion roll blocks enemy contact damage exactly when the roll succeeds', () => {
  const scene = makeScene();
  // Whatever gear earlier tests in this file left equipped, evasionChance
  // must match the shared diminishing-returns curve applied to the
  // character's own evasion rating -- this test isn't about the exact value.
  assert.equal(scene.character.evasionChance, computeEvasionChance(scene.character.evasion));
  assert.ok(scene.character.evasionChance > 0 && scene.character.evasionChance < 0.9);

  const enemy = new Enemy(scene.character.x, scene.character.y, 1, 'husk');
  enemy.attackTimer = 0;
  // Overwhelming damage so this hit is guaranteed to punch through any
  // armour mitigation/Barrier that cumulative gear from earlier tests in
  // this file left equipped -- this test is about the evasion roll gate,
  // not the size of the hit.
  enemy.damage = 999999;
  scene.enemies = [enemy];

  const hpBefore = scene.character.hp;
  const evasionRoll = scene.character.evasionChance / 2;
  withFixedRandom([evasionRoll], () => scene._update(0)); // below evasionChance -> evaded
  assert.equal(scene.character.hp, hpBefore);
  assert.ok(scene.evadeFlashTimer > 0);

  enemy.attackTimer = 0; // ready to attack again
  withFixedRandom([0.999], () => scene._update(0)); // above any plausible evasionChance -> hits
  assert.ok(scene.character.hp < hpBefore);
});

test('each skill kind produces its expected effect, gated by mana', () => {
  inv.addCurrency('voidShard', 200);
  // Hand-rolled items (in place of the merchant's randomized ones) with just
  // enough of each stat to meet the three gems' requirements exactly.
  inv.addLootItem({ kind: 'equipment', defId: 'helmet_armour', w: 2, h: 2, sockets: [null], affixes: { intelligence: 3 } });
  inv.addLootItem({ kind: 'equipment', defId: 'chest_armour', w: 2, h: 3, sockets: [null], affixes: { strength: 2 } });
  inv.addLootItem({ kind: 'equipment', defId: 'legs_armour', w: 2, h: 2, sockets: [null], affixes: { dexterity: 4 } });
  for (const defId of ['helmet_armour', 'chest_armour', 'legs_armour']) {
    const item = inv.getGeneralGrid().items.find((i) => i.defId === defId);
    inv.equipItem(item.instanceId);
  }
  for (const gemId of ['cinder_shot', 'crush', 'slice_and_dice']) {
    inv.addGem(gemId);
    inv.socketGem(
      { cinder_shot: 'helmet', crush: 'chest', slice_and_dice: 'legs' }[gemId],
      0,
      gemId
    );
  }

  const scene = makeScene();
  assert.equal(scene.skills.length, 3); // the 3 socketed gems; Punch steps aside once real skills are socketed

  // projectile: Cinder Shot
  const projTarget = new Enemy(scene.character.x, scene.character.y - 50, 1, 'husk');
  scene.enemies = [projTarget];
  scene.character.mana = scene.character.maxMana;
  const projFired = scene._castSkill(getGemById('cinder_shot'));
  assert.equal(projFired, true);
  assert.equal(scene.projectiles.length, 1);

  // melee: Punch, instant damage + a 'hit' effect
  const meleeTarget = new Enemy(scene.character.x, scene.character.y - 10, 1, 'husk');
  meleeTarget.hp = 1000;
  scene.enemies = [meleeTarget];
  scene.effects = [];
  scene._castSkill(PUNCH_SKILL);
  assert.ok(meleeTarget.hp < 1000);
  assert.ok(scene.effects.some((fx) => fx.type === 'hit'));

  // line: Crush, hits everything in the corridor, not just the nearest
  const inLine1 = new Enemy(scene.character.x, scene.character.y - 40, 1, 'husk');
  const inLine2 = new Enemy(scene.character.x, scene.character.y - 80, 1, 'husk');
  const offLine = new Enemy(scene.character.x + 200, scene.character.y - 40, 1, 'husk');
  for (const e of [inLine1, inLine2, offLine]) e.hp = 1000;
  scene.enemies = [inLine1, inLine2, offLine];
  scene.character.mana = scene.character.maxMana;
  scene._castSkill(getGemById('crush'));
  assert.ok(inLine1.hp < 1000);
  assert.ok(inLine2.hp < 1000);
  assert.equal(offLine.hp, 1000); // out of the line's width, untouched

  // dash: Slice and Dice damages the target and sets a dash animation state
  const dashTarget = new Enemy(scene.character.x, scene.character.y - 60, 1, 'husk');
  dashTarget.hp = 1000;
  scene.enemies = [dashTarget];
  scene.character.mana = scene.character.maxMana;
  scene.dash = null;
  scene._castSkill(getGemById('slice_and_dice'));
  assert.ok(dashTarget.hp < 1000);
  assert.ok(scene.dash);
  assert.equal(scene.dash.toX, dashTarget.x);

  // mana gate: any skill should refuse to fire (and not spend mana) when unaffordable
  scene.character.mana = 0;
  const before = scene.character.mana;
  const gated = scene._castSkill(getGemById('cinder_shot'));
  assert.equal(gated, false);
  assert.equal(scene.character.mana, before);
});

test('weapon type scales non-innate skill range but never Punch', () => {
  inv.addLootItem({ kind: 'equipment', defId: 'bow', w: 1, h: 4, sockets: new Array(6).fill(null), affixes: {} });
  const bow = inv.getGeneralGrid().items.find((i) => i.defId === 'bow');
  assert.equal(inv.equipItem(bow.instanceId, 'weapon'), true);

  const scene = makeScene();
  assert.equal(scene.weaponRangeMultiplier, 1.5); // bow is the longest-range weapon type

  const cinderShot = getGemById('cinder_shot');
  const farEnemy = new Enemy(scene.character.x, scene.character.y - cinderShot.range * 1.3, 1, 'husk');
  scene.enemies = [farEnemy];
  scene.character.mana = scene.character.maxMana;
  // out of the gem's own 220 range, but within range * 1.5 thanks to the bow
  assert.equal(scene._castSkill(cinderShot), true);

  scene.projectiles = [];
  scene.character.mana = scene.character.maxMana;
  assert.equal(scene._castSkill(PUNCH_SKILL), false); // Punch's range is untouched by the bow
});

test('support gems only modify skill gems socketed in the SAME equipped item', () => {
  clearBag();
  inv.addLootItem({ kind: 'equipment', defId: 'helmet_armour', w: 2, h: 2, sockets: [null, null], affixes: { intelligence: 97 } });
  inv.addLootItem({ kind: 'equipment', defId: 'chest_armour', w: 2, h: 3, sockets: [null, null], affixes: { strength: 97 } });
  inv.addLootItem({ kind: 'equipment', defId: 'legs_armour', w: 2, h: 2, sockets: [null], affixes: { vitality: 1 } });
  const helmet = inv.getGeneralGrid().items.find((i) => i.defId === 'helmet_armour' && i.affixes.intelligence === 97);
  const chest = inv.getGeneralGrid().items.find((i) => i.defId === 'chest_armour' && i.affixes.strength === 97);
  const legs = inv.getGeneralGrid().items.find((i) => i.defId === 'legs_armour' && i.affixes.vitality === 1);
  assert.equal(inv.equipItem(helmet.instanceId), true);
  assert.equal(inv.equipItem(chest.instanceId), true);
  assert.equal(inv.equipItem(legs.instanceId), true);

  // helmet: cinder_shot + Added Might Support -- linked, same item
  inv.addGem('cinder_shot');
  inv.addGem('support_added_might');
  assert.equal(inv.socketGem('helmet', 0, 'cinder_shot'), true);
  assert.equal(inv.socketGem('helmet', 1, 'support_added_might'), true);

  // chest: crush alone
  inv.addGem('crush');
  assert.equal(inv.socketGem('chest', 0, 'crush'), true);

  // legs: Momentum Support alone (targets 'melee' -- would boost crush, but
  // it's socketed in a different item, so it must NOT apply)
  inv.addGem('support_momentum');
  assert.equal(inv.socketGem('legs', 0, 'support_momentum'), true);

  const scene = makeScene();
  assert.equal(scene.skills.length, 2); // cinder_shot + crush; supports never fire on their own, Punch steps aside

  const cinderShotSkill = scene.skills.find((s) => s.def.id === 'cinder_shot').def;
  assert.equal(cinderShotSkill.supportDamageMultiplier, 1.25);
  assert.deepEqual(cinderShotSkill.appliedSupportIds, ['support_added_might']);

  const crushSkill = scene.skills.find((s) => s.def.id === 'crush').def;
  assert.equal(crushSkill.supportDamageMultiplier, 1); // Momentum Support is on a different item
  assert.deepEqual(crushSkill.appliedSupportIds, []);
});

test('Volley Support adds a real extra projectile to the actual cast', () => {
  clearBag();
  inv.addLootItem({ kind: 'equipment', defId: 'helmet_armour', w: 2, h: 2, sockets: [null, null], affixes: { intelligence: 55 } });
  const helmet = inv.getGeneralGrid().items.find((i) => i.defId === 'helmet_armour' && i.affixes.intelligence === 55);
  assert.equal(inv.equipItem(helmet.instanceId), true);
  inv.addGem('cinder_shot');
  inv.addGem('support_volley');
  assert.equal(inv.socketGem('helmet', 0, 'cinder_shot'), true);
  assert.equal(inv.socketGem('helmet', 1, 'support_volley'), true);

  const scene = makeScene();
  const resolved = scene.skills.find((s) => s.def.id === 'cinder_shot').def;
  assert.equal(resolved.projectileCount, 2);

  const target = new Enemy(scene.character.x, scene.character.y - 50, 1, 'husk');
  scene.enemies = [target];
  scene.character.mana = scene.character.maxMana;
  assert.equal(scene._castSkill(resolved), true);
  assert.equal(scene.projectiles.length, 2);
});

test('Cinder Nova hits every enemy within its radius and ignores enemies far outside it', () => {
  clearBag(); // a tall 1x4 shape needs a clean grid; earlier tests leave it fragmented
  inv.addLootItem({ kind: 'equipment', defId: 'staff', w: 1, h: 4, sockets: new Array(6).fill(null), affixes: { intelligence: 30 } });
  const staff = inv.getGeneralGrid().items.find((i) => i.defId === 'staff');
  assert.equal(inv.equipItem(staff.instanceId, 'weapon'), true);
  inv.addGem('cinder_nova');
  assert.equal(inv.socketGem('weapon', 0, 'cinder_nova'), true);

  const scene = makeScene();
  const nova = scene.skills.find((s) => s.def.id === 'cinder_nova').def;

  const near = new Enemy(scene.character.x + 10, scene.character.y, 1, 'husk');
  const far = new Enemy(scene.character.x + 5000, scene.character.y, 1, 'husk');
  near.hp = 1000;
  far.hp = 1000;
  scene.enemies = [near, far];
  scene.character.mana = scene.character.maxMana;
  assert.equal(scene._castSkill(nova), true);
  assert.ok(near.hp < 1000);
  assert.equal(far.hp, 1000);
});

test('gear drops: bosses always drop, and the item lands in itemsEarned', () => {
  const scene = makeScene();
  assert.deepEqual(scene.itemsEarned, []);

  const boss = new Enemy(scene.character.x, scene.character.y, 1, 'boss');
  scene._damageEnemy(boss, boss.hp + 1);
  assert.equal(scene.itemsEarned.length, 1);
  assert.ok(scene.itemsEarned[0].defId);
  assert.ok(Array.isArray(scene.itemsEarned[0].sockets));
});

test('clearing all rounds and the boss fires onMapComplete exactly once', () => {
  let completeCount = 0;
  let lastPayload = null;
  const scene = makeScene({
    onMapComplete(currencyEarned, xpEarned) {
      completeCount++;
      lastPayload = { currencyEarned, xpEarned };
    },
  });

  let frame = 0;
  while (completeCount === 0 && frame < 50000) {
    for (const e of scene.enemies) e.hp = 0.001; // one-shot whatever is alive
    scene._update(1 / 60);
    frame++;
  }

  assert.equal(completeCount, 1);
  assert.ok(lastPayload.xpEarned > 0);
  assert.ok(frame < 50000, 'map completion should happen well within the frame budget');

  // a further _update after completion must not fire onMapComplete again
  scene._update(1 / 60);
  assert.equal(completeCount, 1);
});

test('a higher-tier map folds its toughness base % into mapMods.monsterToughnessPct', () => {
  const tier1 = makeScene({}, 'ashen_grove');
  const tier3 = makeScene({}, 'cinder_wastes');
  assert.equal(tier1.mapMods.monsterToughnessPct, 0);
  assert.equal(tier3.mapMods.monsterToughnessPct, 25); // tier 3's toughness base
});

test('a used Warped Sigil\'s rolled modifiers apply to the next scene and are consumed exactly once', () => {
  inv.addCurrency('warpedSigil', 1);
  const rolled = inv.useMapSigil();
  assert.equal(rolled.length, 3);
  assert.notDeepEqual(inv.getPendingMapModifiers(), []);

  const scene = makeScene();
  assert.deepEqual(scene.activeMapModifiers, rolled);
  assert.deepEqual(inv.getPendingMapModifiers(), []); // consumed by starting the run

  // A second scene (no sigil pending) gets none.
  const scene2 = makeScene();
  assert.deepEqual(scene2.activeMapModifiers, []);
});

test("a sigil's rarityBonus raises character.rarity by exactly that amount for the run", () => {
  const baseline = makeScene();
  const baselineRarity = baseline.character.rarity;

  inv.addCurrency('warpedSigil', 1);
  const rolled = inv.useMapSigil();
  const effects = combineModifierEffects(rolled);
  const scene = makeScene();

  assert.ok(Math.abs(scene.character.rarity - (baselineRarity + effects.rarityBonus)) < 1e-6);
});

test("the Weakening map modifier's reducedDefensesPct shrinks armour/evasion/barrier by exactly that %", () => {
  // Equip a real armour piece so there's a non-zero baseline to shrink.
  clearBag();
  inv.addLootItem({ kind: 'equipment', defId: 'chest_armour', tier: 'rare', w: 2, h: 3, sockets: [null], affixes: { armourFlat: 10 } });
  const chest = inv.getGeneralGrid().items.find((i) => i.defId === 'chest_armour');
  inv.equipItem(chest.instanceId);
  const baselineArmour = inv.getDefenseStats().armour;
  assert.ok(baselineArmour > 0);

  // Force-roll until Weakening comes up (~50% per roll with a 6-item pool
  // and 3 picks) -- a generous retry cap keeps this from ever being flaky.
  let effects;
  for (let i = 0; i < 100; i++) {
    inv.addCurrency('warpedSigil', 1);
    const rolled = inv.useMapSigil();
    if (rolled.some((m) => m.id === 'weakening')) {
      effects = combineModifierEffects(rolled);
      break;
    }
  }
  assert.ok(effects, 'never rolled Weakening in 100 tries');
  assert.ok(effects.reducedDefensesPct > 0);

  const scene = makeScene();
  const expectedArmour = baselineArmour * (1 - effects.reducedDefensesPct / 100);
  assert.ok(Math.abs(scene.character.armour - expectedArmour) < 1e-6);
});

test('the Volatile map modifier bursts a slain enemy, damaging the player through the normal defence pipeline', () => {
  const scene = makeScene();
  scene.volatileDeaths = true;
  const enemy = new Enemy(scene.character.x + 10, scene.character.y, 1, 'husk');
  enemy.hp = 1;
  // Overwhelming damage so the burst is guaranteed to punch through any
  // armour mitigation/Barrier that cumulative gear from earlier tests in
  // this file left equipped -- this test is about the burst triggering at
  // all, not the size of the hit.
  enemy.damage = 999999;
  const hpBefore = scene.character.hp;
  withFixedRandom([0.99], () => scene._damageEnemy(enemy, 1)); // roll above any plausible evasionChance -> hits
  assert.ok(scene.character.hp < hpBefore, 'a close-range volatile death should have damaged the player');
});

test('the Volatile map modifier does not damage the player if they are out of burst range', () => {
  const scene = makeScene();
  scene.volatileDeaths = true;
  const enemy = new Enemy(scene.character.x + 5000, scene.character.y, 1, 'husk');
  enemy.hp = 1;
  const hpBefore = scene.character.hp;
  scene._damageEnemy(enemy, 1);
  assert.equal(scene.character.hp, hpBefore);
});

test("Blood Font's manaCostAsLifePct converts part of a skill's mana cost into an HP cost", () => {
  prog.addXp(1000000);
  for (const id of ['vit1', 'vit2', 'vit3', 'vit4', 'vit5', 'vit6', 'vit7']) {
    assert.equal(prog.allocateNode('player', id), true);
  }

  const scene = makeScene();
  assert.equal(scene.character.manaCostAsLifePct, 25);

  const target = new Enemy(scene.character.x, scene.character.y - 50, 1, 'husk');
  scene.enemies = [target];
  scene.character.mana = scene.character.maxMana;
  const manaBefore = scene.character.mana;
  const hpBefore = scene.character.hp;

  const cinderShot = getGemById('cinder_shot'); // manaCost 6
  assert.equal(scene._castSkill(cinderShot), true);
  assert.ok(Math.abs(manaBefore - scene.character.mana - 4.5) < 1e-9); // 75% of 6
  assert.ok(Math.abs(hpBefore - scene.character.hp - 1.5) < 1e-9); // 25% of 6, paid as life

  prog.resetTree('player'); // leave a clean slate for later tests in this file
});

test('Ember Aura continuously drains mana and pulses damage to enemies in range, shutting off empty and relighting full', () => {
  clearBag();
  clearGear();
  inv.addLootItem({ kind: 'equipment', defId: 'staff', w: 1, h: 4, sockets: new Array(6).fill(null), affixes: { intelligence: 40 } });
  const staff = inv.getGeneralGrid().items.find((i) => i.defId === 'staff' && i.affixes.intelligence === 40);
  assert.equal(inv.equipItem(staff.instanceId, 'weapon'), true);
  inv.addGem('ember_aura');
  assert.equal(inv.socketGem('weapon', 0, 'ember_aura'), true);

  const scene = makeScene();
  // The aura is not an attack skill -- Punch still steps up as the active attack.
  assert.equal(scene.skills.length, 1);
  assert.equal(scene.skills[0].def.id, 'punch');
  assert.equal(scene.auras.length, 1);
  assert.equal(scene.auras[0].def.id, 'ember_aura');
  assert.equal(scene.auras[0].on, true);

  const near = new Enemy(scene.character.x + 10, scene.character.y, 1, 'husk');
  near.hp = 1000000;
  scene.enemies = [near];
  scene.character.mana = scene.character.maxMana;

  const manaBefore = scene.character.mana;
  scene._updatePulseAura(scene.auras[0], 1); // a full second: drains and should land at least one pulse
  assert.ok(scene.character.mana < manaBefore, 'expected continuous mana drain while lit');
  assert.ok(near.hp < 1000000, 'expected at least one damage pulse within a full second');

  // Draining past zero clamps to 0 and shuts the aura off.
  scene.character.mana = 1;
  scene._updatePulseAura(scene.auras[0], 1);
  assert.equal(scene.character.mana, 0);
  assert.equal(scene.auras[0].on, false);

  // While off, it stays off short of a completely full mana pool...
  scene.character.mana = scene.character.maxMana * 0.5;
  scene._updatePulseAura(scene.auras[0], 1);
  assert.equal(scene.auras[0].on, false);

  // ...and relights only once mana is back to completely full.
  scene.character.mana = scene.character.maxMana;
  scene._updatePulseAura(scene.auras[0], 0);
  assert.equal(scene.auras[0].on, true);
});

test('Repulse Aura reserves half of max mana at start, and knocks enemies back once its cooldown elapses', () => {
  clearBag();
  clearGear();
  inv.addLootItem({ kind: 'equipment', defId: 'chest_armour', w: 2, h: 3, sockets: [null], affixes: { vitality: 15 } });
  const chest = inv.getGeneralGrid().items.find((i) => i.defId === 'chest_armour' && i.affixes.vitality === 15);
  assert.equal(inv.equipItem(chest.instanceId), true);
  inv.addGem('repulse_aura');
  assert.equal(inv.socketGem('chest', 0, 'repulse_aura'), true);

  const scene = makeScene();
  assert.equal(scene.auras.length, 1);
  assert.equal(scene.auras[0].def.id, 'repulse_aura');
  // Punch still fires as the attack -- Repulse Aura deals no damage of its own.
  assert.equal(scene.skills.length, 1);
  assert.equal(scene.skills[0].def.id, 'punch');

  // The reservation shrinks the usable pool itself, not just what's spendable.
  const unreserved = 20 + inv.getTotalStats().intelligence * 6;
  assert.ok(Math.abs(scene.character.maxMana - unreserved * 0.5) < 1e-6);
  assert.equal(scene.character.mana, scene.character.maxMana); // starts full within the reduced pool

  const enemy = new Enemy(scene.character.x + 20, scene.character.y, 1, 'husk');
  scene.enemies = [enemy];

  // Well before the cooldown elapses, nothing happens.
  scene.auras[0].timer = 10;
  scene._updateRepulseAura(scene.auras[0], 1);
  assert.equal(enemy.knockbackTimer, 0);

  // Once the cooldown elapses, the enemy is knocked back away from the player.
  scene.auras[0].timer = 0.1;
  scene._updateRepulseAura(scene.auras[0], 1);
  assert.ok(enemy.knockbackTimer > 0);
  assert.ok(enemy.knockbackVx > 0); // pushed further toward +x, where it was standing
  assert.equal(scene.auras[0].timer, scene.auras[0].def.cooldown);
});

test("Far Reach Support widens Ember Aura's pulse radius and drains mana faster, linked in the same item", () => {
  clearBag();
  clearGear();
  inv.addLootItem({ kind: 'equipment', defId: 'staff', w: 1, h: 4, sockets: new Array(6).fill(null), affixes: { intelligence: 40, dexterity: 8 } });
  const staff = inv.getGeneralGrid().items.find((i) => i.defId === 'staff' && i.affixes.intelligence === 40 && i.affixes.dexterity === 8);
  assert.equal(inv.equipItem(staff.instanceId, 'weapon'), true);
  inv.addGem('ember_aura');
  inv.addGem('support_far_reach');
  assert.equal(inv.socketGem('weapon', 0, 'ember_aura'), true);
  assert.equal(inv.socketGem('weapon', 1, 'support_far_reach'), true);

  const scene = makeScene();
  const ember = scene.auras.find((a) => a.def.id === 'ember_aura').def;
  assert.deepEqual(ember.appliedSupportIds, ['support_far_reach']);
  assert.equal(ember.areaMultiplier, 1.5);
  assert.ok(Math.abs(ember.manaCostPerSec - 13) < 1e-9); // base 10 * 1.3

  const enemyAtBaseRange = new Enemy(scene.character.x + 120, scene.character.y, 1, 'husk'); // beyond the un-widened 110 range
  enemyAtBaseRange.hp = 1000000;
  scene.enemies = [enemyAtBaseRange];
  scene.character.mana = scene.character.maxMana;
  const auraState = scene.auras.find((a) => a.def.id === 'ember_aura');
  auraState.timer = 0; // force a pulse this tick
  scene._updatePulseAura(auraState, 0.01);
  assert.ok(enemyAtBaseRange.hp < 1000000, 'expected the widened radius to reach an enemy just past the base range');
});

test("Far Reach Support widens Repulse Aura's knockback radius and reserves more mana, linked in the same item", () => {
  clearBag();
  clearGear();
  inv.addLootItem({ kind: 'equipment', defId: 'chest_armour', w: 2, h: 3, sockets: [null, null], affixes: { vitality: 15, dexterity: 8 } });
  const chest = inv.getGeneralGrid().items.find((i) => i.defId === 'chest_armour' && i.affixes.vitality === 15 && i.affixes.dexterity === 8);
  assert.equal(inv.equipItem(chest.instanceId), true);
  inv.addGem('repulse_aura');
  inv.addGem('support_far_reach');
  assert.equal(inv.socketGem('chest', 0, 'repulse_aura'), true);
  assert.equal(inv.socketGem('chest', 1, 'support_far_reach'), true);

  const scene = makeScene();
  const repulse = scene.auras.find((a) => a.def.id === 'repulse_aura').def;
  assert.deepEqual(repulse.appliedSupportIds, ['support_far_reach']);
  assert.equal(repulse.areaMultiplier, 1.5);
  assert.ok(Math.abs(repulse.manaReservePct - 65) < 1e-9); // base 50 * 1.3

  const unreserved = 20 + inv.getTotalStats().intelligence * 6;
  assert.ok(Math.abs(scene.character.maxMana - unreserved * 0.35) < 1e-6); // 1 - 65%

  const enemyAtBaseRange = new Enemy(scene.character.x + 120, scene.character.y, 1, 'husk'); // beyond the un-widened 100 range
  scene.enemies = [enemyAtBaseRange];
  const auraState = scene.auras.find((a) => a.def.id === 'repulse_aura');
  auraState.timer = 0; // force a trigger this tick
  scene._updateRepulseAura(auraState, 0.01);
  assert.ok(enemyAtBaseRange.knockbackTimer > 0, 'expected the widened radius to reach an enemy just past the base range');
});
