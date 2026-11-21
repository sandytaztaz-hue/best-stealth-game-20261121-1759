// world.js — the whole simulation: player movement and collision, guard
// patrol / suspicious / alerted / search AI, line-of-sight and cone
// occlusion, the detection meter, noise, pebbles, seeds, the exit gate
// and the caught rule. Rendering never lives here; render.js only reads.
import {
  WALK_SPEED,
  TIPTOE_SPEED,
  GUARD_PATROL_SPEED,
  GUARD_INVESTIGATE_SPEED,
  GUARD_CHASE_SPEED,
  CONE_HALF_ANGLE,
  CONE_RANGE,
  CONE_RAYS,
  DETECT_RATE_LIT,
  DETECT_RATE_SHADOW,
  DETECT_TIPTOE_MULT,
  DETECT_DRAIN_RATE,
  SUSPICIOUS_AT,
  ALERTED_AT,
  CAUGHT_DISTANCE,
  LOSE_SIGHT_SECONDS,
  SEARCH_SECONDS,
  WALK_NOISE_RADIUS,
  TIPTOE_NOISE_RADIUS,
  WALK_STEP_INTERVAL,
  TIPTOE_STEP_INTERVAL,
  PEBBLE_COUNT,
  PEBBLE_MAX_RANGE,
  PEBBLE_NOISE_RADIUS,
  PEBBLE_ARC_SECONDS,
  WAYPOINT_PAUSE,
  SUSPICIOUS_WAIT,
  INVESTIGATE_TIMEOUT,
  PLAYER_RADIUS,
  GUARD_RADIUS,
  SEED_PICKUP_RADIUS,
} from './config.js';
import { levelByIndex, blockingRects } from './levels.js';
import { mulberry32, scatterPoints } from './random.js';
import * as audio from './audio.js';

// --- geometry helpers -------------------------------------------------------

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// Does segment (x1,y1)-(x2,y2) hit rect [rx,ry,rw,rh]?
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  const [rx, ry, rw, rh] = rect;
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < rx || x1 > rx + rw) return false;
  } else {
    let t1 = (rx - x1) / dx;
    let t2 = (rx + rw - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < ry || y1 > ry + rh) return false;
  } else {
    let t1 = (ry - y1) / dy;
    let t2 = (ry + rh - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

// Distance from a point to the first blocking rect along a ray, or Infinity.
export function raycastDistance(x, y, dirX, dirY, maxDist, rects) {
  let best = maxDist;
  for (const rect of rects) {
    const [rx, ry, rw, rh] = rect;
    const dx = dirX;
    const dy = dirY;
    let tmin = 0;
    let tmax = best;
    let hit = true;
    if (Math.abs(dx) < 1e-9) {
      if (x < rx || x > rx + rw) hit = false;
    } else {
      let t1 = (rx - x) / dx;
      let t2 = (rx + rw - x) / dx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) hit = false;
    }
    if (hit) {
      if (Math.abs(dy) < 1e-9) {
        if (y < ry || y > ry + rh) hit = false;
      } else {
        let t1 = (ry - y) / dy;
        let t2 = (ry + rh - y) / dy;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) hit = false;
      }
    }
    if (hit && tmin < best && tmin >= 0) best = tmin;
  }
  return best;
}

// True when nothing (wall or hedge) stands between the two points.
export function hasLineOfSight(ax, ay, bx, by, rects) {
  for (const rect of rects) {
    if (segmentHitsRect(ax, ay, bx, by, rect)) return false;
  }
  return true;
}

function circleHitsRect(cx, cy, r, rect) {
  const [rx, ry, rw, rh] = rect;
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r;
}

// --- world ------------------------------------------------------------------

