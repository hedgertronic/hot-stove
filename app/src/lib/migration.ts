import { ARCHIVE_CAP, FINALE_VERSION, renderableFinale } from "./history";

const SOURCE_ORIGIN = "https://hedgertronic.com";
const SOURCE_URL = `${SOURCE_ORIGIN}/games/hot-stove/`;
const TARGET_ORIGIN = "https://hotstove.io";

const HISTORY_KEY = "hotstove.history";
const ARCHIVE_KEY = "hotstove.archive";
const SAVE_KEY = "hotstove.current";
const FINALE_KEY = "hotstove.finale";
const FINALE_OPEN_KEY = "hotstove.finale.open";
const SETTINGS_KEY = "hotstove.settings";
const CUES_KEY = "hotstove.cues";
const THEME_KEY = "hotstove.theme";
const ADOPTED_KEY = "hotstove.adopted";
const JOURNAL_KEY = "hotstove.adopting";
const TARGET_PENDING_KEY = "hotstove.migration.pending";
const SOURCE_PENDING_KEY = "hotstove.migration.source-pending";
const SOURCE_COMPLETE_KEY = "hotstove.migrated";
const PLAYER_KEYS = [
  HISTORY_KEY,
  ARCHIVE_KEY,
  SAVE_KEY,
  FINALE_KEY,
  FINALE_OPEN_KEY,
  SETTINGS_KEY,
  CUES_KEY,
  THEME_KEY,
] as const;
const MIGRATION_WRITE_KEYS = new Set<string>([...PLAYER_KEYS, ADOPTED_KEY]);

export const MIGRATION_FRAGMENT_BUDGET = 48 * 1024;
export const MIGRATION_EXPANDED_LIMIT = 1024 * 1024;
const MAX_HISTORY_ROWS_PER_PAYLOAD = 5_000;

export type MigrationMode =
  | "legacy-start"
  | "legacy-forward"
  | "legacy-export"
  | "legacy-complete"
  | "target-prepare"
  | "target-adopt"
  | "target-done";

export interface MigrationBootstrap {
  mode: MigrationMode;
  hash: string;
}

