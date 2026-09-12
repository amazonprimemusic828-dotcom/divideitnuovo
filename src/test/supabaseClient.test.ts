import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { supabase as legacyClient } from '@/integrations/supabase/typed-client';
import { supabase as dataClient } from '@/lib/supabaseClient';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn((_url: string, _key: string, _options: unknown) => ({ auth: {} })),
}));
afterEach(() => vi.unstubAllGlobals());

describe('shared Supabase client', () => {
  it('uses one client for all import paths and the original public configuration', () => {
    expect(legacyClient).toBe(supabase);
    expect(dataClient).toBe(supabase);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(SUPABASE_URL).toBe('https://gsdkunlnjirimxcoqwxd.supabase.co');
    expect(SUPABASE_ANON_KEY).toBeTruthy();
    expect(createClient).toHaveBeenCalledWith(SUPABASE_URL, SUPABASE_ANON_KEY, expect.objectContaining({
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }));
  });
  it('keeps user authentication while adding the configured public API key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const options = vi.mocked(createClient).mock.calls[0][2];
    await options.global.fetch(`${SUPABASE_URL}/rest/v1/groups`, {
      headers: { Authorization: 'Bearer user-session-token' },
    });
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('apikey')).toBe(SUPABASE_ANON_KEY);
    expect(headers.get('Authorization')).toBe('Bearer user-session-token');
  });
});
