import { BASE_ITEM_IDS } from './equipment.js';
import { generateLootItem } from './loot.js';

const STATE_KEY = 'miniarpg.merchant.v1';
const MIN_STOCK = 4;
const MAX_STOCK = 10;

function defaultState() {
  return { stock: [], nextStockId: 1 };
}

let cached = null;

function load() {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    cached = raw ? JSON.parse(raw) : defaultState();
  } catch {
    cached = defaultState();
  }
  return cached;
}

function save() {
  localStorage.setItem(STATE_KEY, JSON.stringify(cached));
}

// Rough heuristic: more sockets and bigger affix rolls cost more. Percentage
// affixes (currently just attackSpeedPct, stored as a fraction) are scaled
// up so a "5" (5%) counts similarly to a flat "5" stat point.
function priceFor(item) {
  const socketValue = item.sockets.length * 6;
  const affixValue = Object.values(item.affixes).reduce(
    (sum, amount) => sum + (amount < 1 ? amount * 100 : amount) * 3,
    0
  );
  return Math.max(10, Math.round(20 + socketValue + affixValue));
}

export function getStock() {
  return load().stock;
}

export function refreshStock() {
  const s = load();
  const count = MIN_STOCK + Math.floor(Math.random() * (MAX_STOCK - MIN_STOCK + 1));
  s.stock = Array.from({ length: count }, () => {
    const baseId = BASE_ITEM_IDS[Math.floor(Math.random() * BASE_ITEM_IDS.length)];
    const item = generateLootItem(baseId);
    return { ...item, stockId: s.nextStockId++, price: priceFor(item) };
  });
  save();
}

export function removeFromStock(stockId) {
  const s = load();
  const before = s.stock.length;
  s.stock = s.stock.filter((i) => i.stockId !== stockId);
  save();
  return s.stock.length < before;
}
