// shots.js — the four screenshots, played by the real rules.
// Each shot starts a fresh world and drives it forward with scripted input
// through stepWorld, so the frame is what real play looks like — never a
// mockup. Same seed, same frame. The autopilot below is a tiny pathfinder:
// it plans a route on a grid, prices every cell by whether a warden's cone
// covers it, waits in cover when the meter climbs, and tosses a pebble when
// it is stuck. It plays through the same input a human uses.
import { CANVAS_W, CANVAS_H, PLAYER_RADIUS, CONE_ANGLE, GUARD_PATROL_SPEED, GUARD_PAUSE_SECONDS, SENTRY_TURN_SPEED } from './config.js';
import { LEVELS } from './levels.js';
import { createWorld, stepWorld, drainEvents, exitUnlocked } from './world.js';
import { createFx, spawnRing, spawnSparks, spawnPuff, updateFx } from './fx.js';
import { guardSeesPlayer, playerInsideCone, lineOfSightBlocked, coneRangeFor } from './senses.js';

const DT = 1 / 60;
const CELL = 40;
const COLS = Math.floor(CANVAS_W / CELL);
const ROWS = Math.floor(CANVAS_H / CELL);

function cellCenter(col, row) {
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
}

function cellWalkable(world, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  const c = cellCenter(col, row);
  if (c.y < 70) return false;
  for (const rect of world.blockers) {
    const pad = PLAYER_RADIUS + 2;
    if (c.x > rect.x - pad && c.x < rect.x + rect.w + pad
      && c.y > rect.y - pad && c.y < rect.y + rect.h + pad) return false;
  }
  return true;
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 0) t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Where a patrolling warden will be in `seconds`: patrol wardens walk their
// loop at patrol speed with a pause at each waypoint, sentries keep turning.
// Suspicious, alerted and searching wardens react to the player, so their
// future is not predicted — they stay where they are.
export function predictGuardStates(world, seconds) {
  return world.guards.map((guard) => {
    if (guard.type === 'sentry') {
      let angle = guard.angle + SENTRY_TURN_SPEED * seconds;
      while (angle > Math.PI) angle -= 2 * Math.PI;
      return { x: guard.x, y: guard.y, angle, type: 'sentry', state: guard.state, investigate: guard.investigate, lastSeen: guard.lastSeen };
    }
    if (guard.state !== 'patrol') {
      return { x: guard.x, y: guard.y, angle: guard.angle, type: 'patrol', state: guard.state, investigate: guard.investigate, lastSeen: guard.lastSeen, waypoints: guard.waypoints };
    }
    let x = guard.x;
    let y = guard.y;
    let angle = guard.angle;
    let index = guard.waypointIndex;
    let pause = guard.pauseTimer;
    let remaining = seconds;
    const step = 0.1;
    while (remaining > 0) {
      const dt = Math.min(step, remaining);
      remaining -= dt;
      if (pause > 0) {
        pause -= dt;
        continue;
      }
      const target = guard.waypoints[index];
      const dx = target[0] - x;
      const dy = target[1] - y;
      const dist = Math.hypot(dx, dy);
      const move = GUARD_PATROL_SPEED * dt;
      if (dist <= move) {
        x = target[0];
        y = target[1];
        angle = Math.atan2(dy, dx);
        index = (index + 1) % guard.waypoints.length;
        pause = GUARD_PAUSE_SECONDS;
      } else {
        x += (dx / dist) * move;
        y += (dy / dist) * move;
        angle = Math.atan2(dy, dx);
      }
    }
    return { x, y, angle, type: 'patrol', state: guard.state, investigate: guard.investigate, lastSeen: guard.lastSeen, waypoints: guard.waypoints };
  });
}

