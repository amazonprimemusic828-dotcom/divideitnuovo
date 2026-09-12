// Scheduled job: releases wallet holds whose release_at has passed.
// SECURITY: this function must only be callable by the scheduler (CRON_SECRET)
// or by an authenticated admin user. It was previously open to the public.
import {
  buildCorsHeaders,
  getServiceClient,
  requireUser,
  jsonResponse,
  auditLog,
} from "../_shared/security.ts";

async function isAdminEmail(supabase: ReturnType<typeof getServiceClient>, email: string): Promise<boolean> {
  const { data } = await supabase
    .from("config")
    .select("value")
    .eq("key", "admin_emails")
    .maybeSingle();
  if (!data?.value) return false;
  const admins = String(data.value)
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getServiceClient();

  // --- Authorization: cron secret OR admin JWT ---
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret") || "";
  let authorizedBy: string | null = null;

  if (cronSecret && providedSecret === cronSecret) {
    authorizedBy = "cron";
  } else {
    const user = await requireUser(req);
    if (user && (await isAdminEmail(supabase, user.email))) {
      authorizedBy = user.email;
    }
  }

  if (!authorizedBy) {
    return jsonResponse({ error: "Non autorizzato" }, 403, corsHeaders);
  }

  try {
    const { data: holdEntries, error } = await supabase
      .from("wallet_ledger")
      .select("*")
      .eq("status", "in_hold")
      .lte("release_at", new Date().toISOString());

    if (error) {
      console.error("Error fetching in_hold entries:", error);
      return jsonResponse({ error: "Errore interno" }, 500, corsHeaders);
    }

    if (!holdEntries?.length) {
      return jsonResponse({ released: 0 }, 200, corsHeaders);
    }

    let released = 0;

    for (const entry of holdEntries) {
      const { data: updated } = await supabase
        .from("wallet_ledger")
        .update({ status: "available" })
        .eq("id", entry.id)
        .eq("status", "in_hold")
        .select("id");

      if (updated?.length) {
        released++;
        await supabase.from("notifications").insert({
          user_email: entry.owner_email,
          type: "funds_available",
          title: "Fondi disponibili",
          content: `€${entry.net_amount.toFixed(2)} sono ora disponibili per il prelievo.`,
          read: false,
          created_date: new Date().toISOString(),
        });
      }
    }

    // Housekeeping: purge old rate-limit windows while we're here
    await supabase.rpc("purge_rate_limits").then(() => {}, () => {});

    await auditLog(supabase, "hold_release_run", authorizedBy === "cron" ? null : authorizedBy, {
      released,
      trigger: authorizedBy === "cron" ? "cron" : "admin",
    });

    console.log(`Hold release: ${released} entries released (by ${authorizedBy})`);
    return jsonResponse({ released }, 200, corsHeaders);
  } catch (err: any) {
    console.error("Hold release error:", err.message);
    return jsonResponse({ error: "Errore interno" }, 500, corsHeaders);
  }
});
