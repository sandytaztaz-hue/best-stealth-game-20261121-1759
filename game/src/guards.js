// guards.js — warden AI. Four states, in order:
// PATROL (walk the loop, pause at each waypoint) -> SUSPICIOUS (stop, look,
// walk to the noise) -> ALERTED (converge on the player) -> SEARCH (check the
// last place the player was seen, then back to PATROL).
// Sentries never walk: on patrol they sweep their cone in a slow full turn;
// when suspicious they stop and stare; when alerted they sound the alarm and
// turn to track the player while the patrol wardens do the chasing.
import {
  GUARD_PATROL_SPEED, GUARD_INVESTIGATE_SPEED, GUARD_ALERT_SPEED,
  GUARD_PAUSE_SECONDS, SENTRY_TURN_SPEED, NO_SIGHT_SEARCH_SECONDS,
  SEARCH_LOOK_SECONDS, SUSPICIOUS_WAIT_SECONDS, INVESTIGATE_LOOK_SECONDS,
  CAUGHT_DISTANCE,
} from './config.js';
import { angleDifference, distanceBetween } from './senses.js';

export function makeGuard(def, index) {
  if (def.type === 'sentry') {
    return {
      id: index,
      type: 'sentry',
      x: def.x,
      y: def.y,
      angle: def.angle,
      turnSpeed: SENTRY_TURN_SPEED,
      state: 'patrol',
      stateTimer: 0,
      investigate: null,
      lastSeen: null,
      pauseTimer: 0,
    };
  }
  const first = def.waypoints[0];
  return {
    id: index,
    type: 'patrol',
    x: first[0],
    y: first[1],
    angle: Math.PI / 2,
    speed: GUARD_PATROL_SPEED,
    waypoints: def.waypoints,
    waypointIndex: 1 % def.waypoints.length,
    pauseTimer: 0,
    state: 'patrol',
    stateTimer: 0,
    investigate: null,
    lastSeen: null,
  };
}

function turnToward(guard, targetAngle, dt, rate) {
  const diff = angleDifference(targetAngle, guard.angle);
  const step = Math.max(-rate * dt, Math.min(rate * dt, diff));
  guard.angle += step;
}

function moveToward(guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const step = Math.min(speed * dt, dist);
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
  guard.angle = Math.atan2(dy, dx);
  return dist - step < 1;
}

export function guardHearsNoise(guard, noise) {
  return distanceBetween(guard.x, guard.y, noise.x, noise.y) <= noise.radius;
}

export function makeGuardSuspicious(guard, x, y) {
  if (guard.state === 'alerted') return;
  guard.state = 'suspicious';
  guard.stateTimer = 0;
  guard.investigate = { x, y };
}

export function makeGuardAlerted(guard, x, y) {
  guard.state = 'alerted';
  guard.stateTimer = 0;
  guard.lastSeen = { x, y };
  guard.investigate = null;
}

function updatePatrolGuard(world, guard, dt) {
  const target = guard.waypoints[guard.waypointIndex];
  if (guard.pauseTimer > 0) {
    guard.pauseTimer -= dt;
    return;
  }
  const arrived = moveToward(guard, target[0], target[1], GUARD_PATROL_SPEED, dt);
  if (arrived) {
    guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    guard.pauseTimer = GUARD_PAUSE_SECONDS;
  }
}

function updateSentryGuard(world, guard, dt) {
  guard.angle += guard.turnSpeed * dt;
  if (guard.angle > Math.PI) guard.angle -= 2 * Math.PI;
}

function updateSuspiciousGuard(world, guard, dt) {
  guard.stateTimer += dt;
  const point = guard.investigate || { x: guard.x, y: guard.y };
  if (guard.type === 'sentry') {
    turnToward(guard, Math.atan2(point.y - guard.y, point.x - guard.x), dt, 3.0);
    if (guard.stateTimer >= SUSPICIOUS_WAIT_SECONDS) {
      guard.state = 'patrol';
      guard.stateTimer = 0;
    }
    return;
  }
  if (guard.stateTimer < SUSPICIOUS_WAIT_SECONDS) {
    turnToward(guard, Math.atan2(point.y - guard.y, point.x - guard.x), dt, 3.0);
    return;
  }
  const arrived = moveToward(guard, point.x, point.y, GUARD_INVESTIGATE_SPEED, dt);
  if (arrived) {
    guard.stateTimer = SUSPICIOUS_WAIT_SECONDS + INVESTIGATE_LOOK_SECONDS;
    guard.state = 'search';
    guard.stateTimer = 0;
    guard.investigate = null;
  }
}

function updateAlertedGuard(world, guard, dt) {
  guard.stateTimer += dt;
  const player = world.player;
  if (guard.type === 'sentry') {
    turnToward(guard, Math.atan2(player.y - guard.y, player.x - guard.x), dt, 4.0);
    return;
  }
  moveToward(guard, player.x, player.y, GUARD_ALERT_SPEED, dt);
  if (distanceBetween(guard.x, guard.y, player.x, player.y) <= CAUGHT_DISTANCE) {
    world.caught = true;
  }
}

function updateSearchGuard(world, guard, dt) {
  guard.stateTimer += dt;
  if (guard.type === 'sentry') {
    if (guard.lastSeen) {
      turnToward(guard, Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x), dt, 2.0);
    }
    if (guard.stateTimer >= SEARCH_LOOK_SECONDS) {
      guard.state = 'patrol';
      guard.stateTimer = 0;
      guard.lastSeen = null;
    }
    return;
  }
  if (guard.lastSeen) {
    const arrived = moveToward(guard, guard.lastSeen.x, guard.lastSeen.y, GUARD_INVESTIGATE_SPEED, dt);
    if (arrived && guard.stateTimer >= SEARCH_LOOK_SECONDS) {
      guard.state = 'patrol';
      guard.stateTimer = 0;
      guard.lastSeen = null;
    }
  } else if (guard.stateTimer >= SEARCH_LOOK_SECONDS) {
    guard.state = 'patrol';
    guard.stateTimer = 0;
  }
}

// One tick of one warden. `seesPlayer` is decided by the world (senses), and
// passed in so the guard can remember where it last saw the player.
export function updateGuard(world, guard, dt, seesPlayer) {
  if (seesPlayer) {
    guard.lastSeen = { x: world.player.x, y: world.player.y };
  }
  switch (guard.state) {
    case 'patrol':
      if (guard.type === 'sentry') updateSentryGuard(world, guard, dt);
      else updatePatrolGuard(world, guard, dt);
      break;
    case 'suspicious':
      updateSuspiciousGuard(world, guard, dt);
      break;
    case 'alerted':
      updateAlertedGuard(world, guard, dt);
      break;
    case 'search':
      updateSearchGuard(world, guard, dt);
      break;
    default:
      break;
  }
}

// When every warden has lost the player for long enough, the alerted ones
// fall back to searching the last-seen spot, then to patrol.
export function calmAlertedGuards(world, dt) {
  if (world.noSightTimer < NO_SIGHT_SEARCH_SECONDS) return;
  for (const guard of world.guards) {
    if (guard.state === 'alerted') {
      guard.state = 'search';
      guard.stateTimer = 0;
    }
  }
  world.noSightTimer = 0;
}
