import { CURRENCY } from './currency.js';

// Skill gems define how the character's auto-attack behaves.
// projectiles: how many targets it fires at per attack.
// pierce: how many extra enemies a single projectile can punch through.
// Support gems (later) will layer modifiers on top of whichever gem is equipped here.
export const GEMS = [
  {
    id: 'ember_bolt',
    name: 'Ember Bolt',
    description: 'A single bolt at your nearest foe.',
    cost: 0,
    currency: CURRENCY.id,
    starter: true,
    projectiles: 1,
    pierce: 0,
  },
  {
    id: 'cinder_twinshot',
    name: 'Cinder Twinshot',
    description: 'Fires at two nearest enemies at once.',
    cost: 12,
    currency: CURRENCY.id,
    projectiles: 2,
    pierce: 0,
  },
  {
    id: 'piercing_shard',
    name: 'Piercing Shard',
    description: 'Your bolt punches through up to 2 extra enemies.',
    cost: 20,
    currency: CURRENCY.id,
    projectiles: 1,
    pierce: 2,
  },
];

const OWNED_KEY = 'miniarpg.gems.owned';
const EQUIPPED_KEY = 'miniarpg.gems.equipped';

function starterGemIds() {
  return GEMS.filter((g) => g.starter).map((g) => g.id);
}

export function getGemById(id) {
  return GEMS.find((g) => g.id === id);
}

export function getOwnedGemIds() {
  const raw = localStorage.getItem(OWNED_KEY);
  if (!raw) {
    const starters = starterGemIds();
    localStorage.setItem(OWNED_KEY, JSON.stringify(starters));
    return starters;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return starterGemIds();
  }
}

export function ownsGem(id) {
  return getOwnedGemIds().includes(id);
}

export function ownGem(id) {
  const owned = getOwnedGemIds();
  if (!owned.includes(id)) {
    owned.push(id);
    localStorage.setItem(OWNED_KEY, JSON.stringify(owned));
  }
}

export function getEquippedGemId() {
  return localStorage.getItem(EQUIPPED_KEY) || starterGemIds()[0];
}

export function equipGem(id) {
  localStorage.setItem(EQUIPPED_KEY, id);
}

export function getEquippedGem() {
  return getGemById(getEquippedGemId()) || GEMS.find((g) => g.starter);
}
