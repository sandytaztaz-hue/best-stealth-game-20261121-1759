// world.js — the game state and one fixed step of it.
// Pure logic: no canvas, no DOM, no audio here, so the shot director and a
// headless test can drive it. The render module draws whatever this holds.
import {
  WALK_SPEED, TIPTOE_SPEED, PLAYER_RADIUS, PEBBLES_PER_LEVEL,
  PEBBLE_THROW_RANGE, PEBBLE_HEAR_RADIUS, PEBBLE_FLIGHT_SECONDS,
  DETECT_DRAIN, SUSPICIOUS_AT, ALERT_AT, SEED_PICKUP_DISTANCE, CAUGHT_DISTANCE,
  STEP_WALK_SECONDS, STEP_TIPTOE_SECONDS, NOISE_WALK_RADIUS, NOISE_TIPTOE_RADIUS,
} from './config.js';
import { LEVELS, levelBlockers } from './levels.js';
import { makeGuard, updateGuard, guardHearsNoise, makeGuardSuspicious, makeGuardAlerted, calmAlertedGuards } from './guards.js';
import { guardSeesPlayer, detectionRateFor, playerHidden, pointInRect } from './senses.js';
import { makeRng } from './random.js';

export function createWorld(levelIndex, seed = 1) {
  const level = LEVELS[levelIndex];
  const rng = makeRng(seed * 1000 + levelIndex * 77 + 13);
  return {
    levelIndex,
    level,
    blockers: levelBlockers(level),
    rng,
    player: {
      x: level.start.x,
      y: level.start.y,
      angle: -Math.PI / 2,
      tiptoe: false,
      moving: false,
      stepTimer: 0,
    },
    guards: level.guards.map((def, i) => makeGuard(def, i)),
    seeds: level.seeds.map((s) => ({ x: s.x, y: s.y, taken: false })),
    seedsCollected: 0,
    meter: 0,
    alert: 'unseen',
    hidden: false,
    pebbles: PEBBLES_PER_LEVEL,
    pebble: null,
    time: 0,
    timesSpotted: 0,
    noSightTimer: 0,
    lastSeen: null,
    caught: false,
    levelClear: false,
    won: false,
    events: [],
  };
}

export function exitUnlocked(world) {
  return world.seedsCollected >= world.seeds.length;
}

export function alertWord(world) {
  if (world.alert === 'hunted') return 'Hunted';
  if (world.alert === 'suspicious') return 'Suspicious';
  if (world.hidden) return 'Hidden';
  return 'Unseen';
}

function circleHitsRect(x, y, radius, rect) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < radius * radius;
}

function collides(world, x, y) {
  for (const rect of world.blockers) {
    if (circleHitsRect(x, y, PLAYER_RADIUS, rect)) return true;
  }
  return false;
}

// Move with sliding: try x, then y, so the player glides along walls.
export function movePlayer(world, dx, dy, dt) {
  const player = world.player;
  const speed = player.tiptoe ? TIPTOE_SPEED : WALK_SPEED;
  const nx = player.x + dx * speed * dt;
  if (!collides(world, nx, player.y)) player.x = nx;
  const ny = player.y + dy * speed * dt;
  if (!collides(world, player.x, ny)) player.y = ny;
  player.x = Math.max(16 + PLAYER_RADIUS, Math.min(1264 - PLAYER_RADIUS, player.x));
  player.y = Math.max(16 + PLAYER_RADIUS, Math.min(704 - PLAYER_RADIUS, player.y));
  if (dx !== 0 || dy !== 0) {
    player.angle = Math.atan2(dy, dx);
    player.moving = true;
  } else {
    player.moving = false;
  }
}

function emitFootstep(world) {
  const player = world.player;
  const radius = player.tiptoe ? NOISE_TIPTOE_RADIUS : NOISE_WALK_RADIUS;
  const noise = { x: player.x, y: player.y, radius, kind: 'step', quiet: player.tiptoe };
  world.events.push({ type: 'footstep', x: player.x, y: player.y, radius, quiet: player.tiptoe });
  for (const guard of world.guards) {
    if (guard.state === 'patrol' && guardHearsNoise(guard, noise)) {
      makeGuardSuspicious(guard, noise.x, noise.y);
      world.events.push({ type: 'guard-suspicious', guard: guard.id });
    }
  }
}

export function tossPebble(world, tx, ty) {
  if (world.pebbles <= 0 || world.pebble) return false;
  const player = world.player;
  const dx = tx - player.x;
  const dy = ty - player.y;
  const dist = Math.hypot(dx, dy);
  const range = Math.min(dist, PEBBLE_THROW_RANGE);
  const scale = dist > 0 ? range / dist : 0;
  world.pebbles -= 1;
  world.pebble = {
    sx: player.x,
    sy: player.y,
    tx: player.x + dx * scale,
    ty: player.y + dy * scale,
    t: 0,
    dur: PEBBLE_FLIGHT_SECONDS,
  };
  return true;
}

