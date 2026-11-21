// random.js — a small seeded RNG (mulberry32) for firefly drift, moss
// placement and cricket timing, so a shot with seed=1 always looks the
// same and real play still feels alive.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build a deterministic field of decorative points inside a rectangle.
// Used once per level load so the moss patches and fireflies never jump.
export function scatterPoints(rng, count, x, y, w, h) {
  const points = [];
  for (let i = 0; i < count; i += 1) {
    points.push({ x: x + rng() * w, y: y + rng() * h, r: 2 + rng() * 5, a: 0.25 + rng() * 0.5 });
  }
  return points;
}

// Pick a value in [min, max) from the seeded stream.
export function rangeFrom(rng, min, max) {
  return min + rng() * (max - min);
}
