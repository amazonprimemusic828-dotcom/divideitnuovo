// Client Supabase del progetto esterno dell'utente.
// Il file `client.ts` e il `.env` vengono rigenerati automaticamente e possono
// puntare a un backend diverso: qui fissiamo il progetto corretto e usiamo
// `db-types.ts` (schema reale) per la tipizzazione.
import { createClient } from '@supabase/supabase-js';
import { brokeredPreviewStorage } from './previewAuthStorage';
import type { Database } from './db-types';

const SUPABASE_URL = 'https://pcumuxuqdxzvtcorbtuo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_pZvznhzMgIxslq8EMVC9LA_q87aBiZk';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: {
    fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
  },
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  },
});

export { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY };
export const SUPABASE_ANON_KEY = SUPABASE_PUBLISHABLE_KEY;
export type { Database };
export default supabase;
