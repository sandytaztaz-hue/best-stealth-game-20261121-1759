// main.js — boots Moonpetal Glasshouse: the game loop, the screen state
// machine (title / play / level-clear / win / caught), and the ?shot=
// screenshot scenes. Fixed timestep 1/60; the world never sees the DOM.
import { CANVAS_W, CANVAS_H } from './config.js';
import { createWorld, stepWorld, drainEvents, exitUnlocked } from './world.js';
import { createFx, spawnRing, spawnSparks, spawnPuff, updateFx } from './fx.js';
import { createInput, moveDirection, consumePresses, consumeToss } from './input.js';
import { createAudio } from './audio.js';
import { renderGame, renderHud, renderTitle, renderLevelClear, renderWin, renderCaught, ghostRating } from './render.js';
import { runShot } from './shots.js';

const STEP = 1 / 60;

function formatTime(seconds) {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function main() {
  const canvas = document.getElementById('game');
  const statusLine = document.getElementById('status');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(window.location.search);
  const shotName = params.get('shot');
  const seed = Number(params.get('seed') || 1);

  // Screenshot mode: play the shot's real rules forward, render once.
  if (shotName) {
    const shot = runShot(shotName, seed);
    const time = shot.time || 0;
    if (shot.screen === 'title') {
      renderTitle(ctx, shot.world, shot.fx, time, null);
    } else if (shot.screen === 'win') {
      renderGame(ctx, shot.world, shot.fx, time);
      renderHud(ctx, shot.world, 0);
      renderWin(ctx, shot.world, shot.world.time, ghostRating(shot.timesSpotted || 0), shot.timesSpotted || 0);
    } else {
      renderGame(ctx, shot.world, shot.fx, time);
      renderHud(ctx, shot.world, 0);
      if (shot.world.caught) renderCaught(ctx);
    }
    return;
  }

  const audio = createAudio();
  const input = createInput(canvas);
  let levelIndex = 0;
  let world = createWorld(levelIndex, 1);
  let fx = createFx(levelIndex);
  let screen = 'title';
  let totalTime = 0;
  let totalSpotted = 0;
  let best = null;
  let hintSeconds = 6;
  let caughtTimer = 0;
  let heartbeatTimer = 0;
  let accumulator = 0;
  let lastNow = performance.now();

  function restartLevel() {
    world = createWorld(levelIndex, 1);
    fx = createFx(levelIndex);
    screen = 'play';
    hintSeconds = 6;
    caughtTimer = 0;
  }

  function handleEvents() {
    for (const event of drainEvents(world)) {
      if (event.type === 'footstep') {
        spawnRing(fx, event.x, event.y, event.radius, event.quiet ? '#7fb8c9' : '#dcefe6', event.quiet);
        audio.footstep(event.quiet);
      } else if (event.type === 'pickup') {
        spawnSparks(fx, event.x, event.y, '#c9a7ff', 16);
        audio.pickup();
      } else if (event.type === 'pebble-ping') {
        spawnRing(fx, event.x, event.y, event.radius, '#f5b942');
        spawnPuff(fx, event.x, event.y);
        audio.pebblePing();
      } else if (event.type === 'suspicious-blip') {
        audio.suspiciousBlip();
      } else if (event.type === 'alert-sting') {
        audio.alertSting();
      } else if (event.type === 'exit-unlocked') {
        audio.exitUnlocked();
      } else if (event.type === 'win') {
        audio.winArpeggio();
      }
    }
  }

  function frame(now) {
    const elapsed = Math.min(0.25, (now - lastNow) / 1000);
    lastNow = now;
    accumulator += elapsed;
    const presses = consumePresses(input);
    if (presses.mute) audio.toggleMute();
    if (input.firstGesture) audio.unlock();

    if (presses.restart && screen !== 'title') {
      totalSpotted += world.timesSpotted;
      restartLevel();
    }

    while (accumulator >= STEP) {
      accumulator -= STEP;
      if (screen === 'title') {
        updateFx(fx, STEP);
        if (presses.enter) {
          screen = 'play';
          presses.enter = false;
        }
      } else if (screen === 'play') {
        hintSeconds = Math.max(0, hintSeconds - STEP);
        const dir = moveDirection(input);
        const toss = consumeToss(input);
        stepWorld(world, { x: dir.x, y: dir.y, tiptoe: input.tiptoe, toss }, STEP);
        handleEvents();
        updateFx(fx, STEP);
        if (world.meter > 0.7 && world.alert === 'hunted') {
          heartbeatTimer -= STEP;
          if (heartbeatTimer <= 0) {
            heartbeatTimer = 0.8;
            audio.heartbeat();
          }
        }
        if (world.caught) {
          screen = 'caught';
          caughtTimer = 0;
        } else if (world.won) {
          totalTime += world.time;
          totalSpotted += world.timesSpotted;
          best = `Ghost ${formatTime(totalTime)} · ${ghostRating(totalSpotted)}`;
          screen = 'win';
        } else if (world.levelClear) {
          totalTime += world.time;
          totalSpotted += world.timesSpotted;
          screen = 'level-clear';
        }
      } else if (screen === 'caught') {
        caughtTimer += STEP;
        updateFx(fx, STEP);
        if (caughtTimer > 1.5 || presses.enter) {
          totalSpotted += world.timesSpotted;
          restartLevel();
        }
      } else if (screen === 'level-clear') {
        updateFx(fx, STEP);
        if (presses.enter) {
          levelIndex += 1;
          restartLevel();
        }
      } else if (screen === 'win') {
        updateFx(fx, STEP);
        if (presses.restart) {
          levelIndex = 0;
          totalTime = 0;
          totalSpotted = 0;
          restartLevel();
        }
      }
    }

    if (screen === 'title') {
      renderTitle(ctx, world, fx, now / 1000, best);
    } else if (screen === 'level-clear') {
      renderGame(ctx, world, fx, now / 1000);
      renderHud(ctx, world, 0);
      renderLevelClear(ctx, world, now / 1000, ghostRating(world.timesSpotted));
    } else if (screen === 'win') {
      renderGame(ctx, world, fx, now / 1000);
      renderHud(ctx, world, 0);
      renderWin(ctx, world, totalTime, ghostRating(totalSpotted), totalSpotted);
    } else {
      renderGame(ctx, world, fx, now / 1000);
      renderHud(ctx, world, hintSeconds);
      if (screen === 'caught') renderCaught(ctx);
    }

    if (statusLine) {
      const state = screen === 'play'
        ? `Level ${levelIndex + 1}: ${world.seedsCollected} of ${world.seeds.length} Moonpetals, ${world.pebbles} pebbles, ${world.alert}`
        : screen;
      if (statusLine.textContent !== state) statusLine.textContent = state;
    }
    requestAnimationFrame(frame);
  }

  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  // Debug handle for automated play-testing: read-only view of live state.
  window.__moonpetal = {
    get screen() { return screen; },
    get level() { return levelIndex; },
    get world() { return world; },
    get fx() { return fx; },
  };
  requestAnimationFrame(frame);
}

main();
