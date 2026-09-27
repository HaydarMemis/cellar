/**
 * UUID helpers for anything that has to round-trip through Supabase.
 *
 * Why this exists: every Supabase table this app writes to uses a `uuid`
 * primary key (see supabase/migrations/20260922000000_initial_schema.sql),
 * but personal recipes have always been created with `generateId('recipe')`
 * (`recipe-<time>-<random>`), which Postgres rejects outright
 * (`22P02 invalid input syntax for type uuid`). Before this module existed,
 * publishing a recipe from the app could never succeed against the real
 * backend — the failure was only masked because unit tests mock the backend.
 *
 * - New recipes get a real v4 UUID (see RecipeRepository.create).
 * - Recipes created before this fix keep their local id untouched on
 *   device (no destructive migration, nothing that references them —
 *   favorites, journal, shopping list — has to be rewritten). When such a
 *   recipe is published, `remoteRecipeId()` derives a *deterministic* UUID
 *   from its local id (RFC 4122 v5 / SHA-1 under a fixed Cellar namespace),
 *   so the same local recipe always maps to the same remote row across
 *   publish → edit → republish → unpublish, on every app run.
 *
 * Pure TypeScript, no native modules — safe to use from the domain layer
 * and in tests.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fixed namespace for Cellar's legacy-recipe-id → UUID mapping. Never change this: doing so would re-key every already-published legacy recipe. */
export const CELLAR_RECIPE_NAMESPACE = '6f1c2b0e-8d4a-5c3e-9b7a-2e4d6c8a0f13';

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function utf8(input: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return Uint8Array.from(out);
}

/** Plain SHA-1 (FIPS 180-4). Used only for RFC 4122 v5 name-based UUIDs — not for anything security-sensitive. */
export function sha1(message: Uint8Array): Uint8Array {
  const ml = message.length;
  const withPadding = new Uint8Array((((ml + 8) >> 6) + 1) << 6);
  withPadding.set(message);
  withPadding[ml] = 0x80;
  const bitLen = ml * 8;
  const view = new DataView(withPadding.buffer);
  view.setUint32(withPadding.length - 8, Math.floor(bitLen / 0x100000000));
  view.setUint32(withPadding.length - 4, bitLen >>> 0);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);

  for (let chunk = 0; chunk < withPadding.length; chunk += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(chunk + i * 4);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const out = new Uint8Array(20);
  const outView = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => outView.setUint32(i * 4, h));
  return out;
}

/** RFC 4122 version-5 (SHA-1, name-based) UUID. */
export function uuidV5(name: string, namespace: string): string {
  const ns = uuidToBytes(namespace);
  const nameBytes = utf8(name);
  const input = new Uint8Array(ns.length + nameBytes.length);
  input.set(ns);
  input.set(nameBytes, ns.length);
  const hash = sha1(input);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  return bytesToUuid(hash);
}

/** RFC 4122 version-4 UUID from 16 caller-supplied random bytes (so the caller chooses the randomness source). */
export function uuidV4FromBytes(random: Uint8Array): string {
  if (random.length < 16) throw new Error('uuidV4FromBytes needs 16 random bytes');
  const bytes = Uint8Array.from(random.slice(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytesToUuid(bytes);
}

/**
 * The id a personal recipe has in the Supabase `recipes` table. A recipe
 * already keyed by a UUID (everything created after this fix) maps to
 * itself; a legacy `recipe-…` id maps to a stable v5 UUID derived from it.
 */
export function remoteRecipeId(localId: string): string {
  return isUuid(localId) ? localId.toLowerCase() : uuidV5(localId, CELLAR_RECIPE_NAMESPACE);
}

/** True when `candidateId` (e.g. a route param or a Discover row id) refers to this local recipe, under either its local or its remote id. */
export function matchesRecipeId(localId: string, candidateId: string): boolean {
  return localId === candidateId || remoteRecipeId(localId) === candidateId.toLowerCase();
}
