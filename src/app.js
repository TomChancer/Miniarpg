import { CombatScene } from './combat.js';
import { getBestWave, reportWaveReached } from './storage.js';
import {
  CURRENCIES,
  getBalance,
  addCurrency,
  spendCurrency,
  getGeneralGrid,
  getGemGrid,
  getEquipped,
  addLootItem,
  equipItem,
  unequipItem,
  addGem,
  socketGem,
  unsocketGem,
  discardItem,
  getTotalStats,
  getDefenseStats,
  meetsRequirement,
  canAddAffix,
  addRandomAffix,
  upgradeTierWithFragment,
  upgradeTierWithShard,
  sellItem,
} from './inventory.js';
import { GEMS, getGemById } from './gems.js';
import { SUPPORT_GEMS } from './supports.js';
import { SLOTS, getBaseItem } from './equipment.js';
import { itemValue, itemDefenseBreakdown } from './loot.js';
import { armourMitigation, evasionChance } from './defense.js';
import { getAvailableNpcs } from './npcs.js';
import { getStock, refreshStock, removeFromStock } from './merchant.js';
import {
  getLevel,
  getXp,
  xpToNext,
  addXp,
  getAvailablePoints,
  getAllocatedNodes,
  isAllocated,
  canAllocate,
  allocateNode,
  resetTree,
  awardMappingPoint,
} from './progression.js';
import { getTree } from './talentTrees.js';

const STAT_LABELS = { strength: 'STR', vitality: 'VIT', intelligence: 'INT', dexterity: 'DEX', rarity: 'RAR' };
const TIER_LABELS = { basic: 'Basic', uncommon: 'Uncommon', rare: 'Rare', unique: 'Unique' };
const TAG_LABELS = { attack: 'Attack', melee: 'Melee', ranged: 'Ranged', projectile: 'Projectile', area: 'Area', dash: 'Dash' };
// Display names for affixes that aren't one of the five main stats above.
const AFFIX_LABELS = {
  attackSpeedPct: 'Attack Speed',
  armourFlat: 'Armour', armourPct: 'Armour', armourGlobalPct: 'Total Armour',
  evasionFlat: 'Evasion', evasionPct: 'Evasion', evasionGlobalPct: 'Total Evasion',
  barrierFlat: 'Barrier', barrierGlobalPct: 'Total Barrier',
};

function requirementText(requirement) {
  if (!requirement) return 'No requirement';
  return `Requires ${requirement.value} ${STAT_LABELS[requirement.stat]}`;
}

function tagsText(tags) {
  return tags.map((t) => TAG_LABELS[t] || t).join(', ');
}

function currencyCost(def) {
  return `${def.cost} ${CURRENCIES[def.currency].name}`;
}

function affixesText(affixes) {
  if (!affixes || Object.keys(affixes).length === 0) return 'No affixes';
  return Object.entries(affixes)
    .map(([stat, amount]) => {
      const label = AFFIX_LABELS[stat] || STAT_LABELS[stat] || stat;
      return stat.endsWith('Pct') ? `+${Math.round(amount * 100)}% ${label}` : `+${amount} ${label}`;
    })
    .join(', ');
}

const DEFENSE_TYPE_LABELS = { armour: 'Armour', evasion: 'Evasion', barrier: 'Barrier' };

// The math behind an item's defensive affixes, spelled out line by line --
// e.g. "Armour: 2 base + 3 flat, x1.10 (+10%) = 5.5" -- rather than leaving
// the player to work out (base + flat) * (1 + pct) from the flat affix list.
function defenseBreakdownHtml(item) {
  const breakdown = itemDefenseBreakdown(item);
  const keys = Object.keys(breakdown);
  if (keys.length === 0) return '<div class="gem-desc">No defensive stats</div>';
  return keys
    .map((key) => {
      const label = DEFENSE_TYPE_LABELS[key];
      const info = breakdown[key];
      if (info.kind === 'global') {
        return `<div class="gem-desc">${label}: +${Math.round(info.pct * 100)}% to Total ${label}</div>`;
      }
      const flatText = info.flat > 0 ? ` + ${info.flat} flat` : '';
      const pctText = info.pct > 0 ? `, &times;${(1 + info.pct).toFixed(2)} (+${Math.round(info.pct * 100)}%)` : '';
      return `<div class="gem-desc">${label}: ${info.base} base${flatText}${pctText} = ${info.total.toFixed(1)}</div>`;
    })
    .join('');
}

