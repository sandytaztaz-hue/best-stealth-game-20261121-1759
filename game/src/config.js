// config.js — tuning numbers and colours for Moonpetal Glasshouse.
// One job: hold every constant the game balances on, so world.js and
// render.js never hard-code a number that play-testing may need to move.
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;
export const HUD_HEIGHT = 64;

// Movement (px per second).
export const WALK_SPEED = 150;
export const TIPTOE_SPEED = 70;
export const GUARD_PATROL_SPEED = 55;
export const GUARD_INVESTIGATE_SPEED = 95;
export const GUARD_CHASE_SPEED = 130;

// Vision cones: 70 degrees total, 230 px range.
export const CONE_HALF_ANGLE = (35 * Math.PI) / 180;
export const CONE_RANGE = 230;
export const CONE_RAYS = 14;

// Detection meter 0..1.
export const DETECT_RATE_LIT = 1.0; // per second, player standing in lamp light
export const DETECT_RATE_SHADOW = 0.5; // per second, player in shadow
export const DETECT_TIPTOE_MULT = 0.5; // tiptoeing halves the rise
export const DETECT_DRAIN_RATE = 0.4; // per second while no guard sees you
export const SUSPICIOUS_AT = 0.35; // meter level that makes guards suspicious
export const ALERTED_AT = 1.0; // meter level that raises the alarm
export const CAUGHT_DISTANCE = 30; // px: an alerted guard this close catches you
export const LOSE_SIGHT_SECONDS = 4; // unseen for this long -> guards give up the chase
export const SEARCH_SECONDS = 3; // guards check the last seen spot this long

// Noise.
export const WALK_NOISE_RADIUS = 90;
export const TIPTOE_NOISE_RADIUS = 30;
export const WALK_STEP_INTERVAL = 0.45; // seconds between footsteps while walking
export const TIPTOE_STEP_INTERVAL = 0.7; // seconds between footsteps while tiptoeing
export const PEBBLE_COUNT = 3; // pebbles per level, refilled each level
export const PEBBLE_MAX_RANGE = 260; // px from the player
export const PEBBLE_NOISE_RADIUS = 170; // px guards hear the landing ping
export const PEBBLE_ARC_SECONDS = 0.4; // flight time of the tossed pebble

// Guard behaviour.
export const WAYPOINT_PAUSE = 1.2; // seconds a guard waits at each waypoint
export const SUSPICIOUS_WAIT = 1.5; // seconds a guard stares before investigating
export const INVESTIGATE_TIMEOUT = 4; // seconds with nothing found -> back to patrol

// Player and guard sizes.
export const PLAYER_RADIUS = 13;
export const GUARD_RADIUS = 14;
export const SEED_RADIUS = 12;
export const SEED_PICKUP_RADIUS = 30;
export const PLAYER_START_RADIUS = 13;

// Lamp light radius used by every level.
export const LAMP_RADIUS = 110;
export const FIREFLY_COUNT = 26; // drifting motes that make the garden feel alive

// Colours.
export const COLORS = {
  floor: '#0e1f1a',
  floorTile: '#12261f',
  moss: '#0a1a14',
  wallFace: '#33414a',
  wallGlass: '#9db8c4',
  wallEdge: '#6d8a97',
  hedge: '#1d4a2e',
  hedgeLeaf: '#2e6b3f',
  hedgeLeafLight: '#4c8a55',
  lampPool: 'rgba(245,185,66,0.30)',
  lampCore: '#f5b942',
  cone: 'rgba(245,185,66,0.26)',
  coneSuspicious: 'rgba(245,166,66,0.40)',
  coneAlerted: 'rgba(220,60,50,0.42)',
  player: '#cfefff',
  playerCloak: '#7fa8b8',
  guardBody: '#1c2436',
  guardTrim: '#c0392b',
  guardLantern: '#ffd27a',
  seed: '#c9a7ff',
  seedHalo: 'rgba(201,167,255,0.35)',
  exitLocked: '#5a6b72',
  exitOpen: '#39d98a',
  exitGlow: 'rgba(57,217,138,0.45)',
  hudBar: 'rgba(6,14,11,0.78)',
  hudText: '#dcefe6',
  hudMuted: '#8fb3a4',
  alertUnseen: '#39d98a',
  alertSuspicious: '#f5b942',
  alertHunted: '#e74c3c',
  meterGreen: '#39d98a',
  meterAmber: '#f5b942',
  meterRed: '#e74c3c',
  titleGlow: 'rgba(201,167,255,0.25)',
  vignetteRed: 'rgba(180,20,20,0.55)',
};
