import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type PhoneStatus = { verified: boolean; phone_e164: string | null };

const CACHE_KEY = "divideit_phone_verified";

function readCache(): PhoneStatus | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.verified !== "boolean") return null;
    return { verified: parsed.verified, phone_e164: parsed.phone_e164 ?? null };
  } catch {
    return null;
  }
}

function writeCache(s: PhoneStatus) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function usePhoneVerification() {
  // Stato iniziale ottimistico dalla cache locale: evita che l'UI "salti"
  // (skeleton -> banner) al primo render.
  const cached = readCache();
  const [status, setStatus] = useState<PhoneStatus | null>(cached ?? { verified: false, phone_e164: null });
  const [loading, setLoading] = useState(!cached);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: s } = await supabase.auth.getUser();
    const uid = s.user?.id;
    if (!uid) {
      const next = { verified: false, phone_e164: null };
      setStatus(next);
      writeCache(next);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("user_profiles")
      .select("phone_e164, phone_verified_at")
      .eq("user_id", uid)
      .maybeSingle();
    const next: PhoneStatus = {
      verified: !!data?.phone_verified_at,
      phone_e164: data?.phone_e164 ?? null,
    };
    setStatus(next);
    writeCache(next);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { status, loading, refresh };
}
