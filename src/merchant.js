import { BASE_ITEM_IDS } from './equipment.js';
import { generateLootItem, itemValue } from './loot.js';

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

export function getStock() {
  return load().stock;
}

export function refreshStock() {
  const s = load();
  const count = MIN_STOCK + Math.floor(Math.random() * (MAX_STOCK - MIN_STOCK + 1));
  s.stock = Array.from({ length: count }, () => {
    const baseId = BASE_ITEM_IDS[Math.floor(Math.random() * BASE_ITEM_IDS.length)];
    // Shop stock never carries Rare or Unique gear — those are earned or crafted.
    const item = generateLootItem(baseId, { maxTier: 'uncommon' });
    return { ...item, stockId: s.nextStockId++, price: itemValue(item) };
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
