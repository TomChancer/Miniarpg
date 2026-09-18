import '../testlib/env.js';
import { makeFakeCanvas, withFixedRandom } from '../testlib/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CombatScene } from '../src/combat.js';
import { Enemy } from '../src/entities.js';
import * as inv from '../src/inventory.js';
import { getGemById, PUNCH_SKILL } from '../src/gems.js';

function makeScene(callbackOverrides = {}) {
  const scene = new CombatScene(makeFakeCanvas(), {
    onHpChange() {}, onWaveChange() {}, onCurrencyChange() {}, onManaChange() {},
    onDeath() {}, onMapComplete() {},
    ...callbackOverrides,
  });
  scene.start();
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

test('currency drop rolls are deterministic given a fixed RNG sequence', () => {
  const scene = makeScene();
  assert.equal(scene.character.rarity, 0); // base stats, nothing allocated

  // Order matches Object.values(CURRENCIES): cinderShard, cinderFragment, voidShard, voidFragment
  // thresholds:                              0.1          0.05            0.05        0.0025
  withFixedRandom([0.05, 0.05, 0.5, 0.001], () => scene._rollDrops(1));

  assert.deepEqual(scene.currencyEarned, {
    cinderShard: 1, // 0.05 < 0.1
    cinderFragment: 0, // 0.05 is not < 0.05
    voidShard: 0, // 0.5 not < 0.05
    voidFragment: 1, // 0.001 < 0.0025
  });
});

test('evasion roll blocks enemy contact damage exactly when the roll succeeds', () => {
  const scene = makeScene();
  assert.equal(scene.character.evasionChance, 0.1); // base dexterity 5 * 0.02

  const enemy = new Enemy(scene.character.x, scene.character.y, 1, 'husk');
  enemy.attackTimer = 0;
  scene.enemies = [enemy];

  const hpBefore = scene.character.hp;
  withFixedRandom([0.05], () => scene._update(0)); // 0.05 < 0.1 -> evaded
  assert.equal(scene.character.hp, hpBefore);
  assert.ok(scene.evadeFlashTimer > 0);

  enemy.attackTimer = 0; // ready to attack again
  withFixedRandom([0.5], () => scene._update(0)); // 0.5 >= 0.1 -> hits
  assert.ok(scene.character.hp < hpBefore);
});

test('each skill kind produces its expected effect, gated by mana', () => {
  inv.addCurrency('voidShard', 200);
  // Hand-rolled items (in place of the merchant's randomized ones) with just
  // enough of each stat to meet the three gems' requirements exactly.
  inv.addLootItem({ kind: 'equipment', defId: 'helmet', w: 2, h: 2, sockets: [null], affixes: { intelligence: 3 } });
  inv.addLootItem({ kind: 'equipment', defId: 'chest', w: 2, h: 3, sockets: [null], affixes: { strength: 2 } });
  inv.addLootItem({ kind: 'equipment', defId: 'legs', w: 2, h: 2, sockets: [null], affixes: { dexterity: 4 } });
  for (const slot of ['helmet', 'chest', 'legs']) {
    const item = inv.getGeneralGrid().items.find((i) => i.defId === slot);
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
  assert.equal(scene.skills.length, 4); // punch + the 3 socketed gems

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
