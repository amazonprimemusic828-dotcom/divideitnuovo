import { supabase } from "@/integrations/supabase/client";

const PENDING_KEY = "pending_ref";
const TICKET_KEY = "pending_ref_ticket";
const CLAIMED_KEY = "referral_claimed_uid";

let referralTicketPromise: Promise<string | null> | null = null;

type ClaimReferralResult =
  | "ok"
  | "already_claimed"
  | "invalid_code"
  | "self_referral"
  | "existing_account"
  | "unauthenticated";

/** Legge ?ref= dall'URL (in qualsiasi pagina) e lo memorizza per il flusso OAuth. */
export function capturePendingReferral(): string | null {
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    if (ref && ref.trim()) {
      const code = ref.trim().toUpperCase().slice(0, 12);
      localStorage.setItem(PENDING_KEY, code);
      const ticket = url.searchParams.get("ref_ticket");
      if (ticket && ticket.trim()) localStorage.setItem(TICKET_KEY, ticket.trim());
      return code;
    }
    return localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

export function getPendingReferral(): string | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("ref");
    return (fromUrl?.trim().toUpperCase() || localStorage.getItem(PENDING_KEY)) ?? null;
  } catch {
    return null;
  }
}

export function clearPendingReferral() {
  try {
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(TICKET_KEY);
  } catch {
    /* noop */
  }
}

/** Creates a server-dated ticket before registration starts. */
export async function prepareReferralClaim(): Promise<string | null> {
  const code = capturePendingReferral();
  if (!code) return null;
  try {
    const existingTicket = localStorage.getItem(TICKET_KEY);
    if (existingTicket) return existingTicket;
  } catch {
    return null;
  }

  // AuthContext and the login button can request preparation at the same time.
  // Share one request so both callers await the same server-dated ticket.
  if (!referralTicketPromise) {
    referralTicketPromise = (async () => {
      const { data, error } = await (supabase as any).rpc("referral_open_link", { code });
      if (error || !data) return null;
      const ticket = String(data);
      try {
        localStorage.setItem(TICKET_KEY, ticket);
      } catch {
        /* noop */
      }
      return ticket;
    })().finally(() => {
      referralTicketPromise = null;
    });
  }

  return referralTicketPromise;
}

export function getPendingReferralTicket(): string | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("ref_ticket");
    return fromUrl?.trim() || localStorage.getItem(TICKET_KEY);
  } catch {
    return null;
  }
}

export const WELCOME_KEY = "referral_welcome";
export const REFERRAL_WELCOME_EVENT = "divideit:referral-welcome";

export interface ReferralLinkInfo {
  valid: boolean;
  referral_code: string | null;
  referrer_name: string | null;
  referrer_avatar: string | null;
}

/** Info pubbliche sull'invitante, per mostrare il link come professionale. */
export async function getReferralLinkInfo(code: string): Promise<ReferralLinkInfo | null> {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  const { data, error } = await (supabase as any).rpc("referral_link_info", { code: clean });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as ReferralLinkInfo) ?? null;
}

/**
 * Reclama il codice referral lato server (tutti i controlli sono nel database).
 * Idempotente: la RPC rifiuta auto-inviti, codici inesistenti e account già
 * esistenti (il bonus vale solo per email mai registrate su DIVIDEIT).
 */
export async function claimPendingReferral(uid: string): Promise<ClaimReferralResult | null> {
  const code = capturePendingReferral();
  if (!code) return null;
  try {
    if (localStorage.getItem(CLAIMED_KEY) === `${uid}:${code}`) return "already_claimed";
  } catch {
    /* noop */
  }
  let ticket: string | null = null;
  try {
    ticket = localStorage.getItem(TICKET_KEY);
  } catch {
    ticket = null;
  }
  if (!ticket) ticket = await prepareReferralClaim();
  if (!ticket) return null;
  const { data, error } = await (supabase as any).rpc("claim_referral", { code, ticket });
  if (error) return null; // Il codice resta salvato: riproveremo al prossimo evento auth.

  const result = data as ClaimReferralResult | null;
  if (result === "unauthenticated" || !result) return result ?? null;
  if (result !== "ok" && result !== "already_claimed") {
    clearPendingReferral();
    return result;
  }

  try {
    localStorage.setItem(CLAIMED_KEY, `${uid}:${code}`);
    if (result === "ok") {
      localStorage.setItem(WELCOME_KEY, code);
      window.dispatchEvent(new CustomEvent(REFERRAL_WELCOME_EVENT, { detail: { code } }));
    }
  } catch {
    /* noop */
  }
  clearPendingReferral();
  return result;
}

export interface MyInviter {
  referrer_name: string | null;
  referral_code: string | null;
  claimed_at: string | null;
}

export async function getMyInviter(): Promise<MyInviter | null> {
  const { data, error } = await (supabase as any).rpc("referral_my_inviter");
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as MyInviter) ?? null;
}


export async function getMyReferralCode(): Promise<string | null> {
  const { data, error } = await (supabase as any).rpc("referral_get_my_code");
  if (error) return null;
  return (data as string) ?? null;
}

export interface ReferralSummary {
  referral_code: string | null;
  total_invites: number;
  pending_invites: number;
  confirmed_invites: number;
  earned_cents: number;
  pending_cents: number;
}

export async function getReferralSummary(): Promise<ReferralSummary | null> {
  const { data, error } = await (supabase as any).rpc("referral_my_summary");
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as ReferralSummary) ?? null;
}

export interface ReferralRow {
  id: string;
  referred_email: string;
  status: string;
  created_at: string;
  confirmed_at: string | null;
}

export async function listMyReferrals(referrerId: string): Promise<ReferralRow[]> {
  const { data, error } = await (supabase.from("referrals" as any) as any)
    .select("id, referred_email, status, created_at, confirmed_at")
    .eq("referrer_id", referrerId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as ReferralRow[];
}
