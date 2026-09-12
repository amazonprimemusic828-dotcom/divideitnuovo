import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_URL } from '@/lib/appConfig';

const mocks = vi.hoisted(() => ({
  oauth: vi.fn(), otp: vi.fn(), reset: vi.fn(), signup: vi.fn(),
  referral: vi.fn(), ticket: vi.fn(), prepare: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {
  signInWithOAuth: mocks.oauth, signInWithOtp: mocks.otp,
  resetPasswordForEmail: mocks.reset, signUp: mocks.signup,
} } }));
vi.mock('@/lib/referral', () => ({
  getPendingReferral: mocks.referral,
  getPendingReferralTicket: mocks.ticket,
  prepareReferralClaim: mocks.prepare,
}));
import { signInWithGoogle, signInWithMagicLink, signUpWithEmail, sendPasswordReset } from '@/lib/auth';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.oauth.mockResolvedValue({ error: null });
  mocks.otp.mockResolvedValue({ error: null });
  mocks.reset.mockResolvedValue({ error: null });
  mocks.signup.mockResolvedValue({ error: null, data: { user: null, session: null } });
  mocks.prepare.mockResolvedValue(null);
  mocks.referral.mockReturnValue(null);
  mocks.ticket.mockReturnValue(null);
});

describe('production authentication redirects', () => {
  it('returns Google OAuth to the application rather than the current test origin', async () => {
    await signInWithGoogle();
    expect(mocks.oauth).toHaveBeenCalledWith({
      provider: 'google', options: { redirectTo: `${APP_URL}/Auth?oauth=callback` },
    });
  });
  it('preserves and encodes referral parameters', async () => {
    mocks.referral.mockReturnValue('invite');
    mocks.prepare.mockResolvedValue('ticket&value');
    await signInWithGoogle();
    const redirect = new URL(mocks.oauth.mock.calls[0][0].options.redirectTo);
    expect(redirect.origin).toBe(APP_URL);
    expect(redirect.searchParams.get('ref')).toBe('INVITE');
    expect(redirect.searchParams.get('ref_ticket')).toBe('ticket&value');
    expect(redirect.searchParams.get('oauth')).toBe('callback');
  });
  it('sets magic link and password recovery destinations', async () => {
    await signInWithMagicLink('test@example.com');
    await sendPasswordReset('test@example.com');
    expect(mocks.otp.mock.calls[0][0].options.emailRedirectTo).toBe(`${APP_URL}/Auth?oauth=callback`);
    expect(mocks.reset).toHaveBeenCalledWith('test@example.com', { redirectTo: `${APP_URL}/reset-password` });
  });
  it('sets the signup confirmation destination', async () => {
    const result = await signUpWithEmail('test@example.com', 'example-password', 'Test');
    expect(mocks.signup.mock.calls[0][0].options.emailRedirectTo).toBe(`${APP_URL}/`);
    expect(result.needsConfirmation).toBe(true);
  });
  it('preserves OAuth error handling', async () => {
    mocks.oauth.mockResolvedValue({ error: { message: 'Too many requests' } });
    expect((await signInWithGoogle()).success).toBe(false);
  });
});
