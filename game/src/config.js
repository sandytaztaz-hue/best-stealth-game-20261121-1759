// config.js — Moonpetal Glasshouse: every tuning number and colour in one place.
// Nothing here touches the DOM; the world, senses and render modules read it.
export const CANVAS_W = 1280;
export const CANVAS_H = 720;
export const HUD_H = 64;
export const FIELD_TOP = 80;
export const FIELD_LEFT = 20;
export const FIELD_RIGHT = 1260;
export const FIELD_BOTTOM = 700;

export const WALK_SPEED = 150;
export const TIPTOE_SPEED = 70;
export const GUARD_PATROL_SPEED = 55;
export const GUARD_INVESTIGATE_SPEED = 72;
export const GUARD_ALERT_SPEED = 96;
export const SENTRY_TURN_SPEED = 0.55;
export const GUARD_PAUSE_SECONDS = 1.2;

export const CONE_ANGLE = (70 * Math.PI) / 180;
export const CONE_RANGE = 230;
export const SENTRY_CONE_RANGE = 180;
export const CONE_EDGE_SAMPLES = 14;

export const DETECT_IN_LIGHT = 1.0;
export const DETECT_IN_SHADOW = 0.5;
export const DETECT_TIPTOE_FACTOR = 0.5;
export const DETECT_DRAIN = 0.4;
export const SUSPICIOUS_AT = 0.35;
export const ALERT_AT = 1.0;

export const NOISE_WALK_RADIUS = 90;
export const NOISE_TIPTOE_RADIUS = 30;
export const STEP_WALK_SECONDS = 0.45;
export const STEP_TIPTOE_SECONDS = 0.7;

export const PEBBLES_PER_LEVEL = 3;
export const PEBBLE_THROW_RANGE = 260;
export const PEBBLE_HEAR_RADIUS = 170;
export const PEBBLE_FLIGHT_SECONDS = 0.4;

export const CAUGHT_DISTANCE = 30;
export const SEED_PICKUP_DISTANCE = 28;
export const PLAYER_RADIUS = 13;
export const GUARD_RADIUS = 14;
export const SEED_RADIUS = 16;

export const NO_SIGHT_SEARCH_SECONDS = 4;
export const SEARCH_LOOK_SECONDS = 3;
export const SUSPICIOUS_WAIT_SECONDS = 1.5;
export const INVESTIGATE_LOOK_SECONDS = 4;

export const COLORS = {
  floor: '#0e1f1a',
  floorTile: '#12261f',
  moss: '#0a1813',
  wallStone: '#9db8c4',
  wallStoneDark: '#6e8894',
  wallGlass: '#b8d2dd',
  hedge: '#1d4a2e',
  hedgeLeaf: '#2f6b41',
  hedgeEdge: '#3f8a55',
  lampPool: '#f5b942',
  cone: '#f5b942',
  coneAlert: '#e74c3c',
  player: '#cfefff',
  playerCloak: '#7fb8c9',
  guardBody: '#1c2436',
  guardTrim: '#c0392b',
  guardLantern: '#ffd27f',
  seed: '#c9a7ff',
  seedCore: '#f2e9ff',
  exitLocked: '#8a97a3',
  exitOpen: '#39d98a',
  hudBar: 'rgba(8, 18, 15, 0.82)',
  hudText: '#dcefe6',
  hudMuted: '#8fa89c',
  amber: '#f5b942',
  red: '#e74c3c',
  green: '#39d98a',
  violet: '#c9a7ff',
  moonbeam: 'rgba(190, 220, 255, 0.05)',
  stainedRose: 'rgba(214, 120, 140, 0.07)',
  stainedTeal: 'rgba(90, 190, 170, 0.07)',
  stainedAmber: 'rgba(245, 185, 66, 0.06)',
};
