const BEST_WAVE_KEY = 'miniarpg.bestWave';

export function getBestWave() {
  return Number(localStorage.getItem(BEST_WAVE_KEY) || 0);
}

export function reportWaveReached(wave) {
  const best = getBestWave();
  if (wave > best) {
    localStorage.setItem(BEST_WAVE_KEY, String(wave));
    return wave;
  }
  return best;
}
