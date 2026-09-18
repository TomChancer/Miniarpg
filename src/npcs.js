import { getBestWave } from './storage.js';

// Each NPC gates on progression via `unlocked()`. Adding a new townsfolk
// later is just a new entry here plus a handler for its `service` in app.js.
export const NPCS = [
  {
    id: 'gem_vendor',
    name: 'Yorna',
    title: 'Gem Vendor',
    unlocked: () => true,
    service: 'gem_shop',
  },
  {
    id: 'merchant',
    name: 'Bram',
    title: 'Merchant',
    unlocked: () => true,
    service: 'merchant_shop',
  },
];

export function getAvailableNpcs() {
  return NPCS.filter((npc) => npc.unlocked(getBestWave()));
}
