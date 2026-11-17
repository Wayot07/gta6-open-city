// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. Screens: title, play, paused, help, busted, wasted,
// complete. Save/load lives in localStorage; progress autosaves every 10 s.
//
// ?seed=N fixes the city. ?shot=start|play|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_EXPLOSION, EVENT_MISSION, EVENT_SHOT, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_HELP, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_HELP, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;
const AUTOSAVE_SECONDS = 10;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.save()));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { daylight: world.daylight(), muted: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = AUTOSAVE_SECONDS;
  let returnScreen = SCREEN_PLAY;
  let pendingEnter = false;
  let pendingPunch = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    if (fresh) {
      world.reset();
      try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
      save = null;
    } else if (save) {
      world.reset();
      world.load(save);
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing Solmar City. Follow the gold marker.');
  }

  function handleEvents(events) {
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_EXPLOSION) audio.explosion();
    if (events & EVENT_CASH) audio.cash();
    if (events & EVENT_MISSION) {
      audio.mission();
      announce(world.state.mission.objective || 'Mission update.');
    }
    if (events & EVENT_BUSTED) {
      audio.busted();
      screen = SCREEN_BUSTED;
    }
    if (events & EVENT_WASTED) {
      audio.busted();
      screen = SCREEN_WASTED;
    }
    if (world.state.gameComplete && screen === SCREEN_PLAY) screen = SCREEN_COMPLETE;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_ENTER) pendingEnter = true;
    if (actions & ACTION_PUNCH) pendingPunch = true;
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(true);
      else if (actions & ACTION_HELP) { returnScreen = SCREEN_TITLE; screen = SCREEN_HELP; }
      return;
    }
    if (screen === SCREEN_HELP) {
      if (actions & (ACTION_HELP | ACTION_PAUSE | ACTION_CONFIRM)) screen = returnScreen;
      return;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM) {
        world.reset();
        screen = SCREEN_PLAY;
      }
      return;
    }
    if (screen === SCREEN_COMPLETE) {
      if (actions & ACTION_CONFIRM) screen = SCREEN_PLAY;
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) screen = SCREEN_PLAY;
      else if (actions & ACTION_HELP) { returnScreen = SCREEN_PAUSED; screen = SCREEN_HELP; }
      return;
    }
    // SCREEN_PLAY
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & ACTION_HELP) {
      returnScreen = SCREEN_PLAY;
      screen = SCREEN_HELP;
    }
  }

  function buildStepInput() {
    const mv = input.moveVector();
    const mouse = input.mouse();
    const rect = canvas.getBoundingClientRect();
    // Mouse position in logical view coords, then into world coords via camera.
    const vx = ((mouse.x - rect.left) / rect.width) * 1280;
    const vy = ((mouse.y - rect.top) / rect.height) * 720;
    const cam = world.state.camera;
    const aimX = cam.x - 640 + vx;
    const aimY = cam.y - 360 + vy;
    const stepInput = {
      mx: mv.x, my: mv.y,
      sprint: input.isSprint(),
      handbrake: input.isSprint(),
      enter: pendingEnter,
      punch: pendingPunch,
      shoot: input.isMouseDown(),
      aimX, aimY,
    };
    pendingEnter = false;
    pendingPunch = false;
    return stepInput;
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { mx: 0, my: 0, sprint: false, handbrake: false, enter: false, punch: false, shoot: false, aimX: 600, aimY: 600 }, true);
      return;
    }
    const events = world.step(STEP, buildStepInput(), false);
    handleEvents(events);
    const p = world.state.player;
    audio.update(p.inCar && p.car ? p.car.speed : 0, world.state.wanted, !!(p.inCar && p.car));
    saveTimer -= STEP;
    if (saveTimer <= 0) {
      saveTimer = AUTOSAVE_SECONDS;
      writeSave();
      save = readSave();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, {
      daylight: world.daylight(),
      muted: audio.isMuted(),
      saveExists: !!save,
      saveMoney: save ? save.money : 0,
      saveMission: save ? (save.missionIndex + 1) : 1,
    });
  }

  // First gesture unlocks audio; also used to start from the title screen.
  window.addEventListener('pointerdown', () => audio.ensure(), { once: false });
  window.addEventListener('keydown', () => audio.ensure(), { once: false });
  // Continue with C on the title screen.
  window.addEventListener('keydown', (event) => {
    if (screen === SCREEN_TITLE && event.code === 'KeyC' && save) startGame(false);
  });
  // Leaving the tab pauses a running game.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar City. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
