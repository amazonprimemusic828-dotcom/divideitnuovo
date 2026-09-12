// notify-email: authenticated trigger for DivideIt email notifications.
// The client never chooses the recipient or the content — it only reports an
// event id; the server resolves everything and applies anti-spam rules.
import {
  buildCorsHeaders,
  getServiceClient,
  requireUser,
  jsonResponse,
  unauthorized,
  badRequest,
  tooManyRequests,
  checkRateLimit,
  z,
} from "../_shared/security.ts";
import { sendAppEmail, escapeHtml, APP_URL } from "../_shared/email.ts";

const BodySchema = z.union([
  z.object({ type: z.literal("chat_message"), group_id: z.string().uuid() }),
  z.object({ type: z.literal("ticket"), ticket_id: z.string().uuid() }),
  z.object({ type: z.literal("youtube_request") }),
]);


Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, cors);

  const user = await requireUser(req);
  if (!user) return unauthorized(cors);

  const supabase = getServiceClient();

  const allowed = await checkRateLimit(supabase, user.uid, "notify-email", 30, 60);
  if (!allowed) return tooManyRequests(cors);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest(cors);
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return badRequest(cors, parsed.error.flatten());
  const body = parsed.data;

  try {
    if (body.type === "chat_message") {
      return jsonResponse(await handleChat(supabase, user, body.group_id), 200, cors);
    }
    if (body.type === "youtube_request") {
      return jsonResponse(await handleYoutubeRequest(supabase, user), 200, cors);
    }
    return jsonResponse(await handleTicket(supabase, user, body.ticket_id), 200, cors);
  } catch (err) {

    console.error("notify-email error:", (err as Error).message);
    return jsonResponse({ error: "Invio notifica fallito" }, 500, cors);
  }
});

// ---- chat: one digest email per recipient per group, max once every 60 min ----
async function handleChat(supabase: any, user: { email: string }, groupId: string) {
  const { data: group } = await supabase
    .from("groups")
    .select("id, service_name, admin_email")
    .eq("id", groupId)
    .maybeSingle();
  if (!group) return { sent: 0 };

  const sender = user.email.toLowerCase();

  const { data: members } = await supabase
    .from("memberships")
    .select("user_email, payment_status")
    .eq("group_id", groupId)
    .in("payment_status", ["paid", "pending"]);

  // sender must belong to the group (admin or member)
  const emails = new Set<string>([String(group.admin_email).toLowerCase()]);
  for (const m of members || []) emails.add(String(m.user_email).toLowerCase());
  if (!emails.has(sender)) return { sent: 0 };
  emails.delete(sender);

  const isAdmin = sender === String(group.admin_email).toLowerCase();
  const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000));

  let sent = 0;
  for (const to of emails) {
    const ok = await sendAppEmail(supabase, {
      to,
      kind: "chat_message",
      groupId,
      dedupeKey: `chat:${groupId}:${to}:${hourBucket}`,
      throttleSeconds: 3600, // never more than 1 chat email per hour per group
      subject: `Nuovi messaggi in ${group.service_name}`,
      title: `Nuovi messaggi nel gruppo ${escapeHtml(group.service_name)}`,
      bodyHtml: `${
        isAdmin ? "L'admin del gruppo" : "Un membro del gruppo"
      } ha scritto in chat. Apri DivideIt per leggere e rispondere.<br><br>
      <span style="color:#98a2b3;font-size:13px;">Riceverai al massimo una email all'ora per questo gruppo.</span>`,
      ctaLabel: "Apri la chat",
      ctaUrl: `${APP_URL}/group/${groupId}`,
    });
    if (ok) sent++;
  }
  return { sent };
}

// ---- tickets: refund / help / problem -> email to the group admin ----
async function handleTicket(supabase: any, user: { email: string }, ticketId: string) {
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, user_email, user_name, ticket_type, subject, description, group_id, group_admin_email")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) return { sent: 0 };
  if (String(ticket.user_email).toLowerCase() !== user.email.toLowerCase()) return { sent: 0 };

  const admin = (ticket.group_admin_email || "").toLowerCase();
  if (!admin || admin === user.email.toLowerCase()) return { sent: 0 };

  const kindMap: Record<string, { kind: any; label: string }> = {
    refund: { kind: "ticket_refund", label: "Richiesta di rimborso" },
    help: { kind: "ticket_help", label: "Richiesta di aiuto" },
    problem: { kind: "ticket_problem", label: "Segnalazione problema" },
  };
  const cfg = kindMap[ticket.ticket_type];
  if (!cfg) return { sent: 0 };

  const ok = await sendAppEmail(supabase, {
    to: admin,
    kind: cfg.kind,
    groupId: ticket.group_id,
    dedupeKey: `ticket:${ticket.id}`,
    subject: `${cfg.label} — ${ticket.subject}`,
    title: `${cfg.label} da ${escapeHtml(ticket.user_name || ticket.user_email)}`,
    bodyHtml: `<strong>${escapeHtml(ticket.subject)}</strong><br><br>${escapeHtml(
      String(ticket.description || "").slice(0, 800),
    ).replaceAll("\n", "<br>")}`,
    ctaLabel: "Gestisci la richiesta",
    ctaUrl: ticket.group_id ? `${APP_URL}/group/${ticket.group_id}` : `${APP_URL}/support`,
  });
  return { sent: ok ? 1 : 0 };
}

// ---- premio YouTube Premium: avvisa gli admin della piattaforma entro 24h ----
async function handleYoutubeRequest(supabase: any, user: { uid: string; email: string }) {
  const { data: reward } = await supabase
    .from("youtube_rewards")
    .select("id, user_email, nickname, google_email, month, status")
    .eq("user_id", user.uid)
    .maybeSingle();
  if (!reward || !reward.google_email) return { sent: 0 };

  const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
  const ids = (roles || []).map((r: any) => r.user_id);
  if (!ids.length) return { sent: 0 };

  const { data: admins } = await supabase
    .from("user_profiles")
    .select("user_email")
    .in("user_id", ids);

  let sent = 0;
  for (const a of admins || []) {
    const to = String(a.user_email || "").toLowerCase();
    if (!to.includes("@")) continue;
    const ok = await sendAppEmail(supabase, {
      to,
      kind: "youtube_request",
      dedupeKey: `youtube:${reward.id}:${reward.google_email}`,
      subject: "Nuova richiesta invito YouTube Premium",
      title: "Invito YouTube Premium da mandare entro 24 ore",
      bodyHtml: `Utente: <strong>${escapeHtml(reward.nickname || reward.user_email)}</strong><br>
      Email Google da invitare: <strong>${escapeHtml(reward.google_email)}</strong><br>
      Mese: ${escapeHtml(reward.month)}`,
      ctaLabel: "Apri Invita YouTube",
      ctaUrl: `${APP_URL}/support`,
    });
    if (ok) sent++;
  }
  return { sent };
}
