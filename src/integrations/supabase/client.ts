import { createClient } from '@supabase/supabase-js';
import type { Database } from './db-types';
import { resolveSupabaseConfig } from '@/lib/appConfig';

const config = resolveSupabaseConfig(import.meta.env);
export const SUPABASE_URL = config.url;
export const SUPABASE_ANON_KEY = config.key;
export const SUPABASE_PUBLISHABLE_KEY = SUPABASE_ANON_KEY;

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    // Opaque public keys are API keys, not bearer JWTs. Preserve user JWTs.
    if (supabaseKey.startsWith('sb_publishable_') && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }
    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

// All DB, storage, realtime and auth calls share this instance and session.
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: createSupabaseFetch(SUPABASE_ANON_KEY) },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type { Database };
export default supabase;
