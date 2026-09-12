/**
 * Conferma il bonus referral quando l'invitato "attiva" davvero l'account:
 *  1. entra in un gruppo pagando la sua quota, OPPURE
 *  2. ha creato un gruppo e arriva il primo co-abbonato pagante.
 * Nel caso 2 il pagante è un altro utente, quindi confermiamo anche
 * l'eventuale referral in sospeso dell'admin del gruppo.
 */
export async function confirmPaidReferral(
  supabase: any,
  userEmail: string,
  groupId: string,
): Promise<void> {
  await confirmForEmail(supabase, userEmail, groupId);

  // Il gruppo diventa attivo con il primo partecipante pagante:
  // sblocca anche il bonus di chi ha invitato l'admin.
  try {
    const { data: group } = await supabase
      .from("groups")
      .select("admin_email")
      .eq("id", groupId)
      .maybeSingle();
    const adminEmail = String(group?.admin_email || "").trim().toLowerCase();
    if (adminEmail && adminEmail !== String(userEmail || "").trim().toLowerCase()) {
      await confirmForEmail(supabase, adminEmail, groupId);
    }
  } catch (_e) {
    /* non bloccante */
  }
}

async function confirmForEmail(
  supabase: any,
  userEmail: string,
  groupId: string,
): Promise<void> {
  const email = String(userEmail || "").trim().toLowerCase();
  if (!email) return;

  const { data: pending } = await supabase
    .from("referrals")
    .select("id, referrer_id, referrer_email, referred_id")
    .ilike("referred_email", email)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!pending) return;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: todayCount } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", pending.referrer_id)
    .eq("status", "confirmed")
    .gt("confirmed_at", since);
  if ((todayCount || 0) >= 10) return;

  // The status guard makes webhook + browser verification races safe: exactly
  // one caller claims the pending referral.
  const { data: confirmed, error: confirmError } = await supabase
    .from("referrals")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", pending.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (confirmError || !confirmed) return;

  const { data: existingBonus } = await supabase
    .from("wallet_transactions")
    .select("id")
    .eq("source_referral_id", pending.id)
    .maybeSingle();

  if (!existingBonus) {
    const { data: credited, error: creditError } = await supabase.rpc("wallet_credit", {
      _user_email: pending.referrer_email,
      _amount_cents: 100,
      _type: "referral_bonus",
      _description: "Bonus invito amico",
      _source_payment_id: null,
      _source_group_id: groupId,
      _source_ticket_id: null,
      _source_session_id: null,
      _created_by: "system",
    });
    const creditRow = Array.isArray(credited) ? credited[0] : credited;
    if (!creditError && creditRow?.tx_id) {
      await supabase
        .from("wallet_transactions")
        .update({ source_referral_id: pending.id })
        .eq("id", creditRow.tx_id);
      await supabase.from("notifications").insert({
        user_email: pending.referrer_email,
        type: "referral",
        title: "Bonus invito accreditato",
        content: "Un amico che hai invitato è entrato in un gruppo: +1,00 € nel tuo portafoglio.",
        link: "/Referral",
        group_id: groupId,
        read: false,
        created_date: new Date().toISOString(),
      });
    }
  }

  const { data: confirmedRows } = await supabase
    .from("referrals")
    .select("referred_id")
    .eq("referrer_id", pending.referrer_id)
    .eq("status", "confirmed");
  const confirmedFriends = new Set(
    (confirmedRows || []).map((row: any) => row.referred_id).filter(Boolean),
  ).size;
  if (confirmedFriends < 3) return;

  const { data: existingReward } = await supabase
    .from("youtube_rewards")
    .select("id")
    .eq("user_id", pending.referrer_id)
    .maybeSingle();
  if (existingReward) return;

  const month = new Date().toISOString().slice(0, 7);
  const { count: usedSlots } = await supabase
    .from("youtube_rewards")
    .select("id", { count: "exact", head: true })
    .eq("month", month);
  if ((usedSlots || 0) >= 50) return;

  const { data: reward, error: rewardError } = await supabase
    .from("youtube_rewards")
    .insert({
      user_id: pending.referrer_id,
      user_email: pending.referrer_email,
      month,
      status: "qualified",
    })
    .select("id")
    .maybeSingle();
  if (!rewardError && reward) {
    await supabase.from("notifications").insert({
      user_email: pending.referrer_email,
      type: "referral",
      title: "Hai sbloccato YouTube Premium!",
      content: "Inserisci la tua email Google nella pagina Invita: riceverai l'invito entro 24 ore.",
      link: "/Referral",
      read: false,
      created_date: new Date().toISOString(),
    });
  }
}