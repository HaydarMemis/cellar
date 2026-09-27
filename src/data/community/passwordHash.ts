/**
 * A deterministic, salted string digest — NOT a cryptographic hash. This is
 * intentional: every account created here lives only in this device's local
 * storage (see src/data/community/AuthBackend.ts), so there is no real
 * network attack surface to defend against yet. The point of hashing at all
 * is to avoid the bad habit of persisting a raw password string, so the same
 * code shape carries over cleanly the day this module is replaced by real
 * server-side auth (which is also the moment a real cryptographic hash
 * becomes meaningful, on a server the client never has to trust).
 */
function digest(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export function generateSalt(): string {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

export function hashPassword(password: string, salt: string): string {
  return digest(`${salt}:${password}`);
}
