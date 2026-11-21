// render.js — draws everything on the canvas: floor, walls, hedges, lamp
// pools, occluded vision cones, guards, the hooded player, seeds, the
// exit gate, noise rings, the HUD and every screen. It only reads the
// world; it never changes it.
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT, CONE_RANGE } from './config.js';
import { conePolygon, playerInLampLight } from './world.js';

// --- small drawing helpers --------------------------------------------------

function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function rect(ctx, x, y, w, h, fill) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

function petalIcon(ctx, x, y, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    ctx.ellipse(px, py, r * 0.62, r * 0.32, a, 0, Math.PI * 2);
  }
  ctx.fillStyle = filled ? COLORS.seed : 'rgba(201,167,255,0.22)';
  ctx.fill();
  circle(ctx, x, y, r * 0.34, filled ? '#efe6ff' : 'rgba(220,200,255,0.25)');
}

// --- the garden -------------------------------------------------------------

function drawFloor(ctx, world) {
  rect(ctx, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, COLORS.floor);
  // Subtle tile grid.
  ctx.strokeStyle = COLORS.floorTile;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= CANVAS_WIDTH; x += 80) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_HEIGHT);
  }
  for (let y = 0; y <= CANVAS_HEIGHT; y += 80) {
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
  }
  ctx.stroke();
  // Darker moss patches (seeded, so they never jump between frames).
  for (const m of world.moss) {
    circle(ctx, m.x, m.y, m.r, `rgba(6,20,14,${m.a})`);
  }
  // Stone path from the start corner toward the middle of the garden.
  ctx.strokeStyle = 'rgba(157,184,196,0.16)';
  ctx.lineWidth = 26;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(80, 640);
  ctx.lineTo(240, 560);
  ctx.lineTo(420, 560);
  ctx.lineTo(640, 420);
  ctx.stroke();
  ctx.lineWidth = 1;
}

function drawLampPools(ctx, world) {
  for (const lamp of world.level.lamps) {
    const grad = ctx.createRadialGradient(lamp.x, lamp.y, 6, lamp.x, lamp.y, lamp.r);
    grad.addColorStop(0, 'rgba(245,185,66,0.42)');
    grad.addColorStop(0.55, 'rgba(245,185,66,0.20)');
    grad.addColorStop(1, 'rgba(245,185,66,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, lamp.r, 0, Math.PI * 2);
    ctx.fill();
    // The lamp post itself: a small brass post with a glowing head.
    ctx.fillStyle = '#3a2f1c';
    ctx.fillRect(lamp.x - 3, lamp.y - 3, 6, 6);
    circle(ctx, lamp.x, lamp.y, 5, COLORS.lampCore);
    circle(ctx, lamp.x, lamp.y, 9, 'rgba(245,185,66,0.35)');
  }
}

function drawWalls(ctx, world) {
  for (const [x, y, w, h] of world.level.walls) {
    rect(ctx, x, y, w, h, COLORS.wallFace);
    ctx.strokeStyle = COLORS.wallGlass;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    // Glass-pane divisions along the longer side.
    ctx.strokeStyle = 'rgba(157,184,196,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (w >= h) {
      for (let px = x + 40; px < x + w - 8; px += 40) {
        ctx.moveTo(px, y + 3);
        ctx.lineTo(px, y + h - 3);
      }
    } else {
      for (let py = y + 40; py < y + h - 8; py += 40) {
        ctx.moveTo(x + 3, py);
        ctx.lineTo(x + w - 3, py);
      }
    }
    ctx.stroke();
    ctx.lineWidth = 1;
  }
}

function drawHedges(ctx, world) {
  for (const [x, y, w, h] of world.level.hedges) {
    // Dark leafy body with a pale rim so cover reads at a glance.
    rect(ctx, x, y, w, h, COLORS.hedge);
    ctx.strokeStyle = COLORS.hedgeLeafLight;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    // Leaf dots: two greens, seeded positions from the rect itself.
    const n = Math.floor((w * h) / 90);
    for (let i = 0; i < n; i += 1) {
      const lx = x + 6 + ((i * 37) % (w - 12));
      const ly = y + 6 + ((i * 53) % (h - 12));
      circle(ctx, lx, ly, 3.2, i % 3 === 0 ? COLORS.hedgeLeafLight : COLORS.hedgeLeaf);
    }
    // A few tiny violet buds so hedges feel like garden, not blocks.
    for (let i = 0; i < 3; i += 1) {
      const bx = x + 14 + ((i * 61) % (w - 28));
      const by = y + 12 + ((i * 29) % (h - 24));
      circle(ctx, bx, by, 2, '#8a6fd6');
    }
  }
}

