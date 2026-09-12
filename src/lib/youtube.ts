import { supabase } from "@/integrations/supabase/client";

export const YOUTUBE_MONTHLY_SLOTS = 50;

export interface YoutubeStatus {
  slots_left: number;
  total_slots?: number;
  confirmed_friends: number;
  reward_id: string | null;
  status: "qualified" | "email_submitted" | "invited" | null;
  google_email: string | null;
  invited_at: string | null;
}

export interface YoutubeAdminRow {
  id: string;
  user_email: string;
  nickname: string | null;
  google_email: string | null;
  month: string;
  status: string;
  qualified_at: string;
  email_submitted_at: string | null;
  invited_at: string | null;
  slots_left: number;
}

/** Contatore pubblico: 50 - richieste del mese corrente (unica fonte di verità). */
export async function getYoutubeSlotsLeft(): Promise<number> {
  const { data, error } = await (supabase as any).rpc("youtube_slots_left");
  if (error) return YOUTUBE_MONTHLY_SLOTS;
  return Number(data ?? YOUTUBE_MONTHLY_SLOTS);
}

export async function getYoutubeStatus(): Promise<YoutubeStatus | null> {
  const { data, error } = await (supabase as any).rpc("youtube_my_status");
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as YoutubeStatus) ?? null;
}

export async function submitYoutubeEmail(email: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc("youtube_submit_email", { _email: email });
  if (error) return "error";
  const result = String(data ?? "error");
  if (result === "ok") {
    // avvisa l'admin: l'invito va mandato entro 24 ore
    try {
      await supabase.functions.invoke("notify-email", { body: { type: "youtube_request" } });
    } catch {
      /* la notifica non deve bloccare l'utente */
    }
  }
  return result;
}

export async function listYoutubeRequests(): Promise<YoutubeAdminRow[]> {
  const { data, error } = await (supabase as any).rpc("youtube_admin_list");
  if (error) return [];
  return (data ?? []) as YoutubeAdminRow[];
}

export async function markYoutubeInvited(id: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("youtube_mark_invited", { _id: id });
  return !error && String(data) === "ok";
}

export async function isPlatformAdmin(): Promise<boolean> {
  const { data: session } = await supabase.auth.getUser();
  const uid = session?.user?.id;
  if (!uid) return false;
  const { data, error } = await (supabase as any).rpc("has_role", { _user_id: uid, _role: "admin" });
  return !error && data === true;
}
