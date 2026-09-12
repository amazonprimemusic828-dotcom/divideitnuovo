import { supabase } from "@/integrations/supabase/client";

export interface DeletionRequest {
  id: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | string;
  reason: string | null;
  operator_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  retention_until: string | null;
}

export interface DeletionAdminRow extends DeletionRequest {
  user_id: string;
  user_email: string | null;
}

export interface DeletionEligibility {
  eligible: boolean;
  owned_groups: number;
  joined_groups: number;
  balance_cents: number;
  hold_cents: number;
}

export async function getDeletionEligibility(): Promise<DeletionEligibility | null> {
  const { data, error } = await (supabase as any).rpc("account_deletion_eligibility");
  if (error) return null;
  return (data as DeletionEligibility) ?? null;
}

export async function getMyDeletionRequest(): Promise<DeletionRequest | null> {
  const { data, error } = await (supabase as any).rpc("account_deletion_my_status");
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as DeletionRequest) ?? null;
}

export async function requestAccountDeletion(reason?: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc("account_deletion_request", {
    _reason: reason ?? null,
  });
  if (error) return "error";
  return String(data ?? "error");
}


export async function cancelAccountDeletion(): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("account_deletion_cancel");
  return !error && String(data) === "ok";
}

export async function listDeletionRequests(): Promise<DeletionAdminRow[]> {
  const { data, error } = await (supabase as any).rpc("account_deletion_admin_list");
  if (error) return [];
  return (data ?? []) as DeletionAdminRow[];
}

export async function approveDeletionRequest(id: string, note?: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc("account_deletion_approve", {
    _id: id,
    _note: note ?? null,
  });
  if (error) return "error";
  return String(data ?? "error");
}

export async function rejectDeletionRequest(id: string, note?: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc("account_deletion_reject", {
    _id: id,
    _note: note ?? null,
  });
  if (error) return "error";
  return String(data ?? "error");
}
