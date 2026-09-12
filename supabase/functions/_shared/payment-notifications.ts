import { APP_URL, escapeHtml, sendAppEmail } from "./email.ts";

interface PaymentNotificationParams {
  supabase: any;
  groupId: string;
  adminEmail: string;
  userEmail: string;
  serviceName: string;
  ownerAmount: number;
  grossAmount: number;
  paymentKey: string;
}

async function insertNotificationOnce(
  supabase: any,
  row: { user_email: string; type: string; title: string; content: string },
) {
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .ilike("user_email", row.user_email)
    .eq("type", row.type)
    .eq("content", row.content)
    .limit(1);

  if (!existing?.length) {
    const { error } = await supabase.from("notifications").insert({
      ...row,
      read: false,
      created_date: new Date().toISOString(),
    });
    if (error) console.error(`notification insert failed (${row.type}):`, error.message);
  }
}

export async function notifyCompletedGroupPayment(params: PaymentNotificationParams) {
  const { supabase, groupId, adminEmail, userEmail, serviceName, ownerAmount, grossAmount, paymentKey } = params;
  const { data: member } = await supabase
    .from("memberships")
    .select("user_name")
    .eq("group_id", groupId)
    .ilike("user_email", String(userEmail).trim())
    .maybeSingle();
  const joiner = member?.user_name || String(userEmail).split("@")[0];

  await Promise.all([
    insertNotificationOnce(supabase, {
      user_email: userEmail,
      type: "payment_success",
      title: "Pagamento completato",
      content: `Il tuo pagamento di €${grossAmount.toFixed(2)} per ${serviceName} è stato completato.`,
    }),
    insertNotificationOnce(supabase, {
      user_email: adminEmail,
      type: "member_joined",
      title: "Nuovo membro nel gruppo",
      content: `${joiner} è entrato nel tuo gruppo ${serviceName}.`,
    }),
    insertNotificationOnce(supabase, {
      user_email: adminEmail,
      type: "payment_received",
      title: "Pagamento ricevuto",
      content: `${joiner} ha pagato ${serviceName}: €${ownerAmount.toFixed(2)} sono ora in hold.`,
    }),
    sendAppEmail(supabase, {
      to: adminEmail,
      kind: "member_joined",
      groupId,
      dedupeKey: `member_joined:${groupId}:${String(userEmail).toLowerCase()}`,
      subject: `${joiner} è entrato in ${serviceName}`,
      title: `Nuovo membro in ${escapeHtml(serviceName)}`,
      bodyHtml: `<strong>${escapeHtml(joiner)}</strong> è appena entrato nel tuo gruppo. Ricordati di condividere le credenziali del servizio dall'area gruppo.`,
      ctaLabel: "Vai al gruppo",
      ctaUrl: `${APP_URL}/GroupDetail?id=${groupId}`,
    }),
    sendAppEmail(supabase, {
      to: adminEmail,
      kind: "payment_received",
      groupId,
      dedupeKey: `payment_received:${paymentKey}`,
      subject: `Pagamento ricevuto — €${ownerAmount.toFixed(2)}`,
      title: "Hai ricevuto un pagamento",
      bodyHtml: `<strong>${escapeHtml(joiner)}</strong> ha pagato la quota di <strong>${escapeHtml(serviceName)}</strong>.<br><br>Importo netto per te: <strong>€${ownerAmount.toFixed(2)}</strong>`,
      ctaLabel: "Apri il wallet",
      ctaUrl: `${APP_URL}/Wallet`,
    }),
    sendAppEmail(supabase, {
      to: userEmail,
      kind: "payment_success",
      groupId,
      dedupeKey: `payment_success:${paymentKey}`,
      subject: `Pagamento confermato — ${serviceName}`,
      title: "Pagamento completato",
      bodyHtml: `Il tuo pagamento di <strong>€${grossAmount.toFixed(2)}</strong> per <strong>${escapeHtml(serviceName)}</strong> è andato a buon fine.`,
      ctaLabel: "Vai al gruppo",
      ctaUrl: `${APP_URL}/GroupDetail?id=${groupId}`,
    }),
  ]);
}