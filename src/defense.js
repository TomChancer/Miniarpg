// Armour and Evasion share the same diminishing-returns curve: each point is
// worth less than the last, and the curve asymptotically approaches (but
// never reaches) a 90% soft cap. `K` is the "half-value" constant -- the
// rating needed to reach 45% (half of the 90% cap).
const SOFT_CAP = 0.9;
export const ARMOUR_K = 100;
export const EVASION_K = 100;

export function armourMitigation(armour) {
  if (armour <= 0) return 0;
  return SOFT_CAP * (armour / (armour + ARMOUR_K));
}

export function evasionChance(evasion) {
  if (evasion <= 0) return 0;
  return SOFT_CAP * (evasion / (evasion + EVASION_K));
}

// Barrier doesn't mitigate -- it's a shield-like pool that absorbs damage
// before HP, refills only after a period without taking damage, and any hit
// that reaches it resets that delay.
export const BARRIER_RECHARGE_DELAY_SEC = 3;
export const BARRIER_RECHARGE_PCT_PER_SEC = 0.2;
