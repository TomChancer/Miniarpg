import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rectsOverlap, fitsAt, findFreeSpot } from '../src/grid.js';

test('rectsOverlap detects overlap and touching-but-not-overlapping rects', () => {
  assert.equal(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 2, h: 2 }), true);
  assert.equal(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 }), false);
  assert.equal(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 0, y: 2, w: 2, h: 2 }), false);
});

test('fitsAt rejects out-of-bounds placements', () => {
  assert.equal(fitsAt([], 6, 8, -1, 0, 2, 2), false);
  assert.equal(fitsAt([], 6, 8, 5, 0, 2, 2), false); // 5+2 > 6
  assert.equal(fitsAt([], 6, 8, 4, 0, 2, 2), true); // 4+2 == 6, exact fit
});

test('fitsAt rejects overlap with existing items and allows clear space', () => {
  const items = [{ x: 0, y: 0, w: 2, h: 2 }];
  assert.equal(fitsAt(items, 6, 8, 0, 0, 2, 2), false);
  assert.equal(fitsAt(items, 6, 8, 2, 0, 2, 2), true);
});

test('findFreeSpot scans left-to-right, top-to-bottom for the first fit', () => {
  const items = [{ x: 0, y: 0, w: 6, h: 1 }]; // fills the entire first row
  const spot = findFreeSpot(items, 6, 8, 2, 2);
  assert.deepEqual(spot, { x: 0, y: 1 });
});

test('findFreeSpot returns null when nothing fits', () => {
  const items = [{ x: 0, y: 0, w: 6, h: 8 }]; // fills the whole grid
  assert.equal(findFreeSpot(items, 6, 8, 1, 1), null);
});
