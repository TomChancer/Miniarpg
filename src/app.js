import { CombatScene } from './combat.js';
import { getBestWave, reportWaveReached } from './storage.js';
import { getBalance, addCurrency, spendCurrency, CURRENCY } from './currency.js';
import { GEMS, getOwnedGemIds, ownsGem, ownGem, getEquippedGemId, equipGem } from './gems.js';
import { getAvailableNpcs } from './npcs.js';

const screens = {
  town: document.getElementById('town-screen'),
  map: document.getElementById('map-screen'),
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
const hpLabel = document.getElementById('hp-label');
const waveLabel = document.getElementById('wave-label');
const shardsLabel = document.getElementById('shards-label');
const bestWaveEl = document.getElementById('best-wave');
const resultWaveEl = document.getElementById('result-wave');
const resultBestEl = document.getElementById('result-best');
const resultEarnedEl = document.getElementById('result-earned');
const currencyDisplay = document.getElementById('currency-display');
const npcListEl = document.getElementById('npc-list');
const shopModal = document.getElementById('shop-modal');
const shopTitle = document.getElementById('shop-title');
const shopBalance = document.getElementById('shop-balance');
const gemListEl = document.getElementById('gem-list');

let scene = null;

function refreshBestWave() {
  bestWaveEl.textContent = `Best wave: ${getBestWave()}`;
}

function refreshCurrencyDisplay() {
  const balance = getBalance();
  currencyDisplay.innerHTML = `${balance} <span class="currency-name">${CURRENCY.name}</span>`;
  shopBalance.textContent = `${balance} ${CURRENCY.name}`;
}

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
    openGemShop(npc);
  }
}

function openGemShop(npc) {
  shopTitle.textContent = `${npc.name}'s Gems`;
  refreshCurrencyDisplay();
  renderGemList();
  shopModal.classList.add('active');
}

function closeShop() {
  shopModal.classList.remove('active');
}

function renderGemList() {
  gemListEl.innerHTML = '';
  const equippedId = getEquippedGemId();
  for (const gem of GEMS) {
    const owned = ownsGem(gem.id);
    const equipped = gem.id === equippedId;

    const card = document.createElement('div');
    card.className = `gem-card${equipped ? ' equipped' : ''}`;

    let actionHtml;
    if (equipped) {
      actionHtml = `<button class="gem-action equipped-label" disabled>Equipped</button>`;
    } else if (owned) {
      actionHtml = `<button class="gem-action" data-action="equip" data-gem="${gem.id}">Equip</button>`;
    } else {
      const canAfford = getBalance() >= gem.cost;
      actionHtml = `<button class="gem-action" data-action="buy" data-gem="${gem.id}" ${canAfford ? '' : 'disabled'}>Buy — ${gem.cost}</button>`;
    }

    card.innerHTML = `
      <div class="gem-card-top">
        <span class="gem-name">${gem.name}</span>
        ${gem.cost > 0 ? `<span class="gem-cost">${gem.cost} ${CURRENCY.name}</span>` : ''}
      </div>
      <div class="gem-desc">${gem.description}</div>
      ${actionHtml}
    `;
    gemListEl.appendChild(card);
  }

  gemListEl.querySelectorAll('[data-action="buy"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const gem = GEMS.find((g) => g.id === btn.dataset.gem);
      if (spendCurrency(gem.cost)) {
        ownGem(gem.id);
        equipGem(gem.id);
        refreshCurrencyDisplay();
        renderGemList();
      }
    });
  });
  gemListEl.querySelectorAll('[data-action="equip"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      equipGem(btn.dataset.gem);
      renderGemList();
    });
  });
}

function startCombat() {
  showScreen('combat');
  scene = new CombatScene(canvas, {
    onHpChange(hp, maxHp) {
      const pct = Math.max(0, (hp / maxHp) * 100);
      hpBarInner.style.width = `${pct}%`;
      hpBarInner.style.background = pct <= 30 ? 'var(--hp-low)' : 'var(--hp)';
      hpLabel.textContent = `${Math.ceil(hp)} / ${maxHp}`;
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

document.getElementById('town-set-out').addEventListener('click', () => showScreen('map'));
document.getElementById('map-back').addEventListener('click', () => showScreen('town'));
document.getElementById('map-node').addEventListener('click', startCombat);
document.getElementById('shop-close').addEventListener('click', closeShop);

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

getOwnedGemIds();
refreshBestWave();
refreshCurrencyDisplay();
renderNpcList();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
