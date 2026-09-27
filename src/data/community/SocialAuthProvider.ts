import { UserProfile } from '../../domain/types';

export type SocialAuthMethod = 'apple' | 'google';

export type SocialAuthResult =
  | { ok: true; profile: UserProfile }
  | { ok: false; error: 'not-configured' | 'cancelled' | 'failed' | 'network' };

/**
 * "Continue with Apple" / "Continue with Google". The real implementation is
 * src/data/supabase/SupabaseSocialAuthProvider.ts (Supabase verifies the
 * provider's identity token). Without Supabase there is no honest local
 * equivalent, so the fallback below reports every provider as unavailable —
 * and the sign-in screen then doesn't show its buttons at all.
 */
export interface SocialAuthProvider {
  isAvailable(method: SocialAuthMethod): Promise<boolean>;
  signIn(method: SocialAuthMethod): Promise<SocialAuthResult>;
  /** Clears any provider-side cached account on sign-out (Google), so the next sign-in can pick a different account. */
  signOut?(): Promise<void>;
  /**
   * Apple requires apps to revoke Sign in with Apple tokens when an account
   * is deleted. This re-prompts the user to authorize with Apple and returns
   * a fresh authorization code for the delete-account Edge Function to
   * exchange and revoke. null if unavailable or the user cancels.
   */
  getAppleAuthorizationCode?(): Promise<string | null>;
}

export const notConfiguredSocialAuthProvider: SocialAuthProvider = {
  async isAvailable() {
    return false;
  },
  async signIn() {
    return { ok: false, error: 'not-configured' };
  },
};
