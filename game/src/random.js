// Seeded random numbers (mulberry32) plus small helpers built on it.
// The same seed always builds the same city, so the screenshot scenes repeat.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] from the given rng. */
export function randomInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Pick one element of an array. */
export function randomPick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** Random float in [min, max). */
export function randomRange(rng, min, max) {
  return min + rng() * (max - min);
}
