// Registra l'accredito in hold per l'admin del gruppo.
// NOTA: `wallet_ledger` ha un indice unico PARZIALE su payment_id
// (WHERE payment_id IS NOT NULL): un upsert PostgREST con onConflict=payment_id
// fallisce con 42P10. Qui usiamo select + insert idempotente.
export interface HoldParams {
  supabase: any;
  ownerEmail: string;
  ownerUid: string;
  groupId: string;
  paymentId: string | null;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  holdDays: number;
}

export async function recordOwnerHold(p: HoldParams): Promise<void> {
  const { supabase, paymentId } = p;

  if (paymentId) {
    const { data: existing } = await supabase
      .from("wallet_ledger")
      .select("id")
      .eq("payment_id", paymentId)
      .maybeSingle();
    if (existing) return;
  }

  const paidAt = new Date();
  const releaseAt = new Date(paidAt);
  releaseAt.setDate(releaseAt.getDate() + (p.holdDays || 25));

  const { error } = await supabase.from("wallet_ledger").insert({
    owner_email: p.ownerEmail,
    owner_uid: p.ownerUid,
    group_id: p.groupId,
    payment_id: paymentId,
    gross_amount: p.grossAmount,
    platform_fee: p.platformFee,
    net_amount: p.netAmount,
    paid_at: paidAt.toISOString(),
    release_at: releaseAt.toISOString(),
    status: "in_hold",
  });

  // 23505 = altra esecuzione concorrente ha già creato la riga: successo idempotente.
  if (error && error.code !== "23505") throw error;
}
