// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 logical view is scaled to fit the window and centred. The world
// is drawn under a camera transform; the HUD, minimap and menus are drawn in
// screen space on top of it.
import { BEACH, FONT, PALETTE, ROADS, VIEW, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_HELP = 'help';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

const PARK = { x: 1056, y: 1056, w: 288, h: 288 };
const PORT = { x: 2656, y: 1856, w: 544, h: 344 };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, bold) {
    const key = size + (bold ? 'b' : '');
    if (!fonts.has(key)) fonts.set(key, `${bold ? 'bold ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function rect(x, y, w, h, color) {
    context.fillStyle = color;
    context.fillRect(x, y, w, h);
  }

  function circle(x, y, r, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }

  function drawCity(state, daylight) {
    const cam = state.camera;
    const left = cam.x - VIEW.width / 2;
    const top = cam.y - VIEW.height / 2;
    // Ground.
    rect(left - 40, top - 40, VIEW.width + 80, VIEW.height + 80, PALETTE.grass);
    // Beach and sea along the south edge.
    rect(left - 40, BEACH.sandY, VIEW.width + 80, WORLD.height - BEACH.sandY, PALETTE.sand);
    rect(left - 40, BEACH.waterY, VIEW.width + 80, WORLD.height - BEACH.waterY, PALETTE.water);
    context.fillStyle = PALETTE.waterDeep;
    for (let wx = 0; wx < WORLD.width; wx += 160) {
      context.fillRect(wx + ((state.time * 20) % 160), BEACH.waterY + 18, 60, 4);
    }
    // Park.
    rect(PARK.x, PARK.y, PARK.w, PARK.h, PALETTE.park);
    // Port yard.
    rect(PORT.x, PORT.y, PORT.w, PORT.h, '#6a6f75');
    // Sidewalks then asphalt.
    for (const rx of ROADS.vertical) rect(rx - ROADS.halfWidth - ROADS.sidewalk, top - 40, (ROADS.halfWidth + ROADS.sidewalk) * 2, VIEW.height + 80, PALETTE.sidewalk);
    for (const ry of ROADS.horizontal) rect(left - 40, ry - ROADS.halfWidth - ROADS.sidewalk, VIEW.width + 80, (ROADS.halfWidth + ROADS.sidewalk) * 2, PALETTE.sidewalk);
    for (const rx of ROADS.vertical) rect(rx - ROADS.halfWidth, top - 40, ROADS.halfWidth * 2, VIEW.height + 80, PALETTE.road);
    for (const ry of ROADS.horizontal) rect(left - 40, ry - ROADS.halfWidth, VIEW.width + 80, ROADS.halfWidth * 2, PALETTE.road);
    // Dashed centre lines.
    context.fillStyle = PALETTE.roadLine;
    for (const rx of ROADS.vertical) {
      for (let y = Math.floor(top / 44) * 44; y < top + VIEW.height; y += 44) context.fillRect(rx - 2, y, 4, 24);
    }
    for (const ry of ROADS.horizontal) {
      for (let x = Math.floor(left / 44) * 44; x < left + VIEW.width; x += 44) context.fillRect(x, ry - 2, 24, 4);
    }
    // Buildings.
    for (const b of state.buildings) {
      rect(b.x, b.y, b.w, b.h, b.color);
      rect(b.x + 4, b.y + 4, b.w - 8, b.h - 8, b.roof);
      context.fillStyle = 'rgba(255, 240, 180, 0.75)';
      for (let wx = b.x + 14; wx < b.x + b.w - 12; wx += 26) {
        for (let wy = b.y + 14; wy < b.y + b.h - 12; wy += 26) context.fillRect(wx, wy, 10, 12);
      }
    }
    // Port containers.
    for (const c of state.containers) rect(c.x, c.y, c.w, c.h, c.color);
    // District labels painted on the ground.
    context.font = 'bold 26px ' + FONT;
    context.fillStyle = 'rgba(255, 255, 255, 0.28)';
    context.textAlign = 'center';
    context.fillText('DOWNTOWN', 1200, 420);
    context.fillText('MARINA', 600, 2080);
    context.fillText('THE PORT', 2900, 1980);
    context.fillText('SOLMAR BEACH', 1600, 2320);
    context.fillText('PALM PARK', 1200, 1200);
    // Park trees.
    for (const t of state.trees) {
      circle(t.x, t.y, t.r, '#2f6b2a');
      circle(t.x - 4, t.y - 4, t.r * 0.6, '#3f8a35');
    }
    // Skid marks.
    context.fillStyle = 'rgba(20, 20, 20, 0.45)';
    for (const s of state.skidmarks) {
      context.save();
      context.translate(s.x, s.y);
      context.rotate(s.angle);
      context.fillRect(-16, -12, 32, 5);
      context.fillRect(-16, 7, 32, 5);
      context.restore();
    }
    // Health pickups.
    for (const kit of state.pickups) {
      if (!kit.active) continue;
      const pulse = 1 + Math.sin(state.time * 4 + kit.x) * 0.12;
      circle(kit.x, kit.y, 13 * pulse, '#ffffff');
      circle(kit.x, kit.y, 10 * pulse, '#58c96b');
      rect(kit.x - 6, kit.y - 2, 12, 4, '#ffffff');
      rect(kit.x - 2, kit.y - 6, 4, 12, '#ffffff');
    }
    // Mission marker: pulsing beacon + diamond.
    if (state.mission.marker) {
      const m = state.mission.marker;
      const pulse = 1 + Math.sin(state.time * 5) * 0.25;
      context.save();
      context.globalAlpha = 0.25;
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(m.x, m.y, 46 * pulse, 0, Math.PI * 2);
      context.fill();
      context.restore();
      context.save();
      context.translate(m.x, m.y - 46);
      context.rotate(Math.PI / 4);
      context.fillStyle = PALETTE.gold;
      context.fillRect(-11, -11, 22, 22);
      context.fillStyle = '#7a5c00';
      context.fillRect(-6, -6, 12, 12);
      context.restore();
      context.strokeStyle = 'rgba(242, 194, 48, 0.7)';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(m.x, m.y - 46);
      context.lineTo(m.x, m.y);
      context.stroke();
    }
  }

  function drawCar(car, state) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    // Wheels.
    context.fillStyle = '#16181c';
    context.fillRect(-22, -20, 14, 7);
    context.fillRect(-22, 13, 14, 7);
    context.fillRect(10, -20, 14, 7);
    context.fillRect(10, 13, 14, 7);
    // Body.
    context.fillStyle = car.dead ? '#3a3a3a' : car.color;
    context.beginPath();
    context.roundRect(-33, -17, 66, 34, 8);
    context.fill();
    // Windshield + roof.
    context.fillStyle = car.dead ? '#222' : '#9fc4dd';
    context.fillRect(8, -13, 12, 26);
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.fillRect(-8, -13, 12, 26);
    if (car.kind === 'taxi') {
      context.fillStyle = '#20242e';
      context.fillRect(-30, -17, 66, 6);
      text('TAXI', 0, 5, 9, '#20242e', 'center', true);
    }
    if (car.police) {
      context.fillStyle = '#f2f4f6';
      context.fillRect(-33, -17, 20, 34);
      context.fillStyle = '#20242e';
      text('PD', -23, 5, 10, '#f2f4f6', 'center', true);
      // Flashing light bar.
      const on = Math.floor(state.time * 6) % 2 === 0;
      context.fillStyle = on ? '#ff2d2d' : '#2d7bff';
      context.fillRect(-6, -19, 8, 5);
      context.fillStyle = on ? '#2d7bff' : '#ff2d2d';
      context.fillRect(2, -19, 8, 5);
    }
    if (car.target) {
      context.fillStyle = '#ffffff';
      context.font = 'bold 11px ' + FONT;
      context.textAlign = 'center';
      context.fillText('★ TARGET', 0, -24);
    }
    // Damage smoke.
    if (car.health < 35 && !car.dead) {
      context.fillStyle = 'rgba(120,120,120,0.7)';
      context.beginPath();
      context.arc(-20, 0, 8 + Math.sin(state.time * 9) * 3, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    // Health bar for damaged cars.
    if (car.health < 100 && !car.dead) {
      rect(car.x - 24, car.y - 30, 48, 5, 'rgba(0,0,0,0.6)');
      rect(car.x - 24, car.y - 30, 48 * (car.health / 100), 5, car.health < 35 ? '#e5534b' : '#f2c230');
    }
  }

  function drawPerson(x, y, angle, skin, shirt, isPlayer) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(0, 4, 12, 9, 0, 0, Math.PI * 2);
    context.fill();
    // Body.
    context.fillStyle = shirt;
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.fill();
    // Head.
    context.fillStyle = skin;
    context.beginPath();
    context.arc(4, 0, 6.5, 0, Math.PI * 2);
    context.fill();
    if (isPlayer) {
      // Rex: red jacket, cap, pistol in hand.
      context.fillStyle = '#c94f4f';
      context.beginPath();
      context.arc(-2, 0, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#20242e';
      context.fillRect(8, -4, 10, 3);
    }
    context.restore();
  }

  function drawWorld(state, daylight) {
    const cam = state.camera;
    const shx = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shy = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.translate(-cam.x + VIEW.width / 2 + shx, -cam.y + VIEW.height / 2 + shy);
    drawCity(state, daylight);
    for (const car of state.cars) drawCar(car, state);
    for (const ped of state.peds) drawPerson(ped.x, ped.y, ped.angle, ped.skin, ped.shirt, false);
    for (const e of state.enemies) {
      drawPerson(e.x, e.y, e.angle, '#e8b98a', e.kind === 'cop' ? '#2d4a8a' : '#7a2d2d', false);
      rect(e.x - 16, e.y - 26, 32, 4, 'rgba(0,0,0,0.6)');
      rect(e.x - 16, e.y - 26, 32 * (e.hp / 60), 4, '#e5534b');
    }
    const p = state.player;
    if (!p.inCar) drawPerson(p.x, p.y, p.angle, '#e8b98a', '#c94f4f', true);
    // Bullets as tracers.
    context.strokeStyle = '#ffe27a';
    context.lineWidth = 3;
    for (const b of state.bullets) {
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    // Particles.
    for (const pt of state.particles) {
      context.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      circle(pt.x, pt.y, pt.size, pt.color);
    }
    context.globalAlpha = 1;
    // Night tint + headlights.
    const darkness = (1 - daylight) * 0.42;
    if (darkness > 0.02) {
      context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
      context.fillStyle = `rgba(8, 10, 34, ${darkness.toFixed(3)})`;
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
      context.translate(-cam.x + VIEW.width / 2, -cam.y + VIEW.height / 2);
      if (p.inCar && p.car) {
        const car = p.car;
        context.save();
        context.translate(car.x, car.y);
        context.rotate(car.angle);
        const grad = context.createRadialGradient(40, 0, 10, 40, 0, 260);
        grad.addColorStop(0, 'rgba(255, 240, 170, 0.30)');
        grad.addColorStop(1, 'rgba(255, 240, 170, 0)');
        context.fillStyle = grad;
        context.beginPath();
        context.moveTo(30, -14);
        context.lineTo(280, -90);
        context.lineTo(280, 90);
        context.lineTo(30, 14);
        context.closePath();
        context.fill();
        context.restore();
      }
    }
  }

  function drawMinimap(state) {
    const mw = 216;
    const mh = 152;
    const mx = VIEW.width - mw - 16;
    const my = 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    rect(mx - 4, my - 4, mw + 8, mh + 8, 'rgba(10, 14, 22, 0.85)');
    rect(mx, my, mw, mh, '#274a2e');
    context.fillStyle = '#3a3f47';
    for (const rx of ROADS.vertical) context.fillRect(mx + rx * sx - 2, my, 4, mh);
    for (const ry of ROADS.horizontal) context.fillRect(mx, my + ry * sy, mw, 4);
    context.fillStyle = '#2e6f9e';
    context.fillRect(mx, my + 2260 * sy, mw, mh - 2260 * sy);
    // Cars, peds, enemies.
    for (const car of state.cars) {
      context.fillStyle = car.police ? (Math.floor(state.time * 6) % 2 === 0 ? '#ff2d2d' : '#2d7bff') : '#f2f4f6';
      context.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
    }
    for (const ped of state.peds) {
      context.fillStyle = '#c9d2dc';
      context.fillRect(mx + ped.x * sx - 1, my + ped.y * sy - 1, 2, 2);
    }
    for (const e of state.enemies) {
      context.fillStyle = e.kind === 'cop' ? '#2d7bff' : '#ff2d2d';
      context.fillRect(mx + e.x * sx - 2, my + e.y * sy - 2, 4, 4);
    }
    if (state.mission.marker) {
      const px = mx + state.mission.marker.x * sx;
      const py = my + state.mission.marker.y * sy;
      context.save();
      context.translate(px, py);
      context.rotate(Math.PI / 4);
      context.fillStyle = '#f2c230';
      context.fillRect(-5, -5, 10, 10);
      context.restore();
    }
    // Player arrow.
    const p = state.player;
    context.save();
    context.translate(mx + p.x * sx, my + p.y * sy);
    context.rotate(p.angle);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.moveTo(8, 0);
    context.lineTo(-6, -5);
    context.lineTo(-6, 5);
    context.closePath();
    context.fill();
    context.restore();
    text('SOLMAR CITY', mx + mw / 2, my + mh + 18, 11, PALETTE.muted, 'center', true);
  }

  function drawHud(state, ui) {
    const p = state.player;
    // Top-left status panel.
    rect(16, 16, 268, 92, 'rgba(10, 14, 22, 0.78)');
    text('REX', 28, 40, 18, PALETTE.text, 'left', true);
    rect(28, 50, 180, 14, 'rgba(255,255,255,0.15)');
    rect(28, 50, 180 * Math.max(0, p.hp / 100), 14, p.hp < 30 ? '#e5534b' : '#58c96b');
    text(`${Math.ceil(p.hp)}`, 216, 63, 13, PALETTE.text, 'left', true);
    text(`$${p.money.toLocaleString('en-US')}`, 28, 92, 20, PALETTE.gold, 'left', true);
    // Wanted stars.
    for (let i = 0; i < 5; i += 1) {
      text(i < state.wanted ? '★' : '☆', 150 + i * 22, 40, 20, i < state.wanted ? '#ffd94d' : 'rgba(255,255,255,0.35)', 'left', true);
    }
    // Weapon + car health.
    text(p.inCar ? `🚗 ${p.carKind ? p.carKind.toUpperCase() : 'CAR'}${p.car ? `  ${Math.ceil(p.car.health)}%` : ''}` : '🔫 PISTOL ∞  ·  👊 F', 28, 122, 15, PALETTE.text, 'left');
    drawMinimap(state);
    // Speedometer while driving.
    if (p.inCar && p.car) {
      const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
      rect(VIEW.width - 150, VIEW.height - 96, 134, 64, 'rgba(10, 14, 22, 0.78)');
      text(`${kmh}`, VIEW.width - 82, VIEW.height - 52, 34, PALETTE.text, 'center', true);
      text('KM/H', VIEW.width - 82, VIEW.height - 36, 12, PALETTE.muted, 'center');
    }
    // Mission objective bar.
    if (state.mission.objective) {
      const label = `MISSION ${state.mission.index + 1}/4 — ${state.mission.objective}`;
      context.font = 'bold 16px ' + FONT;
      const w = Math.min(860, context.measureText(label).width + 32);
      rect((VIEW.width - w) / 2, VIEW.height - 64, w, 34, 'rgba(10, 14, 22, 0.82)');
      text(label, VIEW.width / 2, VIEW.height - 41, 16, PALETTE.gold, 'center', true);
    }
    // Controls hint.
    text('WASD move · E enter car · Click shoot · F punch · Space sprint · P pause · M mute · H help', VIEW.width / 2, VIEW.height - 12, 13, 'rgba(255,255,255,0.55)', 'center');
    // Toast message.
    if (state.message) {
      context.font = 'bold 17px ' + FONT;
      const w = Math.min(900, context.measureText(state.message).width + 36);
      rect((VIEW.width - w) / 2, 128, w, 36, 'rgba(10, 14, 22, 0.85)');
      text(state.message, VIEW.width / 2, 152, 17, PALETTE.text, 'center', true);
    }
    // Damage flash + low-health vignette.
    if (state.flash > 0) {
      context.fillStyle = `rgba(229, 83, 75, ${(state.flash * 0.5).toFixed(3)})`;
      context.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    if (p.hp < 30 && p.hp > 0) {
      const grad = context.createRadialGradient(640, 360, 260, 640, 360, 640);
      grad.addColorStop(0, 'rgba(180, 0, 0, 0)');
      grad.addColorStop(1, `rgba(180, 0, 0, ${0.25 + 0.15 * Math.sin(state.time * 5)})`);
      context.fillStyle = grad;
      context.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    // Mute indicator.
    if (ui.muted) text('🔇 MUTED', VIEW.width - 24, VIEW.height - 110, 14, PALETTE.muted, 'right');
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 720;
    const height = 150 + lines.length * 30;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    rect(x, y, width, height, PALETTE.panel);
    context.strokeStyle = accent || PALETTE.gold;
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 62, 44, accent || PALETTE.gold, 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 108 + i * 30, 18, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 26, 18, PALETTE.text, 'center', true);
  }

  const TITLE_FEATURES = [
    'OPEN WORLD — drive, steal cars, roam Solmar City on foot or by car',
    'WANTED 0–5 STARS — police cars chase and ram, foot cops can bust you',
    '4 STORY MISSIONS — work for fixer Dante, from a pickup to the big bank score',
    'TRAFFIC & PEDESTRIANS — a living city with a beach, a park and a port',
    'DAY / NIGHT CYCLE — headlights after dark · save your progress (localStorage)',
  ];

  /** Paint one frame. `ui` carries menu/save/mute info for the screens. */
  function draw(state, screen, ui) {
    const daylight = ui.daylight !== undefined ? ui.daylight : 1;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawWorld(state, 0.9);
      context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
      context.fillStyle = 'rgba(8, 12, 20, 0.55)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      text('SOLMAR CITY', VIEW.width / 2, 128, 72, PALETTE.gold, 'center', true);
      text('An open-world crime story — you are Rex, wheelman for fixer Dante.', VIEW.width / 2, 168, 20, PALETTE.text, 'center');
      for (let i = 0; i < TITLE_FEATURES.length; i += 1) {
        text('★  ' + TITLE_FEATURES[i], VIEW.width / 2, 216 + i * 30, 17, PALETTE.muted, 'center');
      }
      const menu = ui.saveExists
        ? ['[Enter] NEW GAME', '[C] CONTINUE — $' + ui.saveMoney + ' · mission ' + ui.saveMission, '[H] HOW TO PLAY']
        : ['[Enter] NEW GAME', '[H] HOW TO PLAY'];
      for (let i = 0; i < menu.length; i += 1) {
        text(menu[i], VIEW.width / 2, 420 + i * 34, 22, i === 0 ? PALETTE.text : PALETTE.gold, 'center', true);
      }
      text('WASD move · E steal / enter car · Mouse aim, click shoot · F punch · Space sprint', VIEW.width / 2, 560, 16, PALETTE.muted, 'center');
      text('A wholly original game — no Rockstar content. Built for make.fun gta6-01.', VIEW.width / 2, 640, 14, 'rgba(255,255,255,0.4)', 'center');
      return;
    }
    drawWorld(state, daylight);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawHud(state, ui);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The city waits for you.', 'Missions: ' + state.mission.done.filter(Boolean).length + ' / 4 complete · $' + state.player.money], 'Press P or Esc to resume · H for help', PALETTE.blue);
    } else if (screen === SCREEN_HELP) {
      drawPanel('HOW TO PLAY', [
        'WASD / arrows — move on foot · W/S drive, A/D steer in a car',
        'E — steal / enter the nearest car · Space — sprint / handbrake',
        'Mouse — aim · Left click — shoot · F — punch',
        'Crimes raise your wanted stars (0–5). Lay low to lose the cops.',
        'Follow the gold marker: 4 missions for Dante, $200 → $800.',
        'Health kits (green crosses) heal +25. Save: progress autosaves.',
      ], 'Press H or Esc to go back', PALETTE.blue);
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED!', ['The Solmar PD caught you.', 'You lost 10% of your cash. The mission restarts.'], 'Press Enter to get back out there', PALETTE.blue);
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['You woke up at St. Marina Hospital.', 'You lost 10% of your cash. The mission restarts.'], 'Press Enter to get back out there', '#e5534b');
    } else if (screen === SCREEN_COMPLETE) {
      drawPanel('THE BIG SCORE — DONE!', ['Rex and Dante split the vault cash and vanish.', 'All 4 missions complete · $' + state.player.money + ' in the pocket.'], 'Press Enter to keep cruising Solmar City', PALETTE.gold);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
