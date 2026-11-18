// random.js — a small seeded random number generator, so the city is the same
// on every load. The game uses one seeded stream for the world layout and the
// built-in Math.random for gameplay, which never needs to repeat.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick one element of an array with a seeded stream.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// A number between min and max, from a seeded stream.
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// A whole number between min and max inclusive, from a seeded stream.
export function int(rng, min, max) {
  return Math.floor(min + rng() * (max - min + 1));
}
