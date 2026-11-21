// levels.js — the three glasshouses. Same code, different data.
// Canvas 1280x720; the HUD overlays the top 64px, so every gameplay object
// sits below y=80 and inside x=20..1260, y=80..700.
// Guards come in two kinds: 'patrol' wardens who walk a waypoint loop, and
// 'sentry' wardens who stand at a brass post and sweep a slow 360-degree cone.
function borderWalls() {
  return [
    { x: 0, y: 0, w: 1280, h: 16 },
    { x: 0, y: 704, w: 1280, h: 16 },
    { x: 0, y: 0, w: 16, h: 720 },
    { x: 1264, y: 0, w: 16, h: 720 },
  ];
}

const L1_GUARDS = [
  { type: 'patrol', waypoints: [[360, 200], [360, 500]] },
  { type: 'patrol', waypoints: [[900, 200], [900, 500]] },
];

const L2_WALLS = [
  { x: 300, y: 180, w: 24, h: 240 },
  { x: 700, y: 120, w: 24, h: 200 },
  { x: 980, y: 380, w: 24, h: 220 },
  { x: 420, y: 480, w: 320, h: 24 },
];

const L2_HEDGES = [
  { x: 120, y: 300, w: 180, h: 48 },
  { x: 480, y: 140, w: 160, h: 48 },
  { x: 820, y: 300, w: 180, h: 48 },
  { x: 180, y: 560, w: 160, h: 48 },
  { x: 900, y: 560, w: 160, h: 48 },
  { x: 560, y: 360, w: 120, h: 48 },
];

const L2_LAMPS = [
  { x: 640, y: 240, r: 110 },
  { x: 200, y: 480, r: 110 },
  { x: 1080, y: 200, r: 110 },
  { x: 760, y: 600, r: 110 },
];

const L2_GUARDS = [
  { type: 'patrol', waypoints: [[360, 140], [360, 420], [640, 420], [640, 140]] },
  { type: 'patrol', waypoints: [[900, 140], [900, 420], [1120, 420], [1120, 140]] },
  { type: 'patrol', waypoints: [[200, 300], [560, 300], [560, 560], [200, 560]] },
  { type: 'patrol', waypoints: [[760, 300], [1120, 300], [1120, 620], [760, 620]] },
  { type: 'sentry', x: 640, y: 300, angle: -Math.PI / 2 },
];

// Level 3 is the Fern House again, plus two more patrol wardens, two more
// lamps, and a second sentry watching the exit approach.
const L3_GUARDS = L2_GUARDS.concat([
  { type: 'patrol', waypoints: [[480, 140], [820, 140], [820, 560], [480, 560]] },
  { type: 'patrol', waypoints: [[120, 420], [640, 420], [640, 180], [120, 180]] },
]);

const L3_LAMPS = L2_LAMPS.concat([
  { x: 420, y: 300, r: 110 },
  { x: 1000, y: 520, r: 110 },
]);

export const LEVELS = [
  {
    name: 'The Potting Shed',
    house: 'House 1 of 3',
    blurb: 'Learn the cones. Learn the hedges.',
    walls: borderWalls().concat([{ x: 480, y: 180, w: 24, h: 240 }]),
    hedges: [
      { x: 180, y: 300, w: 180, h: 48 },
      { x: 820, y: 300, w: 180, h: 48 },
    ],
    lamps: [
      { x: 640, y: 360, r: 110 },
      { x: 200, y: 560, r: 110 },
    ],
    guards: L1_GUARDS,
    seeds: [{ x: 180, y: 180 }, { x: 1120, y: 480 }, { x: 640, y: 620 }],
    exit: { x: 1180, y: 640, w: 80, h: 56 },
    start: { x: 80, y: 640 },
  },
  {
    name: 'The Fern House',
    house: 'House 2 of 3',
    blurb: 'Four wardens and a sweeping sentry.',
    walls: borderWalls().concat(L2_WALLS),
    hedges: L2_HEDGES,
    lamps: L2_LAMPS,
    guards: L2_GUARDS,
    seeds: [{ x: 180, y: 180 }, { x: 1120, y: 480 }, { x: 640, y: 620 }],
    exit: { x: 1180, y: 640, w: 80, h: 56 },
    start: { x: 80, y: 640 },
  },
  {
    name: 'The Orchid Vault',
    house: 'House 3 of 3',
    blurb: 'Six wardens, two sentries, no easy way in.',
    walls: borderWalls().concat(L2_WALLS),
    hedges: L2_HEDGES,
    lamps: L3_LAMPS,
    guards: L3_GUARDS,
    seeds: [{ x: 180, y: 180 }, { x: 1120, y: 180 }, { x: 640, y: 620 }],
    exit: { x: 1180, y: 640, w: 80, h: 56 },
    start: { x: 80, y: 640 },
  },
];

export function levelBlockers(level) {
  return level.walls.concat(level.hedges);
}

export function guardCount(level) {
  return level.guards.length;
}
