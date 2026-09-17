export const CURRENCY = { id: 'cinderShards', name: 'Cinder Shards' };

const BALANCE_KEY = 'miniarpg.currency.cinderShards';

export function getBalance() {
  return Number(localStorage.getItem(BALANCE_KEY) || 0);
}

export function addCurrency(amount) {
  const next = getBalance() + amount;
  localStorage.setItem(BALANCE_KEY, String(next));
  return next;
}

export function spendCurrency(amount) {
  const balance = getBalance();
  if (balance < amount) return false;
  localStorage.setItem(BALANCE_KEY, String(balance - amount));
  return true;
}