function drawCones(ctx, world) {
  for (const guard of world.guards) {
    const poly = conePolygon(world, guard);
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i += 1) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    const fill =
      guard.state === 'alerted'
        ? COLORS.coneAlerted
        : guard.state === 'suspicious' || guard.state === 'search'
          ? COLORS.coneSuspicious
          : COLORS.cone;
    ctx.fillStyle = fill;
    ctx.fill();
    // A brighter rim along the cone's edge so its sweep is obvious.
    ctx.strokeStyle = guard.state === 'alerted' ? 'rgba(231,76,60,0.7)' : 'rgba(245,185,66,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineWidth = 1;
  }
}

function drawGuards(ctx, world) {
  for (const guard of world.guards) {
    // Lantern light spilling at the guard's feet.
    circle(ctx, guard.x, guard.y, 20, 'rgba(255,210,122,0.14)');
    // Dark navy body with red trim, facing the patrol direction.
    ctx.save();
    ctx.translate(guard.x, guard.y);
    ctx.rotate(guard.facing);
    ctx.fillStyle = COLORS.guardBody;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.guardTrim;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 14, -Math.PI / 3, Math.PI / 3);
    ctx.stroke();
    // Shoulder line and the lantern held ahead.
    ctx.fillStyle = COLORS.guardTrim;
    ctx.fillRect(-2, -11, 8, 4);
    ctx.fillRect(-2, 7, 8, 4);
    circle(ctx, 17, 0, 4.5, COLORS.guardLantern);
    circle(ctx, 17, 0, 8, 'rgba(255,210,122,0.30)');
    ctx.restore();
    // "?" amber when suspicious, "!" red when alerted, above the head.
    if (guard.state === 'suspicious' || guard.state === 'search') {
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f5b942';
      ctx.fillText('?', guard.x, guard.y - 22);
    } else if (guard.state === 'alerted') {
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e74c3c';
      ctx.fillText('!', guard.x, guard.y - 24);
    }
  }
}