const screens = {
  town: document.getElementById('town-screen'),
  map: document.getElementById('map-screen'),
  inventory: document.getElementById('inventory-screen'),
  talents: document.getElementById('talents-screen'),
  combat: document.getElementById('combat-screen'),
  results: document.getElementById('results-screen'),
  victory: document.getElementById('victory-screen'),
};

function showScreen(name) {
  for (const key of Object.keys(screens)) {
    screens[key].classList.toggle('active', key === name);
  }
}

const canvas = document.getElementById('combat-canvas');
const hpBarInner = document.getElementById('hp-bar-inner');
const manaBarInner = document.getElementById('mana-bar-inner');
const barrierBarOuter = document.getElementById('barrier-bar-outer');
const barrierBarInner = document.getElementById('barrier-bar-inner');
const hpLabel = document.getElementById('hp-label');
const waveLabel = document.getElementById('wave-label');
const shardsLabel = document.getElementById('shards-label');
const bestWaveEl = document.getElementById('best-wave');
const resultWaveEl = document.getElementById('result-wave');
const resultBestEl = document.getElementById('result-best');
const resultEarnedEl = document.getElementById('result-earned');
const resultItemsEl = document.getElementById('result-items');
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
const levelLabel = document.getElementById('level-label');
const pointsLabel = document.getElementById('points-label');
const xpBarInner = document.getElementById('xp-bar-inner');
const talentPointsLabel = document.getElementById('talent-points-label');
const talentViewport = document.getElementById('talent-tree-viewport');
const talentCanvas = document.getElementById('talent-canvas');
const talentModal = document.getElementById('talent-modal');
const talentModalTitle = document.getElementById('talent-modal-title');
const talentModalBody = document.getElementById('talent-modal-body');
const resultXpEl = document.getElementById('result-xp');
const victoryXpEl = document.getElementById('victory-xp');
const victoryEarnedEl = document.getElementById('victory-earned');
const victoryItemsEl = document.getElementById('victory-items');

let scene = null;
let currentModalItem = null;
let activeTalentTree = 'player';
let hasCenteredTalentView = false;

const TREE_CANVAS_SIZE = 800;
const TREE_CENTER = TREE_CANVAS_SIZE / 2;

function refreshBestWave() {
  bestWaveEl.textContent = `Best wave: ${getBestWave()}`;
}

function currencyChipsHtml() {
  return Object.values(CURRENCIES)
    .map(
      (c) => `
        <span class="currency-chip">
          <span class="chip-dot" style="background:${c.color}"></span>
          <strong>${getBalance(c.id)}</strong> ${c.name}
        </span>
      `
    )
    .join('');
}

function bankCurrencyEarnings(earned) {
  for (const [currencyId, amount] of Object.entries(earned)) {
    if (amount > 0) addCurrency(currencyId, amount);
  }
}

// Any drop that doesn't fit is simply lost, same as currency overflow —
// only report the list of what actually got banked.
function bankItemDrops(items) {
  return items.filter((item) => addLootItem(item));
}

function renderCurrencyChipsInto(el, earned) {
  el.innerHTML = Object.values(CURRENCIES)
    .map(
      (c) => `
        <span class="currency-chip">
          <span class="chip-dot" style="background:${c.color}"></span>
          <strong>${earned[c.id] || 0}</strong> ${c.name}
        </span>
      `
    )
    .join('');
}

function renderDropListInto(el, items) {
  if (!items || items.length === 0) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = items
    .map((item) => {
      const base = getBaseItem(item.defId);
      const socketsNote = item.sockets.length > 0 ? ` (${item.sockets.length} sockets)` : '';
      return `<span class="drop-item"><strong>${base.name}</strong>${socketsNote}</span>`;
    })
    .join('');
}

