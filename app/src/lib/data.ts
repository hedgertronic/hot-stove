import type { Card, Colors, GameIndex, Meta, Owners, PlayerSeasons } from "./types";

const base = import.meta.env.BASE_URL;
const cardCache = new Map<string, Promise<Card>>();
let playersCache: Promise<PlayerSeasons> | null = null;

async function j<T>(path: string): Promise<T> {
  const res = await fetch(base + path);
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const loadMeta = () => j<Meta>("data/meta.json");
export const loadIndex = () => j<GameIndex>("data/index.json");
export const loadOwners = () => j<Owners>("data/owners.json");
export const loadColors = () => j<Colors>("data/colors.json");

/** Player-seasons index (~0.5MB) — fetched lazily, only when Prime is armed. */
export function loadPlayers(): Promise<PlayerSeasons> {
  playersCache ??= j<PlayerSeasons>("data/players.json");
  return playersCache;
}

export function loadCard(team: string, year: number): Promise<Card> {
  const key = `${team}_${year}`;
  let p = cardCache.get(key);
  if (!p) {
    p = j<Card>(`data/cards/${key}.json`);
    cardCache.set(key, p);
  }
  return p;
}

/** Resolve the owning name for a franchise-year against [from, to). */
export function ownerFor(owners: Owners, franchise: string, year: number): string {
  const entry = owners.franchises[franchise]?.owners.find(
    (o) => o.from <= year && (o.to === null || year < o.to),
  );
  return entry?.name ?? "The Front Office";
}

export function accentFor(colors: Colors, franchise: string): string {
  return colors.franchises[franchise] ?? "#24221c";
}
