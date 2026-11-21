// levels.js — the three glasshouses. Data only: the same world.js code
// runs every level, so a new house is just a new entry in this list.
// Canvas is 1280x720; the HUD overlays the top 64 px, so every gameplay
// object sits below y=80 and inside x=20..1260, y=80..700.
// A rect is [x, y, width, height]; a point is [x, y].

const BORDER = 16;
const W = 1280;
const H = 720;

function borderWalls() {
  return [
    [0, 0, W, BORDER], // top
    [0, H - BORDER, W, BORDER], // bottom
    [0, 0, BORDER, H], // left
    [W - BORDER, 0, BORDER, H], // right
  ];
}

export const LEVELS = [
  {
    id: 1,
    name: 'The Potting Shed',
    walls: [...borderWalls(), [480, 180, 24, 240]],
    hedges: [
      [180, 300, 180, 48],
      [820, 300, 180, 48],
    ],
    lamps: [
      { x: 640, y: 360, r: 110 },
      { x: 200, y: 560, r: 110 },
    ],
    seeds: [
      [180, 180],
      [1120, 480],
      [640, 620],
    ],
    exit: [1180, 640, 80, 56],
    playerStart: [80, 640],
    guards: [
      { waypoints: [[360, 200], [360, 500]] },
      { waypoints: [[900, 200], [900, 500]] },
    ],
  },
  {
    id: 2,
    name: 'The Fern House',
    walls: [
      ...borderWalls(),
      [300, 180, 24, 240], // vertical glass wall
      [700, 120, 24, 200],
      [980, 380, 24, 220],
      [420, 480, 320, 24], // horizontal glass wall
    ],
    hedges: [
      [120, 300, 180, 48],
      [480, 140, 160, 48],
      [820, 300, 180, 48],
      [180, 560, 160, 48],
      [900, 560, 160, 48],
      [560, 360, 120, 48],
    ],
    lamps: [
      { x: 640, y: 240, r: 110 },
      { x: 200, y: 480, r: 110 },
      { x: 1080, y: 200, r: 110 },
      { x: 760, y: 600, r: 110 },
    ],
    seeds: [
      [180, 180],
      [1120, 480],
      [640, 620],
    ],
    exit: [1180, 640, 80, 56],
    playerStart: [80, 640],
    guards: [
      { waypoints: [[360, 140], [360, 420], [640, 420], [640, 140]] },
      { waypoints: [[900, 140], [900, 420], [1120, 420], [1120, 140]] },
      { waypoints: [[200, 300], [560, 300], [560, 560], [200, 560]] },
      { waypoints: [[760, 300], [1120, 300], [1120, 620], [760, 620]] },
    ],
  },
  {
    id: 3,
    name: 'The Orchid Vault',
    walls: [
      ...borderWalls(),
      [300, 180, 24, 240],
      [700, 120, 24, 200],
      [980, 380, 24, 220],
      [420, 480, 320, 24],
    ],
    hedges: [
      [120, 300, 180, 48],
      [480, 140, 160, 48],
      [820, 300, 180, 48],
      [180, 560, 160, 48],
      [900, 560, 160, 48],
      [560, 360, 120, 48],
    ],
    lamps: [
      { x: 640, y: 240, r: 110 },
      { x: 200, y: 480, r: 110 },
      { x: 1080, y: 200, r: 110 },
      { x: 760, y: 600, r: 110 },
      { x: 420, y: 300, r: 110 },
      { x: 1000, y: 520, r: 110 },
    ],
    seeds: [
      [180, 180],
      [1120, 180],
      [640, 620],
    ],
    exit: [1180, 640, 80, 56],
    playerStart: [80, 640],
    guards: [
      { waypoints: [[360, 140], [360, 420], [640, 420], [640, 140]] },
      { waypoints: [[900, 140], [900, 420], [1120, 420], [1120, 140]] },
      { waypoints: [[200, 300], [560, 300], [560, 560], [200, 560]] },
      { waypoints: [[760, 300], [1120, 300], [1120, 620], [760, 620]] },
      { waypoints: [[480, 140], [820, 140], [820, 560], [480, 560]] },
      { waypoints: [[120, 420], [640, 420], [640, 180], [120, 180]] },
    ],
  },
];

export function levelByIndex(index) {
  return LEVELS[index] || null;
}

// Every rect that blocks movement and line of sight: walls plus hedges.
export function blockingRects(level) {
  return [...level.walls, ...level.hedges];
}
