import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TREES } from '../src/talentTrees.js';

for (const [treeId, tree] of Object.entries(TREES)) {
  test(`${treeId} tree: every connection is bidirectional`, () => {
    for (const node of Object.values(tree.nodes)) {
      for (const otherId of node.connections) {
        const other = tree.nodes[otherId];
        assert.ok(other, `${treeId}.${node.id} connects to unknown node "${otherId}"`);
        assert.ok(
          other.connections.includes(node.id),
          `${treeId}.${otherId} is missing the reverse edge back to ${node.id}`
        );
      }
    }
  });

  test(`${treeId} tree: every node is reachable from start`, () => {
    const seen = new Set(['start']);
    const queue = ['start'];
    while (queue.length) {
      const id = queue.shift();
      for (const nextId of tree.nodes[id].connections) {
        if (!seen.has(nextId)) {
          seen.add(nextId);
          queue.push(nextId);
        }
      }
    }
    const unreachable = Object.keys(tree.nodes).filter((id) => !seen.has(id));
    assert.deepEqual(unreachable, []);
  });

  test(`${treeId} tree: costs and keystone shape are consistent`, () => {
    for (const node of Object.values(tree.nodes)) {
      if (node.id === 'start') {
        assert.equal(node.cost, 0);
        continue;
      }
      if (node.keystone) {
        assert.equal(node.cost, 2);
        assert.equal(typeof node.name, 'string');
        assert.equal(typeof node.description, 'string');
        assert.equal(typeof node.mods, 'object');
      } else {
        assert.equal(node.cost, 1);
        assert.ok(node.stat || node.mod, `${treeId}.${node.id} has neither a stat nor a mod effect`);
      }
    }
  });

  test(`${treeId} tree: has the expected number of keystones`, () => {
    const keystones = Object.values(tree.nodes).filter((n) => n.keystone);
    // Player tree: Berserker's Heart/Juggernaut (STR fork), Overcharge/Mind
    // Ward (INT fork), Phase Skin (DEX, single), Blood Font (VIT, single)
    // = 6. Mapping tree: Overrun (PACK, single) = 1.
    assert.equal(keystones.length, treeId === 'player' ? 6 : 1);
  });
}
