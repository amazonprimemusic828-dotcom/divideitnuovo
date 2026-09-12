// Guard called from the client around the Firebase SMS request.
// - mode "check": verify the user is under 3 SMS / 24h and the monthly cap
//   is not full. Does NOT consume a slot.
// - mode "commit": called ONLY after Firebase has actually delivered the SMS,
//   consumes 1 slot atomically (updates monthly counter + inserts a
//   phone_verifications row).
// This way failed sends (bad number, reCAPTCHA errors, region blocked, ...)
// do NOT eat into the user's 3 attempts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { buildCorsHeaders } from "../_shared/security.ts";

// Set per-request inside Deno.serve (origin whitelist)
let corsHeaders: Record<string, string> = {};

const USER_CAP = 3;
const MONTHLY_CAP = 10000;

Deno.serve(async (req) => {
  corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthenticated" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u, error: uerr } = await userClient.auth.getUser();
    if (uerr || !u.user) return json({ error: "unauthenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const phone: string = String(body.phone || "").trim();
    const mode: "check" | "commit" = body.mode === "commit" ? "commit" : "check";
    if (!/^\+\d{8,15}$/.test(phone)) return json({ error: "invalid_phone" }, 400);

    const admin = createClient(url, serviceKey);

    // --- Always check first ---
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error: rerr } = await admin
      .from("phone_verifications")
      .select("created_at")
      .eq("user_id", u.user.id)
      .gte("created_at", since)
      .order("created_at", { ascending: true });
    if (rerr) {
      console.error("sms-guard query error:", rerr.message);
      return json({ error: "internal_error" }, 500);
    }

    const userCount = rows?.length ?? 0;
    if (userCount >= USER_CAP) {
      const first = rows![0].created_at as string;
      const blockedUntil = new Date(new Date(first).getTime() + 24 * 60 * 60 * 1000).toISOString();
      return json({ allowed: false, reason: "user_blocked", blocked_until: blockedUntil }, 200);
    }

    const ym = new Date().toISOString().slice(0, 7); // YYYY-MM
    const { data: quota } = await admin
      .from("sms_quota_monthly")
      .select("sent_count")
      .eq("year_month", ym)
      .maybeSingle();
    const monthlyCount = quota?.sent_count ?? 0;
    if (monthlyCount >= MONTHLY_CAP) {
      return json({ allowed: false, reason: "monthly_quota_exceeded" }, 200);
    }

    if (mode === "check") {
      return json({
        allowed: true,
        remaining_user: USER_CAP - userCount,
        remaining_monthly: MONTHLY_CAP - monthlyCount,
      }, 200);
    }

    // --- commit: consume one slot via existing atomic RPC ---
    const { data, error } = await admin.rpc("sms_guard_try_consume", {
      _user_id: u.user.id,
      _phone: phone,
    });
    if (error) {
      console.error("sms-guard rpc error:", error.message);
      return json({ error: "internal_error" }, 500);
    }
    return json(data, 200);
  } catch (e) {
    console.error("sms-guard error:", (e as Error).message);
    return json({ error: "internal_error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
