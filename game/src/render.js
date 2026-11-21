// render.js — everything the eye sees. Canvas vector art only: no images,
// no fonts from the network, no libraries. The look is a Victorian glasshouse
// at night: dark blue-green floor, pale stone-and-glass walls, leafy hedges,
// warm lamp pools, amber vision cones, a pale hooded apprentice, violet
// Moonpetals, and a stone exit gate that glows green when it opens.
import { CANVAS_W, CANVAS_H, HUD_H, COLORS, CONE_RANGE } from './config.js';
import { conePolygon, playerInLampLight } from './senses.js';
import { alertWord, exitUnlocked } from './world.js';
import { makeRng, range } from './random.js';

const decorCache = {};

function levelDecor(levelIndex) {
  if (decorCache[levelIndex]) return decorCache[levelIndex];
  const rng = makeRng(4000 + levelIndex * 101);
  const moss = [];
  for (let i = 0; i < 46; i++) {
    moss.push({ x: range(rng, 30, CANVAS_W - 30), y: range(rng, 90, CANVAS_H - 30), r: range(rng, 14, 46) });
  }
  const leaves = [];
  for (let i = 0; i < 240; i++) {
    leaves.push({ x: range(rng, 0, 1), y: range(rng, 0, 1), r: range(rng, 1.5, 3.5) });
  }
  const decor = { moss, leaves };
  decorCache[levelIndex] = decor;
  return decor;
}

