// main.js — boots Moonpetal Glasshouse: the game loop (requestAnimationFrame
// with a fixed 1/60 timestep), the screen state machine (title / play /
// level-clear / win / caught) and the ?shot= scenes for screenshots.
// It wires input, world, render and audio together and owns nothing else.
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './config.js';
import { createWorld, updateWorld, tossPebble } from './world.js';
import { createInput } from './input.js';
import * as audio from './audio.js';
import {
  drawWorld,
  drawTitle,
  drawLevelClear,
  drawWin,
  drawCaughtFlash,
  formatTime,
} from './render.js';
import { resolveShot } from './shots.js';

const STEP = 1 / 60;

export function startGame(canvas, statusEl) {
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(window.location.search);
  const shotName = params.get('shot');
  const seed = parseInt(params.get('seed') || '1', 10) || 1;

  const game = {
    screen: 'title', // title | play | level-clear | win | caught
    world: createWorld(1, seed), // level 2 behind the title screen
    totalTime: 0,
    bestTime: null,
    caughtTimer: 0,
    clearTimer: 0,
    shot: null,
  };

  // A ?shot= scene renders one deterministic frame from the real rules
  // and then holds it still for the screenshot.
  if (shotName) {
    const scene = resolveShot(shotName, seed);
    game.shot = scene;
    game.world = scene.world;
    game.screen = scene.screen === 'title' ? 'title' : scene.screen;
    if (scene.screen === 'win') {
      game.totalTime = scene.totalTime || 0;
      game.screen = 'win';
    }
    if (scene.screen === 'play') game.screen = 'play';
  }

  const input = createInput(canvas, {
    onFirstGesture: () => {
      audio.ensureAudio();
      audio.startCrickets();
    },
    onTossKey: () => {
      if (game.screen !== 'play') return;
      const p = game.world.player;
      tossPebble(game.world, p.x + Math.cos(p.facing) * 120, p.y + Math.sin(p.facing) * 120);
    },
  });

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function startLevel(levelIndex) {
    game.world = createWorld(levelIndex, seed);
    game.screen = 'play';
    setStatus(
      `Level ${game.world.level.id} — ${game.world.level.name}. Collect ${game.world.seeds.length} Moonpetal seeds, then reach the exit gate unseen.`,
    );
  }

  function startGameFromTitle() {
    game.totalTime = 0;
    startLevel(0);
  }

  function update(dt) {
    if (game.shot) return; // a shot frame is frozen, never simulated
    if (input.consumeMute()) {
      audio.ensureAudio();
      const muted = audio.toggleMute();
      setStatus(muted ? 'Sound muted.' : 'Sound on.');
    }

    if (game.screen === 'title') {
      updateWorld(game.world, { moveX: 0, moveY: 0, tiptoe: true }, dt);
      if (input.consumeEnter() || input.consumeClick()) startGameFromTitle();
      return;
    }

    if (game.screen === 'level-clear') {
      game.clearTimer += dt;
      if ((input.consumeEnter() || input.consumeClick()) && game.clearTimer > 0.5) {
        game.totalTime += game.world.levelTime;
        const next = game.world.levelIndex + 1;
        if (next < 3) startLevel(next);
      }
      return;
    }

    if (game.screen === 'win') {
      if (input.consumeRestart()) startGameFromTitle();
      return;
    }

    if (game.screen === 'caught') {
      game.caughtTimer += dt;
      if (input.consumeRestart() || game.caughtTimer > 1.5) {
        startLevel(game.world.levelIndex);
      }
      return;
    }

    // Play.
    if (input.consumeRestart()) {
      startLevel(game.world.levelIndex);
      return;
    }
    const click = input.consumeClick();
    if (click) tossPebble(game.world, click.x, click.y);
    updateWorld(game.world, input, dt);

    if (game.world.caught) {
      game.screen = 'caught';
      game.caughtTimer = 0;
      setStatus('Caught! The wardens found you — press R to try again.');
      return;
    }
    if (game.world.levelComplete) {
      game.screen = 'level-clear';
      game.clearTimer = 0;
      if (game.world.levelIndex === 2) {
        game.totalTime += game.world.levelTime;
        game.screen = 'win';
        game.bestTime = formatTime(game.totalTime);
        audio.playWinArpeggio();
        setStatus(`Unseen. The glasshouse keeps its secret. Total ${game.bestTime}, all 9 Moonpetals home.`);
      } else {
        setStatus(`Level clear — unseen. ${game.world.level.name} in ${formatTime(game.world.levelTime)}.`);
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const muted = audio.isMuted();
    if (game.screen === 'title') {
      drawTitle(ctx, game.world, game.bestTime);
    } else if (game.screen === 'level-clear') {
      drawLevelClear(ctx, game.world);
    } else if (game.screen === 'win') {
      drawWin(ctx, game.world, game.totalTime);
    } else {
      drawWorld(ctx, game.world, muted);
      if (game.screen === 'caught') drawCaughtFlash(ctx);
    }
  }

  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;
    accumulator += elapsed;
    while (accumulator >= STEP) {
      update(STEP);
      accumulator -= STEP;
    }
    draw();
    requestAnimationFrame(frame);
  }

  setStatus(
    'Moonpetal Glasshouse. Three Moonpetals were stolen from the glasshouse. Slip in, steal them back, and leave unseen.',
  );
  requestAnimationFrame(frame);
  return game;
}

// Boot when the DOM is ready.
if (typeof document !== 'undefined') {
  const boot = () => {
    const canvas = document.getElementById('game');
    const statusEl = document.getElementById('status');
    if (canvas) startGame(canvas, statusEl);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
