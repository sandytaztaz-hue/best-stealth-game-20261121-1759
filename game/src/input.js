// input.js — keyboard and mouse, turned into one small state object.
// WASD / arrows move, Shift tiptoes, click (or E) tosses a pebble at that
// point, M mutes, R restarts, Enter starts / advances. No audio starts
// before the first gesture: the handlers below count as the gesture.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    tiptoe: false,
    toss: null,
    pressedEnter: false,
    pressedRestart: false,
    pressedMute: false,
    firstGesture: false,
  };

  function markGesture() {
    input.firstGesture = true;
  }

  function keyName(event) {
    // Always lower-case: 'Enter' and 'enter' must be the same key, and
    // 'Shift' must match the tiptoe check in updateFromKeys.
    return event.key.toLowerCase();
  }

  window.addEventListener('keydown', (event) => {
    markGesture();
    const key = keyName(event);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    keys.add(key);
    keys.add(event.key);
    if (key === 'enter') input.pressedEnter = true;
    if (key === 'r') input.pressedRestart = true;
    if (key === 'm') input.pressedMute = true;
    updateFromKeys();
  });

  window.addEventListener('keyup', (event) => {
    keys.delete(keyName(event));
    keys.delete(event.key);
    updateFromKeys();
  });

  window.addEventListener('blur', () => {
    keys.clear();
    updateFromKeys();
  });

  canvas.addEventListener('mousedown', (event) => {
    markGesture();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    input.toss = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
    input.pressedEnter = true;
  });

  function updateFromKeys() {
    input.up = keys.has('w') || keys.has('arrowup');
    input.down = keys.has('s') || keys.has('arrowdown');
    input.left = keys.has('a') || keys.has('arrowleft');
    input.right = keys.has('d') || keys.has('arrowright');
    input.tiptoe = keys.has('shift');
  }

  return input;
}

// The move direction for one step: -1..1 on each axis, normalised.
export function moveDirection(input) {
  let x = 0;
  let y = 0;
  if (input.left) x -= 1;
  if (input.right) x += 1;
  if (input.up) y -= 1;
  if (input.down) y += 1;
  if (x !== 0 && y !== 0) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return { x, y };
}

// One-shot flags (Enter / R / M) are consumed by the main loop each frame.
export function consumePresses(input) {
  const presses = {
    enter: input.pressedEnter,
    restart: input.pressedRestart,
    mute: input.pressedMute,
  };
  input.pressedEnter = false;
  input.pressedRestart = false;
  input.pressedMute = false;
  return presses;
}

export function consumeToss(input) {
  const toss = input.toss;
  input.toss = null;
  return toss;
}