declare global {
  interface Window {
    __HOTSTOVE_MIGRATION__?: MigrationBootstrap;
  }
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface HistoryChunk {
  start: number;
  end: number;
  total: number;
  done: boolean;
  rows: Record<string, unknown>[];
}

interface SmallState {
  archive?: Record<string, unknown>[];
  current?: Record<string, unknown>;
  finale?: Record<string, unknown>;
  finaleOpen?: string;
  settings?: Record<string, unknown>;
  cues?: Record<string, unknown>;
  theme?: "light" | "dark";
}

export interface MigrationPayload extends SmallState {
  v: 1;
  nonce: string;
  source: typeof SOURCE_ORIGIN;
  history: HistoryChunk;
}

interface AdoptedMarker {
  v: 1;
  source: typeof SOURCE_ORIGIN;
  historyCount: number;
  initialComplete: boolean;
  /** Exact values last written from the source for singular keys. A later
   * legacy-tab update may replace only a value still equal to this copy; any
   * play on .io breaks ownership and wins. */
  owned?: {
    current?: string;
    finale?: string;
    finaleOpen?: string | null;
    settings?: string;
    theme?: string;
  };
}

interface WriteOperation {
  key: string;
  before: string | null;
  after: string | null;
}

interface JournalOperation {
  key: string;
  beforeHash: string;
  afterHash: string;
  after: string | null;
}

interface MigrationJournal {
  v: 1;
  id: string;
  operations: JournalOperation[];
}

interface SourceSnapshot extends SmallState {
  history: Record<string, unknown>[];
}

function plain(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function boundedString(value: unknown, max = 256): value is string {
  return typeof value === "string" && value.length <= max;
}

function readJSON(storage: StorageLike, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Copies only fields understood by current history readers. Identical rows
 * remain identical and remain separate: multiplicity is player data here. */
export function normalizeHistoryRow(value: unknown): Record<string, unknown> | null {
  if (!plain(value) || !boundedString(value.date, 32)) return null;
  const row: Record<string, unknown> = { date: value.date };
  for (const key of ["id", "record", "difficulty", "bank"])
    if (value[key] !== undefined) {
      if (!boundedString(value[key], 128)) return null;
      row[key] = value[key];
    }
  for (const key of ["total", "spins", "seed", "v"])
    if (value[key] !== undefined) {
      if (!finite(value[key])) return null;
      row[key] = value[key];
    }
  if (value.moneyball !== undefined) {
    if (typeof value.moneyball !== "boolean") return null;
    row.moneyball = value.moneyball;
  }
  for (const key of ["badges", "countries"] as const)
    if (value[key] !== undefined) {
      if (
        !Array.isArray(value[key]) ||
        value[key].length > 256 ||
        !value[key].every((item) => boundedString(item, 128))
      )
        return null;
      row[key] = [...value[key]];
    }
  if (value.countryPlayers !== undefined) {
    if (!plain(value.countryPlayers) || Object.keys(value.countryPlayers).length > 256) return null;
    const players: Record<string, string[]> = {};
    for (const [country, ids] of Object.entries(value.countryPlayers)) {
      if (
        !boundedString(country, 128) ||
        !Array.isArray(ids) ||
        ids.length > 256 ||
        !ids.every((id) => boundedString(id, 128))
      )
        return null;
      players[country] = [...ids];
    }
    row.countryPlayers = players;
  }
  return row;
}

function validSave(value: unknown): value is Record<string, unknown> {
  if (!plain(value) || ![4, 5, 6].includes(value.v as number)) return false;
  return (
    finite(value.seed) &&
    finite(value.rngState) &&
    finite(value.spinCount) &&
    finite(value.choicesLeft) &&
    finite(value.choicesUsed) &&
    Array.isArray(value.slots) &&
    value.slots.length <= 32 &&
    Array.isArray(value.spinLog) &&
    value.spinLog.length <= 10_000 &&
    plain(value.powerups)
  );
}

function validFinale(value: unknown): value is Record<string, unknown> {
  return (
    plain(value) &&
    value.v === FINALE_VERSION &&
    Array.isArray(value.slots) &&
    value.slots.length <= 32 &&
    Array.isArray(value.seen) &&
    value.seen.length <= 10_000 &&
    renderableFinale(value.finale)
  );
}

function validArchive(value: unknown): value is Record<string, unknown> {
  return validFinale(value) && boundedString(value.id, 128);
}

function normalizedSettings(value: unknown): Record<string, unknown> | null {
  if (!plain(value)) return null;
  if (JSON.stringify(value).length > 2_048) return null;
  return value;
}

function normalizedCues(value: unknown): Record<string, unknown> | null {
  if (!plain(value) || value.v !== 1) return null;
  if (
    !Array.isArray(value.pendingBadges) ||
    value.pendingBadges.length > 256 ||
    !value.pendingBadges.every((key) => boundedString(key, 128))
  )
    return null;
  return {
    v: 1,
    pendingBadges: [...value.pendingBadges],
    helpSeen: value.helpSeen === true,
    tourSeen: value.tourSeen === true,
    finaleTourSeen: value.finaleTourSeen === true,
  };
}

function snapshotSource(storage: StorageLike): SourceSnapshot {
  const rawHistory = readJSON(storage, HISTORY_KEY);
  const history = Array.isArray(rawHistory)
    ? rawHistory.map(normalizeHistoryRow).filter((row): row is Record<string, unknown> => row !== null)
    : [];
  const rawArchive = readJSON(storage, ARCHIVE_KEY);
  const archive = Array.isArray(rawArchive)
    ? rawArchive.filter(validArchive).slice(-ARCHIVE_CAP)
    : [];
  const current = readJSON(storage, SAVE_KEY);
  const finale = readJSON(storage, FINALE_KEY);
  const settings = normalizedSettings(readJSON(storage, SETTINGS_KEY));
  const cues = normalizedCues(readJSON(storage, CUES_KEY));
  let finaleOpen: string | undefined;
  let theme: "light" | "dark" | undefined;
  try {
    const open = storage.getItem(FINALE_OPEN_KEY);
    if (open === "1" || (open?.startsWith("a:") && boundedString(open.slice(2), 128)))
      finaleOpen = open;
    const storedTheme = storage.getItem(THEME_KEY);
    if (storedTheme === "light" || storedTheme === "dark") theme = storedTheme;
  } catch {
    // An unavailable optional key is simply absent from the handoff.
  }
  return {
    history,
    archive,
    ...(validSave(current) ? { current } : {}),
    ...(validFinale(finale) ? { finale } : {}),
    ...(finaleOpen ? { finaleOpen } : {}),
    ...(settings ? { settings } : {}),
    ...(cues ? { cues } : {}),
    ...(theme ? { theme } : {}),
  };
}

function payloadFor(
  snapshot: SourceSnapshot,
  nonce: string,
  start: number,
  end: number,
  done: boolean,
  archive: Record<string, unknown>[] = [],
): MigrationPayload {
  return {
    v: 1,
    nonce,
    source: SOURCE_ORIGIN,
    history: {
      start,
      end,
      total: snapshot.history.length,
      done,
      rows: snapshot.history.slice(start, end),
    },
    ...(done
      ? {
          ...(archive.length ? { archive } : {}),
          ...(snapshot.current ? { current: snapshot.current } : {}),
          ...(snapshot.finale ? { finale: snapshot.finale } : {}),
          ...(snapshot.finaleOpen ? { finaleOpen: snapshot.finaleOpen } : {}),
          ...(snapshot.settings ? { settings: snapshot.settings } : {}),
          ...(snapshot.cues ? { cues: snapshot.cues } : {}),
          ...(snapshot.theme ? { theme: snapshot.theme } : {}),
        }
      : {}),
  };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Migration payload is not valid base64");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  const stream = new Blob([Uint8Array.from(bytes).buffer])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function encodeMigrationPayload(payload: MigrationPayload): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const compressed = await gzip(bytes);
  return compressed
    ? `g.${bytesToBase64Url(compressed)}`
    : `u.${bytesToBase64Url(bytes)}`;
}

async function decodeExpanded(kind: string, packed: Uint8Array): Promise<Uint8Array> {
  if (kind === "u") {
    if (packed.byteLength > MIGRATION_EXPANDED_LIMIT) throw new Error("Migration payload is too large");
    return packed;
  }
  if (kind !== "g" || typeof DecompressionStream === "undefined")
    throw new Error("This browser cannot unpack the migration payload");
  const reader = new Blob([Uint8Array.from(packed).buffer])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"))
    .getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MIGRATION_EXPANDED_LIMIT) {
      await reader.cancel();
      throw new Error("Migration payload expands past the safety limit");
    }
    chunks.push(value);
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function parsePayload(value: unknown): MigrationPayload {
  if (!plain(value) || value.v !== 1 || value.source !== SOURCE_ORIGIN || !boundedString(value.nonce, 128))
    throw new Error("Migration payload header is invalid");
  if (!plain(value.history)) throw new Error("Migration history header is missing");
  const { start, end, total, done, rows } = value.history;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    !Number.isSafeInteger(total) ||
    (start as number) < 0 ||
    (end as number) < (start as number) ||
    (total as number) < (end as number) ||
    typeof done !== "boolean" ||
    (done && end !== total) ||
    !Array.isArray(rows) ||
    rows.length !== (end as number) - (start as number) ||
    rows.length > MAX_HISTORY_ROWS_PER_PAYLOAD
  )
    throw new Error("Migration history range is invalid");
  const historyRows = rows.map(normalizeHistoryRow);
  if (historyRows.some((row) => row === null)) throw new Error("Migration history contains an invalid row");
  if (!done && ["archive", "current", "finale", "finaleOpen", "settings", "cues", "theme"].some((key) => key in value))
    throw new Error("Non-final migration chunk contains final state");
  const payload: MigrationPayload = {
    v: 1,
    nonce: value.nonce,
    source: SOURCE_ORIGIN,
    history: {
      start: start as number,
      end: end as number,
      total: total as number,
      done,
      rows: historyRows as Record<string, unknown>[],
    },
  };
  if ("archive" in value) {
    if (!Array.isArray(value.archive) || value.archive.length > ARCHIVE_CAP || !value.archive.every(validArchive))
      throw new Error("Migration archive is invalid");
    payload.archive = value.archive;
  }
  if ("current" in value) {
    if (!validSave(value.current)) throw new Error("Migration save is invalid");
    payload.current = value.current;
  }
  if ("finale" in value) {
    if (!validFinale(value.finale)) throw new Error("Migration finale is invalid");
    payload.finale = value.finale;
  }
  if ("finaleOpen" in value) {
    if (
      value.finaleOpen !== "1" &&
      !(boundedString(value.finaleOpen, 130) && value.finaleOpen.startsWith("a:"))
    )
      throw new Error("Migration finale pointer is invalid");
    payload.finaleOpen = value.finaleOpen;
  }
  if ("settings" in value) {
    const settings = normalizedSettings(value.settings);
    if (!settings) throw new Error("Migration settings are invalid");
    payload.settings = settings;
  }
  if ("cues" in value) {
    const cues = normalizedCues(value.cues);
    if (!cues) throw new Error("Migration cues are invalid");
    payload.cues = cues;
  }
  if ("theme" in value) {
    if (value.theme !== "light" && value.theme !== "dark") throw new Error("Migration theme is invalid");
    payload.theme = value.theme;
  }
  return payload;
}

export async function decodeMigrationPayload(encoded: string): Promise<MigrationPayload> {
  if (encoded.length > MIGRATION_FRAGMENT_BUDGET) throw new Error("Migration fragment is too large");
  const separator = encoded.indexOf(".");
  if (separator !== 1) throw new Error("Migration encoding is invalid");
  const expanded = await decodeExpanded(encoded.slice(0, 1), base64UrlToBytes(encoded.slice(2)));
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(expanded));
  } catch {
    throw new Error("Migration payload is damaged");
  }
  return parsePayload(parsed);
}

