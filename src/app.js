import { CombatScene } from './combat.js';
import { getBestWave, reportWaveReached } from './storage.js';
import {
  CURRENCY,
  getBalance,
  addCurrency,
  spendCurrency,
  getGeneralGrid,
  getGemGrid,
  getEquipped,
  buyEquipment,
  equipItem,
  unequipItem,
  addGem,
  socketGem,
  unsocketGem,
  discardItem,
  getTotalStats,
  meetsRequirement,
} from './inventory.js';
import { GEMS, getGemById } from './gems.js';

const STAT_LABELS = { strength: 'STR', vitality: 'VIT', intelligence: 'INT', dexterity: 'DEX' };

function requirementText(requirement) {
  if (!requirement) return 'No requirement';
  return `Requires ${requirement.value} ${STAT_LABELS[requirement.stat]}`;
}
import { EQUIPMENT_ITEMS, getEquipmentDef, SLOTS } from './equipment.js';
import { getAvailableNpcs } from './npcs.js';

const screens = {
  town: document.getElementById('town-screen'),
  map: document.getElementById('map-screen'),
  inventory: document.getElementById('inventory-screen'),
  combat: document.getElementById('combat-screen'),
  results: document.getElementById('results-screen'),
};

function showScreen(name) {
  for (const key of Object.keys(screens)) {
    screens[key].classList.toggle('active', key === name);
  }
}

const canvas = document.getElementById('combat-canvas');
const hpBarInner = document.getElementById('hp-bar-inner');
const manaBarInner = document.getElementById('mana-bar-inner');
const hpLabel = document.getElementById('hp-label');
const waveLabel = document.getElementById('wave-label');
const shardsLabel = document.getElementById('shards-label');
const bestWaveEl = document.getElementById('best-wave');
const resultWaveEl = document.getElementById('result-wave');
const resultBestEl = document.getElementById('result-best');
const resultEarnedEl = document.getElementById('result-earned');
const currencyDisplay = document.getElementById('currency-display');
const invCurrencyDisplay = document.getElementById('inv-currency-display');
const npcListEl = document.getElementById('npc-list');
const shopModal = document.getElementById('shop-modal');
const shopTitle = document.getElementById('shop-title');
const shopBalance = document.getElementById('shop-balance');
const shopItemsEl = document.getElementById('shop-items');
const itemModal = document.getElementById('item-modal');
const itemModalTitle = document.getElementById('item-modal-title');
const itemModalBody = document.getElementById('item-modal-body');
const bagGridEl = document.getElementById('bag-grid');
const gemGridEl = document.getElementById('gem-grid');
const statsRowEl = document.getElementById('stats-row');

let scene = null;
let currentModalItem = null;

function refreshBestWave() {
  bestWaveEl.textContent = `Best wave: ${getBestWave()}`;
}

function refreshCurrencyDisplay() {
  const balance = getBalance();
  const html = `${balance} <span class="currency-name">${CURRENCY.name}</span>`;
  currencyDisplay.innerHTML = html;
  invCurrencyDisplay.innerHTML = html;
  shopBalance.textContent = `${balance} ${CURRENCY.name}`;
}

// --- town / NPCs ---

function renderNpcList() {
  npcListEl.innerHTML = '';
  for (const npc of getAvailableNpcs()) {
    const card = document.createElement('div');
    card.className = 'npc-card';
    card.innerHTML = `
      <div class="npc-avatar"></div>
      <div class="npc-info">
        <span class="npc-name">${npc.name}</span>
        <span class="npc-title">${npc.title}</span>
      </div>
    `;
    card.addEventListener('click', () => handleNpcInteract(npc));
    npcListEl.appendChild(card);
  }
}

function handleNpcInteract(npc) {
  if (npc.service === 'gem_shop') {
    openShop(npc);
  }
}

// --- shop ---

function openShop(npc) {
  shopTitle.textContent = `${npc.name}'s Wares`;
  refreshCurrencyDisplay();
  renderShop();
  shopModal.classList.add('active');
}

function closeShop() {
  shopModal.classList.remove('active');
}

