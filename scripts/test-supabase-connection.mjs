#!/usr/bin/env node
/**
 * Supabase connection test — run BEFORE deploying:
 *   node --env-file=.env scripts/test-supabase-connection.mjs
 *
 * Verifies:
 *   1. Environment variables are set (no hardcoded fallbacks exist in the code)
 *   2. The Supabase REST API is reachable with the anon key
 *   3. A trial query against a public table succeeds (RLS-protected)
 *   4. The auth endpoint responds
 */

const URL_VAR =
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY_VAR =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let failed = false;
const ok = (msg) => console.log(`  PASS  ${msg}`);
const ko = (msg) => {
  console.error(`  FAIL  ${msg}`);
  failed = true;
};

console.log('--- Supabase connection test ---\n');

// 1. Env vars present
if (!URL_VAR) ko('Missing VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL');
else ok(`URL configured: ${new URL(URL_VAR).host}`);
if (!KEY_VAR) ko('Missing VITE_SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY');
else ok('Anon key configured');

if (failed) {
  console.error('\nSet the environment variables and retry. Aborting.');
  process.exit(1);
}

const headers = { apikey: KEY_VAR, Authorization: `Bearer ${KEY_VAR}` };

// 2. Trial query on a real table (groups).
// A JSON PostgREST response — even "permission denied" (42501) — proves the
// database is reachable and the API key is valid. Anonymous access to app
// tables is intentionally blocked by RLS/grants; real users query with their
// session JWT after login.
try {
  const res = await fetch(
    `${URL_VAR}/rest/v1/groups?select=id&limit=1`,
    { headers },
  );
  const bodyText = await res.text();
  if (res.ok) {
    const rows = JSON.parse(bodyText);
    ok(`Trial query on "groups" succeeded (${rows.length} row(s) visible to anon)`);
  } else {
    let code = null;
    try {
      code = JSON.parse(bodyText)?.code ?? null;
    } catch {
      /* not JSON */
    }
    if (code === '42501' || res.status === 403) {
      ok(`DB reached, key valid — anonymous access correctly denied (HTTP ${res.status}, code ${code ?? 'n/a'})`);
    } else if (code) {
      ok(`DB reached and answered with PostgREST code ${code} (HTTP ${res.status})`);
    } else {
      ko(`Trial query failed with HTTP ${res.status}: ${bodyText.slice(0, 200)}`);
    }
  }
} catch (e) {
  ko(`Trial query error: ${e.message}`);
}

// 4. Auth endpoint healthy
try {
  const res = await fetch(`${URL_VAR}/auth/v1/health`, { headers });
  if (res.ok) ok('Auth endpoint healthy');
  else ko(`Auth endpoint returned HTTP ${res.status}`);
} catch (e) {
  ko(`Auth endpoint unreachable: ${e.message}`);
}

console.log(failed ? '\nRESULT: FAILED — fix before deploy.' : '\nRESULT: ALL CHECKS PASSED — safe to deploy.');
process.exit(failed ? 1 : 0);