function dangerAtCell(world, col, row, states) {
  const c = cellCenter(col, row);
  let cost = 0;
  for (const guard of states) {
    const d = Math.hypot(guard.x - c.x, guard.y - c.y);
    if (d < 70) cost = Math.max(cost, 25);
    else if (d < 130) cost = Math.max(cost, 12);
    const toCell = Math.atan2(c.y - guard.y, c.x - guard.x);
    let diff = toCell - guard.angle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    if (d <= coneRangeFor(guard) && Math.abs(diff) <= CONE_ANGLE / 2
      && !lineOfSightBlocked(guard.x, guard.y, c.x, c.y, world.blockers)) {
      cost = Math.max(cost, 45);
    }
    const focus = guard.investigate || guard.lastSeen;
    if (focus && (guard.state === 'suspicious' || guard.state === 'search' || guard.state === 'alerted')) {
      if (Math.hypot(focus.x - c.x, focus.y - c.y) < 110) cost = Math.max(cost, 25);
    }
    if (guard.type === 'patrol') {
      const points = guard.waypoints;
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        if (distanceToSegment(c.x, c.y, a[0], a[1], b[0], b[1]) < 55) {
          cost = Math.max(cost, 40);
        }
      }
    } else if (d < coneRangeFor(guard) && !lineOfSightBlocked(guard.x, guard.y, c.x, c.y, world.blockers)) {
      cost = Math.max(cost, 25);
    }
  }
  return cost;
}

// The predicted states a plan is priced against: the wardens where they
// are right now. Patrols are clockwork, so predictGuardStates can also
// price where they will be — but a live cone is what the eye reads, and the
// pilot times its crossings with the wait below instead.
export function predictedStatesLists(world) {
  return [predictGuardStates(world, 0)];
}

// The nearest cell that breaks every line of sight right now: no cone on
// it, no warden close to it, and away from the last place the player was
// seen (that is where a hunt searches first). A hunt ends by hiding, not
// by outrunning eight wardens across the map.
function findHideCell(world) {
  const statesList = predictedStatesLists(world);
  const px = world.player.x;
  const py = world.player.y;
  const lastSeen = world.lastSeen || { x: px, y: py };
  for (const radius of [200, 350, 600]) {
    let bestCell = null;
    let bestScore = Infinity;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!cellWalkable(world, c, r)) continue;
        const center = cellCenter(c, r);
        const dist = Math.hypot(center.x - px, center.y - py);
        if (dist > radius) continue;
        if (cellDanger(world, c, r, statesList) >= 30) continue;
        let tooClose = false;
        for (const guard of world.guards) {
          if (Math.hypot(guard.x - center.x, guard.y - center.y) < 70) { tooClose = true; break; }
        }
        if (tooClose) continue;
        let score = dist;
        if (cellNearHedge(world, c, r)) score -= 120;
        score += Math.max(0, 200 - Math.hypot(center.x - lastSeen.x, center.y - lastSeen.y));
        if (score < bestScore) {
          bestScore = score;
          bestCell = center;
        }
      }
    }
    if (bestCell) return bestCell;
  }
  return null;
}

function cellLaneCost(world, col, row) {
  const c = cellCenter(col, row);
  for (const guard of world.guards) {
    if (guard.type !== 'patrol') continue;
    const points = guard.waypoints;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (distanceToSegment(c.x, c.y, a[0], a[1], b[0], b[1]) < 55) return 40;
    }
  }
  return 0;
}

function cellDanger(world, col, row, statesList) {
  const lists = statesList || predictedStatesLists(world);
  let cost = 0;
  for (const states of lists) {
    cost = Math.max(cost, dangerAtCell(world, col, row, states));
  }
  return cost;
}

function cellNearHedge(world, col, row) {
  const c = cellCenter(col, row);
  for (const hedge of world.level.hedges) {
    if (c.x > hedge.x - 50 && c.x < hedge.x + hedge.w + 50
      && c.y > hedge.y - 50 && c.y < hedge.y + hedge.h + 50) return true;
  }
  return false;
}

