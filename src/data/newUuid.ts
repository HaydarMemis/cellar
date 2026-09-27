import * as Crypto from 'expo-crypto';
import { isUuid, uuidV4FromBytes } from '../domain/uuid';

/**
 * A fresh random (v4) UUID for anything that may later be written to a
 * Supabase uuid column — see src/domain/uuid.ts for why.
 *
 * Uses expo-crypto's native CSPRNG. The Math.random fallback only exists
 * for environments without the native module (Jest's expo mocks return
 * undefined): uniqueness is what matters for an id, and a v4 UUID from
 * Math.random still has ~122 random bits.
 */
export function newUuid(): string {
  try {
    const native = Crypto.randomUUID?.();
    if (isUuid(native)) return native.toLowerCase();
  } catch {
    // fall through to the non-native fallback
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return uuidV4FromBytes(bytes);
}
