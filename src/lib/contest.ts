import { supabase } from "@/integrations/supabase/client";

export interface ContestSettings {
  starts_at: string | null;
  ends_at: string | null;
  rules_version: string;
  is_open: boolean;
}

export interface ContestEntry {
  nickname: string;
  rules_version: string;
  rules_accepted_at: string;
  active_users: number;
}

export interface LeaderboardRow {
  rank_position: number;
  nickname: string;
  active_users: number;
  is_me: boolean;
}

export const CONTEST_PRIZES = [
  { place: 1, prize: "500 €", threshold: 500 },
  { place: 2, prize: "300 €", threshold: 300 },
  { place: 3, prize: "200 €", threshold: 150 },
] as const;

export async function getContestSettings(): Promise<ContestSettings | null> {
  const { data, error } = await (supabase as any).rpc("contest_settings");
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as ContestSettings) ?? null;
}

export async function getMyContestEntry(): Promise<ContestEntry | null> {
  const { data, error } = await (supabase as any).rpc("contest_my_entry");
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as ContestEntry) ?? null;
}

export async function joinContest(nickname: string, acceptRules: boolean) {
  const { data, error } = await (supabase as any).rpc("contest_join", {
    _nickname: nickname,
    _accept_rules: acceptRules,
  });
  if (error) throw new Error(error.message || "Iscrizione non riuscita.");
  const row = Array.isArray(data) ? data[0] : data;
  return row as { nickname: string; rules_accepted_at: string };
}

export async function getContestLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
  const { data, error } = await (supabase as any).rpc("contest_leaderboard", { _limit: limit });
  if (error) return [];
  return (data ?? []) as LeaderboardRow[];
}

export function formatContestDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
