import { generateId } from '../../domain/id';
import { AuthSession, UserProfile } from '../../domain/types';
import { JsonStore } from '../storage/jsonStore';
import { generateSalt, hashPassword } from './passwordHash';

export interface SignUpInput {
  username: string;
  displayName: string;
  email: string;
  password: string;
}

export interface LogInInput {
  email: string;
  password: string;
}

export type AuthErrorCode =
  | 'username-taken'
  | 'email-taken'
  | 'invalid-username'
  | 'invalid-email'
  | 'invalid-password'
  | 'weak-password'
  | 'not-found'
  | 'wrong-password'
  | 'email-not-confirmed'
  | 'rate-limited'
  | 'network-error'
  | 'unknown';

export type AuthResult = { ok: true; profile: UserProfile } | { ok: false; error: AuthErrorCode };

/**
 * signUp's real outcome space is one wider than logIn's: Supabase Auth can
 * create the account and yet return no session at all, when the project
 * has "Confirm email" turned on in its dashboard — a setting this code
 * cannot see or assume, only detect from the actual response (data.session
 * being null despite data.user existing is the documented signal). The
 * local dev backend never produces this state (no email delivery to wait
 * on), but still returns this same type for a uniform call site.
 */
export type SignUpOutcome = AuthResult | { ok: 'pending-confirmation'; email: string };

export type PasswordResetOutcome =
  | { ok: true }
  | {
      ok: false;
      /**
       * - reauthentication-needed: the project has "Secure password change"
       *   on and this session is too old to change the password without
       *   re-authenticating (Supabase `reauthentication_needed` /
       *   `reauthentication_not_valid`). A fresh sign-in satisfies it.
       * - same-password: the new password equals the current one.
       */
      error: 'not-supported-offline' | 'rate-limited' | 'network-error' | 'weak-password' | 'reauthentication-needed' | 'same-password' | 'unknown';
    };

/**
 * Thrown by ensureProfileForCurrentSession when the backend AUTHORITATIVELY
 * rejects the restored session — the user no longer exists (account deleted
 * on another device), the JWT is invalid, or the server-side session is gone.
 * Distinct from a network failure: only a network failure may fall back to
 * the cached profile; this must sign the device out.
 */
export class SessionInvalidError extends Error {
  constructor(message = 'The stored session is no longer valid') {
    super(message);
    this.name = 'SessionInvalidError';
  }
}

export type ProfilePatch = Partial<Pick<UserProfile, 'displayName' | 'bio' | 'avatarColorSeed'>>;

/**
 * Auth as this build actually ships it: real account creation, login,
 * logout and a persisted session — all genuinely working, all on-device.
 * There is no hosted identity provider behind it. That seam is this
 * interface: swapping AuthBackend's implementation for one that calls a
 * real API is the entire integration surface; nothing above this layer
 * (stores, screens) would need to change.
 */