// A* over the grid. Danger is a cost, never a wall: the autopilot prefers a
// safe detour, but takes the least-bad route when every way is watched.
// Walkable and danger grids are computed once per plan, not per node.
function findPath(world, from, to) {
  const startCol = Math.max(0, Math.min(COLS - 1, Math.floor(from.x / CELL)));
  const startRow = Math.max(0, Math.min(ROWS - 1, Math.floor(from.y / CELL)));
  const goalCol = Math.max(0, Math.min(COLS - 1, Math.floor(to.x / CELL)));
  const goalRow = Math.max(0, Math.min(ROWS - 1, Math.floor(to.y / CELL)));
  const walkable = new Uint8Array(COLS * ROWS);
  const danger = new Float32Array(COLS * ROWS);
  // One prediction per plan, shared by every cell in it.
  const statesList = predictedStatesLists(world);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      walkable[r * COLS + c] = cellWalkable(world, c, r) ? 1 : 0;
      danger[r * COLS + c] = cellDanger(world, c, r, statesList);
    }
  }
  const key = (c, r) => r * COLS + c;
  const open = [{ c: startCol, r: startRow, g: 0, f: 0, parent: null }];
  const best = new Map();
  best.set(key(startCol, startRow), 0);
  const closed = new Set();
  const neighbours = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414],
  ];
  while (open.length > 0) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bi].f) bi = i;
    }
    const node = open.splice(bi, 1)[0];
    const nodeKey = key(node.c, node.r);
    if (closed.has(nodeKey)) continue;
    closed.add(nodeKey);
    if (node.c === goalCol && node.r === goalRow) {
      const path = [];
      let cur = node;
      while (cur) {
        path.unshift(cellCenter(cur.c, cur.r));
        cur = cur.parent;
      }
      // End on the exact target, not the cell centre: a seed 20px off the
      // centre would otherwise sit just outside pickup range forever.
      const last = path[path.length - 1];
      if (Math.hypot(to.x - last.x, to.y - last.y) > 2) path.push({ x: to.x, y: to.y });
      return path;
    }
    for (const [dc, dr, step] of neighbours) {
      const nc = node.c + dc;
      const nr = node.r + dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      if (!walkable[nr * COLS + nc]) continue;
      if (dc !== 0 && dr !== 0) {
        if (!walkable[node.r * COLS + (node.c + dc)] || !walkable[(node.r + dr) * COLS + node.c]) continue;
      }
      const g = node.g + step * (1 + danger[nr * COLS + nc]);
      const k = key(nc, nr);
      if (best.has(k) && best.get(k) <= g) continue;
      best.set(k, g);
      const h = Math.hypot(goalCol - nc, goalRow - nr);
      open.push({ c: nc, r: nr, g, f: g + h, parent: node });
    }
  }
  return [];
}

// The nearest cell no cone covers right now, preferring one beside a hedge.
// When hunted, prefer the cell farthest from every warden instead.
function findSafeCell(world) {
  let bestCell = null;
  let bestScore = Infinity;
  const px = world.player.x;
  const py = world.player.y;
  const hunted = world.alert === 'hunted';
  // One prediction per search, shared by every cell in it.
  const statesList = predictedStatesLists(world);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!cellWalkable(world, c, r)) continue;
      if (cellDanger(world, c, r, statesList) >= 30) continue;
      const center = cellCenter(c, r);
      let score = Math.hypot(center.x - px, center.y - py);
      if (cellNearHedge(world, c, r)) score -= 120;
      if (hunted) {
        let nearestGuard = Infinity;
        for (const guard of world.guards) {
          nearestGuard = Math.min(nearestGuard, Math.hypot(guard.x - center.x, guard.y - center.y));
        }
        score -= nearestGuard * 2;
      }
      if (score < bestScore) {
        bestScore = score;
        bestCell = center;
      }
    }
  }
  return bestCell;
}

function applyFxForEvents(world, fx) {
  for (const event of drainEvents(world)) {
    if (event.type === 'footstep') {
      spawnRing(fx, event.x, event.y, event.radius, event.quiet ? '#7fb8c9' : '#dcefe6', event.quiet);
    } else if (event.type === 'pickup') {
      spawnSparks(fx, event.x, event.y, '#c9a7ff', 16);
    } else if (event.type === 'pebble-ping') {
      spawnRing(fx, event.x, event.y, event.radius, '#f5b942');
      spawnPuff(fx, event.x, event.y);
    }
  }
}