export function createWorld(levelIndex, seed) {
  const level = levelByIndex(levelIndex);
  const rng = mulberry32(seed || 1);
  const blockers = blockingRects(level);
  const world = {
    levelIndex,
    level,
    seed: seed || 1,
    blockers,
    time: 0,
    levelTime: 0,
    player: {
      x: level.playerStart[0],
      y: level.playerStart[1],
      radius: PLAYER_RADIUS,
      facing: -Math.PI / 2,
      moving: false,
      tiptoe: false,
      stepTimer: 0,
    },
    guards: level.guards.map((g, i) => ({
      id: i,
      x: g.waypoints[0][0],
      y: g.waypoints[0][1],
      radius: GUARD_RADIUS,
      facing: Math.PI / 2,
      state: 'patrol', // patrol | suspicious | alerted | search
      waypointIndex: 1,
      pauseTimer: 0,
      waitTimer: 0,
      investigateTarget: null,
      investigateTimer: 0,
      lastSeen: null,
      unseenTimer: 0,
      searchTimer: 0,
      waypoints: g.waypoints,
    })),
    seeds: level.seeds.map(([x, y]) => ({ x, y, taken: false, bob: rng() * Math.PI * 2 })),
    seedsCollected: 0,
    exitOpen: false,
    pebbles: PEBBLE_COUNT,
    pebbleFlight: null, // {fromX, fromY, toX, toY, t}
    pebbleLand: null, // {x, y, t} expanding ping ring
    noiseRings: [], // {x, y, radius, maxRadius, t}
    detection: 0,
    alertState: 'unseen', // unseen | suspicious | hunted
    caught: false,
    caughtTimer: 0,
    levelComplete: false,
    levelCompleteTimer: 0,
    won: false,
    events: [], // one-frame notes for render (pickup flash, etc.)
    moss: scatterPoints(rng, 90, 20, 80, 1240, 620),
    fireflies: scatterPoints(rng, 26, 20, 80, 1240, 620).map((p) => ({
      ...p,
      phase: rng() * Math.PI * 2,
      speed: 0.3 + rng() * 0.7,
    })),
    rng,
  };
  return world;
}

export function playerInLampLight(world, x, y) {
  for (const lamp of world.level.lamps) {
    if (dist(x, y, lamp.x, lamp.y) <= lamp.r) return true;
  }
  return false;
}

function guardSeesPlayer(world, guard) {
  const p = world.player;
  const d = dist(guard.x, guard.y, p.x, p.y);
  if (d > CONE_RANGE) return false;
  let angle = Math.atan2(p.y - guard.y, p.x - guard.x) - guard.facing;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  if (Math.abs(angle) > CONE_HALF_ANGLE) return false;
  return hasLineOfSight(guard.x, guard.y, p.x, p.y, world.blockers);
}

function moveGuardToward(guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return true;
  const step = Math.min(d, speed * dt);
  guard.x += (dx / d) * step;
  guard.y += (dy / d) * step;
  guard.facing = Math.atan2(dy, dx);
  return d <= speed * dt + 0.5;
}

function setGuardSuspicious(world, guard, target, quiet) {
  if (guard.state !== 'suspicious') {
    guard.state = 'suspicious';
    guard.waitTimer = SUSPICIOUS_WAIT;
    guard.investigateTarget = target;
    guard.investigateTimer = 0;
    if (!quiet) audio.playSuspiciousBlip();
  }
  guard.facing = Math.atan2(target.y - guard.y, target.x - guard.x);
}

function setGuardAlerted(world, guard) {
  if (guard.state !== 'alerted') {
    guard.state = 'alerted';
    guard.unseenTimer = 0;
    audio.playAlertSting();
  }
  guard.lastSeen = { x: world.player.x, y: world.player.y };
}

function emitNoise(world, x, y, radius) {
  world.noiseRings.push({ x, y, radius: 6, maxRadius: radius, t: 0 });
  for (const guard of world.guards) {
    if (guard.state === 'alerted') continue;
    if (dist(guard.x, guard.y, x, y) <= radius) {
      setGuardSuspicious(world, guard, { x, y }, false);
    }
  }
}

export function tossPebble(world, targetX, targetY) {
  if (world.pebbles <= 0 || world.pebbleFlight) return false;
  const p = world.player;
  const dx = targetX - p.x;
  const dy = targetY - p.y;
  const d = Math.hypot(dx, dy);
  const range = Math.min(d, PEBBLE_MAX_RANGE);
  const tx = d > 0 ? p.x + (dx / d) * range : p.x;
  const ty = d > 0 ? p.y + (dy / d) * range : p.y;
  world.pebbles -= 1;
  world.pebbleFlight = { fromX: p.x, fromY: p.y, toX: tx, toY: ty, t: 0 };
  return true;
}

// --- per-frame update --------------------------------------------------------

