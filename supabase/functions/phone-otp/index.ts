// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/security.ts";

// Set per-request inside Deno.serve (origin whitelist)
let corsHeaders: Record<string, string> = {};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// SECURITY: the OTP hash pepper MUST be configured — no weak fallback
const PEPPER = Deno.env.get("CREDENTIALS_ENCRYPTION_KEY");

// ============ BulkGate (unico gateway: SMS High Quality + WhatsApp) ============
// Both channels go through BulkGate — no Meta Business account needed.
const BULKGATE_APP_ID = Deno.env.get("BULKGATE_APP_ID");
const BULKGATE_APP_TOKEN = Deno.env.get("BULKGATE_APP_TOKEN");
const BULKGATE_SENDER = Deno.env.get("BULKGATE_SENDER") || "DivideIt";

// Cryptographically secure 6-digit OTP (never Math.random for secrets)
function secureOtp(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeE164(input: string): string | null {
  const cleaned = (input || "").replace(/[^\d+]/g, "");
  if (!/^\+\d{8,15}$/.test(cleaned)) return null;
  return cleaned;
}

// ---------------------------------------------------------------------------
// BulkGate — SMS: transactional High Quality route (gText sender "DivideIt").
// Docs: https://help.bulkgate.com/docs/en/http-simple-transactional.html
// ---------------------------------------------------------------------------
async function sendBulkGateSms(toE164: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!BULKGATE_APP_ID || !BULKGATE_APP_TOKEN) {
    return { ok: false, error: "sms_not_configured" };
  }
  const res = await fetch("https://portal.bulkgate.com/api/1.0/simple/transactional", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      application_id: BULKGATE_APP_ID,
      application_token: BULKGATE_APP_TOKEN,
      number: toE164.replace(/^\+/, ""),
      text: body,
      // High Quality route: alphanumeric gText sender
      sender_id: "gText",
      sender_id_value: BULKGATE_SENDER,
      unicode: false,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.error) {
    console.error("bulkgate sms failed:", res.status, JSON.stringify(data)?.slice(0, 300));
    return { ok: false, error: `bulkgate_sms:${res.status}` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// BulkGate — WhatsApp: native Business WhatsApp channel through BulkGate's
// advanced transactional API (their verified channel — no Meta account).
// If WhatsApp cannot deliver, BulkGate falls back to the HQ SMS route so the
// user still receives the code (fallback uses the same message and sender).
// Docs: https://help.bulkgate.com/docs/en/http-advanced-transactional.html
// ---------------------------------------------------------------------------
async function sendBulkGateWhatsApp(toE164: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!BULKGATE_APP_ID || !BULKGATE_APP_TOKEN) {
    return { ok: false, error: "whatsapp_not_configured" };
  }
  const res = await fetch("https://portal.bulkgate.com/api/2.0/advanced/transactional", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      application_id: BULKGATE_APP_ID,
      application_token: BULKGATE_APP_TOKEN,
      number: toE164.replace(/^\+/, ""),
      channel: {
        whatsapp: {
          message: { text: body },
          sender: BULKGATE_SENDER,
        },
        sms: {
          // Fallback path if WhatsApp delivery is unavailable for this number
          sender_id: "gText",
          sender_id_value: BULKGATE_SENDER,
          text: body,
          unicode: false,
        },
      },
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.error) {
    console.error("bulkgate whatsapp failed:", res.status, JSON.stringify(data)?.slice(0, 300));
    return { ok: false, error: `bulkgate_wa:${res.status}` };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!PEPPER) {
      console.error("CREDENTIALS_ENCRYPTION_KEY is not configured");
      return json({ error: "service_unavailable" }, 503);
    }
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const user = userData.user;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { action, phone, code, channel } = await req.json().catch(() => ({}));

    if (action === "status") {
      const { data } = await admin
        .from("user_profiles")
        .select("phone_e164, phone_verified_at")
        .eq("user_id", user.id)
        .maybeSingle();
      return json({
        verified: !!data?.phone_verified_at,
        phone_e164: data?.phone_e164 || null,
      });
    }

    if (action === "send") {
      // ------------------------------------------------------------------
      // CONTROLLO PREVENTIVO: if the account is already verified, never send
      // a message — verification is bound to the USER, not to a group.
      // ------------------------------------------------------------------
      const { data: prof } = await admin
        .from("user_profiles")
        .select("phone_verified_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prof?.phone_verified_at) {
        return json({ sent: false, already_verified: true });
      }

      const e164 = normalizeE164(phone || "");
      if (!e164) return json({ error: "invalid_phone" }, 400);

      const ch = channel === "whatsapp" ? "whatsapp" : "sms";

      // ------------------------------------------------------------------
      // RATE LIMIT TEMPORANEAMENTE DISATTIVATO su richiesta dell'utente.
      // TODO: ripristinare il cap di 2 messaggi / 24h (per user e per numero)
      // quando l'utente lo richiede — il codice originale è qui sotto.
      // ------------------------------------------------------------------
      // const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      // const { count } = await admin
      //   .from("phone_verifications")
      //   .select("id", { count: "exact", head: true })
      //   .eq("user_id", user.id)
      //   .gte("created_at", since24h);
      // if ((count ?? 0) >= 2) {
      //   return json({ error: "rate_limited", retry_after_hours: 24 }, 429);
      // }
      // const { count: phoneCount } = await admin
      //   .from("phone_verifications")
      //   .select("id", { count: "exact", head: true })
      //   .eq("phone_e164", e164)
      //   .gte("created_at", since24h);
      // if ((phoneCount ?? 0) >= 2) {
      //   return json({ error: "rate_limited", retry_after_hours: 24 }, 429);
      // }

      const otp = secureOtp();
      const code_hash = await sha256(`${otp}:${e164}:${PEPPER}`);
      const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: insErr } = await admin.from("phone_verifications").insert({
        user_id: user.id,
        user_email: user.email,
        phone_e164: e164,
        code_hash,
        expires_at,
      });
      if (insErr) {
        console.error("phone-otp insert error:", insErr.message);
        return json({ error: "internal_error" }, 500);
      }

      // Formato approvato in fase di registrazione su BulkGate — NON modificare.
      const text = `Il tuo codice di verifica per DivideIt è: ${otp}. Il codice scade tra 10 minuti.`;
      const sent = ch === "whatsapp"
        ? await sendBulkGateWhatsApp(e164, text)
        : await sendBulkGateSms(e164, text);

      if (!sent.ok) {
        // SECURITY: never return the OTP in the response — even in dev.
        console.error(`phone-otp ${ch} send failed:`, sent.error);
        // Do not burn the rate-limit slot when the provider is not configured
        if (sent.error === "whatsapp_not_configured" || sent.error === "sms_not_configured") {
          await admin.from("phone_verifications").delete()
            .eq("user_id", user.id).eq("code_hash", code_hash);
          return json({ sent: false, error: "channel_not_configured" }, 503);
        }
        return json({ sent: false, error: "send_failed" }, 502);
      }
      return json({ sent: true, channel: ch });
    }

    if (action === "verify") {
      const otp = (code || "").toString().trim();
      if (!/^\d{6}$/.test(otp)) return json({ error: "invalid_code" }, 400);

      const { data: rec } = await admin
        .from("phone_verifications")
        .select("*")
        .eq("user_id", user.id)
        .is("verified_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!rec) return json({ error: "no_active_code" }, 400);
      if (rec.attempts >= rec.max_attempts) return json({ error: "too_many_attempts" }, 429);

      const expected = await sha256(`${otp}:${rec.phone_e164}:${PEPPER}`);
      if (expected !== rec.code_hash) {
        await admin.from("phone_verifications").update({ attempts: rec.attempts + 1 }).eq("id", rec.id);
        return json({ error: "invalid_code" }, 400);
      }

      await admin.from("phone_verifications").update({ verified_at: new Date().toISOString() }).eq("id", rec.id);

      // upsert profile + award badge (isPhoneVerified flag = phone_verified_at)
      const { data: existing } = await admin
        .from("user_profiles")
        .select("user_id, trust_badges, trust_level")
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing) {
        const badges: string[] = existing.trust_badges || [];
        const has = badges.includes("phone_verified");
        await admin.from("user_profiles").update({
          phone_e164: rec.phone_e164,
          phone_verified_at: new Date().toISOString(),
          trust_badges: has ? badges : [...badges, "phone_verified"],
          trust_level: has ? existing.trust_level : Math.min(100, (existing.trust_level || 0) + 20),
        }).eq("user_id", user.id);
      } else {
        await admin.from("user_profiles").insert({
          user_id: user.id,
          user_email: user.email,
          phone_e164: rec.phone_e164,
          phone_verified_at: new Date().toISOString(),
          trust_badges: ["phone_verified", "email_verified"],
          trust_level: 30,
        });
      }

      return json({ verified: true, phone_e164: rec.phone_e164 });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("phone-otp error:", (e as Error).message);
    return json({ error: "internal_error" }, 500);
  }
});