function renderShop() {
  shopItemsEl.innerHTML = '';

  const gearHeader = document.createElement('div');
  gearHeader.className = 'shop-section-title';
  gearHeader.textContent = 'Gear';
  shopItemsEl.appendChild(gearHeader);

  for (const def of EQUIPMENT_ITEMS) {
    const canAfford = getBalance() >= def.cost;
    const speedNote = def.stats?.attackSpeedPct
      ? ` &middot; +${Math.round(def.stats.attackSpeedPct * 100)}% attack speed`
      : '';
    const card = document.createElement('div');
    card.className = 'gem-card';
    card.innerHTML = `
      <div class="gem-card-top">
        <span class="gem-name">${def.name}</span>
        <span class="gem-cost">${def.cost} ${CURRENCY.name}</span>
      </div>
      <div class="gem-desc">${def.sockets} sockets${speedNote}</div>
      <button class="gem-action" data-buy-gear="${def.id}" ${canAfford ? '' : 'disabled'}>Buy</button>
    `;
    shopItemsEl.appendChild(card);
  }

  const gemHeader = document.createElement('div');
  gemHeader.className = 'shop-section-title';
  gemHeader.textContent = 'Skill Gems';
  shopItemsEl.appendChild(gemHeader);

  for (const def of GEMS) {
    const canAfford = getBalance() >= def.cost;
    const met = meetsRequirement(def.requirement);
    const card = document.createElement('div');
    card.className = 'gem-card';
    card.innerHTML = `
      <div class="gem-card-top">
        <span class="gem-name">${def.name}</span>
        <span class="gem-cost">${def.cost} ${CURRENCY.name}</span>
      </div>
      <div class="gem-desc">${def.description}</div>
      <div class="gem-desc">${def.manaCost} mana &middot; <span class="${met ? '' : 'req-unmet'}">${requirementText(def.requirement)}</span></div>
      <button class="gem-action" data-buy-gem="${def.id}" ${canAfford ? '' : 'disabled'}>Buy</button>
    `;
    shopItemsEl.appendChild(card);
  }

  shopItemsEl.querySelectorAll('[data-buy-gear]').forEach((btn) => {
    btn.addEventListener('click', () => buyGear(btn.dataset.buyGear));
  });
  shopItemsEl.querySelectorAll('[data-buy-gem]').forEach((btn) => {
    btn.addEventListener('click', () => buyGem(btn.dataset.buyGem));
  });
}

function buyGear(defId) {
  const def = getEquipmentDef(defId);
  if (getBalance() < def.cost) return;
  if (!buyEquipment(defId)) {
    alert('Your bag is full — make room in your Inventory first.');
    return;
  }
  spendCurrency(def.cost);
  refreshCurrencyDisplay();
  renderShop();
}

function buyGem(defId) {
  const def = getGemById(defId);
  if (getBalance() < def.cost) return;
  if (!addGem(defId)) {
    alert('Your gem pouch is full — make room in your Inventory first.');
    return;
  }
  spendCurrency(def.cost);
  refreshCurrencyDisplay();
  renderShop();
}

// --- inventory screen ---

function refreshInventoryScreen() {
  refreshCurrencyDisplay();
  renderPaperdoll();
  renderStats();
  renderGrid(bagGridEl, getGeneralGrid(), 'bag');
  renderGrid(gemGridEl, getGemGrid(), 'gems');
}

function renderStats() {
  const stats = getTotalStats();
  statsRowEl.innerHTML = Object.entries(STAT_LABELS)
    .map(([key, label]) => `<span class="stat-chip">${label} <strong>${stats[key]}</strong></span>`)
    .join('');
}

function renderPaperdoll() {
  const equipped = getEquipped();
  for (const slot of SLOTS) {
    const wrap = document.querySelector(`.equip-slot[data-slot="${slot}"]`);
    const body = wrap.querySelector('.equip-slot-body');
    const item = equipped[slot];
    if (item) {
      const def = getEquipmentDef(item.defId);
      const filled = item.sockets.filter(Boolean).length;
      body.textContent = `${def.name} (${filled}/${def.sockets})`;
      wrap.classList.add('filled');
    } else {
      body.textContent = 'Empty';
      wrap.classList.remove('filled');
    }
  }
}

function itemLabel(item, tabKind) {
  if (tabKind === 'gems') {
    const def = getGemById(item.defId);
    return def ? def.name : '?';
  }
  if (item.kind === 'currency') return `${item.quantity}`;
  const def = getEquipmentDef(item.defId);
  return def ? def.name : '?';
}

