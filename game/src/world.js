// Solmar City rules: the city, the player, cars, traffic, pedestrians, police,
// wanted level, combat, particles, missions and save state. No drawing, no
// browser in here — step() advances one fixed step and returns event flags.
import { BEACH, CAR, DAY_LENGTH, PALETTE, PLAYER, PICKUP, POLICE, RIVAL, ROADS, STEP, WANTED, WORLD } from './config.js';
import { randomInt, randomPick, randomRange } from './random.js';
import { MISSION_DEFS, startMission, updateMission } from './missions.js';

export const EVENT_SHOT = 1;
export const EVENT_EXPLOSION = 2;
export const EVENT_CRASH = 4;
export const EVENT_PICKUP = 8;
export const EVENT_CASH = 16;
export const EVENT_MISSION = 32;
export const EVENT_BUSTED = 64;
export const EVENT_WASTED = 128;
export const EVENT_HIT = 256;

const CAR_COLORS = ['#c94f4f', '#4f7ec9', '#e8e8e8', '#5cb85c', '#8e5fc9', '#d97b2f', '#3fb8af'];
const PED_COLORS = ['#e8b98a', '#c98a5f', '#8a5f3d', '#f0c8a0'];
const SHIRT_COLORS = ['#e8e8e8', '#4f7ec9', '#5cb85c', '#c94f4f', '#f2c230', '#8e5fc9', '#d97b2f'];