function drawPlayer(ctx, world) {
  const p = world.player;
  const crouched = p.tiptoe;
  // Soft shadow under the apprentice.
  circle(ctx, p.x, p.y + 2, crouched ? 10 : 12, 'rgba(0,0,0,0.35)');
  // Pale hooded cloak: bright against the dark floor, always findable.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.facing);
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.moveTo(13, 0);
  ctx.lineTo(-8, crouched ? -8 : -10);
  ctx.lineTo(-12, 0);
  ctx.lineTo(-8, crouched ? 8 : 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = COLORS.playerCloak;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Hood point and the dark face opening.
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(4, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, 8, 0, 3, '#22303a');
  ctx.restore();
  if (crouched) {
    // Skip the label at the exit gate: it would collide with the
    // EXIT — OPEN / LOCKED text drawn above the gate.
    const [ex, ey, ew, eh] = world.level.exit;
    // A 30px margin around the gate keeps the label clear of the bars
    // and of the EXIT text even when the player hugs the gate.
    const atExit = p.x > ex - 30 && p.x < ex + ew + 30 && p.y > ey - 30 && p.y < ey + eh + 30;
    if (!atExit) {
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(207,239,255,0.85)';
      ctx.fillText('tiptoe', p.x, p.y - 20);
    }
  }
}

function drawSeeds(ctx, world) {
  for (const seed of world.seeds) {
    if (seed.taken) continue;
    const bob = Math.sin(seed.bob) * 2;
    const pulse = 1 + Math.sin(world.time * 3 + seed.bob) * 0.12;
    // Soft halo so the flower is unmissable even in shadow.
    const grad = ctx.createRadialGradient(seed.x, seed.y + bob, 2, seed.x, seed.y + bob, 26 * pulse);
    grad.addColorStop(0, COLORS.seedHalo);
    grad.addColorStop(1, 'rgba(201,167,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(seed.x, seed.y + bob, 26 * pulse, 0, Math.PI * 2);
    ctx.fill();
    petalIcon(ctx, seed.x, seed.y + bob, 9 * pulse, true);
    // A tiny stem and leaves.
    ctx.strokeStyle = '#4c8a55';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(seed.x, seed.y + bob + 8);
    ctx.lineTo(seed.x, seed.y + bob + 15);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
}

function drawExit(ctx, world) {
  const [x, y, w, h] = world.level.exit;
  const open = world.exitOpen;
  if (open) {
    const grad = ctx.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, 70);
    grad.addColorStop(0, COLORS.exitGlow);
    grad.addColorStop(1, 'rgba(57,217,138,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 70, 0, Math.PI * 2);
    ctx.fill();
  }
  // Stone arch.
  rect(ctx, x, y, w, h, open ? '#1d3a2a' : '#232d33');
  ctx.strokeStyle = open ? COLORS.exitOpen : COLORS.exitLocked;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  // Arch top.
  ctx.beginPath();
  ctx.arc(x + w / 2, y + 6, w / 2 - 4, Math.PI, 0);
  ctx.stroke();
  ctx.lineWidth = 1;
  // The gate bars: green glow when open, grey bars when locked.
  ctx.strokeStyle = open ? 'rgba(57,217,138,0.9)' : 'rgba(120,135,142,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let bx = x + 16; bx < x + w - 8; bx += 14) {
    ctx.moveTo(bx, y + 10);
    ctx.lineTo(bx, y + h - 6);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.font = 'bold 13px sans-serif';
  // The gate label sits above the bars; its centre is clamped below so
  // the text never runs off the right edge of the 1280-wide frame.
  ctx.textAlign = 'center';
  ctx.fillStyle = open ? COLORS.exitOpen : '#8a9aa2';
  // Keep the label inside the frame: the gate sits at the right edge,
  // so clamp its centre to the measured text width.
  const label = open ? 'EXIT — OPEN' : 'EXIT — LOCKED';
  const labelW = ctx.measureText(label).width;
  const labelX = Math.min(x + w / 2, 1280 - labelW / 2 - 6);
  ctx.fillText(label, labelX, y - 8);
}

function drawNoiseAndPebble(ctx, world) {
  for (const ring of world.noiseRings) {
    const alpha = Math.max(0, 0.55 * (1 - ring.t / 0.6));
    ctx.strokeStyle = `rgba(220,235,255,${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (world.pebbleFlight) {
    const f = world.pebbleFlight;
    const x = f.fromX + (f.toX - f.fromX) * f.t;
    const y = f.fromY + (f.toY - f.fromY) * f.t - Math.sin(f.t * Math.PI) * 34;
    circle(ctx, x, y, 4, '#d8d8d8');
    ctx.strokeStyle = 'rgba(216,216,216,0.5)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(f.fromX, f.fromY);
    ctx.lineTo(f.toX, f.toY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (world.pebbleLand) {
    const alpha = Math.max(0, 0.7 * (1 - world.pebbleLand.t / 0.8));
    ctx.strokeStyle = `rgba(255,210,122,${alpha})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(world.pebbleLand.x, world.pebbleLand.y, 8 + world.pebbleLand.t * 160, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  // Drifting fireflies over the garden.
  for (const f of world.fireflies) {
    const tw = 0.35 + 0.3 * Math.sin(world.time * f.speed + f.phase);
    const fx = f.x + Math.sin(world.time * 0.4 * f.speed + f.phase) * 12;
    const fy = f.y + Math.cos(world.time * 0.33 * f.speed + f.phase) * 10;
    circle(ctx, fx, fy, 1.8, `rgba(200,255,190,${tw})`);
  }
}

// --- HUD --------------------------------------------------------------------

function drawHud(ctx, world, muted) {
  rect(ctx, 0, 0, CANVAS_WIDTH, HUD_HEIGHT, COLORS.hudBar);
  ctx.fillStyle = 'rgba(157,184,196,0.25)';
  ctx.fillRect(0, HUD_HEIGHT - 1, CANVAS_WIDTH, 1);

  // Left: title + level name.
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 19px sans-serif';
  ctx.fillText('Moonpetal Glasshouse', 16, 26);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = COLORS.hudMuted;
  ctx.fillText(`Level ${world.level.id} — ${world.level.name}`, 16, 48);

  // Centre: seeds, detection meter, pebbles.
  const cx = CANVAS_WIDTH / 2;
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Seeds ${world.seedsCollected} / ${world.seeds.length}`, cx - 210, 27);
  for (let i = 0; i < world.seeds.length; i += 1) {
    petalIcon(ctx, cx - 118 + i * 26, 22, 8, i < world.seedsCollected);
  }
  // Detection meter: eye + bar, green -> amber -> red.
  const meterX = cx - 60;
  const meterY = 40;
  const meterW = 170;
  ctx.font = '16px sans-serif';
  ctx.fillText('👁', meterX - 26, meterY + 5);
  rect(ctx, meterX, meterY - 7, meterW, 12, 'rgba(255,255,255,0.14)');
  const meterColor =
    world.detection < 0.35 ? COLORS.meterGreen : world.detection < 0.7 ? COLORS.meterAmber : COLORS.meterRed;
  if (world.detection > 0.01) {
    rect(ctx, meterX, meterY - 7, meterW * world.detection, 12, meterColor);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(meterX, meterY - 7, meterW, 12);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = COLORS.hudMuted;
  ctx.fillText('seen', meterX + meterW + 8, meterY + 5);
  // Pebbles.
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = COLORS.hudText;
  ctx.fillText('Pebbles', cx + 150, 27);
  for (let i = 0; i < 3; i += 1) {
    circle(ctx, cx + 215 + i * 20, 22, 6, i < world.pebbles ? '#d8d8d8' : 'rgba(216,216,216,0.18)');
  }
  ctx.font = '12px sans-serif';
  ctx.fillStyle = COLORS.hudMuted;
  ctx.fillText('click / E to toss', cx + 150, 48);

  // Right: alert word + keys.
  const alertColor =
    world.alertState === 'hunted'
      ? COLORS.alertHunted
      : world.alertState === 'suspicious'
        ? COLORS.alertSuspicious
        : COLORS.alertUnseen;
  ctx.textAlign = 'right';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = alertColor;
  ctx.fillText(
    world.alertState === 'hunted' ? 'HUNTED' : world.alertState === 'suspicious' ? 'SUSPICIOUS' : 'UNSEEN',
    CANVAS_WIDTH - 16,
    27,
  );
  ctx.font = '13px sans-serif';
  ctx.fillStyle = COLORS.hudMuted;
  ctx.fillText(`M ${muted ? 'unmute' : 'mute'} · R restart`, CANVAS_WIDTH - 16, 48);
  ctx.textAlign = 'left';
}

// --- screens ------------------------------------------------------------------

function dimGarden(ctx, world) {
  drawFloor(ctx, world);
  drawLampPools(ctx, world);
  drawHedges(ctx, world);
  drawWalls(ctx, world);
  drawCones(ctx, world);
  drawGuards(ctx, world);
  drawSeeds(ctx, world);
  drawExit(ctx, world);
  drawNoiseAndPebble(ctx, world);
}

function panel(ctx, x, y, w, h) {
  rect(ctx, x, y, w, h, 'rgba(6,16,12,0.88)');
  ctx.strokeStyle = 'rgba(201,167,255,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = 1;
}

export function drawTitle(ctx, world, bestTime) {
  dimGarden(ctx, world);
  rect(ctx, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 'rgba(4,10,8,0.55)');
  panel(ctx, 290, 130, 700, 440);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e9d9ff';
  ctx.font = 'bold 52px Georgia, serif';
  ctx.fillText('Moonpetal Glasshouse', CANVAS_WIDTH / 2, 205);
  ctx.fillStyle = COLORS.hudMuted;
  ctx.font = 'italic 18px Georgia, serif';
  ctx.fillText('Three Moonpetals were stolen from the glasshouse.', CANVAS_WIDTH / 2, 245);
  ctx.fillText('Slip in, steal them back, and leave unseen.', CANVAS_WIDTH / 2, 272);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '16px sans-serif';
  ctx.fillText('WASD / arrows — move      Shift — tiptoe (quiet, slow)', CANVAS_WIDTH / 2, 325);
  ctx.fillText('Click or E — toss a pebble to distract a warden', CANVAS_WIDTH / 2, 352);
  ctx.fillText('Stay out of the amber cones · hide behind hedges', CANVAS_WIDTH / 2, 379);
  ctx.fillText('Collect 3 seeds, then slip out the green gate', CANVAS_WIDTH / 2, 406);
  ctx.fillStyle = '#f5b942';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Click or press Enter to start', CANVAS_WIDTH / 2, 455);
  ctx.fillStyle = COLORS.hudMuted;
  ctx.font = '14px sans-serif';
  ctx.fillText(
    bestTime ? `Best escape: ${bestTime}` : 'No escape yet — the glasshouse waits.',
    CANVAS_WIDTH / 2,
    505,
  );
  ctx.fillText('M mute · R restart a level', CANVAS_WIDTH / 2, 535);
  ctx.textAlign = 'left';
}

export function drawLevelClear(ctx, world) {
  drawWorld(ctx, world, false);
  rect(ctx, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 'rgba(4,10,8,0.5)');
  panel(ctx, 340, 230, 600, 240);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#cfefff';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText('Level clear — unseen.', CANVAS_WIDTH / 2, 300);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '18px sans-serif';
  ctx.fillText(
    `${world.level.name} in ${formatTime(world.levelTime)} · ${world.seedsCollected} / ${world.seeds.length} seeds`,
    CANVAS_WIDTH / 2,
    345,
  );
  ctx.fillStyle = '#f5b942';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Press Enter for the next house', CANVAS_WIDTH / 2, 400);
  ctx.textAlign = 'left';
}

export function drawWin(ctx, world, totalTime) {
  drawWorld(ctx, world, false);
  rect(ctx, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 'rgba(4,10,8,0.55)');
  panel(ctx, 290, 180, 700, 330);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e9d9ff';
  ctx.font = 'bold 38px Georgia, serif';
  ctx.fillText('Unseen. The glasshouse', CANVAS_WIDTH / 2, 250);
  ctx.fillText('keeps its secret.', CANVAS_WIDTH / 2, 295);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '18px sans-serif';
  ctx.fillText(`All 9 Moonpetals home · total ${formatTime(totalTime)}`, CANVAS_WIDTH / 2, 345);
  ctx.fillText('Not one warden saw you leave.', CANVAS_WIDTH / 2, 375);
  ctx.fillStyle = '#f5b942';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Press R to play again', CANVAS_WIDTH / 2, 430);
  ctx.textAlign = 'left';
}

export function drawCaughtFlash(ctx) {
  const grad = ctx.createRadialGradient(
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2,
    120,
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2,
    720,
  );
  grad.addColorStop(0, 'rgba(180,20,20,0.12)');
  grad.addColorStop(1, COLORS.vignetteRed);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px Georgia, serif';
  ctx.fillText('Caught! The wardens found you.', CANVAS_WIDTH / 2, 330);
  ctx.font = '18px sans-serif';
  ctx.fillText('Press R to try again', CANVAS_WIDTH / 2, 370);
  ctx.textAlign = 'left';
}

// --- the play frame -----------------------------------------------------------

export function drawWorld(ctx, world, muted) {
  drawFloor(ctx, world);
  drawLampPools(ctx, world);
  drawHedges(ctx, world);
  drawWalls(ctx, world);
  drawCones(ctx, world);
  drawSeeds(ctx, world);
  drawExit(ctx, world);
  drawNoiseAndPebble(ctx, world);
  drawGuards(ctx, world);
  drawPlayer(ctx, world);
  // A soft night vignette so the garden feels like a glasshouse at night.
  const vig = ctx.createRadialGradient(
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2,
    320,
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2,
    780,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawHud(ctx, world, muted);
  // Bottom hint line, fading after 6 s of play.
  if (world.levelTime < 6) {
    ctx.globalAlpha = Math.min(1, (6 - world.levelTime) / 2);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(220,239,230,0.9)';
    ctx.textAlign = 'left';
    ctx.fillText('WASD move · Shift tiptoe · Click toss a pebble', 16, CANVAS_HEIGHT - 14);
    ctx.globalAlpha = 1;
  }
  // "Seen" warning: a thin red frame edge while the meter is high.
  if (world.detection > 0.6 && !world.caught) {
    ctx.strokeStyle = `rgba(231,76,60,${(world.detection - 0.6) * 1.4})`;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, CANVAS_WIDTH - 6, CANVAS_HEIGHT - 6);
    ctx.lineWidth = 1;
  }
}

export function formatTime(seconds) {
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Used by shots.js to label a staged frame without touching the world.
export function drawShotCaption(ctx, text) {
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(220,239,230,0.85)';
  ctx.fillText(text, CANVAS_WIDTH - 16, CANVAS_HEIGHT - 14);
  ctx.textAlign = 'left';
}
