// Small math helpers shared across modules. No game logic here.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
export const TAU = Math.PI * 2;

// Shortest-path angular interpolation (radians, unbounded inputs).
export function angLerp(a, b, t) {
  let d = ((b - a) % TAU + TAU) % TAU;
  if (d > Math.PI) d -= TAU;
  return a + d * t;
}

export const angDiff = (a, b) => {
  let d = ((b - a) % TAU + TAU) % TAU;
  if (d > Math.PI) d -= TAU;
  return d;
};

// Deterministic seeded RNG so the city layout is identical every load.
export function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// Frame-rate independent exponential smoothing toward zero.
export const decay = (v, rate, dt) => v * Math.exp(-rate * dt);

// Circle (cx,cy,r) vs axis-aligned rect (x,y,w,h) overlap test.
export function circleRect(cx, cy, r, x, y, w, h) {
  const nx = clamp(cx, x, x + w);
  const ny = clamp(cy, y, y + h);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

// Push a circle out of an axis-aligned rect along the smallest penetration.
export function pushOut(cx, cy, r, x, y, w, h) {
  const nx = clamp(cx, x, x + w);
  const ny = clamp(cy, y, y + h);
  const dx = cx - nx, dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 < 1e-6) {
    // Center inside the rect: push out along the nearest edge.
    const left = cx - x, right = x + w - cx, top = cy - y, bottom = y + h - cy;
    const m = Math.min(left, right, top, bottom);
    if (m === left) return { x: x - r, y: cy };
    if (m === right) return { x: x + w + r, y: cy };
    if (m === top) return { x: cx, y: y - r };
    return { x: cx, y: y + h + r };
  }
  const d = Math.sqrt(d2);
  const push = r - d;
  return { x: cx + (dx / d) * push, y: cy + (dy / d) * push };
}
