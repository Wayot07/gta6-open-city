// Solmar City — every tuning number, colour and world constant in one place.
// The world is 3200x2400; the camera shows a 1280x720 window of it.

export const WORLD = { width: 3200, height: 2400 };
export const VIEW = { width: 1280, height: 720 };

/** Fixed simulation step: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

/** Road centre lines (vertical x, horizontal y) and half width of the asphalt. */
export const ROADS = {
  vertical: [200, 600, 1000, 1400, 1800, 2200, 2600, 3000],
  horizontal: [200, 600, 1000, 1400, 1800, 2200],
  halfWidth: 46,
  sidewalk: 14,
};

/** Beach strip along the south edge; water is the last band and blocks movement. */
export const BEACH = { sandY: 2260, waterY: 2360 };

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  sprintSpeed: 340,
  health: 100,
  punchDamage: 25,
  punchRange: 34,
  punchCooldown: 0.45,
  shootCooldown: 0.28,
  bulletDamage: 34,
};

export const CAR = {
  length: 66,
  width: 34,
  radius: 26,
  accel: 430,
  brake: 700,
  reverseMax: 190,
  steerRate: 2.5,
  health: 100,
  kinds: {
    sedan: { maxSpeed: 520, color: '#c94f4f', accel: 420 },
    sport: { maxSpeed: 690, color: '#f2c230', accel: 560 },
    taxi: { maxSpeed: 540, color: '#f2a71b', accel: 440 },
    truck: { maxSpeed: 430, color: '#7a8a99', accel: 340 },
    police: { maxSpeed: 640, color: '#20242e', accel: 520 },
  },
};

export const WANTED = {
  max: 5,
  decaySeconds: 20,
  decayRange: 420,
};

export const POLICE = {
  footSpeed: 245,
  arrestSeconds: 2,
  ramDamage: 6,
  shootRange: 430,
  shootCooldown: 1.1,
  bulletDamage: 8,
};

export const RIVAL = {
  health: 60,
  speed: 190,
  shootRange: 380,
  shootCooldown: 1.2,
  bulletDamage: 6,
};

export const PICKUP = { health: 25, respawn: 30 };

/** One full day/night cycle, in seconds of play. */
export const DAY_LENGTH = 150;

export const PALETTE = {
  backdrop: '#0d1420',
  grass: '#5d8a4a',
  grassDark: '#527c42',
  sand: '#d9c08a',
  water: '#2e6f9e',
  waterDeep: '#245c86',
  road: '#33373f',
  roadLine: '#d8c96a',
  sidewalk: '#9aa0a8',
  curb: '#7d838c',
  park: '#4e7d3c',
  buildingRoof: '#8a6f5c',
  text: '#f2f4f6',
  muted: '#aab4c0',
  panel: 'rgba(12, 18, 28, 0.88)',
  gold: '#f2c230',
  red: '#e5534b',
  blue: '#3f8cff',
  green: '#58c96b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Local save slot (this browser only). */
export const SAVE_KEY = 'solmar-city.save.v1';
