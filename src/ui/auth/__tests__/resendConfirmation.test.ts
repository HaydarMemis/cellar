/**
 * "Resend confirmation email" feedback: a rate-limited answer right after
 * sign-up means the first email WAS sent, so it must never read as a failure.
 */
import { RESEND_COOLDOWN_MS, resendFeedback, resendSecondsLeft } from '../resendConfirmation';

it('success → "email sent" and a cooldown', () => {
  expect(resendFeedback({ ok: true })).toEqual({
    titleKey: 'auth.resendConfirmationSentTitle',
    messageKey: 'auth.resendConfirmationSentMessage',
    startCooldown: true,
  });
});

it('rate-limited (Supabase’s per-address window) → "already sent", not a failure', () => {
  const f = resendFeedback({ ok: false, error: 'rate-limited' });
  expect(f.titleKey).toBe('auth.resendConfirmationAlreadySentTitle');
  expect(f.messageKey).toBe('auth.resendConfirmationAlreadySentMessage');
  expect(f.startCooldown).toBe(true);
});

it('no connection → a connection message; anything else → a neutral retry message (never "something went wrong")', () => {
  expect(resendFeedback({ ok: false, error: 'network-error' }).messageKey).toBe('auth.errorNetworkError');
  expect(resendFeedback({ ok: false, error: 'unknown' }).messageKey).toBe('auth.resendConfirmationFailedMessage');
  expect(resendFeedback({ ok: false, error: 'unknown' }).startCooldown).toBe(false);
});

it('counts down the cooldown in whole seconds', () => {
  const start = 1_000_000;
  expect(resendSecondsLeft(null, start)).toBe(0);
  expect(resendSecondsLeft(start + RESEND_COOLDOWN_MS, start)).toBe(60);
  expect(resendSecondsLeft(start + RESEND_COOLDOWN_MS, start + 59_001)).toBe(1);
  expect(resendSecondsLeft(start + RESEND_COOLDOWN_MS, start + RESEND_COOLDOWN_MS)).toBe(0);
});
