import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthContext";
import {
  cachePrivateKey,
  forgetPrivateKey,
  generateIdentity,
  generateRecoveryCode,
  isVaultSupported,
  loadCachedPrivateKey,
  unwrapPrivateKey,
  wrapPrivateKey,
} from "@/lib/vaultCrypto";

export type VaultStatus = "loading" | "unsupported" | "absent" | "locked" | "ready";

interface KeyRow {
  user_id: string;
  public_key_jwk: any;
  wrapped_private_key: string;
  kdf_salt: string;
  kdf_iterations: number;
  pw_wrapped_private_key: string | null;
  pw_kdf_salt: string | null;
  pw_kdf_iterations: number | null;
}

const db = () => supabase as any;

export function useVault() {
  const { user } = useAuth();
  const [status, setStatus] = useState<VaultStatus>("loading");
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [publicKeyJwk, setPublicKeyJwk] = useState<JsonWebKey | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.uid) {
      setStatus("loading");
      return;
    }
    if (!isVaultSupported()) {
      setStatus("unsupported");
      return;
    }
    const { data } = await db()
      .from("user_public_keys")
      .select("*")
      .eq("user_id", user.uid)
      .maybeSingle();

    if (!data) {
      setPrivateKey(null);
      setPublicKeyJwk(null);
      setStatus("absent");
      return;
    }
    setPublicKeyJwk((data as KeyRow).public_key_jwk as JsonWebKey);
    const cached = await loadCachedPrivateKey(user.uid);
    if (cached) {
      setPrivateKey(cached);
      setStatus("ready");
    } else {
      setPrivateKey(null);
      setStatus("locked");
    }
  }, [user?.uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** First-time setup: creates the key pair and returns the one-time recovery code. */
  const setup = useCallback(
    async (password?: string): Promise<{ recoveryCode: string }> => {
      if (!user?.uid) throw new Error("not_authenticated");
      setBusy(true);
      try {
        const recoveryCode = generateRecoveryCode();
        const identity = await generateIdentity();
        const recoveryWrap = await wrapPrivateKey(identity.pkcs8, recoveryCode);
        const pwWrap = password ? await wrapPrivateKey(identity.pkcs8, password) : null;

        const { error } = await db()
          .from("user_public_keys")
          .upsert(
            {
              user_id: user.uid,
              user_email: user.email,
              public_key_jwk: identity.publicKeyJwk,
              wrapped_private_key: recoveryWrap.wrapped,
              kdf_salt: recoveryWrap.salt,
              kdf_iterations: recoveryWrap.iterations,
              pw_wrapped_private_key: pwWrap?.wrapped ?? null,
              pw_kdf_salt: pwWrap?.salt ?? null,
              pw_kdf_iterations: pwWrap?.iterations ?? null,
            },
            { onConflict: "user_id" },
          );
        if (error) throw error;

        await cachePrivateKey(user.uid, identity.privateKey);
        setPrivateKey(identity.privateKey);
        setPublicKeyJwk(identity.publicKeyJwk);
        setStatus("ready");
        return { recoveryCode };
      } finally {
        setBusy(false);
      }
    },
    [user?.uid, user?.email],
  );

  /** Unlock on a new device with the password or the recovery code. */
  const unlock = useCallback(
    async (secret: string): Promise<boolean> => {
      if (!user?.uid) return false;
      setBusy(true);
      try {
        const { data } = await db()
          .from("user_public_keys")
          .select("*")
          .eq("user_id", user.uid)
          .maybeSingle();
        const row = data as KeyRow | null;
        if (!row) return false;

        const attempts: { wrapped: string; salt: string; iterations: number }[] = [];
        if (row.pw_wrapped_private_key && row.pw_kdf_salt) {
          attempts.push({
            wrapped: row.pw_wrapped_private_key,
            salt: row.pw_kdf_salt,
            iterations: row.pw_kdf_iterations || 310000,
          });
        }
        attempts.push({
          wrapped: row.wrapped_private_key,
          salt: row.kdf_salt,
          iterations: row.kdf_iterations,
        });

        for (const attempt of attempts) {
          try {
            const key = await unwrapPrivateKey(attempt, secret);
            await cachePrivateKey(user.uid, key);
            setPrivateKey(key);
            setPublicKeyJwk(row.public_key_jwk as JsonWebKey);
            setStatus("ready");
            return true;
          } catch {
            /* try next wrap */
          }
        }
        return false;
      } finally {
        setBusy(false);
      }
    },
    [user?.uid],
  );

  /** Destroys the identity and creates a new one (previous vaults become unreadable). */
  const reset = useCallback(
    async (password?: string) => {
      if (!user?.uid) throw new Error("not_authenticated");
      await forgetPrivateKey(user.uid);
      return setup(password);
    },
    [user?.uid, setup],
  );

  const lock = useCallback(async () => {
    if (!user?.uid) return;
    await forgetPrivateKey(user.uid);
    setPrivateKey(null);
    setStatus("locked");
  }, [user?.uid]);

  return { status, privateKey, publicKeyJwk, busy, setup, unlock, reset, lock, refresh };
}