async function fits(payload: MigrationPayload): Promise<{ encoded: string; fits: boolean }> {
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > MIGRATION_EXPANDED_LIMIT)
    return { encoded: "", fits: false };
  const encoded = await encodeMigrationPayload(payload);
  return { encoded, fits: encoded.length <= MIGRATION_FRAGMENT_BUDGET };
}

/** Packs a contiguous history prefix. Final state is sent only with a `done`
 * chunk, so a large career can cross in several bounded first-party hops. */
export async function buildSourceTransfer(
  storage: StorageLike,
  nonce: string,
  cursor: number,
): Promise<{ encoded: string; payload: MigrationPayload }> {
  const snapshot = snapshotSource(storage);
  if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor > snapshot.history.length)
    throw new Error("The legacy history changed during migration");

  const remaining = snapshot.history.length - cursor;
  const fullWithoutArchive = payloadFor(snapshot, nonce, cursor, snapshot.history.length, true);
  const full =
    remaining <= MAX_HISTORY_ROWS_PER_PAYLOAD
      ? await fits(fullWithoutArchive)
      : { encoded: "", fits: false };
  if (full.fits) {
    let low = 0;
    let high = snapshot.archive?.length ?? 0;
    let best = { encoded: full.encoded, payload: fullWithoutArchive };
    while (low <= high) {
      const count = Math.floor((low + high) / 2);
      const archive = snapshot.archive?.slice(-count) ?? [];
      const candidate = payloadFor(snapshot, nonce, cursor, snapshot.history.length, true, archive);
      const packed = await fits(candidate);
      if (packed.fits) {
        best = { encoded: packed.encoded, payload: candidate };
        low = count + 1;
      } else high = count - 1;
    }
    return best;
  }

  if (cursor === snapshot.history.length)
    throw new Error("The in-progress legacy state is too large for a safe browser handoff");

  let low = cursor + 1;
  let high = Math.min(snapshot.history.length, cursor + MAX_HISTORY_ROWS_PER_PAYLOAD);
  let best: { encoded: string; payload: MigrationPayload } | null = null;
  while (low <= high) {
    const end = Math.floor((low + high) / 2);
    const candidate = payloadFor(snapshot, nonce, cursor, end, false);
    const packed = await fits(candidate);
    if (packed.fits) {
      best = { encoded: packed.encoded, payload: candidate };
      low = end + 1;
    } else high = end - 1;
  }
  if (!best) throw new Error("One legacy history row is too large for a safe browser handoff");
  return best;
}

