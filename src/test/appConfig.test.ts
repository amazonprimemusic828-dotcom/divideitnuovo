import { describe, expect, it } from 'vitest';
import { APP_URL, ORIGINAL_SUPABASE_URL, SUPABASE_PROJECT_REF, resolveSupabaseConfig } from '@/lib/appConfig';

const anon = (ref = SUPABASE_PROJECT_REF, role = 'anon') =>
  `test.${btoa(JSON.stringify({ ref, role }))}.test`;

describe('production Supabase configuration', () => {
  it('uses the original project and the confirmed application domain', () => {
    expect(APP_URL).toBe('https://c-charm-creator.lovable.app');
    expect(resolveSupabaseConfig({ VITE_SUPABASE_ANON_KEY: anon() })).toEqual({
      url: ORIGINAL_SUPABASE_URL, key: anon(),
    });
  });
  it('normalizes trailing slashes and prefers the anon variable', () => {
    expect(resolveSupabaseConfig({
      VITE_SUPABASE_URL: ORIGINAL_SUPABASE_URL + '/',
      VITE_SUPABASE_ANON_KEY: anon(),
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_unused',
    }).key).toBe(anon());
  });
  it('supports the public publishable key variable', () => {
    expect(resolveSupabaseConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }).key)
      .toBe('sb_publishable_test');
  });
  it('rejects a different database URL rather than silently using it', () => {
    expect(() => resolveSupabaseConfig({ VITE_SUPABASE_URL: 'https://other.supabase.co', VITE_SUPABASE_ANON_KEY: anon() })).toThrow();
  });
  it.each(['', 'malformed', 'sb_secret_test', anon('other'), anon(SUPABASE_PROJECT_REF, 'service_role')])(
    'rejects missing, invalid or private credentials', (key) => {
      expect(() => resolveSupabaseConfig({ VITE_SUPABASE_ANON_KEY: key })).toThrow();
    },
  );
});