export function updateWorld(world, input, dt) {
  world.time += dt;
  world.levelTime += dt;
  world.events = [];
  const p = world.player;

  if (world.caught) {
    world.caughtTimer += dt;
    return;
  }
  if (world.levelComplete) {
    world.levelCompleteTimer += dt;
    return;
  }

  // --- player movement ---
  const speed = input.tiptoe ? TIPTOE_SPEED : WALK_SPEED;
  p.tiptoe = input.tiptoe;
  p.moving = input.moveX !== 0 || input.moveY !== 0;
  if (p.moving) {
    const nx = p.x + input.moveX * speed * dt;
    const ny = p.y + input.moveY * speed * dt;
    // Move axis by axis so the player slides along walls instead of sticking.
    if (!world.blockers.some((r) => circleHitsRect(nx, p.y, p.radius, r))) p.x = nx;
    if (!world.blockers.some((r) => circleHitsRect(p.x, ny, p.radius, r))) p.y = ny;
    p.x = clamp(p.x, 16 + p.radius, 1280 - 16 - p.radius);
    p.y = clamp(p.y, 16 + p.radius, 720 - 16 - p.radius);
    p.facing = Math.atan2(input.moveY, input.moveX);
    // Footsteps: a noise ring every step, quieter while tiptoeing.
    p.stepTimer -= dt;
    if (p.stepTimer <= 0) {
      p.stepTimer = input.tiptoe ? TIPTOE_STEP_INTERVAL : WALK_STEP_INTERVAL;
      const radius = input.tiptoe ? TIPTOE_NOISE_RADIUS : WALK_NOISE_RADIUS;
      world.noiseRings.push({ x: p.x, y: p.y, radius: 6, maxRadius: radius, t: 0 });
      audio.playFootstep(input.tiptoe);
      for (const guard of world.guards) {
        if (guard.state === 'alerted') continue;
        if (dist(guard.x, guard.y, p.x, p.y) <= radius) {
          setGuardSuspicious(world, guard, { x: p.x, y: p.y }, false);
        }
      }
    }
  }

  // --- pebble flight and landing ---
  if (world.pebbleFlight) {
    const f = world.pebbleFlight;
    f.t += dt / PEBBLE_ARC_SECONDS;
    if (f.t >= 1) {
      world.pebbleFlight = null;
      world.pebbleLand = { x: f.toX, y: f.toY, t: 0 };
      audio.playPebblePing();
      emitNoise(world, f.toX, f.toY, PEBBLE_NOISE_RADIUS);
    }
  }
  if (world.pebbleLand) {
    world.pebbleLand.t += dt;
    if (world.pebbleLand.t > 0.8) world.pebbleLand = null;
  }
  for (const ring of world.noiseRings) {
    ring.t += dt;
    ring.radius += (ring.maxRadius - ring.radius) * Math.min(1, dt * 8) + dt * 40;
  }
  world.noiseRings = world.noiseRings.filter((r) => r.t < 0.6);

  // --- seeds ---
  for (const seed of world.seeds) {
    seed.bob += dt * 2;
    if (!seed.taken && dist(p.x, p.y, seed.x, seed.y) <= SEED_PICKUP_RADIUS) {
      seed.taken = true;
      world.seedsCollected += 1;
      audio.playPickupChime();
      world.events.push({ type: 'pickup', x: seed.x, y: seed.y });
      if (world.seedsCollected >= world.seeds.length) {
        world.exitOpen = true;
        world.events.push({ type: 'exit-open', x: world.level.exit[0], y: world.level.exit[1] });
      }
    }
  }

  // --- exit gate ---
  if (world.exitOpen) {
    const [ex, ey, ew, eh] = world.level.exit;
    if (p.x > ex - 4 && p.x < ex + ew + 4 && p.y > ey - 4 && p.y < ey + eh + 4) {
      world.levelComplete = true;
      world.levelCompleteTimer = 0;
      return;
    }
  }

  // --- detection: any guard seeing the player right now? ---
  let anyoneSees = false;
  for (const guard of world.guards) {
    if (guardSeesPlayer(world, guard)) {
      anyoneSees = true;
      break;
    }
  }
  const inLight = playerInLampLight(world, p.x, p.y);
  if (anyoneSees) {
    let rate = inLight ? DETECT_RATE_LIT : DETECT_RATE_SHADOW;
    if (p.tiptoe) rate *= DETECT_TIPTOE_MULT;
    world.detection = Math.min(1, world.detection + rate * dt);
  } else {
    world.detection = Math.max(0, world.detection - DETECT_DRAIN_RATE * dt);
  }

  // Meter crossings drive the guard states.
  if (world.detection >= ALERTED_AT) {
    for (const guard of world.guards) setGuardAlerted(world, guard);
  } else if (world.detection >= SUSPICIOUS_AT) {
    for (const guard of world.guards) {
      if (guardSeesPlayer(world, guard) && guard.state === 'patrol') {
        setGuardSuspicious(world, guard, { x: p.x, y: p.y }, false);
      }
    }
  }

  // --- guard AI ---
  for (const guard of world.guards) {
    const sees = guardSeesPlayer(world, guard);
    if (guard.state === 'patrol') {
      const wp = guard.waypoints[guard.waypointIndex];
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
      } else if (moveGuardToward(guard, wp[0], wp[1], GUARD_PATROL_SPEED, dt)) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.pauseTimer = WAYPOINT_PAUSE;
      }
    } else if (guard.state === 'suspicious') {
      if (guard.waitTimer > 0) {
        guard.waitTimer -= dt;
        if (guard.investigateTarget) {
          guard.facing = Math.atan2(
            guard.investigateTarget.y - guard.y,
            guard.investigateTarget.x - guard.x,
          );
        }
      } else if (guard.investigateTarget) {
        const arrived = moveGuardToward(
          guard,
          guard.investigateTarget.x,
          guard.investigateTarget.y,
          GUARD_INVESTIGATE_SPEED,
          dt,
        );
        guard.investigateTimer += dt;
        if (arrived || guard.investigateTimer > INVESTIGATE_TIMEOUT) {
          guard.state = 'patrol';
          guard.investigateTarget = null;
          guard.investigateTimer = 0;
        }
      }
    } else if (guard.state === 'alerted') {
      if (sees) {
        guard.unseenTimer = 0;
        guard.lastSeen = { x: p.x, y: p.y };
      } else {
        guard.unseenTimer += dt;
      }
      if (guard.unseenTimer >= LOSE_SIGHT_SECONDS) {
        guard.state = 'search';
        guard.searchTimer = SEARCH_SECONDS;
        continue;
      }
      // Converge on the player's position (last seen if not currently seen).
      const target = sees ? p : guard.lastSeen || p;
      moveGuardToward(guard, target.x, target.y, GUARD_CHASE_SPEED, dt);
      if (dist(guard.x, guard.y, p.x, p.y) <= CAUGHT_DISTANCE) {
        world.caught = true;
        world.caughtTimer = 0;
        world.events.push({ type: 'caught' });
      }
    } else if (guard.state === 'search') {
      if (guard.lastSeen) {
        moveGuardToward(guard, guard.lastSeen.x, guard.lastSeen.y, GUARD_INVESTIGATE_SPEED, dt);
      }
      guard.searchTimer -= dt;
      if (guard.searchTimer <= 0) {
        guard.state = 'patrol';
        guard.lastSeen = null;
      }
    }
  }

  // --- alert word for the HUD ---
  const anyAlerted = world.guards.some((g) => g.state === 'alerted');
  const anySuspicious = world.guards.some((g) => g.state === 'suspicious' || g.state === 'search');
  world.alertState = anyAlerted ? 'hunted' : anySuspicious ? 'suspicious' : 'unseen';
}

