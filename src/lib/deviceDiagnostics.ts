/**
 * TEMPORARY device diagnostics — for the "crash when tapping" and "local data
 * missing after reinstall" regressions found on a physical iPhone (Release
 * build, no debugger). Remove this module and its three call sites
 * (app/_layout.tsx, app/(tabs)/profile.tsx, ErrorBoundary) once resolved.
 *
 * Privacy: nothing here records or shows tokens, passwords, emails, names,
 * recipe text or ids. Crash records keep the error class, a sanitized
 * message, the route pattern (e.g. "/cocktail/[id]" — never its params) and
 * a few function names from the stack. The storage report only COUNTS
 * entries per owner category.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { LOCAL_GUEST_OWNER_ID } from '../domain/types';
import { sanitizeDiagnosticText } from './authDiagnostics';

export interface CrashRecord {
  at: string;
  fatal: boolean;
  source: 'global' | 'boundary';
  route: string;
  name: string;
  message: string;
  frames: string[];
  shown?: boolean;
}

let currentRoute = 'unknown';
let installed = false;

/** Called by the root layout on every navigation — the route PATTERN only (segments), never params. */
export function setDiagnosticsRoute(route: string): void {
  currentRoute = route || '/';
}

function crashFile(): File | null {
  try {
    return new File(Paths.document, 'cellar-last-crash.json');
  } catch {
    return null;
  }
}

/** Function names only (no file paths, no argument values). */
function stackFrames(error: unknown): string[] {
  const stack = error && typeof error === 'object' && typeof (error as { stack?: unknown }).stack === 'string' ? (error as { stack: string }).stack : '';
  return stack
    .split('\n')
    .slice(1, 8)
    .map((line) => line.trim().replace(/^at\s+/, '').split(/[\s(@]/)[0])
    .filter((fn) => fn && fn.length < 80)
    .slice(0, 5);
}

export function toCrashRecord(error: unknown, fatal: boolean, source: CrashRecord['source'], route = currentRoute): CrashRecord {
  const e = (error && typeof error === 'object' ? error : { message: String(error) }) as { name?: unknown; message?: unknown };
  return {
    at: new Date().toISOString(),
    fatal,
    source,
    route,
    name: typeof e.name === 'string' ? e.name : 'Error',
    message: sanitizeDiagnosticText(typeof e.message === 'string' ? e.message : String(error)),
    frames: stackFrames(error),
  };
}

/**
 * Written SYNCHRONOUSLY (expo-file-system's File.write) — a fatal JS error in
 * a Release build terminates the app right after the global handler runs, so
 * an async AsyncStorage write would usually be lost.
 */
export function recordCrash(error: unknown, fatal: boolean, source: CrashRecord['source']): void {
  try {
    const file = crashFile();
    if (!file) return;
    file.write(JSON.stringify(toCrashRecord(error, fatal, source)));
  } catch {
    // diagnostics must never make things worse
  }
}

/** Keeps the app's existing crash behavior; only records first. Idempotent. */
export function installCrashRecorder(): void {
  if (installed) return;
  installed = true;
  const errorUtils = (globalThis as unknown as { ErrorUtils?: { getGlobalHandler(): (e: unknown, isFatal?: boolean) => void; setGlobalHandler(h: (e: unknown, isFatal?: boolean) => void): void } }).ErrorUtils;
  if (!errorUtils) return;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    recordCrash(error, !!isFatal, 'global');
    previous(error, isFatal);
  });
}

/** The last recorded crash that hasn't been shown yet; marks it shown. */
export function takeUnshownCrash(): CrashRecord | null {
  try {
    const file = crashFile();
    if (!file || !file.exists) return null;
    const record = JSON.parse(file.textSync()) as CrashRecord;
    if (record.shown) return null;
    file.write(JSON.stringify({ ...record, shown: true }));
    return record;
  } catch {
    return null;
  }
}

export function readLastCrash(): CrashRecord | null {
  try {
    const file = crashFile();
    if (!file || !file.exists) return null;
    return JSON.parse(file.textSync()) as CrashRecord;
  } catch {
    return null;
  }
}

export function formatCrash(record: CrashRecord): string {
  return [
    `${record.fatal ? 'FATAL' : 'caught'} · ${record.source} · ${record.at}`,
    `route: ${record.route}`,
    `${record.name}: ${record.message}`,
    record.frames.length ? `at: ${record.frames.join(' < ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

const OWNER_SCOPED_KEYS = ['@bar/recipes', '@bar/favorites', '@bar/inventory', '@bar/journal', '@bar/shoppingList'];

/**
 * Per-store COUNTS of locally saved data, split by whose it is relative to
 * the identity the app is showing right now: this account ("mine"), the
 * signed-out guest, or other accounts that signed in on this device. Tells
 * apart "the data is gone" (store empty / missing) from "the data is there
 * but belongs to another identity, so it is hidden by design".
 */
export async function buildStorageReport(currentOwnerId: string): Promise<string> {
  const lines: string[] = [];
  let keys: readonly string[] = [];
  try {
    keys = await AsyncStorage.getAllKeys();
  } catch (e) {
    return `AsyncStorage.getAllKeys failed: ${sanitizeDiagnosticText(String(e))}`;
  }
  const showing = currentOwnerId === LOCAL_GUEST_OWNER_ID ? 'guest' : 'signed-in account';
  lines.push(`showing: ${showing}`);
  lines.push(`keys: ${keys.length} (${keys.filter((k) => k.includes('.corrupt-')).length} corrupt backups)`);
  lines.push(`onboarding done: ${keys.includes('@app/onboarding') ? 'stored' : 'NO KEY (fresh storage?)'}`);
  lines.push(`supabase session stored: ${keys.some((k) => /^sb-.*-auth-token$/.test(k)) ? 'yes' : 'no'}`);
  for (const key of OWNER_SCOPED_KEYS) {
    if (!keys.includes(key)) {
      lines.push(`${key}: no key`);
      continue;
    }
    try {
      const raw = await AsyncStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      if (!Array.isArray(parsed)) {
        lines.push(`${key}: not an array`);
        continue;
      }
      let mine = 0;
      let guest = 0;
      const others = new Set<string>();
      let otherCount = 0;
      for (const entry of parsed) {
        const owner = entry && typeof entry === 'object' && typeof (entry as { ownerId?: unknown }).ownerId === 'string' ? (entry as { ownerId: string }).ownerId : LOCAL_GUEST_OWNER_ID;
        if (owner === currentOwnerId) mine++;
        else if (owner === LOCAL_GUEST_OWNER_ID) guest++;
        else {
          otherCount++;
          others.add(owner);
        }
      }
      lines.push(`${key}: ${parsed.length} total · shown ${mine} · guest ${guest} · other accounts ${otherCount} (${others.size} accts)`);
    } catch {
      lines.push(`${key}: unreadable`);
    }
  }
  return lines.join('\n');
}
