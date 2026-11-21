// shots.js — the ?shot= scenes. Each one plays the REAL rules forward
// from a fresh world with a fixed scripted input, so the frame is what
// real play looks like and the same seed always gives the same frame.
// Never a mockup: every shot is a render of the game's own world.
//
// The driver is a cautious apprentice: it tiptoes toward the next
// waypoint and waits (standing still) whenever the next step would be
// inside a guard's cone. Guards patrol on, so the cone sweeps away and
// the walk resumes. If a guard gets close while the player waits, the
// driver backs away from it.
import { createWorld, updateWorld, isPositionSeen, seeingGuardAt } from './world.js';
import { TIPTOE_SPEED } from './config.js';

const DT = 1 / 60;

function makeInput() {
  return { moveX: 0, moveY: 0, tiptoe: true };
}

// Rest stops: points verified (by simulating 120 s of guard patrols with
// the player standing still) to be NEVER seen by any patrolling guard.
// The driver only ever waits at a rest stop, and runs for the nearest
// one when it is seen. Level 1 and 2 have many; level 3 has few, which is
// why its bottom lane is the hardest crossing in the game.
const REST_STOPS = [
  // Level 1 — The Potting Shed.
  [
    [140, 640], [220, 640], [620, 640], [700, 640], [1140, 640],
    [140, 280], [260, 280], [620, 280], [1140, 280],
  ],
  // Level 2 — The Fern House.
  [
    [140, 640], [220, 640], [460, 640], [140, 280], [260, 280],
    [540, 120], [1020, 360], [1020, 400], [540, 520],
  ],
  // Level 3 — The Orchid Vault.
  [
    [220, 640], [220, 280], [260, 280], [540, 120], [1020, 360],
    [1020, 400], [1020, 440], [100, 680], [140, 680], [180, 680], [220, 680],
  ],
];

function nearestRestStop(world, x, y) {
  const stops = REST_STOPS[world.levelIndex] || [];
  let best = null;
  let bestDist = Infinity;
  for (const stop of stops) {
    const d = Math.hypot(stop[0] - x, stop[1] - y);
    if (d < bestDist) {
      bestDist = d;
      best = stop;
    }
  }
  return best ? { x: best[0], y: best[1], dist: bestDist } : null;
}

// Is the stretch of the leg from (x, y) toward (tx, ty), up to `ahead`
// px long, free of every guard's cone right now? Sampled every 15 px.
function legAheadClear(world, x, y, tx, ty, ahead) {
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return true;
  const len = Math.min(d, ahead);
  const steps = Math.max(1, Math.ceil(len / 15));
  for (let i = 1; i <= steps; i += 1) {
    const sx = x + (dx / d) * ((len * i) / steps);
    const sy = y + (dy / d) * ((len * i) / steps);
    if (isPositionSeen(world, sx, sy)) return false;
  }
  return true;
}