function refreshProgressionBar() {
  const level = getLevel();
  const xp = getXp();
  const need = xpToNext(level);
  levelLabel.textContent = `Level ${level}`;
  pointsLabel.textContent = `${getAvailablePoints('player')} Player · ${getAvailablePoints('mapping')} Mapping`;
  xpBarInner.style.width = `${Math.min(100, (xp / need) * 100)}%`;
}

function refreshCurrencyDisplay() {
  const html = currencyChipsHtml();
  currencyDisplay.innerHTML = html;
  invCurrencyDisplay.innerHTML = html;
  shopBalance.innerHTML = html;
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
  if (npc.service === 'gem_shop') openGemShop(npc);
  else if (npc.service === 'merchant_shop') openMerchantShop(npc);
}

// --- Yorna: skill gems only ---

function openGemShop(npc) {
  shopTitle.textContent = `${npc.name}'s Wares`;
  refreshCurrencyDisplay();
  renderGemShop();
  shopModal.classList.add('active');
}

function closeShop() {
  shopModal.classList.remove('active');
}

function renderGemShop() {
  shopItemsEl.innerHTML = '<div class="shop-section-label">Skill Gems</div>';
  for (const def of GEMS) {
    const canAfford = getBalance(def.currency) >= def.cost;
    const met = meetsRequirement(def.requirement);
    const card = document.createElement('div');
    card.className = 'gem-card';
    card.innerHTML = `
      <div class="gem-card-top">
        <span class="gem-name">${def.name}</span>
        <span class="gem-cost">${currencyCost(def)}</span>
      </div>
      <div class="gem-desc">${def.description}</div>
      <div class="gem-desc">Tags: ${tagsText(def.tags)}</div>
      <div class="gem-desc">${def.manaCost} mana &middot; <span class="${met ? '' : 'req-unmet'}">${requirementText(def.requirement)}</span></div>
      <button class="gem-action" data-buy-gem="${def.id}" ${canAfford ? '' : 'disabled'}>Buy</button>
    `;
    shopItemsEl.appendChild(card);
  }

  const supportHeader = document.createElement('div');
  supportHeader.className = 'shop-section-label';
  supportHeader.textContent = 'Support Gems';
  shopItemsEl.appendChild(supportHeader);
  for (const def of SUPPORT_GEMS) {
    const canAfford = getBalance(def.currency) >= def.cost;
    const met = meetsRequirement(def.requirement);
    const card = document.createElement('div');
    card.className = 'gem-card gem-card-support';
    card.innerHTML = `
      <div class="gem-card-top">
        <span class="gem-name">${def.name}</span>
        <span class="gem-cost">${currencyCost(def)}</span>
      </div>
      <div class="gem-desc">${def.description}</div>
      <div class="gem-desc">Applies to: ${tagsText(def.appliesToTags)} &middot; socket it in the same item as the skill</div>
      <div class="gem-desc"><span class="${met ? '' : 'req-unmet'}">${requirementText(def.requirement)}</span></div>
      <button class="gem-action" data-buy-gem="${def.id}" ${canAfford ? '' : 'disabled'}>Buy</button>
    `;
    shopItemsEl.appendChild(card);
  }

  shopItemsEl.querySelectorAll('[data-buy-gem]').forEach((btn) => {
    btn.addEventListener('click', () => buyGem(btn.dataset.buyGem));
  });
}

function buyGem(defId) {
  const def = getGemById(defId);
  if (getBalance(def.currency) < def.cost) return;
  if (!addGem(defId)) {
    alert('Your gem pouch is full — make room in your Inventory first.');
    return;
  }
  spendCurrency(def.currency, def.cost);
  refreshCurrencyDisplay();
  renderGemShop();
}

// --- Bram the Merchant: rotating gear stock ---

function openMerchantShop(npc) {
  shopTitle.textContent = `${npc.name}'s Stock`;
  refreshCurrencyDisplay();
  renderMerchantShop();
  shopModal.classList.add('active');
}

