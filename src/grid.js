export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function fitsAt(items, gridW, gridH, x, y, w, h) {
  if (x < 0 || y < 0 || x + w > gridW || y + h > gridH) return false;
  const rect = { x, y, w, h };
  return !items.some((it) => rectsOverlap(rect, it));
}

export function findFreeSpot(items, gridW, gridH, w, h) {
  for (let y = 0; y <= gridH - h; y++) {
    for (let x = 0; x <= gridW - w; x++) {
      if (fitsAt(items, gridW, gridH, x, y, w, h)) return { x, y };
    }
  }
  return null;
}