// The autopilot: pick a target, plan, follow, wait in cover when seen, toss
// a pebble when stuck. Returns the input for one step.
// Options: waitCap (how long to hold for a cone to pass, in steps),
// replanEvery (how often to commit to a fresh route), nearestSeed (take the
// closest Moonpetal first instead of the level's order), startDelay (stand
// still this many steps before moving — it shifts the whole run against the
// wardens' patrol phases, so a retry meets a different garden).
export function makeAutopilot(world, opts = {}) {
  const waitCap = opts.waitCap || 480;
  const replanEvery = opts.replanEvery || 120;
  const nearestSeed = !!opts.nearestSeed;
  const startDelay = opts.startDelay || 0;
  const pilot = {
    path: [],
    replanIn: 0,
    target: null,
    waiting: false,
    stuckSteps: 0,
    lastX: world.player.x,
    lastY: world.player.y,
    waitAfterPebble: 0,
  };

  function currentTarget() {
    let bestSeed = null;
    let bestDist = Infinity;
    for (const seed of world.seeds) {
      if (seed.taken) continue;
      if (!nearestSeed) return { x: seed.x, y: seed.y };
      const d = Math.hypot(seed.x - world.player.x, seed.y - world.player.y);
      if (d < bestDist) {
        bestDist = d;
        bestSeed = seed;
      }
    }
    if (bestSeed) return { x: bestSeed.x, y: bestSeed.y };
    const exit = world.level.exit;
    return { x: exit.x + exit.w / 2, y: exit.y + exit.h / 2 };
  }

  function nearestBlockingGuard() {
    let bestGuard = null;
    let bestDist = Infinity;
    for (const guard of world.guards) {
      const d = Math.hypot(guard.x - world.player.x, guard.y - world.player.y);
      if (d < bestDist) {
        bestDist = d;
        bestGuard = guard;
      }
    }
    return bestGuard;
  }

  pilot.step = function step() {
    const player = world.player;
    if (pilot.stepsTaken === undefined) pilot.stepsTaken = 0;
    pilot.stepsTaken += 1;
    if (pilot.stepsTaken <= startDelay) {
      return { x: 0, y: 0, tiptoe: true, toss: null };
    }
    if (pilot.waitAfterPebble > 0) {
      pilot.waitAfterPebble -= 1;
      return { x: 0, y: 0, tiptoe: true, toss: null };
    }
    if ((world.meter > 0.3 || world.alert === 'hunted') && !pilot.waiting) {
      if (world.alert === 'hunted' && exitUnlocked(world)) {
        // The gate is open and every warden is converging: run for the exit.
        // Escaping while hunted still wins — it just costs the GHOST rating.
        const exit = world.level.exit;
        pilot.target = { x: exit.x + exit.w / 2, y: exit.y + exit.h / 2 };
        pilot.path = findPath(world, player, pilot.target);
        pilot.waiting = true;
        pilot.replanIn = 10;
        pilot.fleeingToExit = true;
      } else if (world.alert === 'hunted') {
        // Hunted with the gate shut: break line of sight behind the nearest
        // cover and stay still until the hunt burns itself out.
        const hide = findHideCell(world);
        if (hide) {
          pilot.target = hide;
          pilot.path = findPath(world, player, hide);
          pilot.waiting = true;
          pilot.hiding = true;
          pilot.replanIn = 30;
        } else {
          const safe = findSafeCell(world);
          if (safe) {
            pilot.target = safe;
            pilot.path = findPath(world, player, safe);
            pilot.waiting = true;
            pilot.replanIn = 30;
          }
        }
      } else {
        const safe = findSafeCell(world);
        if (safe) {
          pilot.target = safe;
          pilot.path = findPath(world, player, safe);
          pilot.waiting = true;
          pilot.replanIn = 30;
        }
      }
    }
    if (pilot.waiting) {
      // The hunt started while hiding and the gate is open: stop hiding and
      // run for the exit instead.
      if (world.alert === 'hunted' && exitUnlocked(world) && !pilot.fleeingToExit) {
        pilot.fleeingToExit = true;
        pilot.hiding = false;
        pilot.replanIn = 0;
      }
      pilot.replanIn -= 1;
      if (pilot.replanIn <= 0) {
        if (pilot.fleeingToExit) {
          const exit = world.level.exit;
          pilot.target = { x: exit.x + exit.w / 2, y: exit.y + exit.h / 2 };
          pilot.path = findPath(world, player, pilot.target);
          pilot.replanIn = 10;
        } else if (pilot.hiding) {
          const hide = findHideCell(world);
          if (hide) {
            pilot.target = hide;
            pilot.path = findPath(world, player, hide);
          }
          pilot.replanIn = 30;
        } else {
          const safe = findSafeCell(world);
          if (safe) {
            pilot.target = safe;
            pilot.path = findPath(world, player, safe);
          }
          pilot.replanIn = 30;
        }
      }
      if (world.meter < 0.15 && world.alert !== 'hunted') {
        pilot.waiting = false;
        pilot.fleeingToExit = false;
        pilot.hiding = false;
        pilot.path = [];
        pilot.replanIn = 0;
      } else if (pilot.path.length === 0) {
        return { x: 0, y: 0, tiptoe: true, toss: null };
      }
    }
    pilot.replanIn -= 1;
    const target = pilot.waiting ? pilot.target : currentTarget();
    if (pilot.replanIn <= 0 || pilot.path.length === 0) {
      pilot.path = findPath(world, player, target);
      // Commit to a route: replan rarely, so a corridor that looks clear
      // for one moment cannot lure the run off the safe road mid-crossing.
      pilot.replanIn = replanEvery;
    }
    const moved = Math.hypot(player.x - pilot.lastX, player.y - pilot.lastY);
    if (!pilot.waiting && pilot.path.length > 0) {
      if (moved < 0.4) pilot.stuckSteps += 1;
      else pilot.stuckSteps = 0;
    } else {
      pilot.stuckSteps = 0;
    }
    pilot.lastX = player.x;
    pilot.lastY = player.y;
    let toss = null;
    if (pilot.stuckSteps > 150 && world.pebbles > 0) {
      const guard = nearestBlockingGuard();
      if (guard) {
        const dx = guard.x - player.x;
        const dy = guard.y - player.y;
        const d = Math.hypot(dx, dy) || 1;
        toss = {
          x: guard.x + (dx / d) * 110,
          y: guard.y + (dy / d) * 110,
        };
        pilot.stuckSteps = 0;
        pilot.waitAfterPebble = 100;
        pilot.path = [];
        pilot.replanIn = 0;
      }
    }
    if (pilot.path.length === 0) {
      return { x: 0, y: 0, tiptoe: true, toss };
    }
    const next = pilot.path[0];
    const dx = next.x - player.x;
    const dy = next.y - player.y;
    const dist = Math.hypot(dx, dy);
    // The last waypoint is the exact spot (a safe cell's centre, a seed, the
    // gate): arrive within 6px of it, not 14 — a cone's edge does not forgive
    // a 13px shortfall, and the grid's cell centre is what was priced safe.
    const arrive = pilot.path.length === 1 ? 6 : 14;
    if (dist < arrive) {
      pilot.path.shift();
      return { x: 0, y: 0, tiptoe: true, toss };
    }
    const col = Math.floor(next.x / CELL);
    const row = Math.floor(next.y / CELL);
    const myCol = Math.floor(player.x / CELL);
    const myRow = Math.floor(player.y / CELL);
    const nextDanger = cellDanger(world, col, row);
    const myDanger = cellDanger(world, myCol, myRow);
    // Crossing a patrol lane while its warden is near is how runs die: the
    // cone sweeps the crossing mid-step. If a warden is close to the lane
    // ahead, hold in cover until it walks on. Give up after five seconds.
    if (!pilot.waiting && world.alert !== 'hunted' && myDanger < 45 && cellLaneCost(world, col, row) > 0) {
      const nextCenter = cellCenter(col, row);
      let nearest = Infinity;
      for (const guard of world.guards) {
        nearest = Math.min(nearest, Math.hypot(guard.x - nextCenter.x, guard.y - nextCenter.y));
      }
      if (nearest < 300) {
        pilot.waitSteps = (pilot.waitSteps || 0) + 1;
        if (pilot.waitSteps < 600) {
          pilot.replanIn = 0;
          return { x: 0, y: 0, tiptoe: true, toss };
        }
      }
    }
    // Patience: if the next cell is watched and this one is not, hold still
    // and let the cone sweep past instead of walking into it. Give up after
    // about four seconds so a stuck patrol cannot stall the run forever.
    if (!pilot.waiting && world.alert !== 'hunted' && nextDanger >= 45 && myDanger < 45) {
      pilot.waitSteps = (pilot.waitSteps || 0) + 1;
      if (pilot.waitSteps < waitCap) {
        pilot.replanIn = 0;
        return { x: 0, y: 0, tiptoe: true, toss };
      }
    } else {
      pilot.waitSteps = 0;
    }
    // Tiptoe near wardens (footsteps carry 90px; tiptoe only 30) and through
    // watched cells — but never while fleeing, and never once already seen:
    // then speed out matters more than quiet.
    let nearGuard = false;
    for (const guard of world.guards) {
      if (Math.hypot(guard.x - player.x, guard.y - player.y) < 110) { nearGuard = true; break; }
    }
    const tiptoe = world.alert !== 'hunted' && world.meter < 0.3
      && (nearGuard || (nextDanger > 0 && myDanger < 45));
    return { x: dx / dist, y: dy / dist, tiptoe, toss };
  };
  return pilot;
}

