// input.js — keyboard + mouse, nothing else. It keeps the raw key state
// and hands the game a small intent object each frame, plus one-shot
// events (toss a pebble, press Enter, press R) that the loop consumes.
export function createInput(canvas, callbacks) {
  const keys = new Set();
  const state = {
    keys,
    moveX: 0,
    moveY: 0,
    tiptoe: false,
    clickPoint: null, // {x, y} in canvas coords, consumed by the loop
    enterPressed: false,
    restartPressed: false,
    mutePressed: false,
  };

  function recomputeMove() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    state.moveX = x;
    state.moveY = y;
    state.tiptoe = keys.has('ShiftLeft') || keys.has('ShiftRight');
  }

  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Enter' || e.code === 'Space') state.enterPressed = true;
    if (e.code === 'KeyR') state.restartPressed = true;
    if (e.code === 'KeyM') state.mutePressed = true;
    if (e.code === 'KeyE') callbacks.onTossKey();
    recomputeMove();
    callbacks.onFirstGesture();
  }

  function onKeyUp(e) {
    keys.delete(e.code);
    recomputeMove();
  }

  function onMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    state.clickPoint = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
    callbacks.onFirstGesture();
  }

  function onBlur() {
    keys.clear();
    recomputeMove();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);

  // One-shot flags the game loop reads and clears each frame.
  state.consumeEnter = () => {
    const v = state.enterPressed;
    state.enterPressed = false;
    return v;
  };
  state.consumeRestart = () => {
    const v = state.restartPressed;
    state.restartPressed = false;
    return v;
  };
  state.consumeMute = () => {
    const v = state.mutePressed;
    state.mutePressed = false;
    return v;
  };
  state.consumeClick = () => {
    const v = state.clickPoint;
    state.clickPoint = null;
    return v;
  };

  // Test/shots helper: pretend a key is held without a real keyboard.
  state.pressKey = (code) => {
    keys.add(code);
    recomputeMove();
  };
  state.releaseKey = (code) => {
    keys.delete(code);
    recomputeMove();
  };

  return state;
}