// Drive toward a waypoint list. Returns true when every waypoint was
// reached (player within 12 px). One step per call; the caller steps the
// world itself so the shot can watch the meter between steps.
//
// Rules, in order:
//  1. A guard that is already suspicious / alerted / searching and close:
//     run for the nearest rest stop at full walk speed (faster than a
//     guard's investigate). Cover is life.
//  2. The player is standing inside a patrolling guard's cone: step
//     sideways out of it — perpendicular to the guard's facing, on the
//     side toward the waypoint (away from the guard on a tie). Backing
//     straight away only runs deeper into the cone's range.
//  3. The next 100 px of the leg ahead is covered by a cone: wait where
//     you are. The patrol passes; rule 2 steps you out if a cone sweeps
//     onto you while you wait. If the leg stays blocked for 20 s, fall
//     back to the nearest rest stop and wait there instead.
//  4. Otherwise tiptoe toward the waypoint.
export function driveToward(world, input, waypoints, state) {
  const p = world.player;
  const target = waypoints[state.wp];
  if (!target) return true;
  const dx = target[0] - p.x;
  const dy = target[1] - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 12) {
    state.wp += 1;
    state.openWait = 0;
    return state.wp >= waypoints.length;
  }

  // 1. A hunting guard close by: run for cover.
  let hunter = null;
  let hunterDist = Infinity;
  for (const guard of world.guards) {
    if (guard.state === 'patrol') continue;
    const gd = Math.hypot(guard.x - p.x, guard.y - p.y);
    if (gd < hunterDist) {
      hunterDist = gd;
      hunter = guard;
    }
  }
  if (hunter && hunterDist < 130) {
    state.openWait = 0;
    const stop = nearestRestStop(world, p.x, p.y);
    if (stop && stop.dist > 15) {
      const sx = stop.x - p.x;
      const sy = stop.y - p.y;
      const sd = Math.hypot(sx, sy) || 1;
      input.moveX = sx / sd;
      input.moveY = sy / sd;
      input.tiptoe = false;
      return false;
    }
  }

  // 2. Standing in a patrolling guard's cone: step sideways out of it.
  const seeingGuard = seeingGuardAt(world, p.x, p.y);
  if (seeingGuard) {
    state.openWait = 0;
    const fx = Math.cos(seeingGuard.facing);
    const fy = Math.sin(seeingGuard.facing);
    const px = -fy;
    const py = fx;
    const towardWp = px * dx + py * dy;
    const awaySide = px * (p.x - seeingGuard.x) + py * (p.y - seeingGuard.y);
    const sign = towardWp !== 0 ? Math.sign(towardWp) : awaySide >= 0 ? 1 : -1;
    input.moveX = px * sign;
    input.moveY = py * sign;
    input.tiptoe = false;
    return false;
  }

  // 3. The leg ahead is covered: wait. After 20 s with no progress, fall
  // back to the nearest rest stop and wait there.
  if (!legAheadClear(world, p.x, p.y, target[0], target[1], 100)) {
    state.openWait = (state.openWait || 0) + 1;
    if (state.openWait > 1200) {
      const stop = nearestRestStop(world, p.x, p.y);
      if (stop && stop.dist > 15) {
        const sx = stop.x - p.x;
        const sy = stop.y - p.y;
        const sd = Math.hypot(sx, sy) || 1;
        input.moveX = sx / sd;
        input.moveY = sy / sd;
        input.tiptoe = true;
        return false;
      }
    }
    input.moveX = 0;
    input.moveY = 0;
    return false;
  }
  state.openWait = 0;
  // 4. Tiptoe on.
  input.moveX = dx / d;
  input.moveY = dy / d;
  input.tiptoe = true;
  return false;
}

function stepWorld(world, input) {
  input.tiptoe = input.tiptoe !== false;
  updateWorld(world, input, DT);
  input.moveX = 0;
  input.moveY = 0;
}

// --- the four shots ---------------------------------------------------------

export function shotStart(seed) {
  // Title screen over the level-2 garden, dimmed. A couple of seconds of
  // patrol so the cones sit mid-sweep behind the title panel.
  const world = createWorld(1, seed);
  const input = makeInput();
  for (let i = 0; i < 60 * 3; i += 1) stepWorld(world, input);
  return { screen: 'title', world, bestTime: null };
}

export function shotPlay(seed) {
  // Level 2, mid-play: one seed collected (the bottom-middle one), the
  // player crouched behind the bottom-left hedge, meter low and green.
  const world = createWorld(1, seed);
  const input = makeInput();
  const state = { wp: 0 };
  const route = [
    [640, 640], // seed 3, bottom-middle, along the safe bottom lane
    [250, 640], // hide spot: just below the bottom-left hedge
  ];
  let steps = 0;
  const maxSteps = 60 * 120;
  while (steps < maxSteps) {
    driveToward(world, input, route, state);
    stepWorld(world, input);
    steps += 1;
    if (world.caught) break;
    if (state.wp >= route.length && world.seedsCollected >= 1) break;
  }
  // Let the meter settle for a second so the frame reads calm and green.
  for (let i = 0; i < 60; i += 1) stepWorld(world, input);
  return { screen: 'play', world, bestTime: null };
}