// A fixed waypoint walk (used by the alarm shot): move toward each point in
// turn, walking the open stretches and tiptoeing only the final approach.
function makeWaypointWalk(points) {
  let index = 0;
  return function walk(player) {
    if (index >= points.length) return { x: 0, y: 0, tiptoe: true, toss: null };
    const target = points[index];
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) {
      index += 1;
      return { x: 0, y: 0, tiptoe: true, toss: null };
    }
    const lastLeg = index === points.length - 1;
    return { x: dx / dist, y: dy / dist, tiptoe: lastLeg, toss: null };
  };
}

export function runShot(name, seed = 1) {
  if (name === 'start') {
    const world = createWorld(2, seed);
    const fx = createFx(2);
    return { screen: 'title', world, fx, time: 2.0 };
  }
  if (name === 'play') {
    // Freeze the ghost run mid-route: one Moonpetal stolen, the apprentice
    // crossing the bottom corridor, seven wardens' cones sweeping the house.
    const world = createWorld(2, seed);
    const fx = createFx(2);
    const runner = makeGhostRunner(world);
    let steps = 0;
    while (steps < 1600 && !world.caught && !world.won) {
      stepWorld(world, runner.step(), DT);
      applyFxForEvents(world, fx);
      updateFx(fx, DT);
      steps += 1;
    }
    return { screen: 'play', world, fx, time: steps * DT, steps, caught: world.caught };
  }
  if (name === 'alarm') {
    const world = createWorld(1, seed);
    const fx = createFx(1);
    // Walk the quiet left column to the first Moonpetal, then hold on the rim
    // of warden 0's cone until the meter reads a near miss.
    const walk = makeWaypointWalk([
      { x: 80, y: 300 },
      { x: 80, y: 200 },
      { x: 180, y: 180 },
    ]);
    const guard = world.guards[0];
    let steps = 0;
    let staged = false;
    while (steps < 2400 && !world.caught) {
      let input;
      if (!staged) {
        input = walk(world.player);
        if (Math.hypot(world.player.x - 180, world.player.y - 180) < 14) staged = true;
      } else {
        // Hold on the edge of the locked warden's cone: just inside its rim,
        // close enough that the meter climbs, far enough to recover. If the
        // rim point lands inside a wall or hedge, take the other rim.
        let edge = guard.angle + 0.45;
        let hold = { x: guard.x + Math.cos(edge) * 180, y: guard.y + Math.sin(edge) * 180 };
        const blocked = world.blockers.some((rect) => (
          hold.x > rect.x - 16 && hold.x < rect.x + rect.w + 16
          && hold.y > rect.y - 16 && hold.y < rect.y + rect.h + 16
        ));
        if (blocked) {
          edge = guard.angle - 0.45;
          hold = { x: guard.x + Math.cos(edge) * 180, y: guard.y + Math.sin(edge) * 180 };
        }
        const dx = hold.x - world.player.x;
        const dy = hold.y - world.player.y;
        const dist = Math.hypot(dx, dy);
        input = dist < 10
          ? { x: 0, y: 0, tiptoe: true, toss: null }
          : { x: dx / dist, y: dy / dist, tiptoe: false, toss: null };
      }
      stepWorld(world, input, DT);
      applyFxForEvents(world, fx);
      updateFx(fx, DT);
      steps += 1;
      if (staged && world.meter >= 0.7) break;
    }
    return { screen: 'play', world, fx, time: steps * DT, steps, meter: world.meter, caught: world.caught };
  }
  // 'end': a full ghost run of the Orchid Vault, then the win screen.
  const ghost = runGhost(2, seed);
  return { screen: 'win', world: ghost.world, fx: ghost.fx, time: ghost.steps * DT, steps: ghost.steps, won: ghost.won, caught: ghost.caught, timesSpotted: ghost.timesSpotted };
}

