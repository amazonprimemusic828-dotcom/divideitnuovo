import Stripe from "npm:stripe@^16.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { confirmPaidReferral } from "../_shared/paid-referral.ts";
import { notifyCompletedGroupPayment } from "../_shared/payment-notifications.ts";
import { recordOwnerHold } from "../_shared/wallet-hold.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getHoldDays(supabase: any): Promise<number> {
  const { data } = await supabase
    .from("config")
    .select("value")
    .eq("key", "hold_days")
    .single();
  return data?.value ? parseInt(data.value, 10) : 25;
}

async function logAudit(supabase: any, params: any) {
  await supabase.from("audit_log").insert({
    action: params.action,
    actor_uid: params.actor_uid,
    actor_email: params.actor_email || null,
    target_type: params.target_type || null,
    target_id: params.target_id || null,
    details: params.details || null,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (Deno.env.get("STRIPE_ENABLED") !== "true") {
    // Do not acknowledge unprocessed events: Stripe may retry when re-enabled.
    return new Response(JSON.stringify({ code: "STRIPE_DISABLED", error: "Stripe disattivato" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const body = await req.text();
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-12-18.acacia" as any,
  });
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  console.log(`Webhook event: ${event.type} (${event.id})`);
  const supabase = getSupabase();

  // Idempotency check
  try {
    const { data: existing } = await supabase
      .from("stripe_webhook_events")
      .select("event_id")
      .eq("event_id", event.id)
      .limit(1);

    if (existing?.length) {
      console.log(`Event ${event.id} already processed`);
      return new Response(JSON.stringify({ received: true }), {
        headers: corsHeaders,
      });
    }

    await supabase.from("stripe_webhook_events").insert({
      event_id: event.id,
      type: event.type,
      processed_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("Idempotency check failed:", e);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const meta = session.metadata || {};
        // Waitlist preauth: save PI id so later we can capture it
        if (meta.type === "waitlist_preauth" && meta.waitlist_id) {
          const paymentIntentId = typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
          const paymentIntent = paymentIntentId
            ? await stripe.paymentIntents.retrieve(paymentIntentId)
            : null;
          const preauthorised = paymentIntent?.status === "requires_capture";
          if (!preauthorised) break;

          const { data: alreadyQueued } = await supabase
            .from("waitlist")
            .select("id")
            .eq("user_email", meta.user_email)
            .eq("service_name", meta.service_name)
            .filter("plan_type", meta.plan_type ? "eq" : "is", meta.plan_type || null)
            .eq("status", "waiting")
            .limit(1);

          if (alreadyQueued?.length) {
            if (paymentIntentId) {
              try { await stripe.paymentIntents.cancel(paymentIntentId); } catch { /* already cancelled/captured */ }
            }
            break;
          }

          const { error: waitlistInsertError } = await supabase.from("waitlist").insert({
            id: meta.waitlist_id,
            user_email: meta.user_email,
            service_name: meta.service_name,
            plan_type: meta.plan_type || null,
            stripe_payment_intent_id: paymentIntentId || null,
            amount_cents: Number(meta.amount_cents || paymentIntent?.amount || 0),
            expires_at: meta.expires_at,
            status: "waiting",
          });
          if (waitlistInsertError) throw waitlistInsertError;

          // Confirm to the user that the hold is active (no charge yet)
          const { data: wl } = await supabase
            .from("waitlist")
            .select("user_email, service_name, plan_type, amount_cents, expires_at")
            .eq("id", meta.waitlist_id)
            .maybeSingle();

          const email = wl?.user_email || meta.user_email;
          if (email) {
            const amount = ((wl?.amount_cents ?? 0) / 100).toFixed(2);
            const until = wl?.expires_at
              ? new Date(wl.expires_at).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })
              : null;
            await supabase.from("notifications").insert({
              user_email: email,
              type: "waitlist_preauth",
              title: "Preautorizzazione confermata · sei in Coda Prioritaria",
              content:
                `Abbiamo bloccato €${amount} sulla tua carta per ${wl?.service_name || meta.service_name}: ` +
                `nessun addebito è stato effettuato. ` +
                (until ? `La preautorizzazione resta valida fino al ${until}. ` : "") +
                `Appena si libera (o viene creato) un posto ti assegneremo automaticamente al gruppo e solo in quel momento verrà addebitato l'importo. ` +
                `Se non troviamo un posto, il blocco viene rilasciato senza costi.`,
              read: false,
              created_date: new Date().toISOString(),
            });

            const { data: queueData } = await supabase.rpc("waitlist_queue_info", {
              _service: wl?.service_name || meta.service_name,
              _plan: wl?.plan_type || meta.plan_type || null,
              _email: email,
            });
            const queue = Array.isArray(queueData) ? queueData[0] : queueData;
            if (queue) {
              const position = Number(queue.queue_position || 1);
              const capacity = Number(queue.typical_size || 1);
              const groupNumber = Number(queue.groups_ahead || 1);
              await supabase.from("notifications").insert({
                user_email: email,
                type: "waitlist_position",
                title: `Coda ${wl?.service_name || meta.service_name} · sei il #${position}`,
                content: `La tua preautorizzazione è confermata. Sei il numero ${position} in coda per il piano ${wl?.plan_type || meta.plan_type || "selezionato"}. Ogni gruppo accoglie ${capacity} partecipanti oltre all'admin: sei previsto nel ${groupNumber}° prossimo gruppo disponibile.`,
                read: false,
                created_date: new Date().toISOString(),
              });
            }
          }
        } else if (session.payment_status === "paid" && session.metadata) {

          await handleSuccessfulPayment(supabase, stripe, session);
        }
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as any;
        await logAudit(supabase, {
          action: "payment_intent_succeeded",
          actor_uid: pi.metadata?.userId || "stripe",
          actor_email: pi.metadata?.userEmail || "unknown",
          target_type: "payment_intent",
          target_id: pi.id,
          details: { amount: (pi.amount || 0) / 100 },
        });
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as any;
        const { userEmail } = pi.metadata || {};
        if (userEmail) {
          await supabase.from("notifications").insert({
            user_email: userEmail,
            type: "payment_failed",
            title: "Pagamento fallito",
            content: "Il pagamento non è andato a buon fine. Riprova.",
            read: false,
            created_date: new Date().toISOString(),
          });
        }
        break;
      }
      case "charge.refunded": {
        await handleRefund(supabase, stripe, event.data.object as any);
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as any;
        const { userEmail, user_email } = session.metadata || {};
        const notificationEmail = userEmail || user_email;
        if (notificationEmail) {
          await supabase.from("notifications").insert({
            user_email: notificationEmail,
            type: "payment_expired",
            title: "Pagamento scaduto",
            content: "La sessione di pagamento è scaduta.",
            read: false,
            created_date: new Date().toISOString(),
          });
        }
        break;
      }
      case "account.updated": {
        const account = event.data.object as any;
        await handleAccountUpdated(supabase, account);
        break;
      }
      case "transfer.created": {
        const transfer = event.data.object as any;
        console.log(`Transfer created: ${transfer.id}`);
        await logAudit(supabase, {
          action: "transfer_created_webhook",
          actor_uid: "stripe",
          actor_email: transfer.metadata?.owner_email || "unknown",
          target_type: "transfer",
          target_id: transfer.id,
          details: {
            amount: (transfer.amount || 0) / 100,
            destination: transfer.destination,
          },
        });
        break;
      }
      case "payout.paid": {
        const payout = event.data.object as any;
        const stripeAccountId = (event as any).account || payout.metadata?.stripe_account_id || null;
        if (stripeAccountId) {
          const { data: groups } = await supabase
            .from("groups")
            .select("admin_email")
            .eq("stripe_account_id", stripeAccountId)
            .limit(1);
          if (groups?.length) {
            await supabase.from("notifications").insert({
              user_email: groups[0].admin_email,
              type: "payout_arrived",
              title: "Fondi accreditati",
              content: `€${((payout.amount || 0) / 100).toFixed(2)} accreditati sul tuo conto.`,
              read: false,
              created_date: new Date().toISOString(),
            });
          }
        }
        break;
      }
      case "payout.failed": {
        const payout = event.data.object as any;
        const stripeAccountId = (event as any).account || payout.metadata?.stripe_account_id || null;
        if (stripeAccountId) {
          const { data: groups } = await supabase
            .from("groups")
            .select("admin_email")
            .eq("stripe_account_id", stripeAccountId)
            .limit(1);
          if (groups?.length) {
            await supabase.from("notifications").insert({
              user_email: groups[0].admin_email,
              type: "payout_failed",
              title: "Accredito fallito",
              content: `L'accredito di €${((payout.amount || 0) / 100).toFixed(2)} è fallito.`,
              read: false,
              created_date: new Date().toISOString(),
            });
          }
        }
        break;
      }
      case "identity.verification_session.verified":
      case "identity.verification_session.requires_input":
      case "identity.verification_session.canceled": {
        const vs = event.data.object as any;
        const userId = vs.metadata?.user_id;
        if (userId) {
          const verified = event.type.endsWith("verified");
          await supabase
            .from("user_profiles")
            .upsert(
              {
                user_id: userId,
                user_email: vs.metadata?.user_email || null,
                identity_status: verified ? "verified" : "failed",
                identity_verified_at: verified ? new Date().toISOString() : null,
              },
              { onConflict: "user_id" },
            );
          if (verified) {
            await supabase.rpc("award_trust_badge", {
              _user_id: userId,
              _badge: "identity_verified",
              _points: 15,
            });
          }
        }
        break;
      }
      default:
        console.log(`Unhandled event: ${event.type}`);
    }
  } catch (err: any) {
    console.error("Error processing webhook:", err.message);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: corsHeaders,
  });
});