function drawFloor(ctx, world) {
  ctx.fillStyle = COLORS.floor;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.strokeStyle = COLORS.floorTile;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= CANVAS_W; x += 80) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_H);
  }
  for (let y = 0; y <= CANVAS_H; y += 80) {
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_W, y);
  }
  ctx.stroke();
  const decor = levelDecor(world.levelIndex);
  ctx.fillStyle = COLORS.moss;
  for (const patch of decor.moss) {
    ctx.beginPath();
    ctx.ellipse(patch.x, patch.y, patch.r, patch.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Stained-glass washes: soft colour where the moon falls through the roof.
  ctx.fillStyle = COLORS.stainedRose;
  ctx.fillRect(120, 120, 300, 200);
  ctx.fillStyle = COLORS.stainedTeal;
  ctx.fillRect(760, 120, 320, 220);
  ctx.fillStyle = COLORS.stainedAmber;
  ctx.fillRect(420, 480, 360, 180);
  // Moonbeams: slow diagonal shafts from the glass roof.
  ctx.save();
  ctx.fillStyle = COLORS.moonbeam;
  for (let i = 0; i < 3; i++) {
    const x0 = 260 + i * 380;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0 + 190, 0);
    ctx.lineTo(x0 + 60, CANVAS_H);
    ctx.lineTo(x0 - 130, CANVAS_H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawLampPools(ctx, world) {
  for (const lamp of world.level.lamps) {
    const gradient = ctx.createRadialGradient(lamp.x, lamp.y, 8, lamp.x, lamp.y, lamp.r);
    gradient.addColorStop(0, 'rgba(245, 185, 66, 0.34)');
    gradient.addColorStop(0.7, 'rgba(245, 185, 66, 0.14)');
    gradient.addColorStop(1, 'rgba(245, 185, 66, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, lamp.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2c12';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.lampPool;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPatrolRoutes(ctx, world) {
  ctx.save();
  ctx.setLineDash([2, 9]);
  ctx.lineWidth = 2;
  for (const guard of world.guards) {
    if (guard.type !== 'patrol') continue;
    ctx.strokeStyle = 'rgba(220, 239, 230, 0.20)';
    ctx.beginPath();
    const points = guard.waypoints;
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.stroke();
    for (const [x, y] of points) {
      ctx.fillStyle = 'rgba(220, 239, 230, 0.28)';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawWalls(ctx, world) {
  for (const wall of world.level.walls) {
    ctx.fillStyle = COLORS.wallStone;
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = COLORS.wallGlass;
    if (wall.w >= wall.h) {
      ctx.fillRect(wall.x + 4, wall.y + 3, wall.w - 8, Math.max(2, wall.h - 6));
    } else {
      ctx.fillRect(wall.x + 3, wall.y + 4, Math.max(2, wall.w - 6), wall.h - 8);
    }
    ctx.strokeStyle = COLORS.wallStoneDark;
    ctx.lineWidth = 1;
    ctx.strokeRect(wall.x + 0.5, wall.y + 0.5, wall.w - 1, wall.h - 1);
  }
}

function drawHedges(ctx, world) {
  const decor = levelDecor(world.levelIndex);
  for (const hedge of world.level.hedges) {
    ctx.fillStyle = COLORS.hedge;
    ctx.fillRect(hedge.x, hedge.y, hedge.w, hedge.h);
    ctx.fillStyle = COLORS.hedgeLeaf;
    for (let i = 0; i < 14; i++) {
      const leaf = decor.leaves[(hedge.x + hedge.y + i * 31) % decor.leaves.length];
      ctx.beginPath();
      ctx.arc(hedge.x + leaf.x * hedge.w, hedge.y + leaf.y * hedge.h, leaf.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = COLORS.hedgeEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(hedge.x + 1, hedge.y + 1, hedge.w - 2, hedge.h - 2);
  }
}

function drawSeeds(ctx, world, time) {
  for (const seed of world.seeds) {
    if (seed.taken) continue;
    const pulse = 0.75 + 0.25 * Math.sin(time * 3 + seed.x * 0.01);
    const glow = ctx.createRadialGradient(seed.x, seed.y, 2, seed.x, seed.y, 34);
    glow.addColorStop(0, `rgba(201, 167, 255, ${0.5 * pulse})`);
    glow.addColorStop(1, 'rgba(201, 167, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(seed.x, seed.y, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.seed;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(seed.x + Math.cos(a) * 8, seed.y + Math.sin(a) * 8, 6, 3.5, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = COLORS.seedCore;
    ctx.beginPath();
    ctx.arc(seed.x, seed.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExitGate(ctx, world, time) {
  const exit = world.level.exit;
  const open = exitUnlocked(world);
  const cx = exit.x + exit.w / 2;
  const cy = exit.y + exit.h / 2;
  if (open) {
    const pulse = 0.55 + 0.3 * Math.sin(time * 2.4);
    const glow = ctx.createRadialGradient(cx, cy, 6, cx, cy, 90);
    glow.addColorStop(0, `rgba(57, 217, 138, ${pulse})`);
    glow.addColorStop(1, 'rgba(57, 217, 138, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 90, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = open ? COLORS.exitOpen : COLORS.exitLocked;
  ctx.beginPath();
  ctx.arc(cx, exit.y + exit.h, 44, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0e1f1a';
  ctx.beginPath();
  ctx.arc(cx, exit.y + exit.h, 32, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = open ? COLORS.exitOpen : '#5a666f';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(open ? 'EXIT OPEN' : 'EXIT', cx, exit.y + exit.h - 14);
  ctx.fillStyle = open ? COLORS.exitOpen : COLORS.exitLocked;
  ctx.fillRect(exit.x, exit.y + exit.h - 4, exit.w, 4);
}

function drawCones(ctx, world) {
  for (const guard of world.guards) {
    const polygon = conePolygon(guard, world.blockers);
    const alerted = guard.state === 'alerted';
    ctx.fillStyle = alerted ? 'rgba(231, 76, 60, 0.30)' : 'rgba(245, 185, 66, 0.26)';
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < polygon.length; i++) ctx.lineTo(polygon[i].x, polygon[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = alerted ? 'rgba(231, 76, 60, 0.45)' : 'rgba(245, 185, 66, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawGuard(ctx, guard, time) {
  const bob = Math.sin(time * 4 + guard.id * 2) * 1.5;
  if (guard.type === 'sentry') {
    ctx.fillStyle = '#8a6d3b';
    ctx.fillRect(guard.x - 4, guard.y - 4, 8, 8);
    ctx.strokeStyle = '#d9b36a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    const lx = guard.x + Math.cos(guard.angle) * 15;
    const ly = guard.y + Math.sin(guard.angle) * 15;
    ctx.fillStyle = COLORS.guardLantern;
    ctx.beginPath();
    ctx.arc(lx, ly, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.guardBody;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = COLORS.guardBody;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y + bob * 0.4, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.guardTrim;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y + bob * 0.4, 14, 0, Math.PI * 2);
    ctx.stroke();
    const lx = guard.x + Math.cos(guard.angle) * 17;
    const ly = guard.y + Math.sin(guard.angle) * 17 + bob * 0.4;
    ctx.fillStyle = COLORS.guardLantern;
    ctx.beginPath();
    ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8eef2';
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(guard.angle) * 5, guard.y + Math.sin(guard.angle) * 5 + bob * 0.4, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (guard.state === 'suspicious') {
    ctx.fillStyle = COLORS.amber;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('?', guard.x, guard.y - 20);
  } else if (guard.state === 'alerted') {
    ctx.fillStyle = COLORS.red;
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('!', guard.x, guard.y - 20);
  }
}

function drawLastSeenGhost(ctx, world) {
  if (!world.lastSeen || world.alert !== 'hunted') return;
  const ghost = world.lastSeen;
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = COLORS.player;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ghost.x, ghost.y, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = COLORS.amber;
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('?', ghost.x, ghost.y - 18);
  ctx.restore();
}

function drawPlayer(ctx, world, time) {
  const player = world.player;
  const crouched = player.tiptoe;
  const scale = crouched ? 0.82 : 1;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.scale(scale, scale);
  ctx.fillStyle = COLORS.playerCloak;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(11, 10);
  ctx.lineTo(-11, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(0, -6, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0e1f1a';
  ctx.beginPath();
  ctx.arc(Math.cos(player.angle) * 3, -6 + Math.sin(player.angle) * 3, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (world.hidden && world.alert !== 'hunted') {
    ctx.fillStyle = 'rgba(8, 18, 15, 0.85)';
    const label = 'HIDDEN';
    ctx.font = 'bold 11px sans-serif';
    const w = ctx.measureText(label).width + 12;
    ctx.fillRect(player.x - w / 2, player.y - 40, w, 16);
    ctx.fillStyle = '#7fe0b2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, player.x, player.y - 32);
  }
  if (world.pebble) {
    const pebble = world.pebble;
    const t = pebble.t / pebble.dur;
    const x = pebble.sx + (pebble.tx - pebble.sx) * t;
    const y = pebble.sy + (pebble.ty - pebble.sy) * t - Math.sin(t * Math.PI) * 34;
    ctx.strokeStyle = 'rgba(220, 239, 230, 0.5)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(pebble.sx, pebble.sy);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#cfd8dc';
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFxLayer(ctx, fx) {
  for (const ring of fx.rings) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ring.life) * (ring.quiet ? 0.35 : 0.7);
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  for (const puff of fx.puffs) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, puff.life) * 0.5;
    ctx.fillStyle = '#cfd8dc';
    ctx.beginPath();
    ctx.arc(puff.x, puff.y, puff.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const spark of fx.sparks) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, spark.life);
    ctx.fillStyle = spark.color;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const fly of fx.fireflies) {
    const twinkle = 0.35 + 0.35 * Math.sin(fx.time * 2 + fly.phase * 3);
    ctx.save();
    ctx.globalAlpha = Math.max(0.1, twinkle);
    ctx.fillStyle = '#d8f7a0';
    ctx.beginPath();
    ctx.arc(fly.x, fly.y, fly.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// The field itself: floor, routes, lamps, cover, exit, cones, seeds, ghosts,
// wardens, player, effects — in that order, so cones wash over the floor and
// the player stays on top of everything.
export function renderGame(ctx, world, fx, time) {
  drawFloor(ctx, world);
  drawLampPools(ctx, world);
  drawPatrolRoutes(ctx, world);
  drawWalls(ctx, world);
  drawHedges(ctx, world);
  drawExitGate(ctx, world, time);
  drawSeeds(ctx, world, time);
  drawCones(ctx, world);
  drawLastSeenGhost(ctx, world);
  for (const guard of world.guards) drawGuard(ctx, guard, time);
  drawPlayer(ctx, world, time);
  drawFxLayer(ctx, fx);
  if (world.alert === 'hunted') {
    const pulse = 0.10 + 0.06 * Math.sin(time * 5);
    const gradient = ctx.createRadialGradient(640, 360, 260, 640, 360, 720);
    gradient.addColorStop(0, 'rgba(231, 76, 60, 0)');
    gradient.addColorStop(1, `rgba(231, 76, 60, ${pulse})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
}

export function renderHud(ctx, world, hintSecondsLeft) {
  ctx.fillStyle = COLORS.hudBar;
  ctx.fillRect(0, 0, CANVAS_W, HUD_H);
  ctx.fillStyle = COLORS.hudText;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Moonpetal Glasshouse', 18, 22);
  ctx.fillStyle = COLORS.hudMuted;
  ctx.font = '14px sans-serif';
  ctx.fillText(`${world.level.house} — ${world.level.name}`, 18, 45);
  // Centre: seeds, detection meter, pebbles.
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Seeds ${world.seedsCollected} / ${world.seeds.length}`, 640, 20);
  for (let i = 0; i < world.seeds.length; i++) {
    const x = 600 + i * 26;
    ctx.fillStyle = i < world.seedsCollected ? COLORS.seed : '#3a4a44';
    ctx.beginPath();
    ctx.ellipse(x, 40, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const meterX = 700;
  const meterY = 34;
  // Drawn eye icon (no emoji glyphs — headless fonts may lack them).
  ctx.fillStyle = COLORS.hudText;
  ctx.beginPath();
  ctx.ellipse(meterX + 8, meterY, 9, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0e1f1a';
  ctx.beginPath();
  ctx.arc(meterX + 8, meterY, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#243530';
  ctx.fillRect(meterX + 22, meterY - 6, 120, 12);
  const meterColor = world.meter < 0.35 ? COLORS.green : world.meter < 0.7 ? COLORS.amber : COLORS.red;
  ctx.fillStyle = meterColor;
  ctx.fillRect(meterX + 22, meterY - 6, 120 * world.meter, 12);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(world.meter * 100)}%`, meterX + 160, meterY + 1);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '13px sans-serif';
  ctx.fillText('●'.repeat(world.pebbles) + '○'.repeat(Math.max(0, 3 - world.pebbles)), 640, 56);
  // Right: alert word + keys.
  const word = alertWord(world);
  ctx.fillStyle = word === 'Hunted' ? COLORS.red : word === 'Suspicious' ? COLORS.amber : word === 'Hidden' ? '#7fe0b2' : COLORS.green;
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(word.toUpperCase(), CANVAS_W - 18, 22);
  ctx.fillStyle = COLORS.hudMuted;
  ctx.font = '13px sans-serif';
  ctx.fillText('M mute · R restart', CANVAS_W - 18, 45);
  if (hintSecondsLeft > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, hintSecondsLeft);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('WASD move · Shift tiptoe · Click toss a pebble · stay out of the lantern cones', 18, CANVAS_H - 18);
    ctx.restore();
  }
  // Lamp-light warning: standing in a pool makes the meter rise twice as fast.
  if (playerInLampLight(world.level, world.player.x, world.player.y)) {
    ctx.fillStyle = COLORS.amber;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('IN THE LIGHT — seen twice as fast', 18, CANVAS_H - 40);
  }
}

function dimGarden(ctx) {
  ctx.fillStyle = 'rgba(6, 14, 11, 0.72)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawMoon(ctx, x, y, r) {
  const glow = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 2.4);
  glow.addColorStop(0, 'rgba(230, 240, 255, 0.5)');
  glow.addColorStop(1, 'rgba(230, 240, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e9f1ff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(180, 200, 220, 0.5)';
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.18, 0, Math.PI * 2);
  ctx.arc(x + r * 0.25, y + r * 0.3, r * 0.13, 0, Math.PI * 2);
  ctx.fill();
}

export function renderTitle(ctx, world, fx, time, best) {
  renderGame(ctx, world, fx, time);
  dimGarden(ctx);
  drawMoon(ctx, 1060, 150, 52);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2e9ff';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText('Moonpetal Glasshouse', 640, 250);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '20px Georgia, serif';
  ctx.fillText('Three Moonpetals were stolen from the glasshouse.', 640, 300);
  ctx.fillText('Slip in, steal them back, and leave unseen.', 640, 330);
  ctx.fillStyle = COLORS.hudMuted;
  ctx.font = '17px sans-serif';
  ctx.fillText('WASD / arrows — move      Shift — tiptoe, quiet and slow', 640, 400);
  ctx.fillText('Click — toss a pebble to lure a warden      M — mute      R — restart', 640, 428);
  ctx.fillStyle = COLORS.amber;
  ctx.font = '16px sans-serif';
  ctx.fillText('Lamp light doubles how fast you are spotted. Hedges block every cone.', 640, 462);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Click or press Enter to start', 640, 530);
  ctx.fillStyle = COLORS.hudMuted;
  ctx.font = '15px sans-serif';
  ctx.fillText(best ? `Best escape: ${best}` : 'No escape yet — the glasshouse waits.', 640, 566);
}

export function renderLevelClear(ctx, world, time, rating) {
  dimGarden(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.green;
  ctx.font = 'bold 52px Georgia, serif';
  ctx.fillText('Level clear — unseen.', 640, 300);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '20px sans-serif';
  ctx.fillText(`${world.level.name} in ${world.time.toFixed(1)}s · ${rating}`, 640, 350);
  ctx.fillStyle = COLORS.hudMuted;
  ctx.font = '18px sans-serif';
  ctx.fillText('Press Enter for the next house', 640, 400);
}

export function renderWin(ctx, world, totalTime, rating, timesSpotted) {
  dimGarden(ctx);
  drawMoon(ctx, 640, 150, 44);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2e9ff';
  ctx.font = 'bold 48px Georgia, serif';
  ctx.fillText('Unseen. The glasshouse keeps its secret.', 640, 300);
  ctx.fillStyle = COLORS.green;
  ctx.font = 'bold 30px Georgia, serif';
  ctx.fillText(`Rating: ${rating}`, 640, 360);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '20px sans-serif';
  ctx.fillText(`All 9 Moonpetals home in ${totalTime.toFixed(1)}s · spotted ${timesSpotted} time${timesSpotted === 1 ? '' : 's'}`, 640, 405);
  ctx.fillStyle = COLORS.hudMuted;
  ctx.font = '18px sans-serif';
  ctx.fillText('Press R to play again', 640, 450);
}

export function renderCaught(ctx) {
  ctx.fillStyle = 'rgba(120, 10, 10, 0.45)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd9d9';
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillText('Caught!', 640, 320);
  ctx.fillStyle = '#f2e9ff';
  ctx.font = '20px sans-serif';
  ctx.fillText('The wardens found you — press R to try again', 640, 365);
}

// The ghost rating: never spotted at all is a GHOST; spotted once, a SHADOW.
export function ghostRating(timesSpotted) {
  if (timesSpotted === 0) return 'GHOST — never seen';
  if (timesSpotted === 1) return 'SHADOW — seen once';
  return `SEEN — spotted ${timesSpotted} times`;
}