function renderGrid(containerEl, gridData, tabKind) {
  containerEl.innerHTML = '';
  containerEl.style.gridTemplateColumns = `repeat(${gridData.w}, var(--cell-size))`;
  containerEl.style.gridTemplateRows = `repeat(${gridData.h}, var(--cell-size))`;
  for (const item of gridData.items) {
    const el = document.createElement('div');
    const kindClass = tabKind === 'gems' ? 'gem' : item.kind;
    el.className = `grid-item grid-item-${kindClass}`;
    el.style.gridColumn = `${item.x + 1} / span ${item.w || 1}`;
    el.style.gridRow = `${item.y + 1} / span ${item.h || 1}`;
    el.textContent = itemLabel(item, tabKind);
    el.addEventListener('click', () => openItemModal(tabKind, item));
    containerEl.appendChild(el);
  }
}

document.querySelectorAll('.inv-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.inv-tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    bagGridEl.style.display = tab === 'bag' ? 'grid' : 'none';
    gemGridEl.style.display = tab === 'gems' ? 'grid' : 'none';
  });
});

document.querySelectorAll('.equip-slot').forEach((el) => {
  el.addEventListener('click', () => {
    const slot = el.dataset.slot;
    if (getEquipped()[slot]) openEquippedModal(slot);
  });
});

function closeItemModal() {
  itemModal.classList.remove('active');
  currentModalItem = null;
}

function openItemModal(tabKind, item) {
  currentModalItem = { tabKind, item };

  if (tabKind === 'gems') {
    const def = getGemById(item.defId);
    const met = meetsRequirement(def.requirement);
    itemModalTitle.textContent = def.name;
    itemModalBody.innerHTML = `
      <div class="gem-desc">${def.description}</div>
      <div class="gem-desc">${def.speed}/s &middot; ${def.manaCost} mana &middot; scales with ${STAT_LABELS[def.scalingStat]}</div>
      <div class="gem-desc"><span class="${met ? '' : 'req-unmet'}">${requirementText(def.requirement)}</span></div>
      <button class="gem-action" id="item-discard">Discard</button>
    `;
  } else if (item.kind === 'currency') {
    itemModalTitle.textContent = CURRENCY.name;
    itemModalBody.innerHTML = `
      <div class="gem-desc">${item.quantity} / ${CURRENCY.stackCap} in this stack</div>
      <button class="gem-action" id="item-discard">Discard Stack</button>
    `;
  } else {
    const def = getEquipmentDef(item.defId);
    const speedNote = def.stats?.attackSpeedPct
      ? ` &middot; +${Math.round(def.stats.attackSpeedPct * 100)}% attack speed`
      : '';
    itemModalTitle.textContent = def.name;
    itemModalBody.innerHTML = `
      <div class="gem-desc">${def.sockets} sockets${speedNote}</div>
      <button class="gem-action" id="item-equip">Equip</button>
      <button class="gem-action" id="item-discard">Discard</button>
    `;
  }

  itemModal.classList.add('active');
  wireItemModalActions();
}

function wireItemModalActions() {
  const discardBtn = document.getElementById('item-discard');
  if (discardBtn) {
    discardBtn.addEventListener('click', () => {
      const { tabKind, item } = currentModalItem;
      discardItem(tabKind === 'gems' ? 'gem' : 'general', item.instanceId);
      closeItemModal();
      refreshInventoryScreen();
    });
  }
  const equipBtn = document.getElementById('item-equip');
  if (equipBtn) {
    equipBtn.addEventListener('click', () => {
      const { item } = currentModalItem;
      if (equipItem(item.instanceId)) {
        closeItemModal();
        refreshInventoryScreen();
      } else {
        alert('No room to swap out your current gear — make space in your bag first.');
      }
    });
  }
}

function openEquippedModal(slot) {
  const item = getEquipped()[slot];
  if (!item) return;
  const def = getEquipmentDef(item.defId);
  currentModalItem = { tabKind: 'equipped', slot };

  const speedNote = def.stats?.attackSpeedPct
    ? ` &middot; +${Math.round(def.stats.attackSpeedPct * 100)}% attack speed`
    : '';
  const pips = item.sockets
    .map((gemId, idx) => {
      if (gemId) {
        const gdef = getGemById(gemId);
        return `<button class="socket-pip filled" data-index="${idx}">${gdef.name[0]}</button>`;
      }
      return `<button class="socket-pip empty" data-index="${idx}">+</button>`;
    })
    .join('');

  itemModalTitle.textContent = def.name;
  itemModalBody.innerHTML = `
    <div class="gem-desc">${def.sockets} sockets${speedNote}</div>
    <div class="socket-row">${pips}</div>
    <button class="gem-action" id="item-unequip">Unequip</button>
  `;
  itemModal.classList.add('active');

  document.getElementById('item-unequip').addEventListener('click', () => {
    if (unequipItem(slot)) {
      closeItemModal();
      refreshInventoryScreen();
    } else {
      alert('No room in your bag to unequip this.');
    }
  });

  itemModalBody.querySelectorAll('.socket-pip').forEach((pip) => {
    pip.addEventListener('click', () => {
      const idx = Number(pip.dataset.index);
      if (pip.classList.contains('filled')) {
        if (unsocketGem(slot, idx)) {
          refreshInventoryScreen();
          openEquippedModal(slot);
        } else {
          alert('No room in your gem pouch to unsocket this.');
        }
      } else {
        openGemPicker(slot, idx);
      }
    });
  });
}