function readMarker(storage: StorageLike): AdoptedMarker {
  const value = readJSON(storage, ADOPTED_KEY);
  if (
    plain(value) &&
    value.v === 1 &&
    value.source === SOURCE_ORIGIN &&
    Number.isSafeInteger(value.historyCount) &&
    (value.historyCount as number) >= 0 &&
    typeof value.initialComplete === "boolean"
  )
    return {
      v: 1,
      source: SOURCE_ORIGIN,
      historyCount: value.historyCount as number,
      initialComplete: value.initialComplete as boolean,
      ...(plain(value.owned)
        ? {
            owned: {
              ...(typeof value.owned.current === "string" ? { current: value.owned.current } : {}),
              ...(typeof value.owned.finale === "string" ? { finale: value.owned.finale } : {}),
              ...(typeof value.owned.finaleOpen === "string" || value.owned.finaleOpen === null
                ? { finaleOpen: value.owned.finaleOpen as string | null }
                : {}),
              ...(typeof value.owned.settings === "string" ? { settings: value.owned.settings } : {}),
              ...(typeof value.owned.theme === "string" ? { theme: value.owned.theme } : {}),
            },
          }
        : {}),
    };
  return { v: 1, source: SOURCE_ORIGIN, historyCount: 0, initialComplete: false };
}

