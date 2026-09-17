// Data-driven so higher map tiers can add rounds (and later, mapping-passive
// -driven mini-mechanic rounds) without touching combat.js.
export const MAPS = {
  ashen_grove: { id: 'ashen_grove', name: 'Ashen Grove', rounds: 3 },
};

export function getMapDef(id) {
  return MAPS[id];
}