async function handleSuccessfulPayment(supabase: any, stripe: Stripe, session: any) {
  const {
    userId,
    userEmail,
    type,
    groupId,
    billingMonth,
    totalCents,
    joinerFeeCents,
    walletPortionCents,
  } = session.metadata || {};

  if (type !== "group_payment" || !groupId) return;

  // Stripe's settled charge is authoritative. Some completed Checkout
  // Sessions expose a null amount_total, so recover it from the PaymentIntent.
  let cardCents = Number.isSafeInteger(session.amount_total) && session.amount_total >= 0
    ? session.amount_total
    : NaN;
  if (!Number.isSafeInteger(cardCents)) {
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
    if (paymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      cardCents = paymentIntent.amount_received || paymentIntent.amount || 0;
    } else {
      cardCents = 0;
    }
  }
  const parsedWalletCents = parseInt(walletPortionCents || "0", 10);
  const reconstructedTotalCents = cardCents + (Number.isSafeInteger(parsedWalletCents) && parsedWalletCents > 0 ? parsedWalletCents : 0);
  const metadataTotalCents = parseInt(totalCents || "0", 10);
  const effectiveTotalCents = reconstructedTotalCents > 0
    ? reconstructedTotalCents
    : Number.isSafeInteger(metadataTotalCents) && metadataTotalCents > 0
      ? metadataTotalCents
      : 0;
  if (effectiveTotalCents <= 0) {
    throw new Error("Unable to reconcile settled payment amount");
  }
  const metadataFeeCents = parseInt(joinerFeeCents || "0", 10);
  const effectiveFeeCents = Number.isSafeInteger(metadataFeeCents) && metadataFeeCents >= 0
    ? Math.min(metadataFeeCents, effectiveTotalCents)
    : Math.min(99, effectiveTotalCents);
  const effectiveQuotaCents = Math.max(0, effectiveTotalCents - effectiveFeeCents);
  const parsedAmount = effectiveTotalCents / 100;
  const parsedFee = effectiveFeeCents / 100;
  const parsedOwnerAmount = effectiveQuotaCents / 100;
  const currentMonth = billingMonth || new Date().toISOString().substring(0, 7);

  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .ilike("user_email", String(userEmail).trim())
    .eq("group_id", groupId)
    .eq("billing_month", currentMonth)
    .in("status", ["paid", "completed"])
    .limit(1);

  if (!existing?.length) {
    const { error: paymentInsertError } = await supabase.from("payments").insert({
      user_email: userEmail,
      group_id: groupId,
      amount: parsedAmount,
      platform_fee: parsedFee,
      owner_amount: parsedOwnerAmount,
      payment_date: new Date().toISOString(),
      billing_month: currentMonth,
      status: "paid",
    });
    // Browser verification and Stripe's webhook may finalize simultaneously.
    // The unique-key conflict means the same payment was already recorded and
    // is an idempotent success; other accounting failures must stop processing.
    if (paymentInsertError && paymentInsertError.code !== "23505") {
      console.error("webhook payment insert failed:", paymentInsertError.code, paymentInsertError.message);
      throw paymentInsertError;
    }
  }

  await supabase
    .from("memberships")
    .update({ payment_status: "paid" })
    .eq("group_id", groupId)
    .ilike("user_email", String(userEmail).trim());
  await confirmPaidReferral(supabase, userEmail, groupId);

  const { data: group } = await supabase
    .from("groups")
    .select("admin_email, owner_id, service_name")
    .eq("id", groupId)
    .single();

  if (group) {
    const holdDays = await getHoldDays(supabase);

    const { data: paymentRow } = await supabase
      .from("payments")
      .select("id")
      .ilike("user_email", String(userEmail).trim())
      .eq("group_id", groupId)
      .eq("billing_month", currentMonth)
      .eq("status", "paid")
      .limit(1)
      .maybeSingle();

    await recordOwnerHold({
      supabase,
      ownerEmail: group.admin_email,
      ownerUid: group.owner_id || group.admin_email,
      groupId,
      paymentId: paymentRow?.id || null,
      grossAmount: parsedAmount,
      platformFee: parsedFee,
      netAmount: parsedOwnerAmount,
      holdDays,
    });


    await notifyCompletedGroupPayment({
      supabase,
      groupId,
      adminEmail: group.admin_email,
      userEmail,
      serviceName: group.service_name || "il tuo gruppo",
      ownerAmount: parsedOwnerAmount,
      grossAmount: parsedAmount,
      paymentKey: paymentRow?.id || session.id,
    });
  }



  await logAudit(supabase, {
    action: "group_payment_completed",
    actor_uid: userId,
    actor_email: userEmail,
    target_type: "payment",
    target_id: session.id,
    details: { groupId, amount: parsedAmount },
  });
}