function stringify(value: unknown): string {
  return JSON.stringify(value);
}

/** Non-security fingerprint for detecting play in a legacy tab after its
 * first handoff. It covers exact raw values, so a changed in-progress save is
 * noticed even when no history row has been appended yet. */
export function sourceSignature(storage: StorageLike): string {
  const text = PLAYER_KEYS.map((key) => `${key}\u0000${storage.getItem(key) ?? ""}\u0000`).join("");
  let signature = 2_166_136_261;
  for (let i = 0; i < text.length; i += 1) {
    signature ^= text.charCodeAt(i);
    signature = Math.imul(signature, 16_777_619);
  }
  return (signature >>> 0).toString(16).padStart(8, "0");
}

function existingArray(storage: StorageLike, key: string): Record<string, unknown>[] {
  const value = readJSON(storage, key);
  return Array.isArray(value) ? value.filter(plain) : [];
}

function operation(storage: StorageLike, key: string, after: string | null): WriteOperation | null {
  const before = storage.getItem(key);
  return before === after ? null : { key, before, after };
}

function mergeCues(source: Record<string, unknown>, target: unknown): Record<string, unknown> {
  const left = normalizedCues(source)!;
  const right = normalizedCues(target) ?? {
    v: 1,
    pendingBadges: [],
    helpSeen: false,
    tourSeen: false,
    finaleTourSeen: false,
  };
  return {
    v: 1,
    pendingBadges: [
      ...new Set([...(left.pendingBadges as string[]), ...(right.pendingBadges as string[])]),
    ],
    helpSeen: left.helpSeen === true || right.helpSeen === true,
    tourSeen: left.tourSeen === true || right.tourSeen === true,
    finaleTourSeen: left.finaleTourSeen === true || right.finaleTourSeen === true,
  };
}

/** Pure merge planning: marker is last, so it never claims a data write that
 * the write-ahead journal has not verified. */