function renderMerchantShop() {
  shopItemsEl.innerHTML = '';
  const stock = getStock();
  if (stock.length === 0) {
    shopItemsEl.innerHTML = `<div class="gem-desc">Nothing in stock right now. Check back after clearing a map or leveling up.</div>`;
    return;
  }
  for (const stockItem of stock) {
    const base = getBaseItem(stockItem.defId);
    const canAfford = getBalance('cinderShard') >= stockItem.price;
    const socketsNote = stockItem.sockets.length > 0 ? `${stockItem.sockets.length} sockets &middot; ` : '';
    const card = document.createElement('div');
    card.className = `gem-card tier-${stockItem.tier}`;
    card.innerHTML = `
      <div class="gem-card-top">
        <span class="gem-name">${base.name} <span class="tier-tag">${TIER_LABELS[stockItem.tier]}</span></span>
        <span class="gem-cost">${stockItem.price} ${CURRENCIES.cinderShard.name}</span>
      </div>
      <div class="gem-desc">${socketsNote}${affixesText(stockItem.affixes)}</div>
      <details class="gear-details">
        <summary>Defensive details</summary>
        ${defenseBreakdownHtml(stockItem)}
      </details>
      <button class="gem-action" data-buy-stock="${stockItem.stockId}" ${canAfford ? '' : 'disabled'}>Buy</button>
    `;
    shopItemsEl.appendChild(card);
  }
  shopItemsEl.querySelectorAll('[data-buy-stock]').forEach((btn) => {
    btn.addEventListener('click', () => buyMerchantItem(Number(btn.dataset.buyStock)));
  });
}

function buyMerchantItem(stockId) {
  const stockItem = getStock().find((i) => i.stockId === stockId);
  if (!stockItem) return;
  if (getBalance('cinderShard') < stockItem.price) return;
  const { stockId: _s, price: _p, ...item } = stockItem;
  if (!addLootItem(item)) {
    alert('Your bag is full — make room in your Inventory first.');
    return;
  }
  spendCurrency('cinderShard', stockItem.price);
  removeFromStock(stockId);
  refreshCurrencyDisplay();
  renderMerchantShop();
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
  const defense = getDefenseStats();
  const attributeChips = Object.entries(STAT_LABELS)
    .map(([key, label]) => `<span class="stat-chip">${label} <strong>${stats[key]}</strong></span>`)
    .join('');
  const defenseChips = `
    <span class="stat-chip">ARM <strong>${Math.round(armourMitigation(defense.armour) * 100)}%</strong></span>
    <span class="stat-chip">EVA <strong>${Math.round(evasionChance(defense.evasion) * 100)}%</strong></span>
    <span class="stat-chip">BAR <strong>${Math.round(defense.barrierCapacity)}</strong></span>
  `;
  statsRowEl.innerHTML = attributeChips + defenseChips;
}