export interface AuthBackend {
  getSession(): Promise<AuthSession | null>;
  /**
   * Notifies when the backend ends the session on its own — a refresh
   * token that was revoked/expired, the user deleted from another device,
   * a sign-out elsewhere. Optional: the local backend's sessions never end
   * by themselves. Returns an unsubscribe function.
   */
  onSessionEnded?(listener: () => void): () => void;
  /**
   * Notifies when the backend reports a live session for `userId` on its own
   * (sign-in from a deep link, a token refresh that finally succeeded after
   * an offline start, a user update). useAuthStore uses it to reconcile the
   * app identity when it doesn't match the session. Optional — the local
   * backend's session only changes through its own calls.
   */
  onSessionActive?(listener: (userId: string) => void): () => void;
  /**
   * Drops THIS device's session only (no server call needed to succeed, other
   * devices untouched). Used when the session turned out to be invalid, and
   * to never leave a live session behind when sign-in could not complete.
   * Optional — falls back to logOut().
   */
  signOutLocally?(): Promise<void>;
  /**
   * For a session that exists but has no profile row yet (first sign-in
   * after email confirmation arriving via the confirmation link rather than
   * the sign-in form): create it from the data chosen at sign-up.
   * Optional — the local backend always creates both together.
   * Throws SessionInvalidError when the backend rejects the session itself
   * (user gone / invalid JWT); resolves undefined for a network failure.
   */
  ensureProfileForCurrentSession?(): Promise<UserProfile | undefined>;
  /** The CURRENTLY signed-in account's own email — never another user's; email is otherwise never exposed (see AccountRecord/`profiles` table). Used only by the Account & Security screen to show a user their own sign-in address. Resolves null when signed out. */
  getCurrentUserEmail(): Promise<string | null>;
  getProfile(userId: string): Promise<UserProfile | undefined>;
  getAllProfiles(): Promise<UserProfile[]>;
  /** Fetches exactly the given profiles (e.g. to resolve a feed's distinct authors) — prefer this over getAllProfiles() whenever the caller already knows which ids it needs, so a growing user base doesn't mean an ever-larger fetch for a screen that only ever shows a handful of authors at once. */
  getProfilesByIds(userIds: string[]): Promise<UserProfile[]>;
  signUp(input: SignUpInput): Promise<SignUpOutcome>;
  logIn(input: LogInInput): Promise<AuthResult>;
  logOut(): Promise<void>;
  updateProfile(userId: string, patch: ProfilePatch): Promise<UserProfile | undefined>;
  /** Permanently removes the account record and clears the session if it belonged to this account. Does not touch recipes/favorites/inventory — see RecipeRepository.reassignOwnerToGuestAndPrivatize and useAuthStore.deleteAccount for the full deletion flow. */
  deleteAccount(userId: string, options?: { appleAuthorizationCode?: string | null }): Promise<void>;
  /** Sign-in methods linked to the current account (e.g. ['email'], ['apple']). Optional — the local backend only has email accounts. */
  getSignInProviders?(): Promise<string[]>;
  /**
   * Always resolves { ok: true } on the real backend when the request
   * itself was well-formed — Supabase deliberately never reveals whether
   * an account exists for the given email (see resetPasswordForEmail's
   * own anti-enumeration behavior), and this preserves that: never brand
   * a "no such account" case differently from a genuine send in the UI.
   * The local dev backend has no email capability at all, so it always
   * resolves { ok: false, error: 'not-supported-offline' } — an honest
   * failure, never a simulated send.
   */
  requestPasswordReset(email: string): Promise<PasswordResetOutcome>;
  /** Resends the sign-up confirmation email — only meaningful once signUp has already returned a 'pending-confirmation' outcome for this address. */
  resendConfirmationEmail(email: string): Promise<PasswordResetOutcome>;
  /**
   * The other half of requestPasswordReset: the user followed the emailed
   * link back into the app (app/reset-password.tsx, opened via a
   * cellar://reset-password deep link) — this establishes a real,
   * temporary session from the recovery tokens Supabase put in that URL,
   * so updatePassword() below has something to act on. Returns false for
   * a missing/expired/already-used link, or on the local backend, which
   * never issued a real recovery link to begin with.
   */
  confirmPasswordResetSession(url: string): Promise<boolean>;
  /** Changes the CURRENTLY signed-in session's password — used both right after confirmPasswordResetSession succeeds, and could later back a normal "change password" settings flow. */
  updatePassword(newPassword: string): Promise<PasswordResetOutcome>;
}

interface AccountRecord {
  profile: UserProfile;
  /** Kept only here, never on the public profile — the local mirror of "email lives on auth.users, not the public profiles table" (see SupabaseAuthBackend). */
  email: string;
  passwordHash: string;
  salt: string;
}

function isAccountArray(value: unknown): value is AccountRecord[] {
  return (
    Array.isArray(value) &&
    value.every((v) => v && typeof v.profile?.id === 'string' && typeof v.email === 'string' && typeof v.passwordHash === 'string')
  );
}

/**
 * Migrates account records persisted before `email` existed on this
 * shape. This is the real, concrete fix for a genuine data-loss bug: this
 * file used to accept `{ profile, passwordHash, salt }` with no email at
 * all; once `email` became required here, `isAccountArray` started
 * rejecting every account created before that change, and JsonStore's
 * old all-or-nothing validation had no way to recover — a stricter
 * validator silently emptied the *entire* accounts collection on the
 * next read (see JsonStore's `recover` parameter, added specifically for
 * this). The practical symptom a user actually saw: after updating to a
 * build with this change, their account could no longer resolve from
 * their still-valid session, `currentOwnerId()` fell back to the guest
 * identity, and every recipe/favorite/inventory/journal/shopping-list
 * entry they'd created while signed in — still completely intact in
 * storage, still correctly tagged with their real account id — stopped
 * matching that filter and disappeared from view. Nothing was ever
 * deleted; it was orphaned by a validator with no upgrade path.
 *
 * The migration derives a stable placeholder email from the username for
 * any record missing one (same "username-first identity still needs some
 * email" convention used when this local backend was first built) and
 * leaves every other field untouched — including `profile.id`, which is
 * what an existing session and existing owned data key off of, so a
 * signed-in user is immediately made whole again with no action required.
 * A record that doesn't even match this *legacy* shape (not just missing
 * email, but genuinely unrecognizable) is left out rather than fabricated.
 */
function recoverAccountArray(raw: unknown): AccountRecord[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const recovered: AccountRecord[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return undefined;
    const e = entry as { profile?: Partial<UserProfile>; email?: unknown; passwordHash?: unknown; salt?: unknown };
    if (
      typeof e.profile?.id !== 'string' ||
      typeof e.profile.username !== 'string' ||
      typeof e.passwordHash !== 'string' ||
      typeof e.salt !== 'string'
    ) {
      return undefined; // not even the legacy shape — refuse to fabricate an account from unrecognizable data
    }
    const email = typeof e.email === 'string' ? e.email : `${e.profile.username}@users.cellar.local`;
    recovered.push({ profile: e.profile as UserProfile, email, passwordHash: e.passwordHash, salt: e.salt });
  }
  return recovered;
}

