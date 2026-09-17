import { CombatScene } from './combat.js';
import { getBestWave, reportWaveReached } from './storage.js';

const screens = {
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
const bestWaveEl = document.getElementById('best-wave');
const resultWaveEl = document.getElementById('result-wave');
const resultBestEl = document.getElementById('result-best');

let scene = null;

function refreshBestWave() {
  bestWaveEl.textContent = `Best wave: ${getBestWave()}`;
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
    onDeath(waveReached) {
      scene.stop();
      const best = reportWaveReached(waveReached);
      resultWaveEl.textContent = String(waveReached);
      resultBestEl.textContent = String(best);
      showScreen('results');
    },
  });
  scene.start();
}

document.getElementById('map-node').addEventListener('click', startCombat);

document.getElementById('retreat-btn').addEventListener('click', () => {
  if (scene) scene.stop();
  refreshBestWave();
  showScreen('map');
});

document.getElementById('return-btn').addEventListener('click', () => {
  refreshBestWave();
  showScreen('map');
});

refreshBestWave();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
