#!/usr/bin/env node
/**
 * Applies the security remediation migrations to the Supabase Postgres DB.
 * Usage: node --env-file-if-exists=/vercel/share/.env.project scripts/apply-security-migrations.mjs
 * Requires POSTGRES_URL_NON_POOLING (or POSTGRES_URL) in the environment.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const MIGRATIONS = [
  'supabase/migrations/20260709000000_rate_limits.sql',
  'supabase/migrations/20260709000001_security_hardening.sql',
  'supabase/migrations/20260802000000_audit_remediation.sql',
];

const conn = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!conn) {
  console.error('Missing POSTGRES_URL_NON_POOLING / POSTGRES_URL');
  process.exit(1);
}

const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log('Connected to database.');

for (const rel of MIGRATIONS) {
  const path = resolve(root, rel);
  const sql = readFileSync(path, 'utf8');
  process.stdout.write(`Applying ${rel} ... `);
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('OK');
  } catch (err) {
    await client.query('ROLLBACK');
    console.log(`FAILED: ${err.message}`);
    console.error(`  -> detail: ${err.detail ?? 'n/a'} | hint: ${err.hint ?? 'n/a'}`);
  }
}

// Verification: list policies on the sensitive tables
const { rows } = await client.query(`
  SELECT tablename, policyname, cmd
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('memberships','groups','support_tickets','support_messages','messages','user_roles','rate_limits','user_wallets','wallet_ledger','payments')
  ORDER BY tablename, policyname
`);
console.log('\n=== Policies now defined ===');
for (const r of rows) console.log(`${r.tablename} | ${r.policyname} | ${r.cmd}`);

const { rows: rls } = await client.query(`
  SELECT relname, relrowsecurity FROM pg_class
  WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
    AND relname IN ('memberships','groups','support_tickets','support_messages','messages','user_roles','payments','user_wallets','wallet_ledger','rate_limits')
  ORDER BY relname
`);
console.log('\n=== RLS enabled status (operator will re-enable manually) ===');
for (const r of rls) console.log(`${r.relname}: RLS ${r.relrowsecurity ? 'ENABLED' : 'disabled'}`);

await client.end();
console.log('\nDone.');
