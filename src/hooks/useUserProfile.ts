import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthContext";

export interface UserProfile {
  user_id: string;
  user_email: string | null;
  phone_e164: string | null;
  phone_verified_at: string | null;
  trust_level: number;
  trust_badges: string[];
  notify_email: boolean;
  notify_push: boolean;
  notify_marketing: boolean;
  notify_new_member: boolean;
  notify_payment: boolean;
  notify_chat: boolean;
}

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.uid) { setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase.from("user_profiles" as any) as any)
      .select("*")
      .eq("user_id", user.uid)
      .maybeSingle();
    if (data) {
      setProfile(data as UserProfile);
    } else {
      // create defaults
      const { data: created } = await (supabase.from("user_profiles" as any) as any)
        .insert({ user_id: user.uid, user_email: user.email })
        .select()
        .maybeSingle();
      setProfile((created || null) as UserProfile | null);
    }
    setLoading(false);
  }, [user?.uid, user?.email]);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(async (patch: Partial<UserProfile>) => {
    if (!user?.uid) return;
    setProfile((p) => p ? { ...p, ...patch } : p);
    await (supabase.from("user_profiles" as any) as any).update(patch).eq("user_id", user.uid);
  }, [user?.uid]);

  return { profile, loading, reload: load, update };
}
