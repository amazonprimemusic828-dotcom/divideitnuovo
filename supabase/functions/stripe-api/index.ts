import Stripe from "npm:stripe@^16.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, checkRateLimit, z } from "../_shared/security.ts";
import { sendAppEmail, escapeHtml, APP_URL } from "../_shared/email.ts";
import { confirmPaidReferral } from "../_shared/paid-referral.ts";
import { getPlanPriceCents } from "../_shared/service-plans.ts";
import { notifyCompletedGroupPayment } from "../_shared/payment-notifications.ts";
import { recordOwnerHold } from "../_shared/wallet-hold.ts";

// ============= INPUT VALIDATION =============
// Per-action schemas for critical/financial actions. Identity fields
// (ownerEmail, userEmail, ...) are overwritten server-side after auth,
// so they are intentionally NOT part of these schemas.
const uuid = z.string().uuid();
const monthStr = z.string().regex(/^\d{4}-\d{2}$/);
const emailStr = z.string().email().max(320);
const shortStr = z.string().max(200);
const urlStr = z.string().url().max(2000);
// Identity fields (ownerEmail, userEmail, userId, ownerUid, ownerName) are
// overwritten server-side after auth, but MUST still appear in the schemas
// because .strict() rejects unknown keys and the client sends them.
const identityFields = {
  action: z.string().max(60),
  userEmail: emailStr.optional().nullable(),
  userId: z.string().max(100).optional().nullable(),
  userName: shortStr.optional().nullable(),
  ownerEmail: emailStr.optional().nullable(),
  ownerUid: z.string().max(100).optional().nullable(),
  ownerName: shortStr.optional().nullable(),
  actorEmail: emailStr.optional().nullable(),
  actorUid: z.string().max(100).optional().nullable(),
};
// SECURITY (audit punto 6): every action has a schema and every schema is
// .strict() — unknown fields are rejected, amounts never come from the client.
const ACTION_SCHEMAS: Record<string, z.ZodTypeAny> = {
  "checkout": z.object({
    ...identityFields,
    groupId: uuid,
    billingMonth: monthStr.optional().nullable(),
    returnUrl: urlStr.optional().nullable(),
    useWalletCents: z.coerce.number().int().min(0).max(10_000_000).optional().nullable(),
  }).strict(),
  "verify-session": z.object({
    ...identityFields,
    sessionId: z.string().min(10).max(200),
    groupId: uuid,
  }).strict(),
  "checkout-cancelled": z.object({
    ...identityFields,
    groupId: uuid.optional().nullable(),
    sessionId: z.string().max(200).optional().nullable(),
  }).strict(),
  "groups-delete": z.object({ ...identityFields, groupId: uuid }).strict(),
  "group-close": z.object({ ...identityFields, groupId: uuid }).strict(),
  "credentials-set": z.object({
    ...identityFields,
    groupId: uuid,
    credentials: z.string().min(1).max(4000),
  }).strict(),
  "credentials-get": z.object({
    ...identityFields,
    groupId: uuid,
  }).strict(),
  "credential-status": z.object({
    ...identityFields,
    groupId: uuid,
    status: z.enum(["verified", "issue"]),
    note: z.string().max(500).optional().nullable(),
  }).strict(),
  "process-refund": z.object({ ...identityFields, ticketId: uuid }).strict(),
  "payout": z.object({ ...identityFields }).strict(),
  "withdraw": z.object({ ...identityFields }).strict(),
  "wallet-balance": z.object({ ...identityFields }).strict(),
  "ledger": z.object({ ...identityFields }).strict(),
  "ensure-account": z.object({ ...identityFields, groupId: uuid.optional().nullable(), returnUrl: urlStr.optional().nullable() }).strict(),
  "onboard": z.object({ ...identityFields, groupId: uuid.optional().nullable(), returnUrl: urlStr.optional().nullable() }).strict(),
  "onboarding-link": z.object({ ...identityFields, groupId: uuid.optional().nullable(), returnUrl: urlStr.optional().nullable() }).strict(),
  "owner-status": z.object({ ...identityFields }).strict(),
  "reset-stripe-account": z.object({ ...identityFields }).strict(),
  "publishable-key": z.object({ ...identityFields }).strict(),
  "waitlist-join": z.object({
    ...identityFields,
    serviceName: shortStr,
    planType: shortStr.optional().nullable(),
    returnUrl: urlStr.optional().nullable(),
    // amountCents intentionally rejected: derived server-side from the DB
  }).strict(),
  "waitlist-cancel": z.object({ ...identityFields, serviceName: shortStr.optional().nullable(), waitlistId: uuid.optional().nullable() }).strict(),
  "waitlist-process": z.object({ ...identityFields, groupId: uuid }).strict(),
  "matchmaking-find": z.object({
    ...identityFields,
    serviceName: shortStr,
    planType: shortStr.optional().nullable(),
  }).strict(),
  "matchmaking-cancel": z.object({ ...identityFields, serviceName: shortStr.optional().nullable(), lockId: uuid.optional().nullable() }).strict(),
  "admin-config-read": z.object({ ...identityFields, keys: z.array(z.string().max(100)).max(50).optional().nullable() }).strict(),
  "admin-config-write": z.object({
    ...identityFields,
    updates: z.record(z.string().max(100), z.string().max(2000)),
  }).strict(),
  "admin-platform-payout": z.object({ ...identityFields, amountCents: z.coerce.number().int().min(100).max(100_000_000).optional().nullable() }).strict(),
  "release-hold-test": z.object({ ...identityFields, groupId: uuid.optional().nullable() }).strict(),
  "test-fund-platform": z.object({ ...identityFields, amountCents: z.coerce.number().int().min(100).max(10_000_000).optional().nullable() }).strict(),
};

function validateActionBody(action: string, body: any): { ok: true } | { ok: false; details: unknown } {
  const schema = ACTION_SCHEMAS[action];
  // SECURITY: unknown actions without a schema are rejected upstream by the
  // switch; actions listed here MUST validate.
  if (!schema) return { ok: true };
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { ok: false, details: parsed.error.flatten() };
  return { ok: true };
}

// Set per-request inside Deno.serve (origin whitelist)
let corsHeaders: Record<string, string> = {};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getStripe() {
  return new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-12-18.acacia" as any,
  });
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ============= CONFIG =============
async function getConfig(supabase: any, key: string): Promise<string | null> {
  const { data } = await supabase
    .from("config")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value ?? null;
}
async function getConfigInt(supabase: any, key: string, fallback: number) {
  const v = await getConfig(supabase, key);
  return v ? parseInt(v, 10) : fallback;
}
async function getConfigFloat(supabase: any, key: string, fallback: number) {
  const v = await getConfig(supabase, key);
  return v ? parseFloat(v) : fallback;
}
async function isAdminEmail(supabase: any, email: string): Promise<boolean> {
  const v = await getConfig(supabase, "admin_emails");
  if (!v) return false;
  return v.split(",").map((e: string) => e.trim().toLowerCase()).includes(email.toLowerCase());
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

function siteBaseUrl(req: Request, fallback?: string): string {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  return fallback || "https://divideit.app";
}

const PLATFORM_WEBSITE_URL = "https://warm-waves-say.lovable.app";
function cleanOwnerName(ownerName?: string | null, ownerEmail?: string | null) {
  const fallback = ownerEmail?.split("@")[0]?.replace(/[._-]+/g, " ") || "Owner DivideIt";
  const value = (ownerName || fallback).trim().replace(/\s+/g, " ");
  return value.slice(0, 80) || fallback;
}

function splitOwnerName(ownerName: string) {
  const parts = ownerName.trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || ownerName,
    last_name: parts.length > 1 ? parts.slice(1).join(" ") : "DivideIt",
  };
}

function recipientBusinessProfile(ownerName?: string | null, ownerEmail?: string | null) {
  return {
    name: cleanOwnerName(ownerName, ownerEmail),
    url: PLATFORM_WEBSITE_URL,
    support_url: PLATFORM_WEBSITE_URL,
    mcc: "5815",
    product_description:
      "DIVIDEIT consente a privati di dividere quote di abbonamenti digitali condivisi. Il titolare del gruppo riceve solo trasferimenti/payout sul proprio IBAN.",
  };
}