function renderPaperdoll() {
  const equipped = getEquipped();
  for (const slot of SLOTS) {
    const wrap = document.querySelector(`.equip-slot[data-slot="${slot}"]`);
    const body = wrap.querySelector('.equip-slot-body');
    const item = equipped[slot];
    if (item) {
      const base = getBaseItem(item.defId);
      body.textContent =
        item.sockets.length > 0 ? `${base.name} (${item.sockets.filter(Boolean).length}/${item.sockets.length})` : base.name;
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
  const base = getBaseItem(item.defId);
  return base ? base.name : '?';
}

function renderGrid(containerEl, gridData, tabKind) {
  containerEl.innerHTML = '';
  containerEl.style.gridTemplateColumns = `repeat(${gridData.w}, var(--cell-size))`;
  containerEl.style.gridTemplateRows = `repeat(${gridData.h}, var(--cell-size))`;
  for (const item of gridData.items) {
    const el = document.createElement('div');
    const kindClass = tabKind === 'gems' ? 'gem' : item.kind;
    el.className = `grid-item grid-item-${kindClass}`;
    if (item.kind === 'currency') el.style.background = CURRENCIES[item.defId].color;
    if (item.kind === 'equipment' && item.tier) el.classList.add(`tier-${item.tier}`);
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
    const currencyDef = CURRENCIES[item.defId];
    itemModalTitle.textContent = currencyDef.name;
    itemModalBody.innerHTML = `
      <div class="gem-desc">${item.quantity} / ${currencyDef.stackCap} in this stack</div>
      <button class="gem-action" id="item-discard">Discard Stack</button>
    `;
  } else {
    const base = getBaseItem(item.defId);
    const socketsNote = item.sockets.length > 0 ? `${item.sockets.length} sockets` : 'No sockets';
    const equipButtons =
      base.slotCategory === 'weapon' && base.handedness === 'one'
        ? `<button class="gem-action" id="item-equip-main">Equip Main Hand</button>
           <button class="gem-action" id="item-equip-off">Equip Off Hand</button>`
        : `<button class="gem-action" id="item-equip">Equip</button>`;
    const sellValue = Math.round(itemValue(item) * 0.33);
    itemModalTitle.innerHTML = `${base.name} <span class="tier-tag tier-${item.tier}">${TIER_LABELS[item.tier]}</span>`;
    itemModalBody.innerHTML = `
      <div class="gem-desc">${socketsNote}</div>
      <div class="gem-desc">${affixesText(item.affixes)}</div>
      <details class="gear-details">
        <summary>Defensive details</summary>
        ${defenseBreakdownHtml(item)}
      </details>
      ${craftButtonsHtml(item)}
      ${equipButtons}
      <button class="gem-action" id="item-sell">Sell (${sellValue} ${CURRENCIES.cinderShard.name})</button>
      <button class="gem-action" id="item-discard">Discard</button>
    `;
  }

  itemModal.classList.add('active');
  wireItemModalActions();
}

function craftButtonsHtml(item) {
  if (item.tier === 'unique') return '';
  const buttons = [];
  if (item.tier === 'basic') {
    const canAfford = getBalance('cinderFragment') >= 1;
    buttons.push(
      `<button class="gem-action" id="item-craft-fragment" ${canAfford ? '' : 'disabled'}>Upgrade to Uncommon (1 ${CURRENCIES.cinderFragment.name})</button>`
    );
  } else if (item.tier === 'uncommon') {
    const canAfford = getBalance('cinderShard') >= 1;
    buttons.push(
      `<button class="gem-action" id="item-craft-shard-tier" ${canAfford ? '' : 'disabled'}>Upgrade to Rare (1 ${CURRENCIES.cinderShard.name})</button>`
    );
  }
  if (canAddAffix(item.instanceId)) {
    const canAfford = getBalance('cinderShard') >= 1;
    buttons.push(
      `<button class="gem-action" id="item-craft-affix" ${canAfford ? '' : 'disabled'}>Add Random Affix (1 ${CURRENCIES.cinderShard.name})</button>`
    );
  }
  return buttons.join('');
}

function wireItemModalActions() {
  const craftFragmentBtn = document.getElementById('item-craft-fragment');
  if (craftFragmentBtn) {
    craftFragmentBtn.addEventListener('click', () => {
      const { item } = currentModalItem;
      if (upgradeTierWithFragment(item.instanceId)) {
        refreshInventoryScreen();
        openItemModal('bag', getGeneralGrid().items.find((i) => i.instanceId === item.instanceId));
      } else {
        alert('Not enough Cinder Fragments.');
      }
    });
  }
  const craftShardTierBtn = document.getElementById('item-craft-shard-tier');
  if (craftShardTierBtn) {
    craftShardTierBtn.addEventListener('click', () => {
      const { item } = currentModalItem;
      if (upgradeTierWithShard(item.instanceId)) {
        refreshInventoryScreen();
        openItemModal('bag', getGeneralGrid().items.find((i) => i.instanceId === item.instanceId));
      } else {
        alert('Not enough Cinder Shards.');
      }
    });
  }
  const craftAffixBtn = document.getElementById('item-craft-affix');
  if (craftAffixBtn) {
    craftAffixBtn.addEventListener('click', () => {
      const { item } = currentModalItem;
      if (addRandomAffix(item.instanceId)) {
        refreshInventoryScreen();
        openItemModal('bag', getGeneralGrid().items.find((i) => i.instanceId === item.instanceId));
      } else {
        alert('Not enough Cinder Shards.');
      }
    });
  }
  const sellBtn = document.getElementById('item-sell');
  if (sellBtn) {
    sellBtn.addEventListener('click', () => {
      const { item } = currentModalItem;
      const payout = sellItem(item.instanceId);
      if (payout !== false) {
        closeItemModal();
        refreshInventoryScreen();
        refreshCurrencyDisplay();
      }
    });
  }
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
  const equipMainBtn = document.getElementById('item-equip-main');
  if (equipMainBtn) {
    equipMainBtn.addEventListener('click', () => {
      const { item } = currentModalItem;
      if (equipItem(item.instanceId, 'weapon')) {
        closeItemModal();
        refreshInventoryScreen();
      } else {
        alert('No room to swap out your current weapon — make space in your bag first, or unequip your off hand if you have a two-handed weapon queued.');
      }
    });
  }
  const equipOffBtn = document.getElementById('item-equip-off');
  if (equipOffBtn) {
    equipOffBtn.addEventListener('click', () => {
      const { item } = currentModalItem;
      if (equipItem(item.instanceId, 'offhand')) {
        closeItemModal();
        refreshInventoryScreen();
      } else {
        alert('Your off hand needs a one-handed main weapon equipped first.');
      }
    });
  }
}

function openEquippedModal(slot) {
  const item = getEquipped()[slot];
  if (!item) return;
  const base = getBaseItem(item.defId);
  currentModalItem = { tabKind: 'equipped', slot };

  const socketsHtml =
    item.sockets.length > 0
      ? `<div class="socket-row">${item.sockets
          .map((gemId, idx) => {
            if (gemId) {
              const gdef = getGemById(gemId);
              const cls = gdef.gemType === 'support' ? 'filled support' : 'filled';
              return `<button class="socket-pip ${cls}" data-index="${idx}">${gdef.name[0]}</button>`;
            }
            return `<button class="socket-pip empty" data-index="${idx}">+</button>`;
          })
          .join('')}</div>
        <div class="socket-legend">${item.sockets
          .filter(Boolean)
          .map((gemId) => {
            const gdef = getGemById(gemId);
            return gdef.gemType === 'support'
              ? `<div class="gem-desc">${gdef.name} &mdash; Support &middot; applies to: ${tagsText(gdef.appliesToTags)}</div>`
              : `<div class="gem-desc">${gdef.name} &mdash; Skill &middot; ${tagsText(gdef.tags)}</div>`;
          })
          .join('')}</div>`
      : '';

  itemModalTitle.innerHTML = `${base.name} <span class="tier-tag tier-${item.tier}">${TIER_LABELS[item.tier]}</span>`;
  itemModalBody.innerHTML = `
    <div class="gem-desc">${affixesText(item.affixes)}</div>
    <details class="gear-details">
      <summary>Defensive details</summary>
      ${defenseBreakdownHtml(item)}
    </details>
    ${socketsHtml}
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
      const tagLine =
        def.gemType === 'support' ? `Support &middot; applies to: ${tagsText(def.appliesToTags)}` : `Skill &middot; ${tagsText(def.tags)}`;
      return `
        <button class="gem-action gem-picker-option" data-gem="${defId}" ${met ? '' : 'disabled'}>
          ${def.name} (${count}) &mdash; ${tagLine}<br>
          <span class="${met ? '' : 'req-unmet'}">${requirementText(def.requirement)}</span>
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

// --- talents ---

document.querySelectorAll('[data-talent-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-talent-tab]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeTalentTree = btn.dataset.talentTab;
    renderTalentScreen();
  });
});

