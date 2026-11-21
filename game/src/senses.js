// senses.js — what a warden can and cannot see.
// Line of sight is segment-vs-rectangle (Liang-Barsky clipping) against walls
// and hedges, so cover really does block a cone. Vision cones are drawn as
// polygons whose edge is raycast to the nearest blocker, so a cone visibly
// stops at a hedge instead of shining through it.
import { CONE_ANGLE, CONE_RANGE, SENTRY_CONE_RANGE, CONE_EDGE_SAMPLES, DETECT_IN_LIGHT, DETECT_IN_SHADOW, DETECT_TIPTOE_FACTOR } from './config.js';

// A sentry never walks, so its cone is shorter than a patrol warden's —
// a stationary guard should not own the whole room.
export function coneRangeFor(guard) {
  return guard.type === 'sentry' ? SENTRY_CONE_RANGE : CONE_RANGE;
}

export function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function distanceBetween(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

// True when the segment (x1,y1)-(x2,y2) touches or crosses the rectangle.
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const edges = [
    [-dx, x1 - rect.x],
    [dx, rect.x + rect.w - x1],
    [-dy, y1 - rect.y],
    [dy, rect.y + rect.h - y1],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}

export function lineOfSightBlocked(x1, y1, x2, y2, blockers) {
  for (const rect of blockers) {
    if (segmentHitsRect(x1, y1, x2, y2, rect)) return true;
  }
  return false;
}

// Distance along a ray from (x,y) in direction `angle` to the nearest blocker.
export function raycastBlockerDistance(x, y, angle, maxDist, blockers) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = maxDist;
  for (const rect of blockers) {
    let tmin = 0;
    let tmax = best;
    let hit = true;
    const slabs = [
      [dx, x, rect.x, rect.x + rect.w],
      [dy, y, rect.y, rect.y + rect.h],
    ];
    for (const [d, o, lo, hi] of slabs) {
      if (Math.abs(d) < 1e-9) {
        if (o < lo || o > hi) { hit = false; break; }
      } else {
        let ta = (lo - o) / d;
        let tb = (hi - o) / d;
        if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
        if (ta > tmin) tmin = ta;
        if (tb < tmax) tmax = tb;
        if (tmin > tmax) { hit = false; break; }
      }
    }
    if (hit && tmin > 0 && tmin < best) best = tmin;
  }
  return best;
}

// The cone as a polygon: the guard's position, then points along the cone's
// edge, each raycast so the polygon hugs the cover. `steps` samples per side.
export function conePolygon(guard, blockers, steps = CONE_EDGE_SAMPLES) {
  const range = coneRangeFor(guard);
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= steps; i++) {
    const a = guard.angle - CONE_ANGLE / 2 + (CONE_ANGLE * i) / steps;
    const d = raycastBlockerDistance(guard.x, guard.y, a, range, blockers);
    points.push({ x: guard.x + Math.cos(a) * d, y: guard.y + Math.sin(a) * d });
  }
  return points;
}

export function playerInsideCone(guard, px, py) {
  const dx = px - guard.x;
  const dy = py - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > coneRangeFor(guard)) return false;
  if (dist < 4) return true;
  const toPlayer = Math.atan2(dy, dx);
  return Math.abs(angleDifference(toPlayer, guard.angle)) <= CONE_ANGLE / 2;
}

export function guardSeesPlayer(guard, player, blockers) {
  if (!playerInsideCone(guard, player.x, player.y)) return false;
  return !lineOfSightBlocked(guard.x, guard.y, player.x, player.y, blockers);
}

export function playerInLampLight(level, px, py) {
  for (const lamp of level.lamps) {
    if (distanceBetween(px, py, lamp.x, lamp.y) <= lamp.r) return true;
  }
  return false;
}

// How fast the meter rises while this guard watches the player (0 if unseen).
export function detectionRateFor(guard, world) {
  if (!guardSeesPlayer(guard, world.player, world.blockers)) return 0;
  let rate = playerInLampLight(world.level, world.player.x, world.player.y)
    ? DETECT_IN_LIGHT
    : DETECT_IN_SHADOW;
  if (world.player.tiptoe) rate *= DETECT_TIPTOE_FACTOR;
  return rate;
}

// True when no warden at all has a line of sight to the player right now.
export function noGuardSeesPlayer(world) {
  for (const guard of world.guards) {
    if (guardSeesPlayer(guard, world.player, world.blockers)) return false;
  }
  return true;
}

// True when the player is tucked right against a hedge — crouched behind
// cover, where no cone can reach. The HIDDEN tag reads this.
export function playerHidden(world) {
  const p = world.player;
  for (const hedge of world.level.hedges) {
    if (pointInRect(p.x, p.y, { x: hedge.x - 8, y: hedge.y - 8, w: hedge.w + 16, h: hedge.h + 16 })) {
      return true;
    }
  }
  return false;
}
