#!/usr/bin/env node
// Read-only connectivity checks. They do not prove authenticated workflows or schema parity.
const url = (process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (url !== 'https://oozofpqpivmrsfeybswd.supabase.co' || !key || key.startsWith('sb_secret_')) {
  console.error('Configure the original Supabase URL and a public anon/publishable key.');
  process.exit(1);
}
if (!key.startsWith('sb_publishable_')) {
  try {
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (claims.role !== 'anon' || claims.ref !== 'oozofpqpivmrsfeybswd') throw new Error();
  } catch {
    console.error('The key must be an anon key for the original project.');
    process.exit(1);
  }
}
const headers = { apikey: key };
if (!key.startsWith('sb_publishable_')) headers.Authorization = `Bearer ${key}`;
let failed = false;
for (const path of ['/auth/v1/settings', '/rest/v1/groups?select=id&limit=1']) {
  try {
    const response = await fetch(`${url}${path}`, { headers, signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    if (response.ok) {
      console.log(`PASS ${path}`);
    } else if (path.startsWith('/rest/') && [401, 403].includes(response.status) && body?.code === '42501') {
      console.log('PASS database reached; anonymous table access denied by grants/RLS.');
    } else {
      throw new Error(`HTTP ${response.status}, code ${body?.code || 'unknown'}`);
    }
  } catch (error) {
    failed = true;
    const networkCode = error.cause?.code;
    console.error(`FAIL ${path}: ${error.message}${networkCode ? ` (${networkCode})` : ''}`);
  }
}
console.log(failed ? 'Connectivity checks failed.' : 'Connectivity checks passed; verify authenticated flows separately.');
process.exit(failed ? 1 : 0);