// Occluded vision cone as a polygon: sample the cone edge with CONE_RAYS
// rays, raycast each to the nearest blocker, join the points. Cones
// visibly stop at cover.
export function conePolygon(world, guard) {
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= CONE_RAYS; i += 1) {
    const angle = guard.facing - CONE_HALF_ANGLE + (2 * CONE_HALF_ANGLE * i) / CONE_RAYS;
    const d = raycastDistance(guard.x, guard.y, Math.cos(angle), Math.sin(angle), CONE_RANGE, world.blockers);
    points.push({ x: guard.x + Math.cos(angle) * d, y: guard.y + Math.sin(angle) * d });
  }
  return points;
}

// The nearest guard that currently sees a player standing at (x, y),
// or null. The shot driver uses this to back out of a cone it is in.
export function seeingGuardAt(world, x, y) {
  let nearest = null;
  let nearestDist = Infinity;
  for (const guard of world.guards) {
    const d = dist(guard.x, guard.y, x, y);
    if (d > CONE_RANGE || d >= nearestDist) continue;
    let angle = Math.atan2(y - guard.y, x - guard.x) - guard.facing;
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    if (Math.abs(angle) > CONE_HALF_ANGLE) continue;
    if (!hasLineOfSight(guard.x, guard.y, x, y, world.blockers)) continue;
    nearest = guard;
    nearestDist = d;
  }
  return nearest;
}

// Would any guard see a player standing at (x, y) right now? The shot
// driver uses this to wait out a patrol instead of walking into a cone.
export function isPositionSeen(world, x, y) {
  return seeingGuardAt(world, x, y) !== null;
}
