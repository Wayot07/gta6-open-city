// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot that drives toward a target point, so every frame is what a
// short game really looks like and the same seed always gives the same frame.

import { ROADS, STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { startMission } from './missions.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const CHASE_SECONDS = 14;
const MISSION_SECONDS = 6;

function nearestRoad(list, v) {
  return list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
}

/**
 * Next waypoint on the road grid toward (tx, ty): drive along the current road
 * to the intersection nearest the target, then turn onto the road that leads
 * to it. Cutting straight across blocks would smash through buildings.
 */
function roadWaypoint(state, tx, ty) {
  const car = state.player.car || state.player;
  if (Math.abs(car.x - tx) < 60) return { x: car.x, y: ty };
  if (Math.abs(car.y - ty) < 60) return { x: tx, y: car.y };
  const vx = nearestRoad(ROADS.vertical, car.x);
  const hy = nearestRoad(ROADS.horizontal, car.y);
  const tvx = nearestRoad(ROADS.vertical, tx);
  const thy = nearestRoad(ROADS.horizontal, ty);
  if (Math.abs(car.y - hy) < 30) return { x: tvx, y: hy };
  if (Math.abs(car.x - vx) < 30) return { x: vx, y: thy };
  return { x: tvx, y: thy };
}

/** Drive input toward a world point, via the road grid, braking into turns. */
function driveToward(state, tx, ty) {
  const wp = roadWaypoint(state, tx, ty);
  const p = state.player;
  const car = p.car || { x: p.x, y: p.y, angle: p.angle, speed: 200 };
  const want = Math.atan2(wp.y - car.y, wp.x - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return {
    mx: diff > 0.12 ? 1 : diff < -0.12 ? -1 : 0,
    my: Math.abs(diff) > 0.9 ? 1 : -1,
    sprint: false, handbrake: Math.abs(diff) > 1.2,
    enter: false, punch: false, shoot: false,
    aimX: wp.x, aimY: wp.y,
  };
}

/** Walk input toward a world point. */
function walkToward(state, tx, ty) {
  const p = state.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    mx: dx / len, my: dy / len,
    sprint: false, handbrake: false,
    enter: false, punch: false, shoot: Math.hypot(dx, dy) < 400,
    aimX: tx, aimY: ty,
  };
}

function idleInput() {
  return { mx: 0, my: 0, sprint: false, handbrake: false, enter: false, punch: false, shoot: false, aimX: 0, aimY: 0 };
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: title over a living city. play: Rex driving to Dante's garage on
 * mission 1. chase: 3 wanted stars, police cars ramming the player's sedan.
 * mission: the docks fight, rivals shooting, objective on the HUD.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name !== 'play' && name !== 'chase' && name !== 'mission') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, idleInput(), true);
    return { screen: SCREEN_TITLE };
  }

  if (name === 'play') {
    // Put Rex in a parked sedan near the start and drive to the garage.
    const car = state.cars.find((c) => !c.traffic && !c.dead && c.kind === 'sedan');
    if (car) {
      state.player.x = car.x;
      state.player.y = car.y;
      world.step(STEP, { ...idleInput(), enter: true }, false);
    }
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      world.step(STEP, driveToward(state, 600, 600), false);
      if (state.player.x < 700 && state.player.y < 700) break;
    }
    return { screen: SCREEN_PLAY };
  }

  if (name === 'chase') {
    const car = state.cars.find((c) => !c.traffic && !c.dead && c.kind === 'sedan');
    if (car) {
      state.player.x = car.x;
      state.player.y = car.y;
      world.step(STEP, { ...idleInput(), enter: true }, false);
    }
    world.setWanted(3);
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      world.step(STEP, driveToward(state, 1800, 1400), false);
    }
    return { screen: SCREEN_PLAY };
  }

  // mission — the fight stage spawns the 4 rivals itself when Rex reaches
  // the docks, so this only stages the approach and the wanted heat.
  startMission(state, 2);
  state.player.x = 2750;
  state.player.y = 1950;
  state.player.money = 1250;
  world.setWanted(1);
  for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
    world.step(STEP, walkToward(state, 2850, 2050), false);
  }
  return { screen: SCREEN_PLAY };
}