function openGemPicker(slot, socketIndex) {
  const counts = {};
  for (const g of getGemGrid().items) counts[g.defId] = (counts[g.defId] || 0) + 1;
  const entries = Object.entries(counts);

  itemModalTitle.textContent = 'Socket a Gem';
  if (entries.length === 0) {
    itemModalBody.innerHTML = `<div class="gem-desc">No gems in your pouch yet. Buy some from Yorna.</div>`;
    return;
  }

  itemModalBody.innerHTML = entries
    .map(([defId, count]) => {
      const def = getGemById(defId);
      const met = meetsRequirement(def.requirement);
      return `
        <button class="gem-action gem-picker-option" data-gem="${defId}" ${met ? '' : 'disabled'}>
          ${def.name} (${count}) &mdash; <span class="${met ? '' : 'req-unmet'}">${requirementText(def.requirement)}</span>
        </button>
      `;
    })
    .join('');

  itemModalBody.querySelectorAll('.gem-picker-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (socketGem(slot, socketIndex, btn.dataset.gem)) {
        refreshInventoryScreen();
        openEquippedModal(slot);
      } else {
        alert('Your stats don\'t meet this gem\'s requirement yet.');
      }
    });
  });
}

// --- combat ---

function startCombat() {
  showScreen('combat');
  scene = new CombatScene(canvas, {
    onHpChange(hp, maxHp) {
      const pct = Math.max(0, (hp / maxHp) * 100);
      hpBarInner.style.width = `${pct}%`;
      hpBarInner.style.background = pct <= 30 ? 'var(--hp-low)' : 'var(--hp)';
      hpLabel.textContent = `${Math.ceil(hp)} / ${maxHp}`;
    },
    onManaChange(mana, maxMana) {
      const pct = Math.max(0, (mana / maxMana) * 100);
      manaBarInner.style.width = `${pct}%`;
    },
    onWaveChange(wave) {
      waveLabel.textContent = `Wave ${wave}`;
    },
    onCurrencyChange(earned) {
      shardsLabel.textContent = `+${earned} Shards`;
    },
    onDeath(waveReached, currencyEarned) {
      scene.stop();
      const best = reportWaveReached(waveReached);
      addCurrency(currencyEarned);
      resultWaveEl.textContent = String(waveReached);
      resultBestEl.textContent = String(best);
      resultEarnedEl.textContent = String(currencyEarned);
      showScreen('results');
    },
  });
  scene.start();
}

// --- navigation wiring ---

document.getElementById('town-set-out').addEventListener('click', () => showScreen('map'));
document.getElementById('town-inventory').addEventListener('click', () => {
  refreshInventoryScreen();
  showScreen('inventory');
});
document.getElementById('inventory-back').addEventListener('click', () => showScreen('town'));
document.getElementById('map-back').addEventListener('click', () => showScreen('town'));
document.getElementById('map-node').addEventListener('click', startCombat);
document.getElementById('shop-close').addEventListener('click', closeShop);
document.getElementById('item-modal-close').addEventListener('click', closeItemModal);

document.getElementById('retreat-btn').addEventListener('click', () => {
  if (scene) {
    scene.stop();
    addCurrency(scene.currencyEarned);
  }
  refreshBestWave();
  refreshCurrencyDisplay();
  showScreen('town');
});

document.getElementById('return-btn').addEventListener('click', () => {
  refreshBestWave();
  refreshCurrencyDisplay();
  showScreen('town');
});

refreshBestWave();
refreshCurrencyDisplay();
renderNpcList();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
  // The first controllerchange just means the service worker claimed this
  // page for the first time ever — not an update, so don't reload for it.
  // Only a *later* controllerchange means a newer worker actually took over,
  // which is when the already-open page needs to reload to get the new JS.
  let controlledOnce = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlledOnce) {
      controlledOnce = true;
      return;
    }
    window.location.reload();
  });
}
