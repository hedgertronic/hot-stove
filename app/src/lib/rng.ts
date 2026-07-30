/** mulberry32 — the single seeded RNG. ALL gameplay randomness flows through one
 * Game-owned instance so a seed fully reproduces a game (daily mode = date seed).
 * Cosmetic-only randomness (the reel flicker) uses a separate throwaway instance
 * so it can never perturb outcomes. `state` is serializable for mid-game resume. */
export class Rng {
  state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }
}

export function randomSeed(): number {
  return (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
}