function isSessionOrNull(value: unknown): value is AuthSession | null {
  if (value === null) return true;
  const v = value as Partial<AuthSession> | null;
  return !!v && typeof v.userId === 'string';
}

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
// Deliberately simple (not RFC 5322): this only needs to catch obviously
// malformed input client-side — the real authority on "is this a valid,
// deliverable email" is Supabase itself (and, ultimately, the mail
// actually arriving), never a regex.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const accountsStore = new JsonStore<AccountRecord[]>('@community/accounts', isAccountArray, [], recoverAccountArray);
const sessionStore = new JsonStore<AuthSession | null>('@community/session', isSessionOrNull, null);

export const localAuthBackend: AuthBackend = {
  async getSession() {
    return sessionStore.read();
  },

  async getCurrentUserEmail() {
    const session = await sessionStore.read();
    if (!session) return null;
    const accounts = await accountsStore.read();
    return accounts.find((a) => a.profile.id === session.userId)?.email ?? null;
  },

  async getProfile(userId) {
    const accounts = await accountsStore.read();
    return accounts.find((a) => a.profile.id === userId)?.profile;
  },

  async getAllProfiles() {
    const accounts = await accountsStore.read();
    return accounts.map((a) => a.profile);
  },

  async getProfilesByIds(userIds) {
    if (userIds.length === 0) return [];
    const idSet = new Set(userIds);
    const accounts = await accountsStore.read();
    return accounts.filter((a) => idSet.has(a.profile.id)).map((a) => a.profile);
  },

  async signUp({ username, displayName, email, password }) {
    const normalizedUsername = normalizeUsername(username);
    const normalizedEmail = normalizeEmail(email);
    if (!USERNAME_PATTERN.test(normalizedUsername)) return { ok: false, error: 'invalid-username' };
    if (!EMAIL_PATTERN.test(normalizedEmail)) return { ok: false, error: 'invalid-email' };
    if (password.length < 6) return { ok: false, error: 'invalid-password' };

    // Cast (not just annotate) so TS tracks the full SignUpOutcome union
    // here — without it, the closure's reassignment below is invisible to
    // control flow analysis and `result` stays narrowed to this literal,
    // making `if (result.ok)` below spuriously resolve to `never`.
    let result = { ok: false, error: 'username-taken' } as SignUpOutcome;
    await accountsStore.update((accounts) => {
      if (accounts.some((a) => a.profile.username === normalizedUsername)) {
        result = { ok: false, error: 'username-taken' };
        return accounts;
      }
      if (accounts.some((a) => a.email === normalizedEmail)) {
        result = { ok: false, error: 'email-taken' };
        return accounts;
      }
      const salt = generateSalt();
      const profile: UserProfile = {
        id: generateId('user'),
        username: normalizedUsername,
        displayName: displayName.trim() || normalizedUsername,
        avatarColorSeed: normalizedUsername,
        createdAt: new Date().toISOString(),
      };
      result = { ok: true, profile };
      return [...accounts, { profile, email: normalizedEmail, passwordHash: hashPassword(password, salt), salt }];
    });

    if (result.ok === true) await sessionStore.write({ userId: result.profile.id, createdAt: new Date().toISOString() });
    return result;
  },

  async logIn({ email, password }) {
    const normalized = normalizeEmail(email);
    const accounts = await accountsStore.read();
    const account = accounts.find((a) => a.email === normalized);
    if (!account) return { ok: false, error: 'not-found' };
    if (hashPassword(password, account.salt) !== account.passwordHash) return { ok: false, error: 'wrong-password' };

    await sessionStore.write({ userId: account.profile.id, createdAt: new Date().toISOString() });
    return { ok: true, profile: account.profile };
  },

  async logOut() {
    await sessionStore.write(null);
  },

  async updateProfile(userId, patch) {
    let updated: UserProfile | undefined;
    await accountsStore.update((accounts) =>
      accounts.map((a) => {
        if (a.profile.id !== userId) return a;
        updated = { ...a.profile, ...patch };
        return { ...a, profile: updated };
      }),
    );
    return updated;
  },

  async deleteAccount(userId) {
    await accountsStore.update((accounts) => accounts.filter((a) => a.profile.id !== userId));
    const session = await sessionStore.read();
    if (session?.userId === userId) await sessionStore.write(null);
  },

  // The local dev backend has no email delivery capability at all — an
  // honest, clearly-labeled failure, never a simulated send. See
  // app/auth.tsx / app/forgot-password.tsx, which show a dedicated
  // "not available offline" message for this exact outcome rather than a
  // generic error.
  async requestPasswordReset() {
    return { ok: false, error: 'not-supported-offline' };
  },

  async resendConfirmationEmail() {
    return { ok: false, error: 'not-supported-offline' };
  },

  async confirmPasswordResetSession() {
    return false;
  },

  async updatePassword() {
    return { ok: false, error: 'not-supported-offline' };
  },
};