function renderTalentScreen() {
  talentPointsLabel.textContent = `${getAvailablePoints(activeTalentTree)} points available`;
  drawTalentTree(activeTalentTree);
}

function drawTalentTree(treeId) {
  const dpr = window.devicePixelRatio || 1;
  talentCanvas.width = TREE_CANVAS_SIZE * dpr;
  talentCanvas.height = TREE_CANVAS_SIZE * dpr;
  talentCanvas.style.width = `${TREE_CANVAS_SIZE}px`;
  talentCanvas.style.height = `${TREE_CANVAS_SIZE}px`;
  const ctx = talentCanvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, TREE_CANVAS_SIZE, TREE_CANVAS_SIZE);

  const tree = getTree(treeId);
  const allocated = new Set(getAllocatedNodes(treeId));
  const nodes = Object.values(tree.nodes);

  ctx.lineWidth = 3;
  const seenEdges = new Set();
  for (const node of nodes) {
    for (const connId of node.connections) {
      const key = [node.id, connId].sort().join('|');
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      const other = tree.nodes[connId];
      const bothAllocated = allocated.has(node.id) && allocated.has(other.id);
      ctx.strokeStyle = bothAllocated ? 'rgba(216,176,84,0.7)' : 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.moveTo(TREE_CENTER + node.x, TREE_CENTER + node.y);
      ctx.lineTo(TREE_CENTER + other.x, TREE_CENTER + other.y);
      ctx.stroke();
    }
  }

  for (const node of nodes) {
    const cx = TREE_CENTER + node.x;
    const cy = TREE_CENTER + node.y;
    const isStart = node.id === 'start';
    const radius = node.keystone ? 22 : isStart ? 18 : 14;
    const alloc = allocated.has(node.id);
    const allocable = !alloc && canAllocate(treeId, node.id);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    if (isStart) ctx.fillStyle = '#d8b054';
    else if (alloc) ctx.fillStyle = node.keystone ? '#c14fe0' : '#7a6fe0';
    else if (allocable) ctx.fillStyle = '#3a3252';
    else ctx.fillStyle = '#211c30';
    ctx.fill();
    ctx.strokeStyle = alloc ? '#fff3c4' : allocable ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = node.keystone ? 3 : 2;
    ctx.stroke();
  }
}