export function planAdoption(storage: StorageLike, payload: MigrationPayload): WriteOperation[] {
  const marker = readMarker(storage);
  const nextOwned = { ...(marker.owned ?? {}) };
  if (payload.history.start > marker.historyCount)
    throw new Error("Migration history has a gap");
  if (payload.history.total < marker.historyCount)
    throw new Error("Legacy history became shorter during migration");

  const overlap = Math.max(0, marker.historyCount - payload.history.start);
  const incoming = payload.history.rows.slice(overlap);
  const operations: WriteOperation[] = [];
  const targetHistory = existingArray(storage, HISTORY_KEY);
  if (incoming.length) {
    const next = marker.initialComplete
      ? [...targetHistory, ...incoming]
      : [
          ...targetHistory.slice(0, marker.historyCount),
          ...incoming,
          ...targetHistory.slice(marker.historyCount),
        ];
    const op = operation(storage, HISTORY_KEY, stringify(next));
    if (op) operations.push(op);
  }

  if (payload.history.done) {
    const targetArchive = existingArray(storage, ARCHIVE_KEY).filter(validArchive);
    const sourceArchive = payload.archive ?? [];
    const seen = new Set<string>();
    const ordered = marker.initialComplete
      ? [...targetArchive, ...sourceArchive]
      : [...sourceArchive, ...targetArchive];
    const archive = ordered.filter((row) => {
      const id = row.id as string;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }).slice(-ARCHIVE_CAP);
    if (sourceArchive.length) {
      const op = operation(storage, ARCHIVE_KEY, stringify(archive));
      if (op) operations.push(op);
    }

    const mergeSingular = (
      key: string,
      ownerKey: "current" | "settings" | "theme",
      sourceValue: string | undefined,
    ) => {
      const targetValue = storage.getItem(key);
      const ownedValue = nextOwned[ownerKey];
      const sourceStillOwns = targetValue === null || (ownedValue !== undefined && targetValue === ownedValue);
      if (sourceValue !== undefined && sourceStillOwns) {
        const op = operation(storage, key, sourceValue);
        if (op) operations.push(op);
        nextOwned[ownerKey] = sourceValue;
      } else if (sourceValue === undefined && ownedValue !== undefined && targetValue === ownedValue) {
        const op = operation(storage, key, null);
        if (op) operations.push(op);
        delete nextOwned[ownerKey];
      } else if (!sourceStillOwns) delete nextOwned[ownerKey];
    };
    mergeSingular(SAVE_KEY, "current", payload.current ? stringify(payload.current) : undefined);

    const targetFinale = storage.getItem(FINALE_KEY);
    const targetOpen = storage.getItem(FINALE_OPEN_KEY);
    const ownedFinale = nextOwned.finale;
    const ownedOpen = nextOwned.finaleOpen;
    const sourceOwnsFinale =
      (targetFinale === null && targetOpen === null) ||
      (ownedFinale !== undefined && targetFinale === ownedFinale && targetOpen === (ownedOpen ?? null));
    if (sourceOwnsFinale) {
      const sourceFinale = payload.finale ? stringify(payload.finale) : null;
      const requestedOpen = payload.finaleOpen;
      const sourceOpen =
        requestedOpen === "1" ||
        (requestedOpen?.startsWith("a:") && archive.some((row) => row.id === requestedOpen.slice(2)))
          ? requestedOpen
          : null;
      for (const op of [
        operation(storage, FINALE_KEY, sourceFinale),
        operation(storage, FINALE_OPEN_KEY, sourceFinale ? sourceOpen : null),
      ])
        if (op) operations.push(op);
      if (sourceFinale) {
        nextOwned.finale = sourceFinale;
        nextOwned.finaleOpen = sourceOpen;
      } else {
        delete nextOwned.finale;
        delete nextOwned.finaleOpen;
      }
    } else {
      delete nextOwned.finale;
      delete nextOwned.finaleOpen;
    }

    mergeSingular(SETTINGS_KEY, "settings", payload.settings ? stringify(payload.settings) : undefined);
    if (payload.cues) {
      const op = operation(storage, CUES_KEY, stringify(mergeCues(payload.cues, readJSON(storage, CUES_KEY))));
      if (op) operations.push(op);
    }
    mergeSingular(THEME_KEY, "theme", payload.theme);
  }

  const nextMarker: AdoptedMarker = {
    v: 1,
    source: SOURCE_ORIGIN,
    historyCount: Math.max(marker.historyCount, payload.history.end),
    initialComplete: marker.initialComplete || payload.history.done,
    ...(Object.keys(nextOwned).length ? { owned: nextOwned } : {}),
  };
  const markerOp = operation(storage, ADOPTED_KEY, stringify(nextMarker));
  if (markerOp) operations.push(markerOp);
  return operations;
}

