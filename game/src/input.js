// Keyboard and mouse input. Held keys give a movement vector; one-shot presses
// (enter car, punch, pause, mute, help) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_HELP = 32;

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};
const SPRINT = new Set(['ShiftLeft', 'ShiftRight', 'Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER_CAR = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);
const HELP = new Set(['KeyH']);

export function createInput(canvas) {
  const held = new Set();
  let sprint = false;
  let mouseDown = false;
  let mouseX = 0;
  let mouseY = 0;
  let actions = 0;

  function queue(set, flag, event) {
    if (set.has(event.code) && !event.repeat) actions |= flag;
  }

  window.addEventListener('keydown', (event) => {
    if (MOVE_KEYS[event.code]) held.add(event.code);
    else if (SPRINT.has(event.code)) sprint = true;
    else if (CONFIRM.has(event.code)) queue(CONFIRM, ACTION_CONFIRM, event);
    else if (PAUSE.has(event.code)) queue(PAUSE, ACTION_PAUSE, event);
    else if (ENTER_CAR.has(event.code)) queue(ENTER_CAR, ACTION_ENTER, event);
    else if (PUNCH.has(event.code)) queue(PUNCH, ACTION_PUNCH, event);
    else if (MUTE.has(event.code)) queue(MUTE, ACTION_MUTE, event);
    else if (HELP.has(event.code)) queue(HELP, ACTION_HELP, event);
    else return;
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
    if (SPRINT.has(event.code)) sprint = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.clear();
    sprint = false;
    mouseDown = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    mouseX = event.clientX;
    mouseY = event.clientY;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });
  canvas.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Normalised movement vector from held WASD / arrow keys. */
    moveVector() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const v = MOVE_KEYS[code];
        if (v) { x += v[0]; y += v[1]; }
      }
      const len = Math.hypot(x, y);
      if (len > 0) { x /= len; y /= len; }
      return { x, y };
    },
    isSprint() { return sprint; },
    isMouseDown() { return mouseDown; },
    mouse() { return { x: mouseX, y: mouseY }; },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