function talentNodeAt(treeId, x, y) {
  const tree = getTree(treeId);
  for (const node of Object.values(tree.nodes)) {
    const radius = node.keystone ? 26 : node.id === 'start' ? 22 : 18;
    const dx = node.x - x;
    const dy = node.y - y;
    if (dx * dx + dy * dy <= radius * radius) return node;
  }
  return null;
}

talentCanvas.addEventListener('click', (e) => {
  const rect = talentCanvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * TREE_CANVAS_SIZE - TREE_CENTER;
  const y = ((e.clientY - rect.top) / rect.height) * TREE_CANVAS_SIZE - TREE_CENTER;
  const node = talentNodeAt(activeTalentTree, x, y);
  if (node) openTalentModal(activeTalentTree, node);
});

function openTalentModal(treeId, node) {
  const alloc = isAllocated(treeId, node.id);
  const allocable = !alloc && canAllocate(treeId, node.id);

  talentModalTitle.textContent = node.id === 'start' ? 'Start' : node.name;

  let body = '';
  if (node.id === 'start') {
    body = `<div class="gem-desc">Your journey begins here. Always active.</div>`;
  } else if (node.keystone) {
    body = `<div class="gem-desc">${node.description}</div><div class="gem-desc">Keystone &middot; Cost ${node.cost} points</div>`;
  } else {
    body = `<div class="gem-desc">Cost ${node.cost} point</div>`;
  }

  if (node.id !== 'start') {
    if (alloc) {
      body += `<button class="gem-action" disabled>Allocated</button>`;
    } else {
      body += `<button class="gem-action" id="talent-allocate" ${allocable ? '' : 'disabled'}>Allocate</button>`;
      if (!allocable) {
        const reason = getAvailablePoints(treeId) < node.cost ? 'Not enough points' : 'Connect to an allocated node first';
        body += `<div class="gem-desc req-unmet">${reason}</div>`;
      }
    }
  }

  talentModalBody.innerHTML = body;
  talentModal.classList.add('active');

  const allocateBtn = document.getElementById('talent-allocate');
  if (allocateBtn) {
    allocateBtn.addEventListener('click', () => {
      if (allocateNode(treeId, node.id)) {
        talentModal.classList.remove('active');
        renderTalentScreen();
        refreshProgressionBar();
      }
    });
  }
}

