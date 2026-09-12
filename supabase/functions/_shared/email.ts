// Shared email sending for DivideIt (Resend) with built-in anti-spam.
// - respects user_profiles.notify_email / notify_chat / notify_payment / notify_new_member
// - dedupes identical notifications (unique dedupe_key)
// - throttles noisy kinds (chat digests) with a time window
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type EmailKind =
  | "member_joined"
  | "payment_received"
  | "payment_success"
  | "chat_message"
  | "ticket_refund"
  | "ticket_help"
  | "ticket_problem"
  | "youtube_request";

// Which notification preference gates each kind
const PREF_BY_KIND: Record<EmailKind, string> = {
  member_joined: "notify_new_member",
  payment_received: "notify_payment",
  payment_success: "notify_payment",
  chat_message: "notify_chat",
  ticket_refund: "notify_email",
  ticket_help: "notify_email",
  ticket_problem: "notify_email",
  youtube_request: "notify_email",
};


export const APP_URL = "https://divideitnuovo.vercel.app";

function shell(title: string, bodyHtml: string, ctaLabel?: string, ctaUrl?: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="font-size:20px;font-weight:800;color:#6d28d9;margin-bottom:16px;">DivideIt</div>
    <div style="background:#ffffff;border-radius:16px;padding:28px;box-shadow:0 1px 3px rgba(16,24,40,.08);">
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#101828;">${title}</h1>
      <div style="font-size:15px;line-height:1.6;color:#475467;">${bodyHtml}</div>
      ${
        ctaLabel && ctaUrl
          ? `<div style="margin-top:24px;"><a href="${ctaUrl}" style="display:inline-block;background:#6d28d9;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;font-size:15px;">${ctaLabel}</a></div>`
          : ""
      }
    </div>
    <p style="font-size:12px;color:#98a2b3;margin-top:18px;line-height:1.5;">
      Ricevi questa email perché sei iscritto a DivideIt. Puoi disattivare queste notifiche dalle
      <a href="${APP_URL}/settings" style="color:#6d28d9;">impostazioni del tuo profilo</a>.
    </p>
  </div></body></html>`;
}

export function escapeHtml(input: string): string {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

interface SendOptions {
  to: string;
  kind: EmailKind;
  subject: string;
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  groupId?: string | null;
  /** Unique key: the same key is never emailed twice. */
  dedupeKey: string;
  /** Optional extra throttle: max 1 email of this kind (per recipient+group) in N seconds. */
  throttleSeconds?: number;
}

async function prefsAllow(
  supabase: SupabaseClient,
  email: string,
  kind: EmailKind,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("user_profiles")
      .select("notify_email, notify_chat, notify_payment, notify_new_member")
      .eq("user_email", email.toLowerCase())
      .maybeSingle();
    if (!data) return true; // no profile row yet -> defaults are on
    if (data.notify_email === false) return false;
    const pref = PREF_BY_KIND[kind];
    return (data as Record<string, unknown>)[pref] !== false;
  } catch {
    return true;
  }
}

/**
 * Sends one email. Returns true only when it was actually delivered to Resend.
 * Silently skips when the user opted out, when it is a duplicate, or when throttled.
 */
export async function sendAppEmail(
  supabase: SupabaseClient,
  opts: SendOptions,
): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM") || "DivideIt <noreply@divideit.app>";
  const to = (opts.to || "").trim().toLowerCase();
  if (!apiKey || !to || !to.includes("@")) return false;

  if (!(await prefsAllow(supabase, to, opts.kind))) return false;

  // Throttle window (anti-spam for chat notifications)
  if (opts.throttleSeconds && opts.throttleSeconds > 0) {
    const since = new Date(Date.now() - opts.throttleSeconds * 1000).toISOString();
    let q = supabase
      .from("email_send_log")
      .select("id")
      .eq("recipient_email", to)
      .eq("kind", opts.kind)
      .gte("created_at", since)
      .limit(1);
    if (opts.groupId) q = q.eq("group_id", opts.groupId);
    const { data: recent } = await q;
    if (recent && recent.length > 0) return false;
  }

  // Dedupe: unique constraint on dedupe_key — insert first, send only if we won the race
  const { error: logErr } = await supabase.from("email_send_log").insert({
    recipient_email: to,
    kind: opts.kind,
    group_id: opts.groupId || null,
    dedupe_key: opts.dedupeKey,
  });
  if (logErr) return false; // duplicate or db error -> never send twice

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: opts.subject,
        html: shell(opts.title, opts.bodyHtml, opts.ctaLabel, opts.ctaUrl),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`Resend error [${res.status}]: ${text}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend request failed:", (err as Error).message);
    return false;
  }
}