function landPebble(world) {
  const pebble = world.pebble;
  world.pebble = null;
  world.events.push({ type: 'pebble-ping', x: pebble.tx, y: pebble.ty, radius: PEBBLE_HEAR_RADIUS });
  const noise = { x: pebble.tx, y: pebble.ty, radius: PEBBLE_HEAR_RADIUS, kind: 'pebble' };
  for (const guard of world.guards) {
    if (guard.state !== 'alerted' && guardHearsNoise(guard, noise)) {
      makeGuardSuspicious(guard, noise.x, noise.y);
    }
  }
}

function updateDetection(world, dt) {
  let highestRate = 0;
  let anySees = false;
  let anySuspicious = false;
  let anyAlerted = false;
  for (const guard of world.guards) {
    const sees = guardSeesPlayer(guard, world.player, world.blockers);
    if (sees) {
      anySees = true;
      const rate = detectionRateFor(guard, world);
      if (rate > highestRate) highestRate = rate;
    }
    if (guard.state === 'suspicious') anySuspicious = true;
    if (guard.state === 'alerted') anyAlerted = true;
  }
  if (anySees) {
    world.noSightTimer = 0;
    world.lastSeen = { x: world.player.x, y: world.player.y };
    const before = world.meter;
    world.meter = Math.min(ALERT_AT, world.meter + highestRate * dt);
    if (before < SUSPICIOUS_AT && world.meter >= SUSPICIOUS_AT && world.meter < ALERT_AT) {
      for (const guard of world.guards) {
        if (guardSeesPlayer(guard, world.player, world.blockers) && guard.state === 'patrol') {
          makeGuardSuspicious(guard, world.player.x, world.player.y);
          world.events.push({ type: 'guard-suspicious', guard: guard.id });
        }
      }
      world.events.push({ type: 'suspicious-blip' });
    }
    if (world.meter >= ALERT_AT && before < ALERT_AT) {
      world.timesSpotted += 1;
      for (const guard of world.guards) {
        makeGuardAlerted(guard, world.player.x, world.player.y);
      }
      world.events.push({ type: 'alert-sting' });
    }
  } else {
    world.noSightTimer += dt;
    world.meter = Math.max(0, world.meter - DETECT_DRAIN * dt);
    calmAlertedGuards(world, dt);
  }
  if (anyAlerted) world.alert = 'hunted';
  else if (anySuspicious || world.meter >= SUSPICIOUS_AT) world.alert = 'suspicious';
  else world.alert = 'unseen';
  world.hidden = playerHidden(world);
  // A sentry never walks, but an alerted sentry still catches a player who
  // blunders into its post.
  if (world.alert === 'hunted') {
    for (const guard of world.guards) {
      if (guard.type === 'sentry' && guard.state === 'alerted'
        && Math.hypot(guard.x - world.player.x, guard.y - world.player.y) <= CAUGHT_DISTANCE) {
        world.caught = true;
      }
    }
  }
}

function updatePickupsAndExit(world) {
  const player = world.player;
  for (const seed of world.seeds) {
    if (!seed.taken && Math.hypot(seed.x - player.x, seed.y - player.y) <= SEED_PICKUP_DISTANCE) {
      seed.taken = true;
      world.seedsCollected += 1;
      world.events.push({ type: 'pickup', x: seed.x, y: seed.y });
      if (exitUnlocked(world)) {
        world.events.push({ type: 'exit-unlocked' });
      }
    }
  }
  if (exitUnlocked(world) && pointInRect(player.x, player.y, world.level.exit)) {
    if (world.levelIndex >= LEVELS.length - 1) {
      world.won = true;
      world.events.push({ type: 'win' });
    } else {
      world.levelClear = true;
      world.events.push({ type: 'level-clear' });
    }
  }
}

// One fixed step. `input` is {x, y, tiptoe, toss} where x/y is a -1..1 move
// direction and toss is {x, y} in canvas pixels, or null.
export function stepWorld(world, input, dt) {
  if (world.caught || world.levelClear || world.won) return;
  world.time += dt;
  world.player.tiptoe = !!input.tiptoe;
  movePlayer(world, input.x || 0, input.y || 0, dt);
  if (world.player.moving) {
    world.player.stepTimer -= dt;
    if (world.player.stepTimer <= 0) {
      world.player.stepTimer = world.player.tiptoe ? STEP_TIPTOE_SECONDS : STEP_WALK_SECONDS;
      emitFootstep(world);
    }
  }
  if (input.toss) tossPebble(world, input.toss.x, input.toss.y);
  if (world.pebble) {
    world.pebble.t += dt;
    if (world.pebble.t >= world.pebble.dur) landPebble(world);
  }
  for (const guard of world.guards) {
    const sees = guardSeesPlayer(guard, world.player, world.blockers);
    updateGuard(world, guard, dt, sees);
  }
  updateDetection(world, dt);
  updatePickupsAndExit(world);
}

// Drain the world's event queue: the main loop turns events into sound and fx.
export function drainEvents(world) {
  const events = world.events;
  world.events = [];
  return events;
}