async function resolveOwnerName(supabase: any, ownerEmail: string, ownerUid?: string, ownerName?: string) {
  if (ownerName?.trim()) return cleanOwnerName(ownerName, ownerEmail);

  if (ownerUid && /^[0-9a-f-]{36}$/i.test(ownerUid)) {
    try {
      const { data } = await supabase.auth.admin.getUserById(ownerUid);
      const meta = data?.user?.user_metadata || {};
      const name = meta.full_name || meta.name;
      if (name) return cleanOwnerName(name, ownerEmail);
    } catch (err: any) {
      console.warn("owner-name auth lookup warning:", err.message);
    }
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("user_name")
    .ilike("user_email", ownerEmail)
    .not("user_name", "is", null)
    .order("created_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return cleanOwnerName(membership?.user_name, ownerEmail);
}

async function prefillRecipientBusinessProfile(stripe: Stripe, accountId: string, ownerName?: string | null, ownerEmail?: string | null) {
  const displayName = cleanOwnerName(ownerName, ownerEmail);
  try {
    await stripe.accounts.update(accountId, {
      business_profile: recipientBusinessProfile(displayName, ownerEmail),
      metadata: { ownerName: displayName, platform: "divideit" },
    } as any);
  } catch (err: any) {
    console.warn("prefill-recipient-profile warning:", err.message);
  }

  try {
    await stripe.accounts.update(accountId, {
      individual: { email: ownerEmail || undefined, ...splitOwnerName(displayName) },
    } as any);
  } catch (err: any) {
    console.warn("prefill-recipient-individual warning:", err.message);
  }
}

function accountNeedsRecipientReset(account: any): boolean {
  if (!account || account.deleted) return true;
  const hasLegacyCardPayments = typeof account.capabilities?.card_payments === "string";
  return account.type === "standard" || (!account.payouts_enabled && hasLegacyCardPayments);
}

async function createRecipientAccount(stripe: Stripe, req: Request, params: { ownerEmail: string; ownerUid: string; displayName: string }) {
  return await stripe.accounts.create({
    type: "custom",
    country: "IT",
    email: params.ownerEmail,
    business_profile: recipientBusinessProfile(params.displayName, params.ownerEmail),
    capabilities: { transfers: { requested: true } },
    business_type: "individual",
    individual: { email: params.ownerEmail, ...splitOwnerName(params.displayName) },
    metadata: { ownerEmail: params.ownerEmail, ownerUid: params.ownerUid, ownerName: params.displayName, platform: "divideit" },
    tos_acceptance: {
      date: Math.floor(Date.now() / 1000),
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
    },
    settings: { payouts: { schedule: { interval: "manual" } } },
  });
}

function sumStripeBalance(items: any[], currency = "eur") {
  return (items || [])
    .filter((item) => item.currency === currency)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

async function getPlatformBalanceSnapshot(stripe: Stripe) {
  const balance = await stripe.balance.retrieve();
  const availableCents = sumStripeBalance(balance.available as any[], "eur");
  const pendingCents = sumStripeBalance(balance.pending as any[], "eur");
  let nextAvailableOn: number | null = null;
  if (pendingCents > 0) {
    try {
      const txs = await stripe.balanceTransactions.list({ limit: 50 });
      const dates = txs.data
        .filter((tx) => tx.currency === "eur" && tx.status === "pending" && Number(tx.net || tx.amount || 0) > 0 && tx.available_on)
        .map((tx) => tx.available_on as number);
      nextAvailableOn = dates.length ? Math.min(...dates) : null;
    } catch (err: any) {
      console.warn("platform-balance-transactions warning:", err.message);
    }
  }
  return { available_cents: availableCents, pending_cents: pendingCents, next_available_on: nextAvailableOn };
}

function isStripeTestMode() {
  return (Deno.env.get("STRIPE_SECRET_KEY") || "").startsWith("sk_test_");
}

function isBalanceInsufficient(err: any) {
  const message = String(err?.message || "").toLowerCase();
  return err?.code === "balance_insufficient" || message.includes("insufficient available funds") || message.includes("balance_insufficient");
}

async function fundPlatformAvailableBalanceForTest(stripe: Stripe, missingCents: number, reason: string) {
  if (!isStripeTestMode()) return null;
  const amountCents = Math.max(2000, Math.ceil(Number(missingCents || 0) * 1.15) + 1000);
  const charge = await stripe.charges.create({
    amount: amountCents,
    currency: "eur",
    source: "tok_bypassPending",
    description: `DivideIt TEST instant platform balance - ${reason}`,
    metadata: { reason, platform: "divideit", test_only: "true" },
  });
  console.log(`test platform balance funded: ${charge.id} amount=${amountCents} reason=${reason}`);
  return charge;
}

async function findExistingTransferForLedger(stripe: Stripe, ledgerId: string, destination: string) {
  try {
    const transfers = await stripe.transfers.list({ destination, limit: 100 } as any);
    return transfers.data.find((transfer: any) => transfer.metadata?.ledger_id === ledgerId) || null;
  } catch (err: any) {
    console.warn(`transfer lookup warning for ledger ${ledgerId}:`, err.message);
    return null;
  }
}

async function hasOpenTransferredLedger(supabase: any, ownerEmail: string) {
  const { data } = await supabase
    .from("wallet_ledger")
    .select("id")
    .eq("owner_email", ownerEmail)
    .eq("status", "available")
    .not("stripe_transfer_id", "is", null)
    .limit(1);
  return !!data?.length;
}

async function sha256Hex(input: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// In-memory rate limit (per cold-start instance)
const rateLimitBuckets = new Map<string, number[]>();
function rateLimit(key: string, max = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (rateLimitBuckets.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  rateLimitBuckets.set(key, arr);
  return arr.length <= max;
}

// ============= ENSURE CONNECT ACCOUNT (silent) =============
async function handleEnsureAccount(body: any, req: Request) {
  const { ownerEmail, ownerUid, ownerName, groupId } = body;
  if (!ownerEmail || !ownerUid) return json({ error: "Missing ownerEmail/ownerUid" }, 400);

  const supabase = getSupabase();
  const stripe = getStripe();
  const displayName = await resolveOwnerName(supabase, ownerEmail, ownerUid, ownerName);

  // Look for an existing stripe_account_id on any group of this owner
  const { data: ownerGroups } = await supabase
    .from("groups")
    .select("id, stripe_account_id")
    .eq("admin_email", ownerEmail);

  let stripeAccountId: string | null = null;
  for (const g of ownerGroups || []) {
    if (g.stripe_account_id) {
      try {
        const a = await stripe.accounts.retrieve(g.stripe_account_id);
        if (a && !(a as any).deleted && (!accountNeedsRecipientReset(a) || await hasOpenTransferredLedger(supabase, ownerEmail))) {
          stripeAccountId = g.stripe_account_id;
          break;
        }
      } catch { /* skip */ }
    }
  }

  if (!stripeAccountId) {
    try {
      // Recipient-only account: solo `transfers`.
      // NIENTE `card_payments` (eviterebbe la richiesta di dati attività/azienda).
      // Profilo beneficiario precompilato con il nome owner: l'utente inserisce solo dati personali/IBAN richiesti da Stripe.
      const account = await createRecipientAccount(stripe, req, { ownerEmail, ownerUid, displayName });
      stripeAccountId = account.id;

      await logAudit(supabase, {
        action: "stripe_account_created_silent",
        actor_uid: ownerUid,
        actor_email: ownerEmail,
        target_type: "stripe_account",
        target_id: stripeAccountId,
        details: { groupId },
      });
    } catch (err: any) {
      console.error("ensure-account error:", err.message);
      return json({ error: err.message }, 500);
    }
  }

  await prefillRecipientBusinessProfile(stripe, stripeAccountId, displayName, ownerEmail);

  // Propagate stripe_account_id to all owner's groups
  await supabase
    .from("groups")
    .update({ stripe_account_id: stripeAccountId })
    .eq("admin_email", ownerEmail);

  // Status snapshot
  const acct = await stripe.accounts.retrieve(stripeAccountId);
  await supabase
    .from("groups")
    .update({
      stripe_payouts_enabled: !!acct.payouts_enabled,
      stripe_charges_enabled: !!acct.charges_enabled,
      stripe_requirements_due: acct.requirements?.currently_due || [],
    })
    .eq("admin_email", ownerEmail);

  return json({
    success: true,
    stripe_account_id: stripeAccountId,
    owner_name: displayName,
    payouts_enabled: !!acct.payouts_enabled,
    charges_enabled: !!acct.charges_enabled,
    requirements: acct.requirements?.currently_due || [],
  });
}

// ============= ONBOARDING LINK (hosted) =============
async function handleOnboardingLink(body: any, req: Request) {
  const { ownerEmail, ownerUid, groupId } = body;
  if (!ownerEmail || !ownerUid) return json({ error: "Missing ownerEmail/ownerUid" }, 400);

  const supabase = getSupabase();
  const stripe = getStripe();

  // Ensure account first
  const ensure = await handleEnsureAccount(body, req);
  if (ensure.status !== 200) return ensure;
  const ensureData = await ensure.json();
  const stripeAccountId: string = ensureData.stripe_account_id;

  const base = siteBaseUrl(req);
  const idem = `accountlink_${stripeAccountId}_${Date.now()}`;
  try {
    const link = await stripe.accountLinks.create(
      {
        account: stripeAccountId,
        refresh_url: `${base}/Wallet?onboarding=refresh`,
        return_url: `${base}/Wallet?onboarding=complete`,
        type: "account_onboarding",
        collect: "currently_due",
      },
      { idempotencyKey: idem },
    );

    await logAudit(supabase, {
      action: "stripe_account_link_created",
      actor_uid: ownerUid,
      actor_email: ownerEmail,
      target_type: "stripe_account",
      target_id: stripeAccountId,
      details: { groupId },
    });

    return json({ url: link.url, stripe_account_id: stripeAccountId });
  } catch (err: any) {
    console.error("onboarding-link error:", err.message);
    return json({ error: err.message }, 500);
  }
}

async function handleResetStripeAccount(body: any, req: Request) {
  const { ownerEmail, ownerUid, ownerName } = body;
  if (!ownerEmail || !ownerUid) return json({ error: "Missing ownerEmail/ownerUid" }, 400);
  const supabase = getSupabase();
  const stripe = getStripe();
  if (await hasOpenTransferredLedger(supabase, ownerEmail)) {
    return json({
      error: "Non posso ricreare l'account mentre esistono fondi già trasferiti al vecchio saldo Stripe. Completa prima quel payout o contatta supporto.",
      code: "open_transfers_on_old_account",
    }, 400);
  }
  const displayName = await resolveOwnerName(supabase, ownerEmail, ownerUid, ownerName);
  const previous = await supabase
    .from("groups")
    .select("stripe_account_id")
    .eq("admin_email", ownerEmail)
    .not("stripe_account_id", "is", null)
    .limit(1)
    .maybeSingle();
  const account = await createRecipientAccount(stripe, req, { ownerEmail, ownerUid, displayName });
  await supabase.from("groups").update({
    stripe_account_id: account.id,
    stripe_payouts_enabled: false,
    stripe_charges_enabled: false,
    stripe_requirements_due: [],
  }).eq("admin_email", ownerEmail);
  await logAudit(supabase, {
    action: "stripe_account_reset",
    actor_uid: ownerUid,
    actor_email: ownerEmail,
    target_type: "stripe_account",
    target_id: account.id,
    details: { previous_stripe_account_id: previous.data?.stripe_account_id || null },
  });
  return json({ success: true, stripe_account_id: account.id, owner_name: displayName });
}

// ============= OWNER STATUS (live from Stripe) =============
async function handleOwnerStatus(body: any) {
  const { ownerEmail, ownerUid, ownerName } = body;
  if (!ownerEmail) return json({ error: "Missing ownerEmail" }, 400);

  const supabase = getSupabase();
  const stripe = getStripe();
  const displayName = await resolveOwnerName(supabase, ownerEmail, ownerUid, ownerName);

  const { data: g } = await supabase
    .from("groups")
    .select("stripe_account_id")
    .eq("admin_email", ownerEmail)
    .not("stripe_account_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (!g?.stripe_account_id) {
    return json({
      status: "not_created",
      stripe_account_id: null,
      payouts_enabled: false,
      charges_enabled: false,
      details_submitted: false,
      requirements: [],
    });
  }

  try {
    const a = await stripe.accounts.retrieve(g.stripe_account_id);
    if (accountNeedsRecipientReset(a) && !(await hasOpenTransferredLedger(supabase, ownerEmail))) {
      const replacement = await createRecipientAccount(stripe, new Request("https://divideit.local"), {
        ownerEmail,
        ownerUid: ownerUid || ownerEmail,
        displayName,
      });
      await supabase.from("groups").update({ stripe_account_id: replacement.id }).eq("admin_email", ownerEmail);
      await prefillRecipientBusinessProfile(stripe, replacement.id, displayName, ownerEmail);
      return json({
        status: "pending",
        stripe_account_id: replacement.id,
        owner_name: displayName,
        payouts_enabled: false,
        charges_enabled: false,
        details_submitted: false,
        requirements: [],
        replaced_legacy_account: true,
      });
    }
    await prefillRecipientBusinessProfile(stripe, g.stripe_account_id, displayName, ownerEmail);
    const status =
      a.payouts_enabled
        ? "complete"
        : a.details_submitted
        ? "pending_verification"
        : "pending";
    const requirements = [
      ...(a.requirements?.currently_due || []),
      ...(a.requirements?.past_due || []),
    ].filter((v, i, arr) => arr.indexOf(v) === i);

    await supabase
      .from("groups")
      .update({
        stripe_payouts_enabled: !!a.payouts_enabled,
        stripe_charges_enabled: !!a.charges_enabled,
        stripe_requirements_due: requirements,
      })
      .eq("admin_email", ownerEmail);

    return json({
      status,
      stripe_account_id: g.stripe_account_id,
      owner_name: displayName,
      payouts_enabled: !!a.payouts_enabled,
      charges_enabled: !!a.charges_enabled,
      details_submitted: !!a.details_submitted,
      requirements,
      disabled_reason: a.requirements?.disabled_reason || null,
    });
  } catch (err: any) {
    return json({ status: "error", error: err.message, payouts_enabled: false, charges_enabled: false });
  }
}

// ============= CHECKOUT (joiner subscription / one-time) =============
async function handleCheckout(body: any, req: Request) {
  const { userEmail, userId, userName, groupId, billingMonth, returnUrl, useWalletCents: useWalletCentsRaw } = body;
  if (!userEmail || !userId || !groupId) return json({ error: "Missing required fields" }, 400);

  const supabase = getSupabase();
  const stripe = getStripe();

  const { data: group } = await supabase.from("groups").select("*").eq("id", groupId).single();
  if (!group) return json({ error: "Group not found" }, 404);
  if (group.status !== "active") return json({ error: "Group is not active" }, 400);

  // A paid membership is an idempotent checkout success. A pending membership
  // is a seat reservation from an earlier interrupted checkout and may retry.
  const { data: existingMembership } = await supabase
    .from("memberships")
    .select("id, payment_status")
    .eq("group_id", groupId)
    .ilike("user_email", String(userEmail).trim())
    .limit(1)
    .maybeSingle();
  if (existingMembership?.payment_status === "paid") {
    return json({
      success: true,
      alreadyMember: true,
      redirect: `/GroupDetail?id=${groupId}`,
    });
  }

  if (!group.stripe_account_id) {
    await handleEnsureAccount({ ownerEmail: group.admin_email, ownerUid: group.admin_email, groupId: group.id }, req);
    const { data: g2 } = await supabase.from("groups").select("stripe_account_id").eq("id", groupId).single();
    group.stripe_account_id = g2?.stripe_account_id || null;
  }

  let seatRes: unknown = existingMembership;
  if (!existingMembership) {
    const reservation = await supabase.rpc("reserve_group_seat", {
      _group_id: groupId, _user_email: userEmail, _user_name: userName || null, _user_avatar_url: null,
    });
    seatRes = reservation.data;
    if (reservation.error) {
      const msg = reservation.error.message || "";
      if (msg.includes("seat_full")) return json({ error: "Il gruppo è pieno. Riprova più tardi.", code: "seat_full" }, 409);
      if (msg.includes("already_member")) return json({ error: "Iscrizione già in elaborazione. Riprova tra poco.", code: "membership_pending" }, 409);
      if (msg.includes("group_closed")) return json({ error: "Gruppo non attivo", code: "group_closed" }, 410);
      return json({ error: msg || "Impossibile riservare il posto" }, 400);
    }
  }
  console.log(`[checkout] seat reserved on ${groupId}:`, seatRes);

  const baseQuota = group.total_cost / group.max_members;
  const quotaCents = Math.round(baseQuota * 100);
  const joinerFeeCents = await getConfigInt(supabase, "joiner_fee_cents", 99);
  const totalCents = quotaCents + joinerFeeCents;
  if (totalCents < 50) return json({ error: "Importo sotto il minimo" }, 400);

  const currentMonth = billingMonth || new Date().toISOString().substring(0, 7);
  const { data: existingPayment } = await supabase
    .from("payments").select("id")
    .ilike("user_email", String(userEmail).trim()).eq("group_id", groupId).eq("billing_month", currentMonth)
    .in("status", ["pending", "paid", "completed"]).limit(1);
  if (existingPayment?.length) return json({ error: "Pagamento già esistente per questo periodo" }, 409);

  // ===== WALLET LOGIC =====
  const { data: bal } = await supabase.rpc("wallet_get_balance", { _user_email: userEmail });
  const walletBalanceCents = Number(bal || 0);
  let walletApplyCents = Math.max(0, Math.min(walletBalanceCents, totalCents));
  if (typeof useWalletCentsRaw === "number" && useWalletCentsRaw >= 0) {
    walletApplyCents = Math.min(walletApplyCents, Math.floor(useWalletCentsRaw));
  }
  const cardCents = totalCents - walletApplyCents;

  // SCENARIO 1: wallet covers everything → no Stripe, finalize immediately
  if (walletApplyCents > 0 && cardCents === 0) {
    const { error: spendErr } = await supabase.rpc("wallet_spend", {
      _user_email: userEmail, _amount_cents: walletApplyCents, _type: "checkout_spend",
      _description: `Iscrizione gruppo ${group.service_name}`,
      _source_group_id: groupId, _source_session_id: null,
    });
    if (spendErr) return json({ error: "Wallet insufficiente: " + spendErr.message }, 400);

    const grossAmount = totalCents / 100;
    const platformFee = joinerFeeCents / 100;
    const ownerAmount = quotaCents / 100;
    const { data: insertedPayment } = await supabase.from("payments").insert({
      user_email: userEmail, group_id: groupId,
      amount: grossAmount, platform_fee: platformFee, owner_amount: ownerAmount,
      payment_date: new Date().toISOString(), billing_month: currentMonth,
      status: "paid", payment_method: "wallet",
    }).select("id").single();

    await supabase.from("memberships").update({ payment_status: "paid" })
      .eq("group_id", groupId).ilike("user_email", String(userEmail).trim());
    await confirmPaidReferral(supabase, userEmail, groupId);

    const holdDays = await getConfigInt(supabase, "hold_days", 25);
    const { data: ownerProfile } = await supabase
      .from("user_profiles")
      .select("user_id")
      .ilike("user_email", group.admin_email)
      .maybeSingle();
    await recordOwnerHold({
      supabase,
      ownerEmail: group.admin_email,
      ownerUid: ownerProfile?.user_id || group.admin_email,
      groupId,
      paymentId: insertedPayment?.id || null,
      grossAmount, platformFee, netAmount: ownerAmount,
      holdDays,
    });


    await logAudit(supabase, {
      action: "checkout_wallet_full",
      actor_uid: userId, actor_email: userEmail,
      target_type: "payment", target_id: insertedPayment?.id || null,
      details: { groupId, totalCents, walletApplyCents },
    });
    await notifyCompletedGroupPayment({
      supabase,
      groupId,
      adminEmail: group.admin_email,
      userEmail,
      serviceName: group.service_name || "il tuo gruppo",
      ownerAmount,
      grossAmount,
      paymentKey: insertedPayment?.id || `wallet:${groupId}:${currentMonth}:${userEmail}`,
    });
    return json({ wallet_only: true, success: true, redirect: `/GroupDetail?id=${groupId}`, wallet_cents_used: walletApplyCents });
  }

  // SCENARIO 2/3: Stripe checkout for cardCents (wallet covers partial 0..n)
  const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
  let customer = customers.data[0];
  if (!customer) customer = await stripe.customers.create({ email: userEmail, name: userName || undefined, metadata: { userId } });

  const base = returnUrl || siteBaseUrl(req);

  // Reserve wallet portion immediately (will reverse on cancel)
  if (walletApplyCents > 0) {
    const { error: spendErr } = await supabase.rpc("wallet_spend", {
      _user_email: userEmail, _amount_cents: walletApplyCents, _type: "checkout_spend",
      _description: `Prenotato per checkout gruppo ${group.service_name}`,
      _source_group_id: groupId, _source_session_id: null,
    });
    if (spendErr) return json({ error: "Wallet insufficiente: " + spendErr.message }, 400);
  }

  let useDestination = false;
  if (group.stripe_account_id) {
    try {
      const acct = await stripe.accounts.retrieve(group.stripe_account_id);
      // Account recipient-only: basta `transfers` per destination charges
      const transfersActive = (acct.capabilities as any)?.transfers === "active";
      useDestination = !!transfersActive;
    } catch (err: any) {
      console.warn(`[checkout] account retrieve: ${err.message}`);
    }
  }

  const sharedMetadata = {
    userId, userEmail, groupId, type: "group_payment",
    quotaCents: quotaCents.toString(),
    joinerFeeCents: joinerFeeCents.toString(),
    totalCents: totalCents.toString(),
    walletPortionCents: walletApplyCents.toString(),
    cardPortionCents: cardCents.toString(),
    billingMonth: currentMonth,
  };

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "eur",
          unit_amount: cardCents,
          product_data: {
            name: `Quota ${group.service_name}`,
            description: walletApplyCents > 0
              ? `${group.service_name} - ${currentMonth} (€${(walletApplyCents/100).toFixed(2)} Wallet + €${(cardCents/100).toFixed(2)} carta)`
              : `Quota ${group.service_name} - ${currentMonth}`,
          },
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${base}/JoinGroup?id=${groupId}&payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/JoinGroup?id=${groupId}&payment=cancelled&session_id={CHECKOUT_SESSION_ID}`,
      metadata: sharedMetadata,
      payment_intent_data: useDestination
        ? {
            application_fee_amount: Math.min(joinerFeeCents, cardCents),
            transfer_data: { destination: group.stripe_account_id },
            metadata: sharedMetadata,
          }
        : { metadata: sharedMetadata },
    }, {
      // Idempotency (audit punto 8): deterministic key — a network retry can
      // never create two checkout sessions for the same user/group/month.
      idempotencyKey: `checkout_${userId}_${groupId}_${currentMonth}_${cardCents}`,
    });
  } catch (err: any) {
    if (walletApplyCents > 0) {
      await supabase.rpc("wallet_credit", {
        _user_email: userEmail, _amount_cents: walletApplyCents,
        _type: "spend_reversal", _description: "Rollback: checkout Stripe non creato",
        _source_group_id: groupId,
      });
    }
    return json({ error: "Stripe error: " + err.message }, 500);
  }

  await logAudit(supabase, {
    action: "checkout_created",
    actor_uid: userId, actor_email: userEmail,
    target_type: "payment", target_id: session.id,
    details: { groupId, totalCents, cardCents, walletApplyCents, useDestination },
  });

  return json({ url: session.url, sessionId: session.id, wallet_cents_used: walletApplyCents, card_cents: cardCents });
}

// ============= CHECKOUT CANCELLED (refund wallet reservation) =============
async function handleCheckoutCancelled(body: any) {
  const { sessionId, userEmail } = body;
  if (!sessionId || !userEmail) return json({ error: "Missing params" }, 400);
  const stripe = getStripe();
  const supabase = getSupabase();
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid") return json({ skipped: true, reason: "already_paid" });
    const walletPortion = parseInt((session.metadata as any)?.walletPortionCents || "0", 10);
    if (!walletPortion) return json({ skipped: true, reason: "no_wallet_portion" });
    if ((session.metadata as any)?.userEmail?.toLowerCase() !== userEmail.toLowerCase()) {
      return json({ error: "Mismatched session owner" }, 403);
    }
    const { data: existing } = await supabase.from("wallet_transactions")
      .select("id").eq("source_session_id", sessionId).eq("type", "spend_reversal").limit(1);
    if (existing?.length) return json({ skipped: true, reason: "already_reversed" });
    await supabase.rpc("wallet_credit", {
      _user_email: userEmail, _amount_cents: walletPortion,
      _type: "spend_reversal", _description: "Rimborso wallet per checkout annullato",
      _source_session_id: sessionId,
    });
    return json({ success: true, reversed_cents: walletPortion });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}

// ============= WALLET BALANCE & TRANSACTIONS =============
async function handleWalletBalance(body: any) {
  const { userEmail } = body;
  if (!userEmail) return json({ error: "Missing userEmail" }, 400);
  const supabase = getSupabase();
  const email = userEmail.toLowerCase().trim();
  const { data: bal } = await supabase.rpc("wallet_get_balance", { _user_email: email });
  const { data: txs } = await supabase
    .from("wallet_transactions").select("*")
    .eq("user_email", email).order("created_at", { ascending: false }).limit(50);
  return json({ balance_cents: Number(bal || 0), transactions: txs || [] });
}

// ============= VERIFY SESSION =============
async function handleVerifySession(body: any) {
  const { sessionId, groupId, userEmail, userId } = body;
  if (!sessionId || !groupId || !userEmail || !userId) return json({ error: "Missing required fields" }, 400);

  const stripe = getStripe();
  const supabase = getSupabase();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") return json({ verified: false });

  // SECURITY: bind the Stripe session to the authenticated user AND the claimed group.
  // Without these checks a valid cheap session could unlock any expensive group (fraud).
  if (!session.metadata?.groupId || session.metadata.groupId !== groupId) {
    return json({ verified: false, error: "session_group_mismatch" }, 403);
  }
  if (session.metadata?.userId && session.metadata.userId !== userId) {
    return json({ verified: false, error: "session_user_mismatch" }, 403);
  }
  const sessionEmail = (session.metadata?.userEmail || session.customer_email || "").toLowerCase();
  if (sessionEmail && sessionEmail !== String(userEmail).toLowerCase()) {
    return json({ verified: false, error: "session_email_mismatch" }, 403);
  }

  const currentMonth = session.metadata?.billingMonth || new Date().toISOString().substring(0, 7);

  // The webhook can complete before the browser returns from Stripe. Once a
  // paid record exists for this authenticated user/session group, verification
  // is already complete and must be idempotent (including legacy sessions that
  // predate the latest amount metadata).
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id")
    .ilike("user_email", String(userEmail).trim())
    .eq("group_id", groupId)
    .eq("billing_month", currentMonth)
    .in("status", ["paid", "completed"])
    .limit(1);

  if (existingPayment?.length) {
    await supabase.from("memberships")
      .update({ payment_status: "paid" })
      .eq("group_id", groupId)
      .ilike("user_email", String(userEmail).trim());
    await confirmPaidReferral(supabase, userEmail, groupId);
    return json({ verified: true, alreadyFinalized: true });
  }

  // Load only immutable ownership data needed for accounting. Never read the
  // group's current price here: price validation belongs to checkout creation.
  const { data: payGroup } = await supabase
    .from("groups")
    .select("admin_email, owner_id, service_name")
    .eq("id", groupId)
    .single();
  if (!payGroup) return json({ verified: false, error: "group_not_found" }, 404);

  // Legacy checkout sessions did not persist cardPortionCents. Stripe's paid
  // amount is authoritative for the card portion; combine it with the wallet
  // reservation to reconstruct the locked checkout total without consulting
  // mutable group pricing.
  const parsedWalletPortionCents = Number.parseInt(session.metadata?.walletPortionCents || "0", 10);
  const walletPortionCents = Number.isSafeInteger(parsedWalletPortionCents) && parsedWalletPortionCents >= 0
    ? parsedWalletPortionCents
    : 0;
  // Stripe is the source of truth for a completed card charge. Reconstruct the
  // checkout total from the paid amount plus the server-recorded wallet share;
  // do not reject legacy sessions because optional metadata used a prior shape.
  // `amount_total` can be null on old Checkout sessions even though Stripe has
  // already marked the PaymentIntent as paid. Never reject an authenticated,
  // correctly-bound paid session because optional Checkout amount fields are
  // missing. Recover the immutable charged amount from the PaymentIntent, then
  // from our server-created metadata as a final compatibility fallback.
  let paidCardCents = session.amount_total;
  if (!Number.isSafeInteger(paidCardCents) || Number(paidCardCents) < 0) {
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
    if (paymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      paidCardCents = paymentIntent.amount_received;
    }
  }
  if (!Number.isSafeInteger(paidCardCents) || Number(paidCardCents) < 0) {
    console.error("verify-session paid amount unavailable", { sessionId, groupId });
    return json({ verified: false, error: "payment_amount_unavailable" }, 500);
  }
  paidCardCents = Number(paidCardCents);
  const paidTotalCents = paidCardCents + walletPortionCents;
  const configuredFeeCents = Number.parseInt(session.metadata?.joinerFeeCents || "", 10);
  const joinerFeeCents = Number.isSafeInteger(configuredFeeCents) && configuredFeeCents >= 0
    ? Math.min(configuredFeeCents, paidTotalCents)
    : Math.min(99, paidTotalCents);
  const quotaCents = paidTotalCents - joinerFeeCents;

  const grossAmount = paidTotalCents / 100;
  const platformFee = joinerFeeCents / 100;
  const ownerAmount = quotaCents / 100;

  // Insert payment; the UNIQUE index (user_email, group_id, billing_month) added by the
  // hardening migration makes a webhook/verify-session race insert exactly once.
  const { data: insertedPayment, error: payInsertErr } = await supabase
      .from("payments")
      .insert({
        user_email: userEmail,
        group_id: groupId,
        amount: grossAmount,
        platform_fee: platformFee,
        owner_amount: ownerAmount,
        payment_date: new Date().toISOString(),
        billing_month: currentMonth,
        status: "paid",
      })
      .select("id")
      .single();

  let finalPaymentId: string | null = insertedPayment?.id || null;
  let alreadyFinalized = false;

  if (payInsertErr) {
    // Only a unique-key race with the webhook is a successful finalization.
    // Never turn unrelated database/accounting failures into a false success.
    if (payInsertErr.code !== "23505") {
      console.error("verify-session payment insert failed:", payInsertErr.code, payInsertErr.message);
      return json({ verified: false, error: "payment_finalize_failed" }, 500);
    }

    const { data: racedPayment } = await supabase
      .from("payments")
      .select("id")
      .ilike("user_email", String(userEmail).trim())
      .eq("group_id", groupId)
      .eq("billing_month", currentMonth)
      .in("status", ["paid", "completed"])
      .limit(1);
    if (!racedPayment?.length) {
      console.error("verify-session duplicate without finalized payment", { groupId, currentMonth });
      return json({ verified: false, error: "payment_finalize_failed" }, 500);
    }
    finalPaymentId = racedPayment[0].id;
    alreadyFinalized = true;
  }

  await supabase.from("memberships").update({ payment_status: "paid" }).eq("group_id", groupId).ilike("user_email", String(userEmail).trim());
  await confirmPaidReferral(supabase, userEmail, groupId);

  const holdDays = await getConfigInt(supabase, "hold_days", 25);

  // Resolve the owner's real Supabase UUID (owner_uid must be a UUID, never an email)
  let ownerUid: string | null = payGroup.owner_id || null;
  const { data: ownerProfile } = await supabase
    .from("user_profiles")
    .select("user_id")
    .ilike("user_email", payGroup.admin_email)
    .maybeSingle();
  ownerUid = ownerUid || ownerProfile?.user_id || payGroup.admin_email;

  try {
    await recordOwnerHold({
      supabase,
      ownerEmail: payGroup.admin_email,
      ownerUid: ownerUid!,
      groupId,
      paymentId: finalPaymentId,
      grossAmount, platformFee, netAmount: ownerAmount,
      holdDays,
    });
  } catch (err: any) {
    console.error("verify-session ledger insert failed:", err?.code, err?.message);
    return json({ verified: false, error: "ledger_finalize_failed" }, 500);
  }

  await notifyCompletedGroupPayment({
    supabase,
    groupId,
    adminEmail: payGroup.admin_email,
    userEmail,
    serviceName: payGroup.service_name || "il tuo gruppo",
    ownerAmount,
    grossAmount,
    paymentKey: finalPaymentId || sessionId,
  });

  return json({ verified: true, alreadyFinalized });
}


// ============= PAYOUT (owner withdraws to bank) =============
async function handlePayout(body: any, _req: Request) {
  const { ownerEmail, ownerUid, ownerName } = body;
  if (!ownerEmail) return json({ error: "Missing ownerEmail" }, 400);

  if (!rateLimit(`payout:${ownerEmail}`, 5, 60_000))
    return json({ error: "Troppi tentativi. Attendi un minuto." }, 429);

  const supabase = getSupabase();
  const stripe = getStripe();

  const { data: g } = await supabase
    .from("groups")
    .select("stripe_account_id")
    .eq("admin_email", ownerEmail)
    .not("stripe_account_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (!g?.stripe_account_id) return json({ error: "Account Stripe non configurato. Crea o iscriviti a un gruppo prima.", code: "no_account" }, 400);

  const stripeAccountId = g.stripe_account_id;

  // Live check
  const acct = await stripe.accounts.retrieve(stripeAccountId);
  const displayName = await resolveOwnerName(supabase, ownerEmail, ownerUid, ownerName);
  await prefillRecipientBusinessProfile(stripe, stripeAccountId, displayName, ownerEmail);
  await supabase
    .from("groups")
    .update({
      stripe_payouts_enabled: !!acct.payouts_enabled,
      stripe_charges_enabled: !!acct.charges_enabled,
      stripe_requirements_due: acct.requirements?.currently_due || [],
    })
    .eq("admin_email", ownerEmail);

  if (!acct.payouts_enabled) {
    return json({
      error: "Verifica identità non completata. Completa l'onboarding Stripe per prelevare.",
      code: "kyc_incomplete",
      requirements: acct.requirements?.currently_due || [],
    }, 400);
  }

  // Available funds from ledger
  const { data: availableEntries } = await supabase
    .from("wallet_ledger")
    .select("*")
    .eq("owner_email", ownerEmail)
    .eq("status", "available");

  const availableTotal = (availableEntries || []).reduce((s: number, e: any) => s + Number(e.net_amount), 0);
  const availableCents = Math.round(availableTotal * 100);

  const minPayoutCents = await getConfigInt(supabase, "min_payout_cents", 1000);
  if (availableCents < minPayoutCents) {
    return json({
      error: `Soglia minima di prelievo: €${(minPayoutCents / 100).toFixed(2)}. Saldo attuale disponibile: €${availableTotal.toFixed(2)}.`,
      code: "below_min",
      min_cents: minPayoutCents,
      available_cents: availableCents,
    }, 400);
  }

  const transferNeededCents = (availableEntries || [])
    .filter((entry: any) => !entry.stripe_transfer_id)
    .reduce((sum: number, entry: any) => sum + Math.max(0, Math.round(Number(entry.net_amount) * 100)), 0);
  if (transferNeededCents > 0) {
    let platformBalance = await getPlatformBalanceSnapshot(stripe);
    if (platformBalance.available_cents < transferNeededCents) {
      if (isStripeTestMode()) {
        try {
          await fundPlatformAvailableBalanceForTest(stripe, transferNeededCents - platformBalance.available_cents, "pre_transfer_guard");
          platformBalance = await getPlatformBalanceSnapshot(stripe);
        } catch (err: any) {
          console.error("auto test funding failed:", err.message);
        }
      }
    }
    if (platformBalance.available_cents < transferNeededCents) {
      const eta = platformBalance.next_available_on
        ? new Date(platformBalance.next_available_on * 1000).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })
        : null;
      return json({
        success: false,
        code: "platform_balance_pending",
        error: `I fondi Stripe sono ancora in arrivo: disponibile €${(platformBalance.available_cents / 100).toFixed(2)}, in arrivo €${(platformBalance.pending_cents / 100).toFixed(2)}. ${eta ? `Riprova dal ${eta}.` : "Riprova quando Stripe li segna come disponibili."}`,
        required_cents: transferNeededCents,
        platform_available_cents: platformBalance.available_cents,
        platform_pending_cents: platformBalance.pending_cents,
        next_available_on: platformBalance.next_available_on,
      }, 400);
    }
  }

  // Step 1: transfer net amounts from platform → connect account, per ledger row
  let totalTransferredCents = 0;
  const transferredEntries: Array<{ id: string; transferId: string; amountCents: number }> = [];
  const transferFailures: string[] = [];

  for (const entry of availableEntries || []) {
    const amountCents = Math.round(Number(entry.net_amount) * 100);
    if (amountCents <= 0) continue;
    if (entry.stripe_transfer_id) {
      totalTransferredCents += amountCents;
      transferredEntries.push({ id: entry.id, transferId: entry.stripe_transfer_id, amountCents });
      continue;
    }
    try {
      const existingTransfer = await findExistingTransferForLedger(stripe, entry.id, stripeAccountId);
      if (existingTransfer) {
        await supabase
          .from("wallet_ledger")
          .update({ stripe_transfer_id: existingTransfer.id })
          .eq("id", entry.id)
          .eq("status", "available");
        totalTransferredCents += amountCents;
        transferredEntries.push({ id: entry.id, transferId: existingTransfer.id, amountCents });
        continue;
      }
      const transfer = await stripe.transfers.create(
        {
          amount: amountCents,
          currency: "eur",
          destination: stripeAccountId,
          description: `DivideIt payout ledger ${entry.id}`,
          metadata: { ledger_id: entry.id, group_id: entry.group_id, owner_email: ownerEmail },
        },
        { idempotencyKey: `transfer_${entry.id}_${stripeAccountId}_v2` },
      );
      await supabase
        .from("wallet_ledger")
        .update({ stripe_transfer_id: transfer.id })
        .eq("id", entry.id)
        .eq("status", "available")
        .is("stripe_transfer_id", null);
      totalTransferredCents += amountCents;
      transferredEntries.push({ id: entry.id, transferId: transfer.id, amountCents });
    } catch (err: any) {
      console.error(`transfer fail ledger ${entry.id}`, err.message);
      if (isBalanceInsufficient(err) && isStripeTestMode()) {
        try {
          await fundPlatformAvailableBalanceForTest(stripe, amountCents, `retry_transfer_${entry.id}`);
          const transfer = await stripe.transfers.create(
            {
              amount: amountCents,
              currency: "eur",
              destination: stripeAccountId,
              description: `DivideIt payout ledger ${entry.id}`,
              metadata: { ledger_id: entry.id, group_id: entry.group_id, owner_email: ownerEmail, auto_funded_test: "true" },
            },
            { idempotencyKey: `transfer_${entry.id}_${stripeAccountId}_funded_v2` },
          );
          await supabase
            .from("wallet_ledger")
            .update({ stripe_transfer_id: transfer.id })
            .eq("id", entry.id)
            .eq("status", "available");
          totalTransferredCents += amountCents;
          transferredEntries.push({ id: entry.id, transferId: transfer.id, amountCents });
          continue;
        } catch (retryErr: any) {
          console.error(`transfer retry fail ledger ${entry.id}`, retryErr.message);
          transferFailures.push(retryErr.message);
          continue;
        }
      }
      transferFailures.push(err.message);
    }
  }

  if (totalTransferredCents === 0) {
    return json({
      success: false,
      code: transferFailures.some((m) => m?.toLowerCase().includes("insufficient")) ? "platform_balance_pending" : "transfer_failed",
      error: transferFailures[0] || "Nessun trasferimento eseguito. Riprova o verifica che il saldo Stripe della piattaforma abbia fondi disponibili.",
      required_cents: transferNeededCents,
    }, 400);
  }

  // Step 2: payout from connect balance to user bank
  // Apply admin payout fee if any
  const feePercent = await getConfigFloat(supabase, "admin_payout_fee_percent", 0);
  const feeCents = Math.round(totalTransferredCents * (feePercent / 100));
  const payoutCents = totalTransferredCents - feeCents;
  const ledgerIds = transferredEntries.map((entry) => entry.id);
  const payoutKeyHash = await sha256Hex(`${ownerEmail}:${stripeAccountId}:${ledgerIds.sort().join(",")}:${payoutCents}`);

  let payoutId: string | null = null;
  try {
    const payout = await stripe.payouts.create(
      {
        amount: payoutCents,
        currency: "eur",
        description: "DivideIt withdrawal",
        metadata: { owner_email: ownerEmail, owner_name: displayName, ledger_ids: ledgerIds.join(",") },
      },
      { stripeAccount: stripeAccountId, idempotencyKey: `payout_${payoutKeyHash}` },
    );
    payoutId = payout.id;
  } catch (err: any) {
    console.error("payout error:", err.message);
    // Transfers already happened idempotently; leave ledger available so retry can finish the bank payout without duplicating transfers.
    return json({
      success: false,
      error: `Trasferimento al saldo Stripe ok, ma il payout al tuo IBAN è fallito: ${err.message}. Riprova tra poco.`,
      transferred_to_balance_cents: totalTransferredCents,
    }, 400);
  }

  const payoutAt = new Date().toISOString();
  for (const entry of transferredEntries) {
    await supabase
      .from("wallet_ledger")
      .update({ status: "paid_out", payout_at: payoutAt, stripe_transfer_id: entry.transferId })
      .eq("id", entry.id)
      .eq("status", "available");
  }

  await logAudit(supabase, {
    action: "payout_executed",
    actor_uid: ownerUid || ownerEmail,
    actor_email: ownerEmail,
    target_type: "stripe_payout",
    target_id: payoutId,
    details: { totalTransferredCents, payoutCents, feeCents, ledgerIds },
  });

  await supabase.from("notifications").insert({
    user_email: ownerEmail,
    type: "payout_initiated",
    title: "Prelievo avviato",
    content: `€${(payoutCents / 100).toFixed(2)} in arrivo sul tuo IBAN entro 1-2 giorni lavorativi.`,
    read: false,
    created_date: new Date().toISOString(),
  });

  return json({
    success: true,
    transferred_cents: totalTransferredCents,
    payout_cents: payoutCents,
    fee_cents: feeCents,
    payout_id: payoutId,
  });
}

// ============= LEDGER =============
async function handleLedger(body: any) {
  const { ownerEmail } = body;
  if (!ownerEmail) return json({ error: "Missing ownerEmail" }, 400);

  const supabase = getSupabase();
  const { data: entries, error } = await supabase
    .from("wallet_ledger")
    .select("*")
    .eq("owner_email", ownerEmail)
    .order("paid_at", { ascending: false });
  if (error) return json({ error: "Failed to fetch ledger" }, 500);

  const inHold = (entries || []).filter((e: any) => e.status === "in_hold");
  const available = (entries || []).filter((e: any) => e.status === "available");
  const paidOut = (entries || []).filter((e: any) => e.status === "paid_out");
  const reversed = (entries || []).filter((e: any) => e.status === "reversed");

  return json({
    entries: entries || [],
    summary: {
      in_hold_total: inHold.reduce((s: number, e: any) => s + Number(e.net_amount), 0),
      available_total: available.reduce((s: number, e: any) => s + Number(e.net_amount), 0),
      paid_out_total: paidOut.reduce((s: number, e: any) => s + Number(e.net_amount), 0),
      next_release_date: inHold.length
        ? inHold.reduce((min: string, e: any) => (e.release_at < min ? e.release_at : min), inHold[0].release_at)
        : null,
      in_hold_count: inHold.length,
      available_count: available.length,
      paid_out_count: paidOut.length,
      reversed_count: reversed.length,
    },
  });
}

// ============= RELEASE HOLD (TEST) =============
async function handleReleaseHoldTest(body: any) {
  const { ownerEmail } = body;
  if (!ownerEmail) return json({ error: "Missing ownerEmail" }, 400);
  // ownerEmail is always forced to the authenticated user upstream, so this
  // only ever releases the caller's own holds.
  const supabase = getSupabase();
  const { data: updated, error } = await supabase
    .from("wallet_ledger")
    .update({ status: "available", release_at: new Date().toISOString() })
    .eq("owner_email", ownerEmail)
    .eq("status", "in_hold")
    .select("id");
  if (error) return json({ error: error.message }, 500);
  return json({ success: true, released: updated?.length || 0 });
}

// ============= GROUPS DELETE =============
async function handleGroupsDelete(body: any) {
  const { groupId, ownerEmail } = body;
  if (!groupId || !ownerEmail) return json({ error: "Missing params" }, 400);
  const supabase = getSupabase();
  const { data: group } = await supabase.from("groups").select("*").eq("id", groupId).single();
  if (!group) return json({ error: "Gruppo non trovato" }, 404);
  if (String(group.admin_email).toLowerCase() !== String(ownerEmail).toLowerCase()) return json({ error: "Solo il proprietario può eliminare" }, 403);

  const { data: activeLedger } = await supabase
    .from("wallet_ledger").select("id").eq("group_id", groupId).in("status", ["in_hold", "available"]).limit(1);
  if (activeLedger?.length) return json({ error: "Ci sono importi in trattenuta o disponibili.", reason: "active_holds" }, 409);

  const { data: paidMembers } = await supabase
    .from("memberships").select("id").eq("group_id", groupId).eq("payment_status", "paid").neq("user_email", group.admin_email).limit(1);
  if (paidMembers?.length) return json({ error: "Ci sono membri con pagamenti attivi.", reason: "active_members" }, 409);

  await supabase.from("memberships").delete().eq("group_id", groupId);
  await supabase.from("groups").delete().eq("id", groupId);
  return json({ success: true });
}

// Classify an audit event as success / error / warning / info for the admin console
function classifyAuditEvent(a: any): { status: string; status_label: string; status_detail: string | null } {
  const action = String(a?.action || "").toLowerCase();
  const details = a?.details || {};
  const detailText = typeof details === "object" ? JSON.stringify(details).toLowerCase() : String(details).toLowerCase();
  const explicit = String(details?.status || details?.result || "").toLowerCase();
  const errMsg = details?.error || details?.error_message || details?.message || null;

  if (/fail|error|denied|forbidden|invalid|declined|rejected|cancel|expired|abort/.test(action) ||
      ["failed", "error", "denied", "canceled", "cancelled"].includes(explicit) ||
      (errMsg && String(errMsg).length > 0)) {
    return { status: "error", status_label: "Errore", status_detail: errMsg ? String(errMsg).slice(0, 240) : null };
  }
  if (/pending|created|attempt|requested|started|link_created|silent/.test(action) && !/completed|succeeded|approved/.test(action)) {
    return { status: "pending", status_label: "In corso", status_detail: null };
  }
  if (/succeed|success|completed|approved|paid|created_ok|set|updated|refunded|transfer/.test(action) ||
      ["ok", "success", "succeeded", "paid"].includes(explicit) ||
      /"success":true/.test(detailText)) {
    return { status: "success", status_label: "Successo", status_detail: null };
  }
  return { status: "info", status_label: "Info", status_detail: null };
}

// ============= ADMIN: FULL OVERVIEW (payments, profit, growth, health) =============
async function handleAdminOverview(body: any) {
  const { actorEmail } = body;
  if (!actorEmail) return json({ error: "Missing actorEmail" }, 401);
  const supabase = getSupabase();
  if (!(await isAdminEmail(supabase, actorEmail))) return json({ error: "Forbidden" }, 403);

  const [
    { data: payments },
    { data: ledger },
    { data: groups },
    { data: memberships },
    { data: refunds },
    { data: audit },
    { data: tickets },
  ] = await Promise.all([
    supabase.from("payments").select("id, user_email, amount, platform_fee, owner_amount, status, payment_date, billing_month, created_date, group_id").order("created_date", { ascending: false }).limit(500),
    supabase.from("wallet_ledger").select("id, owner_email, gross_amount, platform_fee, net_amount, status, paid_at, payout_at, refunded_at").order("paid_at", { ascending: false }).limit(500),
    supabase.from("groups").select("id, service_name, admin_email, status, created_date, stripe_payouts_enabled, stripe_charges_enabled, closed_at").order("created_date", { ascending: false }).limit(1000),
    supabase.from("memberships").select("id, payment_status, created_date, dunning_attempts, auto_renew").limit(2000),
    supabase.from("refund_requests").select("id, user_email, status, reason, created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("audit_log").select("id, action, actor_email, target_type, target_id, details, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("support_tickets").select("id, status, ticket_type, created_at").limit(500),
  ]);

  const pays = payments || [];
  const led = ledger || [];
  const grps = groups || [];
  const mem = memberships || [];

  const num = (v: any) => Number(v || 0);
  const paidPays = pays.filter((p: any) => p.status === "paid");
  const grossVolume = paidPays.reduce((s: number, p: any) => s + num(p.amount), 0);
  const profitFromPayments = paidPays.reduce((s: number, p: any) => s + num(p.platform_fee), 0);
  const profitFromLedger = led.reduce((s: number, r: any) => s + num(r.platform_fee), 0);
  const pendingPayouts = led.filter((r: any) => !r.payout_at && !r.refunded_at).reduce((s: number, r: any) => s + num(r.net_amount), 0);
  const refundedAmount = led.filter((r: any) => r.refunded_at).reduce((s: number, r: any) => s + num(r.gross_amount), 0);

  // Growth: last 12 months buckets
  const monthKey = (d: any) => (d ? String(d).slice(0, 7) : null);
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const growth = months.map((m) => ({
    month: m,
    revenue: paidPays.filter((p: any) => monthKey(p.created_date) === m).reduce((s: number, p: any) => s + num(p.amount), 0),
    profit: paidPays.filter((p: any) => monthKey(p.created_date) === m).reduce((s: number, p: any) => s + num(p.platform_fee), 0),
    payments: paidPays.filter((p: any) => monthKey(p.created_date) === m).length,
    groups: grps.filter((g: any) => monthKey(g.created_date) === m).length,
    members: mem.filter((x: any) => monthKey(x.created_date) === m).length,
  }));

  // Health / security signals
  const issues: any[] = [];
  const failedPays = pays.filter((p: any) => ["failed", "unpaid", "past_due"].includes(String(p.status)));
  if (failedPays.length) issues.push({ level: "warning", title: "Pagamenti falliti", detail: `${failedPays.length} pagamenti in stato failed/unpaid/past_due`, count: failedPays.length });
  const dunning = mem.filter((m: any) => num(m.dunning_attempts) > 0);
  if (dunning.length) issues.push({ level: "warning", title: "Membri in dunning", detail: `${dunning.length} membri con tentativi di pagamento falliti`, count: dunning.length });
  const openRefunds = (refunds || []).filter((r: any) => r.status === "pending" || r.status === "open");
  if (openRefunds.length) issues.push({ level: "critical", title: "Rimborsi da gestire", detail: `${openRefunds.length} richieste di rimborso aperte`, count: openRefunds.length });
  const openTickets = (tickets || []).filter((t: any) => t.status !== "closed" && t.status !== "resolved");
  if (openTickets.length) issues.push({ level: "info", title: "Ticket aperti", detail: `${openTickets.length} ticket di supporto non risolti`, count: openTickets.length });
  const noPayout = grps.filter((g: any) => g.status === "active" && !g.closed_at && !g.stripe_payouts_enabled);
  if (noPayout.length) issues.push({ level: "warning", title: "Gruppi senza payout Stripe", detail: `${noPayout.length} gruppi attivi non possono ricevere prelievi`, count: noPayout.length });
  const suspicious = (audit || []).filter((a: any) => /fail|error|forbidden|denied|invalid/i.test(String(a.action)));
  if (suspicious.length) issues.push({ level: "critical", title: "Eventi sospetti nel log", detail: `${suspicious.length} eventi di errore/accesso negato registrati di recente`, count: suspicious.length });
  if (!issues.length) issues.push({ level: "ok", title: "Nessun problema rilevato", detail: "Tutti i controlli sono superati", count: 0 });

  return json({
    totals: {
      gross_volume: grossVolume,
      profit_payments: profitFromPayments,
      profit_ledger: profitFromLedger,
      pending_payouts: pendingPayouts,
      refunded_amount: refundedAmount,
      payments_count: pays.length,
      paid_count: paidPays.length,
      groups_count: grps.length,
      active_groups: grps.filter((g: any) => g.status === "active" && !g.closed_at).length,
      members_count: mem.length,
      paid_members: mem.filter((m: any) => m.payment_status === "paid").length,
    },
    growth,
    payments: pays.slice(0, 100),
    ledger: led.slice(0, 100),
    refunds: (refunds || []).slice(0, 50),
    audit: (audit || []).slice(0, 50).map((a: any) => ({ ...a, ...classifyAuditEvent(a) })),
    issues,
  });
}

// ============= ADMIN: FEES CONFIG =============
const FEE_KEYS = ["joiner_fee_cents", "admin_payout_fee_percent", "min_payout_cents", "hold_days", "dunning_max_attempts", "platform_fee_percent"];

async function handleAdminConfigRead(body: any) {
  const { actorEmail } = body;
  if (!actorEmail) return json({ error: "Missing actorEmail" }, 401);
  const supabase = getSupabase();
  if (!(await isAdminEmail(supabase, actorEmail))) return json({ error: "Forbidden" }, 403);

  const { data } = await supabase.from("config").select("key, value").in("key", FEE_KEYS);
  const out: Record<string, string> = {};
  for (const k of FEE_KEYS) out[k] = (data || []).find((r: any) => r.key === k)?.value || "";

  // Platform fees accumulated
  const { data: ledger } = await supabase.from("wallet_ledger").select("platform_fee");
  const platformAccumulated = (ledger || []).reduce((s: number, r: any) => s + Number(r.platform_fee || 0), 0);

  return json({ config: out, platform_fees_accumulated_eur: platformAccumulated });
}

async function handleAdminConfigWrite(body: any) {
  const { actorEmail, updates } = body;
  if (!actorEmail || !updates) return json({ error: "Missing params" }, 400);
  const supabase = getSupabase();
  if (!(await isAdminEmail(supabase, actorEmail))) return json({ error: "Forbidden" }, 403);

  for (const [k, v] of Object.entries(updates)) {
    if (!FEE_KEYS.includes(k)) continue;
    await supabase.from("config").upsert({ key: k, value: String(v) }, { onConflict: "key" });
  }
  await logAudit(supabase, {
    action: "admin_config_updated",
    actor_uid: actorEmail,
    actor_email: actorEmail,
    target_type: "config",
    target_id: "fees",
    details: updates,
  });
  return json({ success: true });
}

// ============= ADMIN: PLATFORM FEES PAYOUT =============
async function handleAdminPlatformPayout(body: any) {
  const { actorEmail, amountCents } = body;
  if (!actorEmail) return json({ error: "Missing actorEmail" }, 400);
  const supabase = getSupabase();
  if (!(await isAdminEmail(supabase, actorEmail))) return json({ error: "Forbidden" }, 403);

  if (!amountCents || amountCents < 100) return json({ error: "Invalid amount" }, 400);

  const stripe = getStripe();
  try {
    // Idempotency (audit punto 8): deterministic key per actor+amount+day —
    // Date.now() made every retry a NEW payout (double-spend on retry).
    const dayKey = new Date().toISOString().slice(0, 10);
    const payout = await stripe.payouts.create(
      {
        amount: amountCents,
        currency: "eur",
        description: "DivideIt platform fees withdrawal",
        metadata: { actor: actorEmail, type: "platform_fees" },
      },
      { idempotencyKey: `platform_payout_${actorEmail}_${amountCents}_${dayKey}` },
    );
    await logAudit(supabase, {
      action: "admin_platform_payout",
      actor_uid: actorEmail,
      actor_email: actorEmail,
      target_type: "stripe_payout",
      target_id: payout.id,
      details: { amountCents },
    });
    return json({ success: true, payout_id: payout.id });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}

// ============= CREDENTIALS (AES-256-GCM) =============
function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function getEncKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("CREDENTIALS_ENCRYPTION_KEY");
  if (!raw) throw new Error("CREDENTIALS_ENCRYPTION_KEY not set");
  let bytes: Uint8Array;
  try { bytes = b64decode(raw.trim()); } catch { bytes = new TextEncoder().encode(raw); }
  if (bytes.length !== 32) {
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    bytes = new Uint8Array(hash);
  }
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function aesEncrypt(plaintext: string) {
  const key = await getEncKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, new TextEncoder().encode(plaintext));
  const encArr = new Uint8Array(enc);
  const ct = encArr.slice(0, encArr.length - 16);
  const tag = encArr.slice(encArr.length - 16);
  return { ciphertext: b64encode(ct), iv: b64encode(iv), tag: b64encode(tag) };
}
async function aesDecrypt(ciphertext: string, iv: string, tag: string) {
  const key = await getEncKey();
  const ct = b64decode(ciphertext);
  const tg = b64decode(tag);
  const full = new Uint8Array(ct.length + tg.length);
  full.set(ct, 0); full.set(tg, ct.length);
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64decode(iv), tagLength: 128 }, key, full);
  return new TextDecoder().decode(dec);
}

// ============= CREDENTIAL VERIFICATION (member feedback) =============
async function handleCredentialStatus(body: any) {
  const { groupId, userEmail, userName, status, note } = body;
  const supabase = getSupabase();

  const { data: g } = await supabase.from("groups")
    .select("id, admin_email, service_name").eq("id", groupId).single();
  if (!g) return json({ error: "Group not found" }, 404);

  const email = String(userEmail || "").toLowerCase();
  const { data: m } = await supabase.from("memberships")
    .select("id, payment_status").eq("group_id", groupId).ilike("user_email", email).limit(1).maybeSingle();
  if (!m) return json({ error: "Non sei membro di questo gruppo" }, 403);

  const { error } = await supabase.from("memberships").update({
    cred_status: status,
    cred_status_at: new Date().toISOString(),
    cred_issue_note: status === "issue" ? String(note || "").slice(0, 500) : null,
  }).eq("id", m.id);
  if (error) return json({ error: error.message }, 500);

  const who = escapeHtml(userName || email);
  const service = escapeHtml(g.service_name || "il servizio");
  const link = `${APP_URL}/GroupDetail?id=${groupId}`;

  try {
    if (status === "issue") {
      await supabase.from("notifications").insert({
        user_email: g.admin_email.toLowerCase(),
        type: "credentials_issue",
        title: "⚠️ Credenziali non funzionanti",
        content: `${userName || email} segnala un problema con l'accesso a ${g.service_name || "il servizio"}.`,
        link: `/GroupDetail?id=${groupId}`,
        group_id: groupId,
        read: false,
      });
      await sendAppEmail(supabase, {
        to: g.admin_email,
        kind: "ticket_problem",
        subject: `⚠️ Credenziali non funzionanti — ${g.service_name || "gruppo"}`,
        title: "Un membro non riesce ad accedere",
        bodyHtml: `<p><b>${who}</b> ha segnalato che le credenziali di <b>${service}</b> non funzionano.</p>
          ${note ? `<p style="background:#fef3f2;border-radius:10px;padding:12px;">"${escapeHtml(String(note))}"</p>` : ""}
          <p>Controlla l'account e, se serve, aggiorna le credenziali nella cassaforte del gruppo: i membri riceveranno subito una notifica.</p>`,
        ctaLabel: "Apri il gruppo",
        ctaUrl: link,
        groupId,
        dedupeKey: `cred_issue:${groupId}:${email}:${Date.now()}`,
      });
    } else {
      await sendAppEmail(supabase, {
        to: g.admin_email,
        kind: "member_joined",
        subject: `✅ Accesso confermato — ${g.service_name || "gruppo"}`,
        title: "Accesso verificato",
        bodyHtml: `<p><b>${who}</b> ha confermato che le credenziali di <b>${service}</b> funzionano correttamente.</p>`,
        ctaLabel: "Apri il gruppo",
        ctaUrl: link,
        groupId,
        dedupeKey: `cred_ok:${groupId}:${email}:${Date.now()}`,
      });
    }
  } catch (e: any) {
    console.error("credential status notify failed:", e?.message);
  }

  return json({ success: true, status });
}



async function handleCredentialsSet(body: any) {
  const { groupId, ownerEmail, credentials } = body;
  if (!groupId || !ownerEmail || typeof credentials !== "string") return json({ error: "Missing params" }, 400);
  if (credentials.length > 4000) return json({ error: "Credentials too long" }, 400);

  const supabase = getSupabase();
  const { data: g } = await supabase.from("groups")
    .select("id, admin_email, service_name, credentials_ciphertext")
    .eq("id", groupId).single();
  if (!g) return json({ error: "Group not found" }, 404);
  if (g.admin_email.toLowerCase() !== ownerEmail.toLowerCase()) return json({ error: "Forbidden" }, 403);

  const isUpdate = !!g.credentials_ciphertext;

  const { ciphertext, iv, tag } = await aesEncrypt(credentials);
  const { error } = await supabase.from("groups").update({
    credentials_ciphertext: ciphertext,
    credentials_iv: iv,
    credentials_tag: tag,
    credentials_updated_at: new Date().toISOString(),
  }).eq("id", groupId);
  if (error) return json({ error: error.message }, 500);

  await logAudit(supabase, {
    action: isUpdate ? "credentials_updated" : "credentials_set",
    actor_uid: ownerEmail, actor_email: ownerEmail,
    target_type: "group", target_id: groupId, details: { length: credentials.length },
  });

  // Ogni cambio credenziali azzera lo stato di verifica dei membri.
  try {
    await supabase.from("memberships").update({
      cred_status: "pending",
      cred_status_at: new Date().toISOString(),
      cred_issue_note: null,
    }).eq("group_id", groupId);
  } catch (e: any) {
    console.error("reset cred status failed:", e?.message);
  }

  // Notify all active paying members (excluding admin) — only on update.
  if (isUpdate) {
    try {
      const { data: members } = await supabase.from("memberships")
        .select("user_email")
        .eq("group_id", groupId)
        .eq("payment_status", "paid");
      const recipients = (members || [])
        .map((m: any) => (m.user_email || "").toLowerCase())
        .filter((e: string) => e && e !== g.admin_email.toLowerCase());
      if (recipients.length) {
        const rows = recipients.map((email: string) => ({
          user_email: email,
          type: "credentials_updated",
          title: "Credenziali aggiornate",
          content: `L'admin ha aggiornato le credenziali di accesso${g.service_name ? ` di ${g.service_name}` : ""}. Apri il gruppo per vedere le nuove.`,
          link: `/GroupDetail?id=${groupId}`,
          group_id: groupId,
          read: false,
        }));
        await supabase.from("notifications").insert(rows);

        const stamp = Date.now();
        const service = escapeHtml(g.service_name || "il servizio");
        for (const email of recipients) {
          await sendAppEmail(supabase, {
            to: email,
            kind: "member_joined",
            subject: `🔑 Nuove credenziali per ${g.service_name || "il tuo gruppo"}`,
            title: "Le credenziali sono state aggiornate",
            bodyHtml: `<p>L'admin ha appena aggiornato la password di <b>${service}</b>.</p>
              <p>Apri il gruppo per vedere le nuove credenziali e conferma con un tap se l'accesso funziona.</p>`,
            ctaLabel: "Vedi le nuove credenziali",
            ctaUrl: `${APP_URL}/GroupDetail?id=${groupId}`,
            groupId,
            dedupeKey: `cred_updated:${groupId}:${email}:${stamp}`,
          });
        }
      }
    } catch (e: any) {
      console.error("notify credentials update failed:", e?.message);
    }
  }


  return json({ success: true, updated: isUpdate });
}

async function handleCredentialsGet(body: any) {
  const { groupId, userEmail } = body;
  if (!groupId || !userEmail) return json({ error: "Missing params" }, 400);

  const supabase = getSupabase();
  const { data: g } = await supabase.from("groups")
    .select("admin_email, credentials_ciphertext, credentials_iv, credentials_tag, credentials_updated_at, closed_at")
    .eq("id", groupId).single();
  if (!g) return json({ error: "Group not found" }, 404);
  if (g.closed_at) return json({ error: "Gruppo chiuso" }, 410);




  const email = userEmail.toLowerCase();
  const isAdmin = g.admin_email.toLowerCase() === email;
  if (!isAdmin) {
    const { data: m } = await supabase.from("memberships")
      .select("payment_status, current_period_end")
      .eq("group_id", groupId).ilike("user_email", email).limit(1).maybeSingle();
    if (!m || m.payment_status !== "paid") return json({ error: "Accesso non autorizzato. Pagamento richiesto." }, 403);
    if (m.current_period_end && new Date(m.current_period_end) < new Date())
      return json({ error: "Abbonamento scaduto" }, 403);
  }

  if (!g.credentials_ciphertext) return json({ credentials: null, updated_at: null });

  try {
    const plain = await aesDecrypt(g.credentials_ciphertext, g.credentials_iv!, g.credentials_tag!);
    return json({ credentials: plain, updated_at: g.credentials_updated_at });
  } catch (err: any) {
    console.error("decrypt failed:", err.message);
    return json({ error: "Decifratura fallita" }, 500);
  }
}

// ============= GROUP CLOSE (refund pro-rata) =============
async function handleGroupClose(body: any) {
  const { groupId, ownerEmail } = body;
  if (!groupId || !ownerEmail) return json({ error: "Missing params" }, 400);

  const supabase = getSupabase();
  const stripe = getStripe();

  const { data: g } = await supabase.from("groups").select("*").eq("id", groupId).single();
  if (!g) return json({ error: "Group not found" }, 404);
  if (g.admin_email.toLowerCase() !== ownerEmail.toLowerCase()) return json({ error: "Forbidden" }, 403);
  if (g.closed_at) return json({ error: "Gruppo già chiuso" }, 409);

  const today = new Date();
  const billingDay = Number(g.billing_date) || 1;
  const nextBilling = new Date(today.getFullYear(), today.getMonth(), billingDay);
  if (nextBilling <= today) nextBilling.setMonth(nextBilling.getMonth() + 1);
  const totalDaysInPeriod = 30;
  const daysRemaining = Math.max(0, Math.min(totalDaysInPeriod, Math.ceil((nextBilling.getTime() - today.getTime()) / 86400000)));
  const proRataRatio = daysRemaining / totalDaysInPeriod;

  const currentMonth = today.toISOString().substring(0, 7);
  const { data: payments } = await supabase
    .from("payments")
    .select("id, user_email, amount, billing_month")
    .eq("group_id", groupId)
    .in("status", ["paid", "completed"])
    .neq("user_email", g.admin_email)
    .eq("billing_month", currentMonth);

  const refundResults: any[] = [];
  for (const p of payments || []) {
    const refundCents = Math.round(Number(p.amount) * 100 * proRataRatio);
    if (refundCents <= 0) continue;
    try {
      const customers = await stripe.customers.list({ email: p.user_email, limit: 1 });
      if (!customers.data[0]) { refundResults.push({ user_email: p.user_email, status: "no_customer" }); continue; }
      const pis = await stripe.paymentIntents.list({ customer: customers.data[0].id, limit: 20 });
      const pi = pis.data.find(x =>
        x.metadata?.groupId === groupId &&
        x.metadata?.billingMonth === currentMonth &&
        x.status === "succeeded"
      );
      if (!pi) { refundResults.push({ user_email: p.user_email, status: "no_pi" }); continue; }
      const refund = await stripe.refunds.create({
        payment_intent: pi.id,
        amount: refundCents,
        reason: "requested_by_customer",
        metadata: { reason: "group_closed_prorata", group_id: groupId },
      }, { idempotencyKey: `refund_close_${p.id}` });
      await supabase.from("payments").update({ status: "refunded" }).eq("id", p.id);
      await supabase.from("memberships").update({ payment_status: "canceled" })
        .eq("group_id", groupId).ilike("user_email", p.user_email);
      refundResults.push({ user_email: p.user_email, refund_id: refund.id, amount_cents: refundCents });
    } catch (err: any) {
      console.error(`refund failed for ${p.user_email}:`, err.message);
      refundResults.push({ user_email: p.user_email, error: err.message });
    }
  }

  const { data: memWithSub } = await supabase.from("memberships")
    .select("id, stripe_subscription_id")
    .eq("group_id", groupId)
    .not("stripe_subscription_id", "is", null);
  for (const m of memWithSub || []) {
    try { await stripe.subscriptions.cancel(m.stripe_subscription_id!); } catch (e: any) { console.warn(e.message); }
  }

  await supabase.from("groups").update({
    closed_at: new Date().toISOString(),
    status: "closed",
  }).eq("id", groupId);

  await logAudit(supabase, {
    action: "group_closed_prorata",
    actor_uid: ownerEmail, actor_email: ownerEmail,
    target_type: "group", target_id: groupId,
    details: { proRataRatio, daysRemaining, refundResults },
  });

  return json({ success: true, refunds: refundResults, pro_rata_ratio: proRataRatio, days_remaining: daysRemaining });
}

// ============= PROCESS REFUND (wallet closed-loop, NO Stripe call) =============
async function handleProcessRefund(body: any) {
  const { ticketId, actorEmail, actorUid } = body;
  if (!ticketId || !actorEmail || !actorUid) {
    return json({ error: "Missing ticketId/actorEmail/actorUid" }, 400);
  }
  const supabase = getSupabase();

  // Verify caller is operator/admin
  const { data: roles } = await supabase
    .from("user_roles").select("role").eq("user_id", actorUid).in("role", ["operator", "admin"]);
  if (!roles?.length) return json({ error: "Forbidden" }, 403);

  // Load ticket
  const { data: ticket, error: tErr } = await supabase
    .from("support_tickets").select("*").eq("id", ticketId).single();
  if (tErr || !ticket) return json({ error: "Ticket non trovato" }, 404);
  if (ticket.ticket_type !== "refund") return json({ error: "Non è un ticket di rimborso" }, 400);
  if (ticket.status === "closed") return json({ error: "Ticket già chiuso" }, 400);

  const groupId = ticket.group_id;
  const userEmail = (ticket.user_email || "").toLowerCase();
  if (!groupId || !userEmail) return json({ error: "Ticket incompleto" }, 400);

  // Most recent paid payment (accetta sia 'paid' che 'completed')
  const { data: payment } = await supabase
    .from("payments").select("*")
    .eq("group_id", groupId).ilike("user_email", userEmail).in("status", ["paid", "completed"])
    .order("created_date", { ascending: false }).limit(1).maybeSingle();
  if (!payment) return json({ error: "Nessun pagamento trovato per questo utente nel gruppo" }, 400);

  // Ledger entry must still be in_hold
  let { data: ledgerEntry } = await supabase
    .from("wallet_ledger").select("*").eq("payment_id", payment.id).maybeSingle();

  // Riconciliazione lazy: alcuni pagamenti storici sono stati finalizzati senza
  // riga nel ledger. La ricostruiamo al volo invece di bloccare il rimborso.
  if (!ledgerEntry) {
    const { data: grp } = await supabase
      .from("groups").select("admin_email, owner_id").eq("id", groupId).maybeSingle();
    const adminEmail = (grp?.admin_email || "").toLowerCase();
    if (!adminEmail) return json({ error: "Movimento wallet non trovato per questo pagamento" }, 400);

    const paidAt = payment.payment_date || payment.created_date || new Date().toISOString();
    const releaseAt = new Date(new Date(paidAt).getTime() + 25 * 24 * 60 * 60 * 1000).toISOString();
    const { data: inserted, error: insErr } = await supabase
      .from("wallet_ledger")
      .insert({
        owner_uid: grp?.owner_id ? String(grp.owner_id) : adminEmail,
        owner_email: adminEmail,
        group_id: groupId,
        payment_id: payment.id,
        gross_amount: payment.amount,
        platform_fee: payment.platform_fee ?? 0,
        net_amount: payment.owner_amount ?? payment.amount,
        paid_at: paidAt,
        release_at: releaseAt,
        status: new Date(releaseAt) <= new Date() ? "available" : "in_hold",
      })
      .select("*")
      .maybeSingle();
    if (insErr || !inserted) {
      console.error("ledger backfill failed:", insErr?.message);
      return json({ error: "Movimento wallet non trovato per questo pagamento" }, 400);
    }
    ledgerEntry = inserted;
  }

  if (ledgerEntry.status === "refunded") return json({ error: "Questo pagamento è già stato rimborsato" }, 400);
  if (ledgerEntry.status !== "in_hold") {
    return json({
      error: "Rimborso non possibile: i fondi non sono più in hold (stato: " + ledgerEntry.status +
        "). I rimborsi sono consentiti solo entro il periodo di hold, prima che diventino disponibili all'admin.",
    }, 400);
  }

  // ===== WALLET CLOSED-LOOP: credit user wallet, NO Stripe refund =====
  const totalCents = Math.round(Number(payment.amount) * 100);
  let creditedCents = 0;
  try {
    const { data: creditRes, error: creditErr } = await supabase.rpc("wallet_credit", {
      _user_email: userEmail,
      _amount_cents: totalCents,
      _type: "refund_credit",
      _description: `Rimborso da gruppo (ticket ${ticketId})`,
      _source_payment_id: payment.id,
      _source_group_id: groupId,
      _source_ticket_id: ticketId,
      _created_by: actorEmail,
    });
    if (creditErr) throw creditErr;
    creditedCents = totalCents;
    console.log(`[refund] wallet credited`, creditRes);
  } catch (err: any) {
    console.error("Wallet credit error:", err.message);
    return json({ error: "Accredito wallet fallito: " + err.message }, 500);
  }

  // Mark payment as refunded-to-wallet
  await supabase.from("payments").update({ status: "refunded_to_wallet" }).eq("id", payment.id);

  // Mark wallet_ledger entry as refunded (admin loses this in-hold amount; platform absorbs it via cassa reale)
  await supabase.from("wallet_ledger").update({
    status: "refunded",
    refunded_at: new Date().toISOString(),
    refund_reason: ticket.description || "Rimborso approvato (wallet credit)",
  }).eq("payment_id", payment.id);

  // Remove user from group
  await supabase.from("memberships").delete().eq("group_id", groupId).ilike("user_email", userEmail);

  // System message in group chat
  await supabase.from("messages").insert({
    group_id: groupId, sender_uid: "system", sender_name: "Sistema",
    message: `✅ Rimborso approvato per ${ticket.user_name || userEmail}: €${(creditedCents/100).toFixed(2)} accreditati sul suo Wallet DivideIt. L'utente è stato rimosso dal gruppo.`,
    message_type: "refund_approved",
  });

  // System message in ticket
  await supabase.from("support_messages").insert({
    ticket_id: ticketId, sender_id: actorUid,
    sender_name: "Operatore DIVIDEIT", sender_type: "operator",
    message: `✅ Rimborso approvato: €${(creditedCents/100).toFixed(2)} accreditati sul Wallet DivideIt dell'utente. Potrà riutilizzarli per qualsiasi nuovo gruppo (non prelevabili su IBAN).`,
  });

  // Notify joiner
  await supabase.from("notifications").insert({
    user_email: userEmail,
    type: "wallet_credited",
    title: `Rimborso accreditato sul Wallet: €${(creditedCents/100).toFixed(2)}`,
    content: `Il tuo rimborso è stato accreditato sul tuo Wallet DivideIt. Puoi usarlo subito per iscriverti a nuovi gruppi.`,
    read: false,
    created_date: new Date().toISOString(),
  });

  // Close ticket
  await supabase.from("support_tickets").update({
    status: "closed",
    assigned_operator: actorEmail,
    refund_amount: creditedCents / 100,
  }).eq("id", ticketId);

  await logAudit(supabase, {
    action: "refund_approved_wallet",
    actor_uid: actorUid, actor_email: actorEmail,
    target_type: "support_ticket", target_id: ticketId,
    details: { group_id: groupId, user_email: userEmail, credited_cents: creditedCents, model: "wallet_closed_loop" },
  });

  return json({ success: true, wallet_credited_cents: creditedCents, amount: creditedCents / 100 });
}

async function handleTestFundPlatform(body: any) {
  const stripe = getStripe();
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  if (!secretKey.startsWith("sk_test_")) {
    return json({ error: "Disponibile solo in modalita test Stripe." }, 400);
  }
  const amountCents = Math.max(100, Math.round(Number(body.amount_cents) || 20000));
  try {
    const charge = await stripe.charges.create({
      amount: amountCents,
      currency: "eur",
      source: "tok_bypassPending",
      description: "DivideIt TEST platform funding (instant available balance)",
    });
    const balance = await getPlatformBalanceSnapshot(stripe);
    return json({
      success: true,
      charge_id: charge.id,
      amount_cents: amountCents,
      platform_available_cents: balance.available_cents,
      platform_pending_cents: balance.pending_cents,
    });
  } catch (err: any) {
    console.error("test-fund-platform failed:", err.message);
    return json({ error: err.message || "Top-up test fallito" }, 400);
  }
}

// ============= MATCHMAKING =============
// ============= QUEUE HELPERS =============
type QueueInfo = {
  position: number;
  totalWaiting: number;
  freeSlots: number;
  typicalSize: number;
  groupsAhead: number;
};

async function getQueueInfo(
  supabase: any,
  serviceName: string,
  planType?: string | null,
  email?: string | null,
): Promise<QueueInfo> {
  const { data, error } = await supabase.rpc("waitlist_queue_info", {
    _service: serviceName,
    _plan: planType || null,
    _email: email ? String(email).trim().toLowerCase() : null,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    return { position: 1, totalWaiting: 0, freeSlots: 0, typicalSize: 4, groupsAhead: 0 };
  }
  return {
    position: Number(row.queue_position ?? 1),
    totalWaiting: Number(row.total_waiting ?? 0),
    freeSlots: Number(row.free_slots ?? 0),
    typicalSize: Number(row.typical_size ?? 4),
    groupsAhead: Number(row.groups_ahead ?? 0),
  };
}

function queueMessage(serviceName: string, info: QueueInfo) {
  if (info.groupsAhead <= 0) {
    return `Sei il numero ${info.position} in coda per ${serviceName}: c'è già un posto disponibile, ti assegneremo a breve.`;
  }
  const ordinal = info.groupsAhead;
  return (
    `Sei il numero ${info.position} in coda per ${serviceName}. ` +
    `I gruppi hanno in media ${info.typicalSize} posti: entrerai nel ${ordinal}° gruppo che verrà creato o si libererà. ` +
    `Ti aggiorneremo qui ogni volta che la tua posizione migliora.`
  );
}

/** Keeps a single "posizione in coda" notification up to date for every waiting user. */
async function refreshQueueNotifications(supabase: any, serviceName: string) {
  try {
    const { data: queue } = await supabase
      .from("waitlist")
      .select("user_email, plan_type")
      .eq("status", "waiting")
      .ilike("service_name", serviceName)
      .order("created_at", { ascending: true });
    if (!queue?.length) return;

    let idx = 0;
    for (const w of queue) {
      idx++;
      const info = await getQueueInfo(supabase, serviceName, w.plan_type, w.user_email);
      const position = info.position || idx;
      const content = queueMessage(serviceName, { ...info, position });
      const title = `Coda ${serviceName} · sei il #${position}`;

      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_email", w.user_email)
        .eq("type", "waitlist_position")
        .order("created_date", { ascending: false })
        .limit(1);

      if (existing?.length) {
        await supabase
          .from("notifications")
          .update({ title, content, read: false, created_date: new Date().toISOString() })
          .eq("id", existing[0].id);
      } else {
        await supabase.from("notifications").insert({
          user_email: w.user_email,
          type: "waitlist_position",
          title,
          content,
          read: false,
          created_date: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.warn("refreshQueueNotifications failed:", (e as any)?.message);
  }
}

async function handleMatchmakingFind(body: any) {

  const { userEmail, userName, serviceName, planType } = body;
  if (!userEmail || !serviceName) return json({ error: "Missing fields" }, 400);

  const supabase = getSupabase();
  const email = String(userEmail).trim().toLowerCase();

  // SKIP LOCKED can return no candidate while the only suitable group is under
  // a very short concurrent update. Retry before concluding that no slot exists.
  let matchData: any = null;
  let matchErr: any = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await supabase.rpc("match_and_lock_group", {
      _service_name: serviceName,
      _user_email: email,
      _plan_type: planType || null,
    });
    matchData = result.data;
    matchErr = result.error;
    if (matchErr || (Array.isArray(matchData) ? matchData.length > 0 : Boolean(matchData))) break;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
  }
  if (matchErr) {
    const msg = matchErr.message || "";
    if (msg.includes("lock_already_exists")) {
      return json({ error: "Hai già una prenotazione in corso per questo servizio.", code: "lock_exists" }, 409);
    }
    console.error("matchmaking-find rpc error:", msg);
    return json({ error: "Errore nel matchmaking" }, 500);
  }

  const match = Array.isArray(matchData) ? matchData[0] : matchData;
  const matchedGroupId = match?.out_group_id ?? match?.group_id;
  const matchedLockId = match?.out_lock_id ?? match?.lock_id;
  const matchedExpiresAt = match?.out_expires_at ?? match?.expires_at;
  const availableGroups = Number(match?.out_available_groups ?? 1);
  const availableSlots = Number(match?.out_available_slots ?? 1);
  const trustScore = Number(match?.out_trust_score ?? 100);
  if (matchedGroupId) {
    // NOTE: nessuna notifica qui — il posto è solo bloccato temporaneamente.
    // La notifica arriva solo dopo il pagamento confermato.
    return json({
      matched: true,
      groupId: matchedGroupId,
      lockId: matchedLockId,
      expiresAt: matchedExpiresAt,
      availableGroups,
      availableSlots,
      trustScore,
    });
  }

  // No slot → propose waitlist (do NOT create PaymentIntent here, let join action do it)
  const info = await getQueueInfo(supabase, serviceName, planType, email);
  return json({ matched: false, waitlist: true, queue: info });
}


async function handleMatchmakingCancel(body: any) {
  const { lockId } = body;
  if (!lockId) return json({ error: "Missing lockId" }, 400);
  const supabase = getSupabase();
  await supabase.from("group_slot_locks").delete().eq("id", lockId);
  return json({ ok: true });
}

async function handleWaitlistJoin(body: any, req: Request) {
  const { userEmail, serviceName, planType, returnUrl } = body;
  if (!userEmail || !serviceName) return json({ error: "Missing fields" }, 400);

  const supabase = getSupabase();
  const stripe = getStripe();
  const email = String(userEmail).trim().toLowerCase();

  // SECURITY (audit punto 6): the preauth amount is derived server-side from the
  // DB — the client can never propose an amount. service_type is the stable
  // identity; service_name is only a display label and usually contains the plan.
  const { data: svcGroups } = await supabase
    .from("groups")
    .select("total_cost, max_members, plan_type, service_type")
    .ilike("service_type", serviceName)
    .eq("status", "active")
    .limit(50);
  let amountCents = 0;
  for (const g of (svcGroups || []).filter((candidate: any) => !planType || String(candidate.plan_type || "").toLowerCase() === String(planType).toLowerCase())) {
    const q = Math.round((Number(g.total_cost) / Math.max(1, Number(g.max_members))) * 100);
    if (q > amountCents) amountCents = q;
  }
  if (amountCents <= 0) {
    amountCents = getPlanPriceCents(serviceName, planType)
      ?? await getConfigInt(supabase, "waitlist_default_preauth_cents", 1500);
  }
  const joinerFeeCents = await getConfigInt(supabase, "joiner_fee_cents", 99);
  amountCents = Math.min(50_000, amountCents + joinerFeeCents);

  const { data: existing } = await supabase
    .from("waitlist")
    .select("id")
    .eq("user_email", email)
    .eq("service_name", serviceName)
    .filter("plan_type", planType ? "eq" : "is", planType || null)
    .eq("status", "waiting")
    .limit(1);
  if (existing?.length) {
    return json({ error: "Hai già una preautorizzazione in corso o sei già in coda per questo piano.", code: "already_waiting" }, 409);
  }

  // No waitlist row is created before payment. Stripe carries the signed
  // checkout metadata and the webhook inserts the row only after the card
  // preauthorisation is confirmed.
  const waitlistId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const baseUrl = siteBaseUrl(req, returnUrl);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [{
      price_data: {
        currency: "eur",
        product_data: { name: `Coda prioritaria · ${serviceName}` },
        unit_amount: Math.max(50, Math.round(Number(amountCents))),
      },
      quantity: 1,
    }],
    payment_intent_data: {
      capture_method: "manual",
      description: `Preautorizzazione coda ${serviceName}`,
      metadata: {
        service_name: serviceName,
        plan_type: planType || "",
        user_email: email,
        waitlist_id: waitlistId,
        amount_cents: String(amountCents),
        expires_at: expiresAt,
        type: "waitlist_preauth",
      },
    },
    metadata: {
      waitlist_id: waitlistId,
      user_email: email,
      service_name: serviceName,
      plan_type: planType || "",
      amount_cents: String(amountCents),
      expires_at: expiresAt,
      type: "waitlist_preauth",
    },
    success_url: `${baseUrl}/BrowseGroups?waitlist=ok`,
    cancel_url: `${baseUrl}/BrowseGroups?waitlist=cancel`,
  }, { idempotencyKey: `waitlist_session_${waitlistId}` });

  return json({
    ok: true,
    waitlistId,
    expiresAt,
    checkoutUrl: session.url,
  });

}

async function handleWaitlistProcess(body: any) {
  const { groupId } = body;
  if (!groupId) return json({ error: "Missing groupId" }, 400);
  const supabase = getSupabase();
  const stripe = getStripe();

  const { data: group } = await supabase.from("groups").select("*").eq("id", groupId).single();
  if (!group) return json({ error: "Group not found" }, 404);
  if (group.status !== "active" || group.closed_at) return json({ ok: true, processed: 0 });

  const baseQuota = Math.round((group.total_cost / group.max_members) * 100);
  const joinerFeeCents = await getConfigInt(supabase, "joiner_fee_cents", 99);

  // Find waiting users for this service ordered by creation
  const { data: queue } = await supabase
    .from("waitlist")
    .select("*")
    .eq("status", "waiting")
    .ilike("service_name", group.service_type || group.service_name)
    .filter("plan_type", group.plan_type ? "eq" : "is", group.plan_type || null)
    .order("created_at", { ascending: true });

  if (!queue?.length) return json({ ok: true, processed: 0 });

  let processed = 0;
  for (const w of queue) {
    // Recompute available slots live
    const { data: cnt } = await supabase.rpc("count_active_slots", { _group_id: groupId });
    const used = Number(cnt || 0);
    if (used >= group.max_members) break;

    try {
      const expected = baseQuota + joinerFeeCents;
      // Reserve first under the database row lock, then capture. This prevents
      // charging a customer when another request took the final seat.
      const { data: seatRes, error: seatErr } = await supabase.rpc("reserve_group_seat", {
        _group_id: groupId,
        _user_email: w.user_email,
        _user_name: w.user_email.split("@")[0],
        _user_avatar_url: null,
      });
      if (seatErr) {
        console.warn("waitlist seat reserve failed:", seatErr.message);
        continue;
      }

      const membershipId = Array.isArray(seatRes) ? seatRes[0]?.membership_id : (seatRes as any)?.membership_id;
      if (!membershipId) continue;
      const captureAmount = Math.min(Number(w.amount_cents), expected);
      let captured: Stripe.PaymentIntent;
      try {
        captured = await stripe.paymentIntents.capture(w.stripe_payment_intent_id, {
          amount_to_capture: captureAmount,
        } as any, { idempotencyKey: `wl_capture_${w.id}` });
      } catch (captureError) {
        await supabase.from("memberships").delete().eq("id", membershipId).eq("payment_status", "pending");
        throw captureError;
      }
      if (captured.status !== "succeeded") {
        await supabase.from("memberships").delete().eq("id", membershipId).eq("payment_status", "pending");
        await supabase.from("waitlist").update({ status: "expired" }).eq("id", w.id);
        continue;
      }
      const billingMonth = new Date().toISOString().substring(0, 7);

      await supabase.from("memberships").update({ payment_status: "paid" }).eq("id", membershipId);
      await supabase.from("payments").insert({
        user_email: w.user_email,
        group_id: groupId,
        membership_id: membershipId,
        billing_month: billingMonth,
        amount: expected / 100,
        platform_fee: joinerFeeCents / 100,
        owner_amount: baseQuota / 100,
        currency: "eur",
        status: "paid",
        stripe_session_id: w.stripe_payment_intent_id,
      });

      await supabase.from("waitlist")
        .update({ status: "matched", matched_group_id: groupId })
        .eq("id", w.id);

      await supabase.from("notifications").insert({
        user_email: w.user_email,
        type: "waitlist_matched",
        title: "Posto assegnato · Coda Prioritaria",
        content: `Si è liberato un posto in un gruppo ${group.service_name} e ti abbiamo aggiunto automaticamente. La preautorizzazione di €${(captureAmount / 100).toFixed(2)} è stata addebitata come previsto. Trovi le credenziali nella pagina del gruppo.`,
        group_id: groupId,
        read: false,
      });

      processed++;
    } catch (e: any) {
      console.error("waitlist process error:", e.message);
      // If preauth no longer capturable, expire
      if (String(e.message || "").toLowerCase().includes("payment_intent")) {
        await supabase.from("waitlist").update({ status: "expired" }).eq("id", w.id);
      }
    }
  }

  // Everyone still in queue gets an updated position ("il tuo turno si avvicina")
  if (processed > 0) await refreshQueueNotifications(supabase, group.service_type || group.service_name);

  return json({ ok: true, processed });

}

async function handleWaitlistProcessAll() {
  const supabase = getSupabase();
  const { data: groups, error } = await supabase
    .from("groups")
    .select("id")
    .eq("status", "active")
    .is("closed_at", null)
    .eq("is_public", true)
    .order("created_date", { ascending: true })
    .limit(250);

  if (error) return json({ error: "Impossibile leggere i gruppi attivi" }, 500);

  let processed = 0;
  for (const group of groups || []) {
    const response = await handleWaitlistProcess({ groupId: group.id });
    const payload = await response.clone().json().catch(() => ({}));
    processed += Number(payload?.processed || 0);
  }
  return json({ ok: true, processed });
}

async function handleWaitlistCancel(body: any) {
  const { waitlistId, userEmail } = body;
  if (!waitlistId) return json({ error: "Missing waitlistId" }, 400);
  const supabase = getSupabase();
  const stripe = getStripe();
  const { data: w } = await supabase.from("waitlist").select("*").eq("id", waitlistId).single();
  if (!w) return json({ error: "not_found" }, 404);
  if (userEmail && w.user_email.toLowerCase() !== String(userEmail).toLowerCase()) {
    return json({ error: "forbidden" }, 403);
  }
  if (w.status === "waiting" && w.stripe_payment_intent_id) {
    try { await stripe.paymentIntents.cancel(w.stripe_payment_intent_id); } catch {}
  }
  await supabase.from("waitlist").update({ status: "cancelled" }).eq("id", waitlistId);
  await refreshQueueNotifications(supabase, w.service_name);
  return json({ ok: true });
}



// ============= AUTH =============
// Actions that do NOT require an authenticated user (must not expose or mutate user data)
const PUBLIC_ACTIONS = new Set(["publishable-key"]);
// Test/maintenance actions restricted to admins only
const ADMIN_ONLY_ACTIONS = new Set([
  "test-fund-platform",
  "admin-config-read",
  "admin-overview",
  "admin-config-write",
  "admin-platform-payout",
  // "waitlist-process" is checked separately: admins OR the group owner
]);


// ============= AUTO PAYOUT (cron, 28th of each month) =============
// Runs the same payout logic as the manual button, for every owner who enabled
// "bonifico automatico": transfers the FULL available balance (no threshold).
async function handleAutoPayoutRun() {
  const supabase = getSupabase();

  const { data: profiles, error } = await supabase
    .from("user_profiles")
    .select("user_email, auto_payout_enabled")
    .eq("auto_payout_enabled", true)
    .limit(200);

  if (error) {
    console.error("auto-payout: profiles fetch failed", error.message);
    return json({ error: "Errore interno" }, 500);
  }

  const results: Array<{ email: string; status: string; payout_cents?: number; error?: string }> = [];

  for (const p of profiles || []) {
    const email = (p as any).user_email as string | null;
    if (!email) continue;

    const { data: entries } = await supabase
      .from("wallet_ledger")
      .select("net_amount")
      .eq("owner_email", email)
      .eq("status", "available");

    const availableCents = Math.round(
      (entries || []).reduce((s: number, e: any) => s + Number(e.net_amount || 0), 0) * 100,
    );
    if (availableCents <= 0) {
      results.push({ email, status: "no_funds" });
      continue;
    }


    try {
      const res = await handlePayout({ ownerEmail: email }, new Request("http://internal/auto-payout"));
      const payload = await res.clone().json().catch(() => ({}));
      if (payload?.success) {
        results.push({ email, status: "paid", payout_cents: payload.payout_cents });
      } else {
        results.push({ email, status: "failed", error: payload?.error || payload?.code });
      }
    } catch (err: any) {
      console.error(`auto-payout failed for ${email}`, err.message);
      results.push({ email, status: "failed", error: err.message });
    }
  }

  const paid = results.filter((r) => r.status === "paid").length;
  await logAudit(supabase, {
    action: "auto_payout_run",
    actor_uid: "cron",
    actor_email: null,
    target_type: "auto_payout",
    target_id: null,
    details: { candidates: results.length, paid },
  });

  return json({ success: true, candidates: results.length, paid, results });
}

async function authenticateRequest(req: Request): Promise<{ email: string; uid: string } | null> {

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.email) return null;
  return { email: data.user.email, uid: data.user.id };
}

// Per-user rate limits (requests per minute) for sensitive actions.
// Financial actions FAIL CLOSED if the limiter is unavailable.
const RATE_LIMITS: Record<string, { max: number; failOpen: boolean }> = {
  "checkout": { max: 10, failOpen: false },
  "payout": { max: 5, failOpen: false },
  "withdraw": { max: 5, failOpen: false },
  "refund": { max: 5, failOpen: false },
  "process-refund": { max: 5, failOpen: false },
  "ensure-account": { max: 10, failOpen: true },
  "onboarding-link": { max: 10, failOpen: true },
  "credentials-get": { max: 30, failOpen: true },
  "credentials-set": { max: 10, failOpen: true },
  "credential-status": { max: 20, failOpen: true },
};
const DEFAULT_RATE_LIMIT = { max: 60, failOpen: true };

// ============= MAIN =============
Deno.serve(async (req) => {
  corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "";

    // Cron-only action: authenticated with the shared CRON_SECRET header
    if (action === "auto-payout-run" || action === "waitlist-process-all") {
      const cronSecret = Deno.env.get("CRON_SECRET") || "";
      const provided = req.headers.get("x-cron-secret") || "";
      if (!cronSecret || provided !== cronSecret) {
        return json({ error: "Non autorizzato" }, 403);
      }
      if (action === "waitlist-process-all") return await handleWaitlistProcessAll();
      return await handleAutoPayoutRun();
    }


    // Enforce authentication for all non-public actions
    if (!PUBLIC_ACTIONS.has(action)) {
      const user = await authenticateRequest(req);
      if (!user) {
        return json({ error: "Autenticazione richiesta" }, 401);
      }

      // Force all identity fields to the verified user — never trust the client
      body.ownerEmail = user.email;
      body.ownerUid = user.uid;
      body.userEmail = user.email;
      body.userId = user.uid;
      body.actorEmail = user.email;
      body.actorUid = user.uid;

      const supabase = getSupabase();

      // Rate limiting per user + action
      const limit = RATE_LIMITS[action] ?? DEFAULT_RATE_LIMIT;
      const allowed = await checkRateLimit(
        supabase,
        user.uid,
        `stripe-api:${action}`,
        limit.max,
        60,
        limit.failOpen,
      );
      if (!allowed) {
        return json({ error: "Troppe richieste. Riprova tra qualche minuto." }, 429);
      }

      // Admin-only actions: verify against the admin_emails config
      if (ADMIN_ONLY_ACTIONS.has(action)) {
        if (!(await isAdminEmail(supabase, user.email))) {
          return json({ error: "Forbidden" }, 403);
        }
      }

      // release-hold-test: allowed to any authenticated user while Stripe is in
      // TEST mode (releases only their own holds); admin-only in live mode.
      if (action === "release-hold-test" && !isStripeTestMode()) {
        if (!(await isAdminEmail(supabase, user.email))) {
          return json({ error: "Disponibile solo in modalità test" }, 403);
        }
      }

      // waitlist-process can also be triggered by the owner of the group being filled
      if (action === "waitlist-process" && body.groupId) {
        const { data: g } = await supabase
          .from("groups")
          .select("admin_email")
          .eq("id", body.groupId)
          .maybeSingle();
        const isOwner = g?.admin_email && String(g.admin_email).toLowerCase() === String(user.email).toLowerCase();
        if (!isOwner && !(await isAdminEmail(supabase, user.email))) {
          return json({ error: "Forbidden" }, 403);
        }
      }


      // Input validation for critical actions
      const validation = validateActionBody(action, body);
      if (!validation.ok) {
        return json({ error: "Richiesta non valida", details: validation.details }, 400);
      }
    }

    switch (action) {
      // New unified actions
      case "ensure-account": return await handleEnsureAccount(body, req);
      case "onboarding-link": return await handleOnboardingLink(body, req);
      case "reset-stripe-account": return await handleResetStripeAccount(body, req);
      case "owner-status": return await handleOwnerStatus(body);
      case "checkout": return await handleCheckout(body, req);
      case "verify-session": return await handleVerifySession(body);
      case "payout":
      case "withdraw": return await handlePayout(body, req);
      case "ledger": return await handleLedger(body);
      case "release-hold-test": return await handleReleaseHoldTest(body);
      case "test-fund-platform": return await handleTestFundPlatform(body);
      case "groups-delete": return await handleGroupsDelete(body);
      case "credentials-set": return await handleCredentialsSet(body);
      case "credentials-get": return await handleCredentialsGet(body);
      case "credential-status": return await handleCredentialStatus(body);

      case "group-close": return await handleGroupClose(body);

      // Wallet closed-loop
      case "wallet-balance": return await handleWalletBalance(body);
      case "checkout-cancelled": return await handleCheckoutCancelled(body);

      // Admin
      case "admin-overview": return await handleAdminOverview(body);
      case "admin-config-read": return await handleAdminConfigRead(body);
      case "admin-config-write": return await handleAdminConfigWrite(body);
      case "admin-platform-payout": return await handleAdminPlatformPayout(body);

      // Refund processing
      case "process-refund": return await handleProcessRefund(body);

      // Matchmaking & waitlist
      case "matchmaking-find": return await handleMatchmakingFind(body);
      case "matchmaking-cancel": return await handleMatchmakingCancel(body);
      case "waitlist-join": return await handleWaitlistJoin(body, req);
      case "waitlist-process": return await handleWaitlistProcess(body);
      case "waitlist-cancel": return await handleWaitlistCancel(body);

      // Legacy compat
      case "onboard": return await handleEnsureAccount(body, req);
      case "publishable-key":
        return json({ publishableKey: Deno.env.get("STRIPE_PUBLISHABLE_KEY") || "" });

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err: any) {
    console.error("stripe-api error:", err.message, err.stack);
    return json({ error: "Errore interno del server. Riprova." }, 500);
  }
});