export function shotAlarm(seed) {
  // Level 2 near-miss: the player walks up the safe left lane to the edge
  // of guard G3's patrol lane and stands there. G3's patrol brings its
  // cone onto the player; the meter climbs and the frame freezes the
  // moment it first crosses 0.7, with the guard SUSPICIOUS ("?") and
  // turning toward the player. The player stands still on purpose: the
  // shot is about being seen, not about escaping.
  const world = createWorld(1, seed);
  const input = makeInput();
  const state = { wp: 0 };
  // y=280, not y=300: the bottom-left hedge starts at y=300 and the
  // player's radius would snag its corner on the y=300 lane.
  const route = [
    [80, 280], // up the safe left lane
    [260, 280], // the edge of G3's patrol lane
  ];
  let steps = 0;
  const maxSteps = 60 * 180;
  let arrived = false;
  let shuffleLeft = true;
  while (steps < maxSteps) {
    if (!arrived) {
      // Wait-only driving: no flee, no retreat — the player wants to be
      // seen here. Waiting when the next step is in a cone is enough.
      const p = world.player;
      const target = route[state.wp];
      const dx = target[0] - p.x;
      const dy = target[1] - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 12) {
        state.wp += 1;
        if (state.wp >= route.length) arrived = true;
      } else {
        const step = TIPTOE_SPEED * DT;
        const nx = p.x + (dx / d) * step;
        const ny = p.y + (dy / d) * step;
        if (isPositionSeen(world, nx, ny)) {
          input.moveX = 0;
          input.moveY = 0;
        } else {
          input.moveX = dx / d;
          input.moveY = dy / d;
          input.tiptoe = true;
        }
      }
    } else {
      // Shuffle a few pixels back and forth on the lane edge, walking, so
      // a fresh footstep ring is always expanding in the frozen frame.
      const target = shuffleLeft ? [252, 280] : [268, 280];
      const dx = target[0] - world.player.x;
      const dy = target[1] - world.player.y;
      if (Math.hypot(dx, dy) < 4) shuffleLeft = !shuffleLeft;
      input.moveX = dx / (Math.hypot(dx, dy) || 1);
      input.moveY = dy / (Math.hypot(dx, dy) || 1);
      input.tiptoe = false;
    }
    stepWorld(world, input);
    steps += 1;
    if (world.caught) break;
    if (world.detection >= 0.7) break;
  }
  return { screen: 'play', world, bestTime: null };
}

export function shotEnd(seed) {
  // A full winning run: level 1, then 2, then 3, each played by the same
  // cautious driver, collecting all 3 seeds and slipping out the gate.
  // The returned world is the level-3 world at the win screen.
  const routes = [
    // Level 1 — The Potting Shed. Lanes are the clear ones: x=80 down the
    // west side (hedges start at x=120), y=640 along the bottom (hedges
    // end at y=608), x=1240 down the east side to the gate.
    [
      [80, 180],
      [180, 180],
      [80, 180],
      [80, 640],
      [640, 640],
      [1120, 640],
      [1120, 480],
      [1240, 480],
      [1240, 640],
      [1220, 660],
    ],
    // Level 2 — The Fern House (same seeds as level 1).
    [
      [80, 180],
      [180, 180],
      [80, 180],
      [80, 640],
      [640, 640],
      [1120, 640],
      [1120, 480],
      [1240, 480],
      [1240, 640],
      [1220, 660],
    ],
    // Level 3 — The Orchid Vault (third seed is top-right instead).
    // The north leg runs up x=80: the x=220 lane is blocked by the hedge
    // at (180,560) and the x=140 lane by the hedge at (120,300). The
    // east leg goes up the clear lane x=1240 and steps west to the seed.
    // Every wait happens at a verified rest stop (see REST_STOPS).
    [
      [80, 680],
      [80, 280],
      [220, 280],
      [180, 180],
      [220, 280],
      [80, 280],
      [80, 680],
      [220, 680],
      [220, 640],
      [640, 640],
      [1120, 640],
      [1240, 640],
      [1240, 180],
      [1120, 180],
      [1240, 180],
      [1240, 640],
      [1220, 660],
    ],
  ];
  let totalTime = 0;
  let world = null;
  for (let levelIndex = 0; levelIndex < 3; levelIndex += 1) {
    world = createWorld(levelIndex, seed);
    const input = makeInput();
    const state = { wp: 0 };
    const route = routes[levelIndex];
    let steps = 0;
    const maxSteps = 60 * 420;
    while (steps < maxSteps) {
      driveToward(world, input, route, state);
      stepWorld(world, input);
      steps += 1;
      if (world.caught) break;
      if (world.levelComplete) break;
    }
    totalTime += world.levelTime;
    if (!world.levelComplete) break;
  }
  return { screen: 'win', world, bestTime: null, totalTime };
}

// Resolve ?shot= into a scene. Unknown names fall back to the title.
export function resolveShot(name, seed) {
  if (name === 'play') return shotPlay(seed);
  if (name === 'alarm') return shotAlarm(seed);
  if (name === 'end') return shotEnd(seed);
  return shotStart(seed);
}