// The ghost run: a hand-planned route through the Orchid Vault, one leg at
// a time, each leg waiting for its patrol window before it moves. The legs
// hug the walls and the bottom corridor, where the hedges break every cone;
// the waits are the whole trick — cross a lane only when its warden is
// elsewhere. Same stepWorld rules as a human player, same inputs.
const GHOST_LEGS = [
  { to: { x: 80, y: 200 } },
  { to: { x: 100, y: 180 }, wait: (w) => w.guards[6].x > 450 },
  { to: { x: 180, y: 180 } },
  { to: { x: 80, y: 200 } },
  { to: { x: 80, y: 500 }, wait: (w) => w.guards[2].x > 320 || w.guards[2].y < 500 },
  { to: { x: 80, y: 660 } },
  { to: { x: 700, y: 660 }, wait: (w) => w.guards[3].y < 500 },
  { to: { x: 1180, y: 660 } },
  { to: { x: 1220, y: 200 }, wait: (w) => w.guards[3].y > 500 },
  { to: { x: 1120, y: 180 }, wait: (w) => w.guards[1].x < 1000 },
  { to: { x: 1220, y: 200 } },
  { to: { x: 1220, y: 660 }, wait: (w) => w.guards[3].y > 500 },
  { to: { x: 700, y: 660 }, wait: (w) => w.guards[3].y < 500 },
  { to: { x: 640, y: 620 } },
  { to: { x: 700, y: 660 }, wait: (w) => w.guards[3].y < 500 },
  { to: { x: 1220, y: 668 } },
];