async function handleRefund(supabase: any, stripe: Stripe, charge: any) {
  const refundAmount = (charge.amount_refunded || 0) / 100;
  const paymentIntentId = charge.payment_intent;
  if (!paymentIntentId) return;

  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    const email = pi.metadata?.userEmail;
    const groupId = pi.metadata?.groupId;
    const billingMonth = pi.metadata?.billingMonth;

    if (!email || !groupId || !billingMonth) return;

    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("user_email", email)
      .eq("group_id", groupId)
      .eq("billing_month", billingMonth)
      .in("status", ["paid", "completed"])
      .limit(1)
      .single();

    if (!payment) return;

    await supabase.from("payments").update({ status: "refunded" }).eq("id", payment.id);

    await supabase
      .from("memberships")
      .update({ payment_status: "pending" })
      .eq("group_id", groupId)
      .eq("user_email", email);

    const { data: ledgerEntry } = await supabase
      .from("wallet_ledger")
      .select("id")
      .eq("payment_id", payment.id)
      .in("status", ["in_hold", "available"])
      .single();

    if (ledgerEntry) {
      await supabase
        .from("wallet_ledger")
        .update({ status: "reversed" })
        .eq("id", ledgerEntry.id);
    }

    await supabase.from("notifications").insert({
      user_email: email,
      type: "refund",
      title: "Rimborso effettuato",
      content: `Rimborso di €${refundAmount.toFixed(2)} effettuato.`,
      read: false,
      created_date: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error processing refund:", err);
  }
}

async function handleAccountUpdated(supabase: any, account: any) {
  const stripeAccountId = account.id;
  const payoutsEnabled = !!account.payouts_enabled;
  const chargesEnabled = !!account.charges_enabled;
  const requirements = account.requirements?.currently_due || [];
  const disabledReason = account.requirements?.disabled_reason || null;

  const { data: groups } = await supabase
    .from("groups")
    .select("id, admin_email, stripe_payouts_enabled")
    .eq("stripe_account_id", stripeAccountId);

  if (!groups?.length) return;

  await supabase
    .from("groups")
    .update({
      stripe_payouts_enabled: payoutsEnabled,
      stripe_charges_enabled: chargesEnabled,
      stripe_requirements_due: requirements,
    })
    .eq("stripe_account_id", stripeAccountId);

  const wasVerified = groups[0].stripe_payouts_enabled;
  const admin = groups[0].admin_email;

  if (payoutsEnabled && !wasVerified) {
    await supabase.from("notifications").insert({
      user_email: admin,
      type: "stripe_verified",
      title: "Identità verificata ✅",
      content: "Stripe ha approvato i tuoi dati. Ora puoi prelevare i fondi sul tuo IBAN.",
      read: false,
      created_date: new Date().toISOString(),
    });
  } else if (!payoutsEnabled && disabledReason) {
    await supabase.from("notifications").insert({
      user_email: admin,
      type: "stripe_rejected",
      title: "Verifica Stripe: azione richiesta",
      content: `Stripe richiede ulteriori informazioni (${disabledReason}). Riapri la verifica dal Portafoglio.`,
      read: false,
      created_date: new Date().toISOString(),
    });
  }
}