document.getElementById('talent-modal-close').addEventListener('click', () => {
  talentModal.classList.remove('active');
});

document.getElementById('talent-reset').addEventListener('click', () => {
  if (confirm(`Reset your ${activeTalentTree} tree and refund all its points?`)) {
    resetTree(activeTalentTree);
    renderTalentScreen();
    refreshProgressionBar();
  }
});

document.getElementById('town-talents').addEventListener('click', () => {
  showScreen('talents');
  renderTalentScreen();
  if (!hasCenteredTalentView) {
    hasCenteredTalentView = true;
    requestAnimationFrame(() => {
      talentViewport.scrollLeft = TREE_CENTER - talentViewport.clientWidth / 2;
      talentViewport.scrollTop = TREE_CENTER - talentViewport.clientHeight / 2;
    });
  }
});
document.getElementById('talents-back').addEventListener('click', () => showScreen('town'));

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
    onBarrierChange(barrier, maxBarrier) {
      barrierBarOuter.classList.toggle('active', maxBarrier > 0);
      const pct = maxBarrier > 0 ? Math.max(0, (barrier / maxBarrier) * 100) : 0;
      barrierBarInner.style.width = `${pct}%`;
    },
    onWaveChange(wave) {
      waveLabel.textContent = wave === 'Boss' ? 'Boss Round' : `Round ${wave}/${scene.mapDef.rounds}`;
    },
    onCurrencyChange(earned) {
      shardsLabel.textContent = `+${earned} Loot`;
    },
    onDeath(waveReached, currencyEarned, xpEarned, itemsEarned) {
      scene.stop();
      const best = reportWaveReached(waveReached);
      bankCurrencyEarnings(currencyEarned);
      const banked = bankItemDrops(itemsEarned);
      const xpResult = addXp(xpEarned);
      if (xpResult.levelsGained > 0) refreshStock();
      resultWaveEl.textContent = String(waveReached);
      resultBestEl.textContent = String(best);
      resultXpEl.textContent = String(Math.round(xpEarned));
      renderCurrencyChipsInto(resultEarnedEl, currencyEarned);
      renderDropListInto(resultItemsEl, banked);
      refreshProgressionBar();
      showScreen('results');
    },
    onMapComplete(currencyEarned, xpEarned, itemsEarned) {
      scene.stop();
      bankCurrencyEarnings(currencyEarned);
      const banked = bankItemDrops(itemsEarned);
      addXp(xpEarned);
      awardMappingPoint();
      refreshStock();
      victoryXpEl.textContent = String(Math.round(xpEarned));
      renderCurrencyChipsInto(victoryEarnedEl, currencyEarned);
      renderDropListInto(victoryItemsEl, banked);
      refreshProgressionBar();
      showScreen('victory');
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
    bankCurrencyEarnings(scene.currencyEarned);
    bankItemDrops(scene.itemsEarned);
    const xpResult = addXp(scene.xpEarned);
    if (xpResult.levelsGained > 0) refreshStock();
  }
  refreshBestWave();
  refreshCurrencyDisplay();
  refreshProgressionBar();
  showScreen('town');
});

document.getElementById('return-btn').addEventListener('click', () => {
  refreshBestWave();
  refreshCurrencyDisplay();
  showScreen('town');
});

document.getElementById('victory-return-btn').addEventListener('click', () => {
  refreshBestWave();
  refreshCurrencyDisplay();
  showScreen('town');
});

if (getStock().length === 0) refreshStock();

refreshBestWave();
refreshCurrencyDisplay();
refreshProgressionBar();
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
