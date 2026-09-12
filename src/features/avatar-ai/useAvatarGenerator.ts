import { useEffect, useRef, useState } from "react";
import { AvatarAIError, isAvatarTokenValid, type AvatarConfirmCallback, type GeneratedAvatar } from "./contracts";
import { AVATAR_GENERATION_ENABLED } from "./config";
import { generateAvatar } from "./client";
import { prepareSelfie } from "./selfie";

type Phase = "empty" | "preparing" | "ready" | "generating" | "done" | "confirming";
interface Selfie { file: File; url: string; name: string }
interface AvatarPreview extends GeneratedAvatar { url: string }
interface Options {
  disabled?: boolean;
  onConfirm?: AvatarConfirmCallback;
  onConfirmed?: () => void;
  onBusyChange?: (busy: boolean, confirming: boolean) => void;
}

export function useAvatarGenerator({ disabled = false, onConfirm, onConfirmed, onBusyChange }: Options = {}) {
  const [phase, setPhase] = useState<Phase>("empty");
  const [selfie, setSelfie] = useState<Selfie | null>(null);
  const [result, setResult] = useState<AvatarPreview | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<AvatarAIError | null>(null);
  const [confirmedUrl, setConfirmedUrl] = useState<string | null>(null);
  const operation = useRef<AbortController | null>(null);
  const urls = useRef(new Set<string>());
  const mounted = useRef(true);
  const confirming = phase === "confirming";
  const confirmed = Boolean(result && confirmedUrl === result.url);
  const busy = phase === "preparing" || phase === "generating" || confirming;
  const canConfirm = Boolean(result && onConfirm) && !disabled && !busy && !confirmed;
  const canGenerate = AVATAR_GENERATION_ENABLED && !disabled && !busy && Boolean(selfie) && consent && (!accessToken.trim() || isAvatarTokenValid(accessToken));

  useEffect(() => {
    mounted.current = true;
    const activeUrls = urls.current;
    return () => {
      mounted.current = false;
      operation.current?.abort();
      activeUrls.forEach((url) => URL.revokeObjectURL(url));
      activeUrls.clear();
    };
  }, []);

  useEffect(() => {
    onBusyChange?.(busy, confirming);
    return () => onBusyChange?.(false, false);
  }, [busy, confirming, onBusyChange]);

  const release = (url?: string) => {
    if (url) {
      URL.revokeObjectURL(url);
      urls.current.delete(url);
    }
  };

  const restorePhase = () => setPhase(result ? "done" : selfie ? "ready" : "empty");

  const chooseSelfie = async (file: File) => {
    if (disabled || operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setError(null);
    setPhase("preparing");

    try {
      const prepared = await prepareSelfie(file, controller.signal);
      if (!mounted.current || operation.current !== controller || controller.signal.aborted) return;
      const url = URL.createObjectURL(prepared);
      urls.current.add(url);
      release(selfie?.url);
      release(result?.url);
      setSelfie({ file: prepared, url, name: file.name });
      setResult(null);
      setConsent(false);
      setPhase("ready");
    } catch (failure) {
      if (!mounted.current || operation.current !== controller) return;
      if (!controller.signal.aborted) {
        setError(failure instanceof AvatarAIError ? failure : new AvatarAIError("INVALID_IMAGE"));
      }
      restorePhase();
    } finally {
      if (operation.current === controller) operation.current = null;
    }
  };

  const chooseFiles = (files: FileList | null) => {
    if (disabled || busy || operation.current || !files?.length) return;
    if (files.length > 1) {
      setError(new AvatarAIError("SINGLE_IMAGE_REQUIRED"));
      return;
    }
    void chooseSelfie(files[0]);
  };

  const generate = async () => {
    if (disabled || operation.current || !selfie) return;
    if (!AVATAR_GENERATION_ENABLED) {
      setError(new AvatarAIError("INTEGRATION_PENDING"));
      return;
    }
    if (!consent) { setError(new AvatarAIError("CONSENT_REQUIRED")); return; }
    if (accessToken.trim() && !isAvatarTokenValid(accessToken)) {
      setError(new AvatarAIError("INVALID_TOKEN"));
      return;
    }
    const controller = new AbortController();
    operation.current = controller;
    setError(null);
    setPhase("generating");
    try {
      const generated = await generateAvatar(selfie.file, { accessToken, consent }, controller.signal);
      if (!mounted.current || operation.current !== controller || controller.signal.aborted) return;
      const url = URL.createObjectURL(generated.file);
      urls.current.add(url);
      release(result?.url);
      setResult({ ...generated, url });
      setPhase("done");
    } catch (failure) {
      if (!mounted.current || operation.current !== controller) return;
      if (!controller.signal.aborted) {
        setError(failure instanceof AvatarAIError ? failure : new AvatarAIError("GENERATION_FAILED"));
      }
      restorePhase();
    } finally {
      if (operation.current === controller) operation.current = null;
    }
  };

  const confirm = async () => {
    if (!canConfirm || operation.current || !result || !onConfirm) return;
    const controller = new AbortController();
    operation.current = controller;
    setError(null);
    setPhase("confirming");
    try {
      // The parent owns a separate URL so closing this panel cannot revoke the profile photo.
      await onConfirm(result.file);
      if (!mounted.current || operation.current !== controller || controller.signal.aborted) return;
      setConfirmedUrl(result.url);
      setPhase("done");
      onConfirmed?.();
    } catch {
      if (!mounted.current || operation.current !== controller || controller.signal.aborted) return;
      setError(new AvatarAIError("PROFILE_UPDATE_FAILED"));
      setPhase("done");
    } finally {
      if (operation.current === controller) operation.current = null;
    }
  };

  const updateAccessToken = (value: string) => {
    if (disabled || operation.current) return;
    setAccessToken(value);
    if (error?.code === "INVALID_TOKEN") setError(null);
  };

  const validateAccessToken = () => {
    if (disabled || operation.current || (error && error.code !== "INVALID_TOKEN")) return;
    setError(accessToken.trim() && !isAvatarTokenValid(accessToken) ? new AvatarAIError("INVALID_TOKEN") : null);
  };

  const updateConsent = (value: boolean) => {
    if (disabled || operation.current) return;
    setConsent(value);
    if (error?.code === "CONSENT_REQUIRED") setError(null);
  };

  const cancel = () => {
    if (confirming) return;
    operation.current?.abort();
    operation.current = null;
    setError(null);
    restorePhase();
  };

  const reset = () => {
    if (confirming) return;
    operation.current?.abort();
    operation.current = null;
    release(selfie?.url);
    release(result?.url);
    setSelfie(null);
    setResult(null);
    setAccessToken("");
    setConsent(false);
    setError(null);
    setPhase("empty");
  };

  return { phase, selfie, result, accessToken, consent, error, busy, confirming, confirmed, canGenerate, canConfirm, chooseFiles, updateAccessToken, validateAccessToken, updateConsent, generate, confirm, cancel, reset };
}
