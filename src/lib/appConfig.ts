export const APP_URL = 'https://divideitnuovo.vercel.app';
export const SUPABASE_PROJECT_REF = 'gsdkunlnjirimxcoqwxd';
export const ORIGINAL_SUPABASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`;

export function resolveSupabaseConfig(env: Record<string, string | undefined>) {
  const url = (env.VITE_SUPABASE_URL || ORIGINAL_SUPABASE_URL).trim().replace(/\/+$/, '');
  const key = (env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (url !== ORIGINAL_SUPABASE_URL) {
    throw new Error('VITE_SUPABASE_URL deve puntare al progetto originale: ' + ORIGINAL_SUPABASE_URL);
  }
  if (!key || key.startsWith('sb_secret_')) {
    throw new Error('Configura una chiave Supabase anon/publishable pubblica, mai una chiave privata.');
  }
  // This checks configuration, not the JWT signature (validated by Supabase).
  if (!key.startsWith('sb_publishable_')) {
    try {
      const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
      if (claims.role !== 'anon' || claims.ref !== SUPABASE_PROJECT_REF) throw new Error('Invalid claims');
    } catch {
      throw new Error('La ANON_KEY deve appartenere al progetto originale e avere ruolo anon.');
    }
  }
  return { url, key };
}
