import { stripeApi } from "./stripeApi";

export interface WalletTransaction {
  id: string;
  user_email: string;
  type: "refund_credit" | "checkout_spend" | "spend_reversal" | "adjustment";
  amount_cents: number;
  balance_after_cents: number;
  source_payment_id: string | null;
  source_group_id: string | null;
  source_ticket_id: string | null;
  source_session_id: string | null;
  description: string | null;
  created_at: string;
}

export interface WalletData {
  balance_cents: number;
  transactions: WalletTransaction[];
}

export async function getWallet(userEmail: string): Promise<WalletData> {
  const { ok, data } = await stripeApi("wallet-balance", { userEmail });
  if (!ok) return { balance_cents: 0, transactions: [] };
  return {
    balance_cents: Number(data.balance_cents || 0),
    transactions: data.transactions || [],
  };
}

export function centsToEur(cents: number) {
  return (cents / 100).toFixed(2);
}
