// Minimal browser-global stubs so src/ modules (written for a real page) can
// run under plain Node for testing. No jsdom, no headless browser — these
// are just enough surface area for the *logic* paths to execute; nothing
// here needs to actually render anything.

function makeLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

// Installed once per test process (node:test runs each file in its own
// process, so this never leaks state between files).
globalThis.localStorage = makeLocalStorage();
globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1 };
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || (() => 1);
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame || (() => {});
globalThis.performance = globalThis.performance || { now: () => Date.now() };

const noop = () => {};
const fakeCtx = {
  setTransform: noop, clearRect: noop, fillRect: noop, beginPath: noop, arc: noop,
  fill: noop, stroke: noop, moveTo: noop, lineTo: noop, save: noop, restore: noop,
  translate: noop, rotate: noop,
  createRadialGradient: () => ({ addColorStop: noop }),
};

export function makeFakeCanvas(width = 400, height = 700) {
  return {
    clientWidth: width,
    clientHeight: height,
    width: 0,
    height: 0,
    style: {},
    getContext: () => fakeCtx,
  };
}

// Force a fixed sequence of Math.random() results, then restore the real
// implementation. Lets probability-driven code (drop rolls, evasion) be
// tested deterministically instead of statistically.
export function withFixedRandom(values, fn) {
  const original = Math.random;
  let i = 0;
  Math.random = () => (i < values.length ? values[i++] : values[values.length - 1]);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}
