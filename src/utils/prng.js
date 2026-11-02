/**
 * Mulberry32 Seeded Pseudo-Random Number Generator (PRNG)
 * ──────────────────────────────────────────────────────────
 * Generates identical sequences of numbers across different clients
 * given the same 32-bit integer seed.
 * Perfect for synchronous multiplayer game logic (fruit spawns, obstacles, etc.)
 */

export function mulberry32(seed) {
  let s = (typeof seed === 'number' ? seed : 1337) >>> 0;
  return function next() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Creates a seeded random utility with helper methods
 * @param {number} seed 
 */
export function createPRNG(seed) {
  const rng = mulberry32(seed);

  return {
    /** Float between 0 (inclusive) and 1 (exclusive) */
    random: rng,

    /** Float between min (inclusive) and max (exclusive) */
    range: (min, max) => min + rng() * (max - min),

    /** Integer between min (inclusive) and max (inclusive) */
    rangeInt: (min, max) => Math.floor(min + rng() * (max - min + 1)),

    /** Random item from an array */
    choice: (arr) => arr[Math.floor(rng() * arr.length)],

    /** Boolean with probability p (0 to 1) */
    chance: (p) => rng() < p,
  };
}
