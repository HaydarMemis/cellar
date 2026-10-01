import type { PasswordResetOutcome } from '../../data/community/AuthBackend';

/**
 * Supabase only sends another confirmation email to the same address after
 * a short window (Auth → Rate Limits / `max_frequency`, 60 s by default).
 * A resend inside that window is answered "rate limited" — while the first
 * email is already on its way. The resend button waits out that window
 * instead of inviting a request that can only be refused.
 */
export const RESEND_COOLDOWN_MS = 60_000;

export type ResendFeedback = {
  titleKey:
    | 'auth.resendConfirmationSentTitle'
    | 'auth.resendConfirmationAlreadySentTitle'
    | 'auth.resendConfirmationFailedTitle';
  messageKey:
    | 'auth.resendConfirmationSentMessage'
    | 'auth.resendConfirmationAlreadySentMessage'
    | 'auth.errorNetworkError'
    | 'auth.resendConfirmationFailedMessage';
  /** Whether to (re)start the cooldown: an email was sent, or one was sent moments ago. */
  startCooldown: boolean;
};

/**
 * What the "check your email" screen tells the person after tapping
 * "Resend". A rate-limited answer is NOT a failure: the previous email was
 * sent (that is exactly why Supabase refuses another one so soon). No
 * outcome reveals whether the address has an account.
 */
export function resendFeedback(result: PasswordResetOutcome): ResendFeedback {
  if (result.ok) {
    return { titleKey: 'auth.resendConfirmationSentTitle', messageKey: 'auth.resendConfirmationSentMessage', startCooldown: true };
  }
  if (result.error === 'rate-limited') {
    return { titleKey: 'auth.resendConfirmationAlreadySentTitle', messageKey: 'auth.resendConfirmationAlreadySentMessage', startCooldown: true };
  }
  if (result.error === 'network-error') {
    return { titleKey: 'auth.resendConfirmationFailedTitle', messageKey: 'auth.errorNetworkError', startCooldown: false };
  }
  return { titleKey: 'auth.resendConfirmationFailedTitle', messageKey: 'auth.resendConfirmationFailedMessage', startCooldown: false };
}

/** Whole seconds left before another resend is allowed (0 = allowed now). */
export function resendSecondsLeft(availableAt: number | null, now: number): number {
  if (availableAt == null) return 0;
  return Math.max(0, Math.ceil((availableAt - now) / 1000));
}
