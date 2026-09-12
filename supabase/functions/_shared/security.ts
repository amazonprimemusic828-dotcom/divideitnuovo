// Shared security utilities for all DivideIt edge functions.
// Provides: CORS origin whitelist, JWT verification, rate limiting, input validation.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "npm:zod@3";

export { z };

// ============= CORS WHITELIST =============
// Configure extra origins via the ALLOWED_ORIGINS secret (comma-separated).
// SECURITY (audit punto 10): dev/preview origins are enabled ONLY outside
// production (ENVIRONMENT secret). Production allows real domains only.
const PRODUCTION_ORIGINS = ["https://c-charm-creator.lovable.app"];
const DEV_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigins(): string[] {
  // Production is the default; local origins require an explicit opt-in.
  const isDevelopment = Deno.env.get("ENVIRONMENT") === "development";
  return isDevelopment ? [...PRODUCTION_ORIGINS, ...DEV_ORIGINS] : PRODUCTION_ORIGINS;
}

function isOriginAllowed(origin: string): boolean {
  return getAllowedOrigins().includes(origin);
}

/**
 * Builds CORS headers with a strict origin whitelist.
 * Unknown origins get the primary production origin (their browser will block the response).
 */
export function buildCorsHeaders(req: Request): Record<string, string> {
  const allowed = getAllowedOrigins();
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": isOriginAllowed(origin) ? origin : allowed[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, stripe-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-supabase-client-version",
    "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
    Vary: "Origin",
  };
}

// ============= SUPABASE CLIENTS =============
export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ============= JWT VERIFICATION =============
export interface AuthUser {
  uid: string;
  email: string;
  emailVerified: boolean;
}

/**
 * Verifies the Supabase JWT from the Authorization header.
 * Returns the verified user or null. NEVER trust client-provided identity fields.
 */
export async function requireUser(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.email) return null;
    return {
      uid: data.user.id,
      email: data.user.email,
      emailVerified: !!data.user.email_confirmed_at,
    };
  } catch {
    return null;
  }
}

// ============= RATE LIMITING =============
/**
 * Sliding-window rate limiter backed by the public.rate_limits table.
 * Returns true when the request is allowed, false when the limit is exceeded.
 * Fails CLOSED for financial endpoints (pass failOpen = false).
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  key: string,
  endpoint: string,
  maxPerWindow: number,
  windowSeconds = 60,
  failOpen = true,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_key: key,
      p_endpoint: endpoint,
      p_max: maxPerWindow,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("rate_limit rpc error:", error.message);
      return failOpen;
    }
    return data === true;
  } catch (err) {
    console.error("rate_limit error:", (err as Error).message);
    return failOpen;
  }
}

// ============= RESPONSES =============
export function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function unauthorized(corsHeaders: Record<string, string>): Response {
  return jsonResponse({ error: "Autenticazione richiesta" }, 401, corsHeaders);
}

export function forbidden(corsHeaders: Record<string, string>): Response {
  return jsonResponse({ error: "Non autorizzato" }, 403, corsHeaders);
}

export function tooManyRequests(corsHeaders: Record<string, string>): Response {
  return jsonResponse(
    { error: "Troppe richieste. Riprova tra qualche minuto." },
    429,
    corsHeaders,
  );
}

export function badRequest(
  corsHeaders: Record<string, string>,
  details?: unknown,
): Response {
  return jsonResponse({ error: "Richiesta non valida", details }, 400, corsHeaders);
}

// ============= AUDIT LOG =============
export async function auditLog(
  supabase: SupabaseClient,
  event: string,
  actorEmail: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabase.from("audit_log").insert({
      action: event,
      actor_email: actorEmail,
      details: metadata,
    });
  } catch (err) {
    console.error("audit_log insert failed:", (err as Error).message);
  }
}