async function hash(value: string | null): Promise<string> {
  const bytes = new TextEncoder().encode(value === null ? "\u0000" : `\u0001${value}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function journalFor(id: string, operations: WriteOperation[]): Promise<MigrationJournal> {
  return {
    v: 1,
    id,
    operations: await Promise.all(
      operations.map(async (op) => ({
        key: op.key,
        beforeHash: await hash(op.before),
        afterHash: await hash(op.after),
        after: op.after,
      })),
    ),
  };
}

function validJournal(value: unknown): value is MigrationJournal {
  return (
    plain(value) &&
    value.v === 1 &&
    boundedString(value.id, 128) &&
    Array.isArray(value.operations) &&
    value.operations.every(
      (op) =>
        plain(op) &&
        boundedString(op.key, 128) &&
        MIGRATION_WRITE_KEYS.has(op.key) &&
        boundedString(op.beforeHash, 128) &&
        boundedString(op.afterHash, 128) &&
        (typeof op.after === "string" || op.after === null),
    )
  );
}

/** Crash-safe multi-key commit. A retry can tell a value still at `before`
 * from one already at `after`; any third value means another tab changed it,
 * and migration stops instead of overwriting that newer state. */
export async function commitAdoption(
  storage: StorageLike,
  payload: MigrationPayload,
): Promise<AdoptedMarker> {
  const existing = readJSON(storage, JOURNAL_KEY);
  if (existing !== undefined) {
    if (!validJournal(existing)) throw new Error("The migration journal is damaged");
    await applyJournal(storage, existing);
    storage.removeItem(JOURNAL_KEY);
  }
  const operations = planAdoption(storage, payload);
  if (!operations.length) return readMarker(storage);
  const journal = await journalFor(await hash(stringify(payload)), operations);
  storage.setItem(JOURNAL_KEY, stringify(journal));
  if (stringify(readJSON(storage, JOURNAL_KEY)) !== stringify(journal))
    throw new Error("Could not verify the migration journal");
  await applyJournal(storage, journal);
  storage.removeItem(JOURNAL_KEY);
  return readMarker(storage);
}

async function applyJournal(storage: StorageLike, journal: MigrationJournal): Promise<void> {
  for (const expected of journal.operations) {
    const currentHash = await hash(storage.getItem(expected.key));
    if (currentHash === expected.afterHash) continue;
    if (currentHash !== expected.beforeHash)
      throw new Error(`Stored ${expected.key} changed during migration`);
    if (expected.after === null) storage.removeItem(expected.key);
    else storage.setItem(expected.key, expected.after);
    if ((await hash(storage.getItem(expected.key))) !== expected.afterHash)
      throw new Error(`Could not verify ${expected.key}`);
  }
}

function params(hashValue: string): URLSearchParams {
  return new URLSearchParams(hashValue.replace(/^#/, ""));
}

function requireNonce(value: string | null): string {
  if (!value || !/^[0-9a-f-]{16,128}$/i.test(value)) throw new Error("Migration session is invalid");
  return value;
}

function replace(url: string): void {
  location.replace(url);
}

function showFailure(error: unknown): void {
  console.error("hot stove migration failed:", error);
  const message = error instanceof Error ? error.message : "Unknown migration error";
  const card = document.getElementById("static-boot");
  if (!card) return;
  const heading = document.createElement("h1");
  heading.style.cssText = "font-size:22px;line-height:1.2";
  heading.textContent = "Your old game is still safe";
  const detail = document.createElement("p");
  detail.style.cssText = "font-size:15px;line-height:1.45;margin:16px 0";
  detail.textContent = `The move to hotstove.io stopped before it could be confirmed. ${message}`;
  const actions = document.createElement("p");
  actions.style.cssText = "font-size:15px;line-height:1.45;margin:0";
  const old = document.createElement("a");
  old.href = `${SOURCE_URL}#stay`;
  old.style.cssText = "color:inherit;font-weight:900";
  old.textContent = "Open the old version";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.style.cssText = "border:0;background:none;color:inherit;font:inherit;font-weight:900;text-decoration:underline;cursor:pointer";
  retry.textContent = "Try again";
  retry.addEventListener("click", () => location.reload());
  actions.append(old, " · ", retry);
  card.replaceChildren(heading, detail, actions);
}

function readPendingNonce(storage: StorageLike, key: string): string | null {
  const value = readJSON(storage, key);
  return plain(value) && boundedString(value.nonce, 128) ? value.nonce : null;
}

async function executeMigration(bootstrap: MigrationBootstrap): Promise<void> {
  const hashParams = params(bootstrap.hash);
  switch (bootstrap.mode) {
    case "legacy-forward":
      return replace(`${TARGET_ORIGIN}/`);
    case "legacy-start":
      return replace(`${TARGET_ORIGIN}/#prepare=1`);
    case "target-prepare": {
      const nonce = crypto.randomUUID();
      localStorage.setItem(TARGET_PENDING_KEY, stringify({ v: 1, nonce, at: Date.now() }));
      if (readPendingNonce(localStorage, TARGET_PENDING_KEY) !== nonce)
        throw new Error("Could not start a verified migration session");
      const marker = readMarker(localStorage);
      return replace(`${SOURCE_URL}#export=${encodeURIComponent(nonce)}&h=${marker.historyCount}`);
    }
    case "legacy-export": {
      const nonce = requireNonce(hashParams.get("export"));
      const cursor = Number(hashParams.get("h"));
      if (!Number.isSafeInteger(cursor) || cursor < 0) throw new Error("Migration cursor is invalid");
      localStorage.setItem(SOURCE_PENDING_KEY, stringify({ v: 1, nonce, at: Date.now() }));
      const transfer = await buildSourceTransfer(localStorage, nonce, cursor);
      const theme = transfer.payload.theme ? `&t=${transfer.payload.theme}` : "";
      return replace(
        `${TARGET_ORIGIN}/#adopt=${encodeURIComponent(transfer.encoded)}&n=${encodeURIComponent(nonce)}${theme}`,
      );
    }
    case "target-adopt": {
      const nonce = requireNonce(hashParams.get("n"));
      if (readPendingNonce(localStorage, TARGET_PENDING_KEY) !== nonce)
        throw new Error("Migration session could not be verified");
      const encoded = hashParams.get("adopt");
      if (!encoded) throw new Error("Migration payload is missing");
      const payload = await decodeMigrationPayload(encoded);
      if (payload.nonce !== nonce) throw new Error("Migration payload belongs to another session");
      const marker = await commitAdoption(localStorage, payload);
      if (payload.history.done)
        return replace(`${SOURCE_URL}#complete=${encodeURIComponent(nonce)}`);
      return replace(`${SOURCE_URL}#export=${encodeURIComponent(nonce)}&h=${marker.historyCount}`);
    }
    case "legacy-complete": {
      const nonce = requireNonce(hashParams.get("complete"));
      if (readPendingNonce(localStorage, SOURCE_PENDING_KEY) !== nonce)
        throw new Error("Migration completion could not be verified");
      localStorage.setItem(
        SOURCE_COMPLETE_KEY,
        stringify({
          v: 1,
          target: TARGET_ORIGIN,
          signature: sourceSignature(localStorage),
          at: new Date().toISOString(),
        }),
      );
      if (localStorage.getItem(SOURCE_COMPLETE_KEY) === null)
        throw new Error("Could not remember the completed migration");
      localStorage.removeItem(SOURCE_PENDING_KEY);
      return replace(`${TARGET_ORIGIN}/#done=${encodeURIComponent(nonce)}`);
    }
    case "target-done": {
      const nonce = requireNonce(hashParams.get("done"));
      if (readPendingNonce(localStorage, TARGET_PENDING_KEY) !== nonce)
        throw new Error("Migration acknowledgment could not be verified");
      localStorage.removeItem(TARGET_PENDING_KEY);
      history.replaceState(null, "", `${location.pathname}${location.search}`);
      location.reload();
      return;
    }
  }
}

export function runMigration(bootstrap: MigrationBootstrap): void {
  void executeMigration(bootstrap).catch(showFailure);
}