export function makeGhostRunner(world) {
  const runner = { leg: 0, waitSteps: 0 };
  runner.step = function step() {
    if (runner.leg >= GHOST_LEGS.length) return { x: 0, y: 0, tiptoe: true, toss: null };
    const leg = GHOST_LEGS[runner.leg];
    const player = world.player;
    if (leg.wait && !leg.wait(world)) {
      runner.waitSteps += 1;
      if (runner.waitSteps > 900) {
        runner.leg += 1;
        runner.waitSteps = 0;
      }
      return { x: 0, y: 0, tiptoe: true, toss: null };
    }
    runner.waitSteps = 0;
    const dx = leg.to.x - player.x;
    const dy = leg.to.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 10) {
      runner.leg += 1;
      return { x: 0, y: 0, tiptoe: true, toss: null };
    }
    return { x: dx / dist, y: dy / dist, tiptoe: false, toss: null };
  };
  return runner;
}

export function runGhost(levelIndex, seed = 1, maxSteps = 12000) {
  const world = createWorld(levelIndex, seed);
  const fx = createFx(levelIndex);
  const runner = makeGhostRunner(world);
  let steps = 0;
  while (steps < maxSteps && !world.caught && !world.won) {
    stepWorld(world, runner.step(), DT);
    applyFxForEvents(world, fx);
    updateFx(fx, DT);
    steps += 1;
  }
  return { world, fx, steps, won: world.won, caught: world.caught, seeds: world.seedsCollected, timesSpotted: world.timesSpotted, meter: world.meter };
}

export function traceAutopilot(levelIndex, seed = 1, maxSteps = 12000) {
  const world = createWorld(levelIndex, seed);
  const fx = createFx(levelIndex);
  const pilot = makeAutopilot(world);
  const trace = [];
  let steps = 0;
  let lastMeterMark = 0;
  while (steps < maxSteps && !world.caught && !world.won) {
    stepWorld(world, pilot.step(), DT);
    applyFxForEvents(world, fx);
    updateFx(fx, DT);
    steps += 1;
    if (steps % 120 === 0 || world.meter >= 0.3 || world.alert !== 'unseen') {
      trace.push({
        step: steps,
        px: Math.round(world.player.x),
        py: Math.round(world.player.y),
        meter: +world.meter.toFixed(2),
        alert: world.alert,
        seeds: world.seedsCollected,
        pebbles: world.pebbles,
        guards: world.guards.map((g) => [Math.round(g.x), Math.round(g.y), g.state]),
      });
      lastMeterMark = world.meter;
    }
  }
  trace.push({ final: true, steps, won: world.won, caught: world.caught, seeds: world.seedsCollected, timesSpotted: world.timesSpotted });
  return trace;
}