function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createWorld(random) {
  const state = {
    player: null, cars: [], peds: [], enemies: [], bullets: [], particles: [],
    pickups: [], skidmarks: [], buildings: [], trees: [], containers: [],
    wanted: 0, wantedTimer: 0, crimeTimer: 0, time: 0, elapsed: 0,
    camera: { x: 600, y: 600 }, shake: 0, flash: 0,
    message: '', messageTimer: 0,
    mission: { index: 0, stage: 0, active: false, done: [false, false, false, false], marker: null, objective: '', timer: 0, enemiesSpawned: false, cashReady: false },
    stats: { kills: 0, carsStolen: 0 },
    busted: false, wasted: false, gameComplete: false,
    interactPressed: false, threat: null, seedNote: 0,
  };

  function isRoad(x, y) {
    for (const rx of ROADS.vertical) if (Math.abs(x - rx) < ROADS.halfWidth) return true;
    for (const ry of ROADS.horizontal) if (Math.abs(y - ry) < ROADS.halfWidth) return true;
    return false;
  }

  function circleHitsBuilding(x, y, r) {
    for (const b of state.buildings) {
      const cx = clamp(x, b.x, b.x + b.w);
      const cy = clamp(y, b.y, b.y + b.h);
      if (dist(x, y, cx, cy) < r) return b;
    }
    return null;
  }

  /** Push a circle out of buildings, world bounds and deep water. */
  function resolveCircle(pos, r) {
    pos.x = clamp(pos.x, r + 4, WORLD.width - r - 4);
    pos.y = clamp(pos.y, r + 4, WORLD.height - r - 4);
    if (pos.y > BEACH.waterY - r) pos.y = BEACH.waterY - r;
    for (let pass = 0; pass < 3; pass += 1) {
      const b = circleHitsBuilding(pos.x, pos.y, r);
      if (!b) break;
      const cx = clamp(pos.x, b.x, b.x + b.w);
      const cy = clamp(pos.y, b.y, b.y + b.h);
      let dx = pos.x - cx;
      let dy = pos.y - cy;
      let d = Math.hypot(dx, dy);
      if (d < 0.01) { dx = 0; dy = -1; d = 1; }
      pos.x = cx + (dx / d) * r;
      pos.y = cy + (dy / d) * r;
    }
    return pos;
  }

  function buildCity() {
    state.buildings = [];
    state.trees = [];
    state.containers = [];
    const v = ROADS.vertical;
    const h = ROADS.horizontal;
    for (let i = 0; i < v.length - 1; i += 1) {
      for (let j = 0; j < h.length - 1; j += 1) {
        const x0 = v[i] + ROADS.halfWidth + 10;
        const x1 = v[i + 1] - ROADS.halfWidth - 10;
        const y0 = h[j] + ROADS.halfWidth + 10;
        const y1 = h[j + 1] - ROADS.halfWidth - 10;
        if (y0 > BEACH.sandY) continue;
        // Central park block.
        if (i === 2 && j === 2) {
          for (let t = 0; t < 14; t += 1) {
            state.trees.push({ x: randomRange(random, x0 + 20, x1 - 20), y: randomRange(random, y0 + 20, y1 - 20), r: randomRange(random, 12, 22) });
          }
          continue;
        }
        // Port / industrial blocks, bottom right.
        if (i >= 6 && j >= 4) {
          for (let c = 0; c < 6; c += 1) {
            state.containers.push({
              x: randomRange(random, x0, x1 - 90), y: randomRange(random, y0 + c * 34, y0 + c * 34 + 24),
              w: 90, h: 24, color: randomPick(random, ['#b8543f', '#3f7eb8', '#5c9e4a', '#c9a23f']),
            });
          }
          continue;
        }
        // One or two buildings per block, with a seeded roof colour.
        const bw = (x1 - x0) / (random() < 0.4 ? 2 : 1);
        for (let b = 0; b < Math.round((x1 - x0) / bw); b += 1) {
          const w = bw - 26 - random() * 30;
          const hh = (y1 - y0) - 30 - random() * 40;
          state.buildings.push({
            x: x0 + b * bw + 14, y: y0 + 16 + random() * 20, w, h: hh,
            color: randomPick(random, ['#8a6f5c', '#6f7d8a', '#a08a6a', '#7a6a8a', '#96705a', '#5f7a6a']),
            roof: randomPick(random, ['#5c4a3d', '#3d4a5c', '#6a5c4a']),
          });
        }
      }
    }
  }

  function makeCar(kind, x, y, angle, opts) {
    const spec = CAR.kinds[kind];
    const car = {
      kind, x, y, angle, speed: 0, health: CAR.health, maxHealth: CAR.health,
      color: (opts && opts.color) || spec.color, target: !!(opts && opts.target),
      traffic: !!(opts && opts.traffic), police: kind === 'police',
      driver: !!(opts && opts.driver), axis: (opts && opts.axis) || 'v', dir: (opts && opts.dir) || 1,
      lane: (opts && opts.lane) || 0, cruise: randomRange(random, 170, 260), turnCd: 0, dead: false,
    };
    return car;
  }

  function spawnTrafficCar() {
    const vertical = random() < 0.5;
    let x; let y; let axis; let dir;
    if (vertical) {
      x = randomPick(random, ROADS.vertical);
      y = randomRange(random, 120, WORLD.height - 200);
      axis = 'v'; dir = random() < 0.5 ? 1 : -1;
    } else {
      x = randomRange(random, 120, WORLD.width - 120);
      y = randomPick(random, ROADS.horizontal);
      axis = 'h'; dir = random() < 0.5 ? 1 : -1;
    }
    const car = makeCar(randomPick(random, ['sedan', 'sedan', 'taxi', 'truck']), x, y, axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), { traffic: true, driver: true, axis, dir, lane: randomPick(random, [-18, 18]) });
    state.cars.push(car);
    return car;
  }

  function spawnPed() {
    // On a sidewalk next to a random road.
    const vertical = random() < 0.5;
    let x; let y;
    if (vertical) {
      x = randomPick(random, ROADS.vertical) + randomPick(random, [-58, 58]);
      y = randomRange(random, 120, WORLD.height - 200);
    } else {
      x = randomRange(random, 120, WORLD.width - 120);
      y = randomPick(random, ROADS.horizontal) + randomPick(random, [-58, 58]);
    }
    const ped = {
      x, y, angle: randomRange(random, 0, Math.PI * 2), speed: randomRange(random, 55, 95),
      tx: x, ty: y, state: 'walk', hp: 30, fleeT: 0,
      skin: randomPick(random, PED_COLORS), shirt: randomPick(random, SHIRT_COLORS),
    };
    pickPedTarget(ped);
    state.peds.push(ped);
    return ped;
  }

  function pickPedTarget(ped) {
    const vertical = random() < 0.5;
    if (vertical) {
      ped.tx = randomPick(random, ROADS.vertical) + randomPick(random, [-58, 58]);
      ped.ty = randomRange(random, 120, WORLD.height - 200);
    } else {
      ped.tx = randomRange(random, 120, WORLD.width - 120);
      ped.ty = randomPick(random, ROADS.horizontal) + randomPick(random, [-58, 58]);
    }
  }

  function burst(x, y, color, count, speed, life, size) {
    for (let i = 0; i < count; i += 1) {
      const a = randomRange(random, 0, Math.PI * 2);
      const s = randomRange(random, speed * 0.3, speed);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: randomRange(random, life * 0.5, life), maxLife: life, color, size: randomRange(random, size * 0.6, size * 1.4) });
    }
    if (state.particles.length > 420) state.particles.splice(0, state.particles.length - 420);
  }

  function notify(text) {
    state.message = text;
    state.messageTimer = 4;
  }

  function addWanted(n) {
    const before = state.wanted;
    state.wanted = clamp(state.wanted + n, 0, WANTED.max);
    if (state.wanted > before) state.crimeTimer = 0;
  }

  function setWanted(n) {
    state.wanted = clamp(n, 0, WANTED.max);
    state.crimeTimer = 0;
  }

  function explode(x, y, causePlayer) {
    burst(x, y, '#ff9a3c', 26, 320, 0.7, 9);
    burst(x, y, '#e5534b', 18, 220, 0.9, 12);
    burst(x, y, '#5a5a5a', 14, 120, 1.4, 14);
    state.shake = Math.max(state.shake, 16);
    state.flash = 0.25;
    state.threat = { x, y, t: 2 };
    for (const car of state.cars) {
      if (!car.dead && dist(x, y, car.x, car.y) < 150) damageCar(car, 60, causePlayer);
    }
    const p = state.player;
    if (dist(x, y, p.x, p.y) < 130 && !p.inCar) hurtPlayer(30);
    if (causePlayer) addWanted(1);
  }

  function damageCar(car, amount, causePlayer) {
    if (car.dead) return;
    car.health -= amount;
    if (car.health <= 0) {
      car.dead = true;
      car.health = 0;
      explode(car.x, car.y, causePlayer);
      if (car === state.player.car) {
        state.player.car = null;
        state.player.inCar = false;
      }
    } else if (car.health < 35) {
      burst(car.x, car.y, '#888888', 2, 60, 0.8, 6);
    }
  }

  function hurtPlayer(amount) {
    const p = state.player;
    if (p.invuln > 0) return;
    p.hp -= amount;
    p.invuln = 0.4;
    state.flash = 0.35;
    state.shake = Math.max(state.shake, 6);
    if (p.hp <= 0) {
      p.hp = 0;
      state.wasted = true;
    }
  }

  function spawnRivals(x, y) {
    for (let i = 0; i < 4; i += 1) {
      state.enemies.push({
        x: x + randomRange(random, -90, 90), y: y + randomRange(random, -70, 70),
        angle: 0, hp: RIVAL.health, kind: 'rival', shootCd: randomRange(random, 1.2, 2.2), speed: RIVAL.speed,
      });
    }
  }

  function spawnPoliceCar() {
    const p = state.player;
    const a = randomRange(random, 0, Math.PI * 2);
    const road = randomPick(random, ROADS.vertical);
    const x = clamp(p.x + Math.cos(a) * 650, 120, WORLD.width - 120);
    const y = clamp(p.y + Math.sin(a) * 650, 120, WORLD.height - 120);
    const car = makeCar('police', x, y, angleTo(x, y, p.x, p.y), { traffic: false, driver: true });
    car.x = road; // sit on a road so the chase starts cleanly
    car.y = y;
    state.cars.push(car);
    return car;
  }

  function spawnFootCop() {
    const p = state.player;
    const a = randomRange(random, 0, Math.PI * 2);
    state.enemies.push({
      x: clamp(p.x + Math.cos(a) * 320, 60, WORLD.width - 60),
      y: clamp(p.y + Math.sin(a) * 320, 60, WORLD.height - 60),
      angle: 0, hp: 60, kind: 'cop', shootCd: 1, speed: POLICE.footSpeed, arrest: 0,
    });
  }

  function reset() {
    buildCity();
    state.cars = [];
    state.peds = [];
    state.enemies = [];
    state.bullets = [];
    state.particles = [];
    state.skidmarks = [];
    state.pickups = [];
    state.wanted = 0;
    state.wantedTimer = 0;
    state.crimeTimer = 0;
    state.time = 0;
    state.elapsed = 0;
    state.shake = 0;
    state.flash = 0;
    state.message = '';
    state.messageTimer = 0;
    state.busted = false;
    state.wasted = false;
    state.gameComplete = false;
    state.stats = { kills: 0, carsStolen: 0 };
    state.mission = { index: 0, stage: 0, active: false, done: [false, false, false, false], marker: null, objective: '', timer: 0, enemiesSpawned: false, cashReady: false };
    state.player = {
      x: 600, y: 660, angle: -Math.PI / 2, hp: PLAYER.health, money: 50,
      inCar: false, car: null, carKind: null, carTarget: false, speed: 0,
      shootCd: 0, punchCd: 0, invuln: 0, arrestTimer: 0, moving: false,
    };
    state.camera = { x: 600, y: 660 };
    // Parked cars around the city, plus the mission target sports car.
    const parkedSpots = [
      [1000, 258, 'sedan'], [1400, 258, 'taxi'], [1800, 142, 'sedan'], [600, 1058, 'sedan'],
      [2600, 658, 'truck'], [3000, 1458, 'sedan'], [1400, 2058, 'taxi'], [200, 1858, 'sedan'],
    ];
    for (const [x, y, kind] of parkedSpots) {
      state.cars.push(makeCar(kind, x, y, randomRange(random, 0, Math.PI * 2), { traffic: false, driver: false }));
    }
    state.cars.push(makeCar('sport', 2200, 1000, Math.PI / 2, { traffic: false, driver: false, target: true, color: '#f2c230' }));
    for (let i = 0; i < 10; i += 1) spawnTrafficCar();
    for (let i = 0; i < 18; i += 1) spawnPed();
    const kitSpots = [[600, 300], [1400, 1100], [2200, 300], [1000, 1900], [2600, 1100], [300, 1400], [1800, 700], [2800, 2000]];
    for (const [x, y] of kitSpots) state.pickups.push({ x, y, kind: 'health', active: true, timer: 0 });
    startMission(state, 0);
    notify(MISSION_DEFS[0].intro);
  }

  function nearestCar(x, y, maxD) {
    let best = null;
    let bestD = maxD;
    for (const car of state.cars) {
      if (car.dead) continue;
      const d = dist(x, y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function stepPlayer(dt, input, harmless) {
    const p = state.player;
    if (p.shootCd > 0) p.shootCd -= dt;
    if (p.punchCd > 0) p.punchCd -= dt;
    if (p.invuln > 0) p.invuln -= dt;

    if (p.inCar && p.car) {
      const car = p.car;
      const spec = CAR.kinds[car.kind];
      const fwd = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
      const accelInput = input.my < 0 ? 1 : input.my > 0 ? -0.6 : 0; // W = forward, S = brake/reverse
      const steerInput = input.mx; // A/D
      const handbrake = input.handbrake;
      if (accelInput > 0) car.speed += spec.accel * dt;
      else if (accelInput < 0) {
        if (car.speed > 30) car.speed -= CAR.brake * dt;
        else car.speed -= spec.accel * 0.55 * dt;
      } else {
        car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
      }
      const maxSpeed = spec.maxSpeed * (car.health < 35 ? 0.55 : 1);
      car.speed = clamp(car.speed, -CAR.reverseMax, maxSpeed);
      const steerAuthority = clamp(Math.abs(car.speed) / 160, 0, 1);
      car.angle += steerInput * CAR.steerRate * steerAuthority * dt * Math.sign(car.speed || 1) * (handbrake ? 1.7 : 1);
      const nx = car.x + fwd.x * car.speed * dt;
      const ny = car.y + fwd.y * car.speed * dt;
      const hit = circleHitsBuilding(nx, ny, CAR.radius - 4);
      if (hit || nx < 20 || nx > WORLD.width - 20 || ny < 20 || ny > WORLD.height - 20) {
        if (Math.abs(car.speed) > 200) {
          damageCar(car, Math.max(0, (Math.abs(car.speed) - 150) * 0.03), false);
          state.shake = Math.max(state.shake, 8);
          burst(car.x, car.y, '#cccccc', 6, 140, 0.5, 5);
        }
        car.speed *= -0.25;
      } else {
        car.x = nx;
        car.y = ny;
      }
      if (handbrake && Math.abs(car.speed) > 150) {
        state.skidmarks.push({ x: car.x, y: car.y, angle: car.angle, life: 2.5 });
        if (Math.random() < 0.3) burst(car.x, car.y, '#bbbbbb', 1, 40, 0.4, 4);
      }
      if (Math.abs(car.speed) > 60 && Math.random() < 0.25) {
        burst(car.x - fwd.x * 30, car.y - fwd.y * 30, '#999999', 1, 30, 0.5, 4);
      }
      if (car.health < 35 && Math.random() < 0.2) burst(car.x, car.y - 10, '#666666', 1, 50, 1, 7);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.speed = car.speed;
      p.carKind = car.kind;
      p.carTarget = car.target;
      if (input.enter) {
        // Step out beside the car.
        p.inCar = false;
        p.car = null;
        p.carKind = null;
        p.carTarget = false;
        p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 46;
        p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 46;
        resolveCircle(p, PLAYER.radius);
        car.speed *= 0.2;
      }
      return 0;
    }

    // On foot.
    const speed = input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const moving = input.mx !== 0 || input.my !== 0;
    p.moving = moving;
    p.speed = moving ? speed : 0;
    if (moving) {
      p.x += input.mx * speed * dt;
      p.y += input.my * speed * dt;
      resolveCircle(p, PLAYER.radius);
      if (input.aimX !== undefined) p.angle = angleTo(p.x, p.y, input.aimX, input.aimY);
    } else if (input.aimX !== undefined) {
      p.angle = angleTo(p.x, p.y, input.aimX, input.aimY);
    }
    if (input.enter && !harmless) {
      const m = state.mission;
      const nearCollect = m.active && m.marker && dist(p.x, p.y, m.marker.x, m.marker.y) < 80 &&
        (MISSION_DEFS[m.index].stages[m.stage].kind === 'collect');
      if (!nearCollect) {
        const car = nearestCar(p.x, p.y, 85);
        if (car) {
          p.inCar = true;
          p.car = car;
          p.carKind = car.kind;
          p.carTarget = car.target;
          if (car.traffic && car.driver) {
            // The driver bails and runs.
            const driver = spawnPed();
            driver.x = car.x + 40;
            driver.y = car.y + 40;
            driver.state = 'flee';
            driver.fleeT = 3;
            car.driver = false;
            addWanted(1);
            notify('Car stolen! The driver ran off screaming.');
          } else if (!car.traffic) {
            addWanted(1);
            notify('Car stolen! +1 wanted star.');
          }
          state.stats.carsStolen += 1;
          return EVENT_CASH;
        }
      }
    }
    if (input.punch && p.punchCd <= 0) {
      p.punchCd = PLAYER.punchCooldown;
      const px = p.x + Math.cos(p.angle) * 26;
      const py = p.y + Math.sin(p.angle) * 26;
      for (const e of state.enemies) {
        if (e.hp > 0 && dist(px, py, e.x, e.y) < PLAYER.punchRange + 12) {
          e.hp -= PLAYER.punchDamage;
          burst(e.x, e.y, '#ffdd55', 6, 160, 0.4, 5);
          if (e.hp <= 0) {
            state.stats.kills += 1;
            if (e.kind === 'cop') addWanted(2);
          }
          return EVENT_HIT;
        }
      }
      return EVENT_HIT;
    }
    if (input.shoot && p.shootCd <= 0 && !harmless) {
      p.shootCd = PLAYER.shootCooldown;
      const a = angleTo(p.x, p.y, input.aimX, input.aimY) + randomRange(random, -0.03, 0.03);
      state.bullets.push({
        x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22,
        vx: Math.cos(a) * 950, vy: Math.sin(a) * 950, life: 0.8,
        from: 'player', damage: PLAYER.bulletDamage,
      });
      burst(p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 26, '#ffd94d', 4, 180, 0.15, 4);
      state.threat = { x: p.x, y: p.y, t: 1.5 };
      // Firing where the police can see it is a crime: +1 star if a cop is near.
      if (!harmless && (state.cars.some((c) => c.police && !c.dead && dist(c.x, c.y, p.x, p.y) < 520) ||
        state.enemies.some((e) => e.kind === 'cop' && dist(e.x, e.y, p.x, p.y) < 520))) {
        addWanted(1);
        notify('Shots fired! The police saw that.');
      }
      return EVENT_SHOT;
    }
    return 0;
  }

  function stepTraffic(dt) {
    const p = state.player;
    for (const car of state.cars) {
      if (!car.traffic || car.dead) continue;
      car.turnCd -= dt;
      // Slow for a car ahead on the same road.
      let blocked = false;
      for (const other of state.cars) {
        if (other === car || other.dead) continue;
        if (other.axis === car.axis && Math.abs((car.axis === 'v' ? other.x - car.x : other.y - car.y)) < 40) {
          const along = car.axis === 'v' ? (other.y - car.y) * car.dir : (other.x - car.x) * car.dir;
          if (along > 0 && along < 80) blocked = true;
        }
      }
      const target = blocked ? 0 : car.cruise;
      car.speed += clamp(target - car.speed, -500 * dt, 320 * dt);
      // Maybe turn at an intersection.
      const nearCross = car.axis === 'v'
        ? ROADS.horizontal.some((hy) => Math.abs(car.y - hy) < 24)
        : ROADS.vertical.some((vx) => Math.abs(car.x - vx) < 24);
      if (nearCross && car.turnCd <= 0 && random() < 0.02) {
        car.turnCd = 4;
        if (random() < 0.5) {
          if (car.axis === 'v') {
            car.axis = 'h';
            car.dir = random() < 0.5 ? 1 : -1;
            car.y = ROADS.horizontal.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
            car.lane = randomPick(random, [-18, 18]);
          } else {
            car.axis = 'v';
            car.dir = random() < 0.5 ? 1 : -1;
            car.x = ROADS.vertical.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
            car.lane = randomPick(random, [-18, 18]);
          }
        } else {
          car.dir *= -1;
        }
      }
      if (car.axis === 'v') {
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.x += (car.lane - (car.x - Math.round(car.x / 400) * 400)) * 0; // stay on road
        car.y += car.dir * car.speed * dt;
        car.x = clamp(car.x, 60, WORLD.width - 60);
        if (car.y < 80) { car.y = 80; car.dir = 1; }
        if (car.y > WORLD.height - 80) { car.y = WORLD.height - 80; car.dir = -1; }
      } else {
        car.angle = car.dir > 0 ? 0 : Math.PI;
        car.x += car.dir * car.speed * dt;
        car.y = clamp(car.y, 60, WORLD.height - 60);
        if (car.x < 80) { car.x = 80; car.dir = 1; }
        if (car.x > WORLD.width - 80) { car.x = WORLD.width - 80; car.dir = -1; }
      }
      // Snap back onto the road centre + lane offset.
      if (car.axis === 'v') {
        const road = ROADS.vertical.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
        car.x = road + car.lane;
      } else {
        const road = ROADS.horizontal.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
        car.y = road + car.lane;
      }
      // Running over a pedestrian.
      for (const ped of state.peds) {
        if (dist(car.x, car.y, ped.x, ped.y) < 30 && Math.abs(car.speed) > 90) {
          ped.hp = 0;
          burst(ped.x, ped.y, '#c94f4f', 10, 200, 0.6, 5);
          if (car === state.player.car) addWanted(1);
        }
      }
    }
    state.cars = state.cars.filter((c) => !c.dead || c === state.player.car);
  }

  function stepPeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.hp <= 0) continue;
      if (state.threat && dist(ped.x, ped.y, state.threat.x, state.threat.y) < 420) {
        ped.state = 'flee';
        ped.fleeT = 2.5;
      }
      if (ped.fleeT > 0) {
        ped.fleeT -= dt;
        const a = angleTo(p.x, p.y, ped.x + (ped.x - (state.threat ? state.threat.x : p.x)), ped.y + (ped.y - (state.threat ? state.threat.y : p.y)));
        ped.angle = a;
        ped.x += Math.cos(a) * 220 * dt;
        ped.y += Math.sin(a) * 220 * dt;
        resolveCircle(ped, 12);
        if (ped.fleeT <= 0) ped.state = 'walk';
        continue;
      }
      const d = dist(ped.x, ped.y, ped.tx, ped.ty);
      if (d < 24) pickPedTarget(ped);
      else {
        ped.angle = angleTo(ped.x, ped.y, ped.tx, ped.ty);
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        resolveCircle(ped, 12);
      }
    }
    state.peds = state.peds.filter((ped) => ped.hp > 0);
    if (state.peds.length < 14 && random() < 0.01) spawnPed();
  }

  function stepEnemies(dt) {
    const p = state.player;
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const d = dist(e.x, e.y, p.x, p.y);
      e.shootCd -= dt;
      if (e.kind === 'cop') {
        // Chase; arrest if close while the player is slow or on foot and still.
        if (d > 26) {
          e.angle = angleTo(e.x, e.y, p.x, p.y);
          e.x += Math.cos(e.angle) * e.speed * dt;
          e.y += Math.sin(e.angle) * e.speed * dt;
          resolveCircle(e, 12);
          e.arrest = 0;
        } else if (!p.inCar && p.speed < 70) {
          // Only a player on foot, slow or standing still, can be arrested.
          e.arrest = (e.arrest || 0) + dt;
          if (e.arrest > POLICE.arrestSeconds) {
            state.busted = true;
            return;
          }
        }
        if (d < POLICE.shootRange && d > 120 && e.shootCd <= 0 && !p.inCar) {
          e.shootCd = POLICE.shootCooldown;
          const a = angleTo(e.x, e.y, p.x, p.y) + randomRange(random, -0.12, 0.12);
          state.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, life: 0.9, from: 'enemy', damage: POLICE.bulletDamage });
        }
      } else {
        // Rival gang member: close in, then shoot.
        if (d > 260) {
          e.angle = angleTo(e.x, e.y, p.x, p.y);
          e.x += Math.cos(e.angle) * e.speed * dt;
          e.y += Math.sin(e.angle) * e.speed * dt;
          resolveCircle(e, 12);
        } else if (e.shootCd <= 0) {
          e.shootCd = RIVAL.shootCooldown;
          const a = angleTo(e.x, e.y, p.x, p.y) + randomRange(random, -0.1, 0.1);
          state.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, life: 0.9, from: 'enemy', damage: RIVAL.bulletDamage });
        }
      }
    }
    state.enemies = state.enemies.filter((e) => e.hp > 0);
  }

  function stepPolice(dt) {
    const p = state.player;
    const wantedCars = state.cars.filter((c) => c.police && !c.dead);
    const wantCars = state.wanted;
    if (wantedCars.length < wantCars) spawnPoliceCar();
    if (wantedCars.length > wantCars && wantedCars.length > 0) {
      const far = wantedCars[wantedCars.length - 1];
      far.dead = true;
    }
    const wantCops = state.wanted >= 2 ? state.wanted - 1 : 0;
    const cops = state.enemies.filter((e) => e.kind === 'cop');
    if (cops.length < wantCops) spawnFootCop();
    // Police cars chase and ram.
    for (const car of wantedCars) {
      const d = dist(car.x, car.y, p.x, p.y);
      const targetAngle = angleTo(car.x, car.y, p.x, p.y);
      car.angle += clamp(angleDiff(car.angle, targetAngle), -2.2 * dt, 2.2 * dt);
      const spec = CAR.kinds.police;
      const boost = 1 + state.wanted * 0.06;
      car.speed = clamp(car.speed + spec.accel * dt, 0, spec.maxSpeed * boost);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (!circleHitsBuilding(nx, ny, CAR.radius - 4)) {
        car.x = nx;
        car.y = ny;
      } else {
        car.speed *= 0.5;
        car.angle += 0.6 * dt * 10;
      }
      if (d < 46) {
        // Ram! Limited by a cooldown so contact is a shove, not a shredder.
        car.ramCd = (car.ramCd || 0) - dt;
        if (car.ramCd <= 0) {
          car.ramCd = 0.8;
          if (p.inCar && p.car) damageCar(p.car, 3, false);
          else hurtPlayer(POLICE.ramDamage);
          car.speed *= 0.4;
          state.shake = Math.max(state.shake, 5);
        }
      }
      // Police car vs player car collision damage.
      if (p.inCar && p.car && p.car !== car && dist(car.x, car.y, p.car.x, p.car.y) < 52 && Math.abs(car.speed) > 150) {
        car.ramCd = (car.ramCd || 0) - dt;
        if (car.ramCd <= 0) {
          car.ramCd = 0.8;
          damageCar(p.car, 2, false);
          damageCar(car, 2, false);
        }
      }
    }
    // Wanted decay: quiet for a while and out of police sight.
    const nearestCop = Math.min(
      ...state.cars.filter((c) => c.police && !c.dead).map((c) => dist(c.x, c.y, p.x, p.y)),
      ...state.enemies.filter((e) => e.kind === 'cop').map((e) => dist(e.x, e.y, p.x, p.y)),
      Infinity,
    );
    state.crimeTimer += dt;
    if (state.wanted > 0 && state.crimeTimer > WANTED.decaySeconds && nearestCop > WANTED.decayRange) {
      state.wanted -= 1;
      state.crimeTimer = 0;
      notify(state.wanted === 0 ? 'You lost the cops.' : `Wanted level dropped to ${state.wanted} star${state.wanted > 1 ? 's' : ''}.`);
    }
  }

  function stepBullets(dt) {
    const p = state.player;
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      if (circleHitsBuilding(b.x, b.y, 2) || b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height) {
        b.life = 0;
        burst(b.x, b.y, '#aaaaaa', 3, 90, 0.25, 3);
        continue;
      }
      if (b.from === 'player') {
        for (const e of state.enemies) {
          if (e.hp > 0 && dist(b.x, b.y, e.x, e.y) < 16) {
            e.hp -= b.damage;
            b.life = 0;
            burst(b.x, b.y, '#ff5a4d', 6, 160, 0.35, 4);
            if (e.hp <= 0) {
              state.stats.kills += 1;
              if (e.kind === 'cop') addWanted(2);
            }
            break;
          }
        }
        if (b.life > 0) {
          for (const car of state.cars) {
            if (!car.dead && car !== p.car && dist(b.x, b.y, car.x, car.y) < 30) {
              damageCar(car, b.damage, true);
              b.life = 0;
              burst(b.x, b.y, '#ffd94d', 4, 120, 0.3, 4);
              break;
            }
          }
        }
      } else if (!p.inCar && dist(b.x, b.y, p.x, p.y) < 16) {
        hurtPlayer(b.damage);
        b.life = 0;
      } else if (p.inCar && p.car && dist(b.x, b.y, p.car.x, p.car.y) < 30) {
        damageCar(p.car, b.damage * 0.5, false);
        b.life = 0;
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);
  }

  function stepPickups(dt) {
    const p = state.player;
    for (const kit of state.pickups) {
      if (!kit.active) {
        kit.timer -= dt;
        if (kit.timer <= 0) kit.active = true;
        continue;
      }
      if (dist(p.x, p.y, kit.x, kit.y) < 34 && p.hp < PLAYER.health) {
        kit.active = false;
        kit.timer = PICKUP.respawn;
        p.hp = Math.min(PLAYER.health, p.hp + PICKUP.health);
        burst(kit.x, kit.y, '#58c96b', 10, 120, 0.6, 5);
        notify('Health +25');
      }
    }
  }

  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.time += dt;
    if (state.messageTimer > 0) {
      state.messageTimer -= dt;
      if (state.messageTimer <= 0) state.message = '';
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt);
    if (state.threat) {
      state.threat.t -= dt;
      if (state.threat.t <= 0) state.threat = null;
    }
    state.interactPressed = !!(input && input.enter);

    events |= stepPlayer(dt, input || { mx: 0, my: 0 }, harmless);
    stepTraffic(dt);
    stepPeds(dt);
    stepEnemies(dt);
    if (!harmless) stepPolice(dt);
    stepBullets(dt);
    stepPickups(dt);

    // Particles and skid marks.
    for (const pt of state.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.98;
      pt.vy *= 0.98;
      pt.life -= dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
    for (const s of state.skidmarks) s.life -= dt;
    state.skidmarks = state.skidmarks.filter((s) => s.life > 0);

    // Missions.
    if (!harmless && !state.gameComplete) {
      const before = state.mission.index;
      updateMission(state, {
        notify,
        addMoney(n) { state.player.money += n; events |= EVENT_CASH; },
        setWanted,
        spawnRivals,
        markComplete() { state.gameComplete = true; },
      }, dt);
      if (state.mission.index !== before) events |= EVENT_MISSION;
    }

    // Busted / wasted respawn.
    if (state.busted) {
      events |= EVENT_BUSTED;
      const p = state.player;
      p.money = Math.max(0, Math.floor(p.money * 0.9));
      p.hp = PLAYER.health;
      p.x = 600; p.y = 260;
      p.inCar = false; p.car = null; p.carKind = null; p.carTarget = false;
      state.wanted = 0;
      state.enemies = state.enemies.filter((e) => e.kind !== 'cop');
      state.busted = false;
      notify('BUSTED! You lost 10% of your cash at the station.');
      if (state.mission.active) { startMission(state, state.mission.index); }
    }
    if (state.wasted) {
      events |= EVENT_WASTED;
      const p = state.player;
      p.money = Math.max(0, Math.floor(p.money * 0.9));
      p.hp = PLAYER.health;
      p.x = 1800; p.y = 260;
      p.inCar = false; p.car = null; p.carKind = null; p.carTarget = false;
      state.wanted = 0;
      state.enemies = state.enemies.filter((e) => e.kind !== 'cop');
      state.wasted = false;
      notify('WASTED! You woke up at the hospital, 10% poorer.');
      if (state.mission.active) { startMission(state, state.mission.index); }
    }

    // Camera follows the player.
    const p = state.player;
    const tx = clamp(p.x, 640, WORLD.width - 640);
    const ty = clamp(p.y, 360, WORLD.height - 360);
    state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 5);
    state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 5);
    return events;
  }

  reset();
  return {
    state, reset, step, addWanted, setWanted, spawnRivals, notify, explode,
    isRoad, daylight() {
      const frac = (state.time % DAY_LENGTH) / DAY_LENGTH;
      return 0.5 + 0.5 * Math.sin(frac * Math.PI * 2 - Math.PI / 2);
    },
    save() {
      return {
        money: state.player.money,
        missionsDone: state.mission.done,
        missionIndex: state.mission.index,
        x: state.player.x, y: state.player.y, hp: state.player.hp,
      };
    },
    load(save) {
      if (!save) return false;
      state.player.money = save.money || 0;
      state.player.x = save.x || 600;
      state.player.y = save.y || 660;
      state.player.hp = save.hp || PLAYER.health;
      state.mission.done = save.missionsDone || [false, false, false, false];
      const next = state.mission.done.findIndex((d) => !d);
      startMission(state, next === -1 ? 0 : next);
      resolveCircle(state.player, PLAYER.radius);
      return true;
    },
  };
}
