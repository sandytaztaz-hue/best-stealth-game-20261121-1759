// fx.js — light, cheap effects state: footstep rings, pebble pings, seed
// sparkles, drifting fireflies. No drawing here; render.js draws them.
// The fireflies are seeded per level, so the garden looks the same every run.
import { CANVAS_W, CANVAS_H } from './config.js';
import { makeRng, range } from './random.js';

export function createFx(levelIndex) {
  const rng = makeRng(9000 + levelIndex * 331);
  const fireflies = [];
  for (let i = 0; i < 26; i++) {
    fireflies.push({
      x: range(rng, 40, CANVAS_W - 40),
      y: range(rng, 100, CANVAS_H - 40),
      phase: range(rng, 0, Math.PI * 2),
      speed: range(rng, 0.2, 0.6),
      size: range(rng, 1.2, 2.6),
    });
  }
  return {
    rings: [],
    sparks: [],
    puffs: [],
    fireflies,
    time: 0,
  };
}

export function spawnRing(fx, x, y, maxRadius, color, quiet = false) {
  fx.rings.push({ x, y, r: 6, maxRadius, color, life: 1, quiet });
}

export function spawnSparks(fx, x, y, color, count = 14) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + fx.time;
    const speed = 40 + ((i * 37) % 60);
    fx.sparks.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color,
      size: 2 + ((i * 13) % 3),
    });
  }
}

export function spawnPuff(fx, x, y) {
  fx.puffs.push({ x, y, r: 4, life: 1 });
}

export function updateFx(fx, dt) {
  fx.time += dt;
  for (const ring of fx.rings) {
    ring.r += (ring.maxRadius - ring.r) * dt * 3.2 + 26 * dt;
    ring.life -= dt * 1.6;
  }
  fx.rings = fx.rings.filter((ring) => ring.life > 0);
  for (const spark of fx.sparks) {
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.vx *= 0.96;
    spark.vy *= 0.96;
    spark.life -= dt * 1.4;
  }
  fx.sparks = fx.sparks.filter((spark) => spark.life > 0);
  for (const puff of fx.puffs) {
    puff.r += 30 * dt;
    puff.life -= dt * 2.2;
  }
  fx.puffs = fx.puffs.filter((puff) => puff.life > 0);
  for (const fly of fx.fireflies) {
    fly.phase += dt * fly.speed;
    fly.x += Math.cos(fly.phase * 0.7) * 6 * dt;
    fly.y += Math.sin(fly.phase) * 5 * dt;
    if (fly.x < 30) fly.x = 30;
    if (fly.x > CANVAS_W - 30) fly.x = CANVAS_W - 30;
    if (fly.y < 90) fly.y = 90;
    if (fly.y > CANVAS_H - 30) fly.y = CANVAS_H - 30;
  }
}
