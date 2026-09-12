import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, ShieldCheck, Smartphone, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import { usePhoneVerification } from "@/hooks/usePhoneVerification";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onVerified?: () => void;
}

export default function PhoneVerificationDialog({ open, onOpenChange, onVerified }: Props) {
  const { refresh } = usePhoneVerification();
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState("+39");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setStep(1); setCode(""); setCooldown(0);
      if (timerRef.current) window.clearInterval(timerRef.current);
    }
  }, [open]);

  const startCooldown = () => {
    setCooldown(60);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { if (timerRef.current) window.clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const callOtpApi = async (body: Record<string, unknown>) => {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) return { ok: false, status: 401, data: { error: "unauthenticated" } };
    const res = await fetch(`${SUPABASE_URL}/functions/v1/phone-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  };

  const handleSend = async () => {
    const cleaned = phone.replace(/\s/g, "");
    if (!/^\+\d{8,15}$/.test(cleaned)) {
      toast.error("Inserisci un numero valido in formato internazionale (es. +39 333 1234567)");
      return;
    }
    setSending(true);
    try {
      const res = await callOtpApi({ action: "send", phone: cleaned, channel: "sms" });
      if (res.data?.already_verified) {
        toast.success("Il tuo numero è già verificato!");
        await refresh();
        onVerified?.();
        onOpenChange(false);
        return;
      }
      if (!res.ok) {
        if (res.data?.error === "rate_limited") {
          toast.error("Limite raggiunto: massimo 2 messaggi di verifica ogni 24 ore. Riprova domani.");
        } else if (res.data?.error === "channel_not_configured") {
          toast.error("Il servizio SMS non è disponibile in questo momento. Riprova più tardi.");
        } else if (res.data?.error === "invalid_phone") {
          toast.error("Numero non valido");
        } else {
          toast.error("Errore durante l'invio. Riprova.");
        }
        return;
      }
      toast.success("Codice inviato via SMS");
      setStep(2);
      startCooldown();
    } catch {
      toast.error("Errore di rete. Riprova.");
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(code)) { toast.error("Codice non valido"); return; }
    setVerifying(true);
    try {
      const res = await callOtpApi({ action: "verify", code });
      if (!res.ok || !res.data?.verified) {
        if (res.data?.error === "invalid_code") toast.error("Codice errato");
        else if (res.data?.error === "no_active_code") toast.error("Codice scaduto, reinvia");
        else if (res.data?.error === "too_many_attempts") toast.error("Troppi tentativi. Richiedi un nuovo codice.");
        else toast.error("Verifica fallita");
        return;
      }
      await refresh();
      toast.success("Numero verificato! Ora puoi creare gruppi senza altre verifiche.");
      onVerified?.();
      onOpenChange(false);
    } catch {
      toast.error("Errore di rete. Riprova.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-2xl gradient-divideit flex items-center justify-center mb-2">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <DialogTitle className="text-center">Verifica il tuo numero</DialogTitle>
          <DialogDescription className="text-center">
            Verifica richiesta una sola volta: da quel momento creerai gruppi all&apos;istante, senza altri codici.
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Numero di telefono</Label>
              <div className="relative mt-2">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+39 333 123 4567"
                  className="pl-9"
                  inputMode="tel"
                />
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3">
              <MessageSquareText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground">
                Riceverai un <span className="font-semibold text-foreground">SMS</span> con un codice a 6 cifre.
                Formato internazionale obbligatorio (E.164). Massimo 2 messaggi ogni 24 ore.
              </p>
            </div>

            <Button onClick={handleSend} disabled={sending} className="w-full gradient-divideit text-white">
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Invia codice SMS
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              Inserisci il codice a 6 cifre inviato via SMS al<br />
              <span className="font-semibold text-foreground">{phone}</span>
            </p>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  {[0,1,2,3,4,5].map((i) => <InputOTPSlot key={i} index={i} className="w-11 h-12 text-lg" />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button onClick={handleVerify} disabled={verifying || code.length !== 6} className="w-full gradient-divideit text-white">
              {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Verifica
            </Button>
            <div className="flex items-center justify-between text-xs">
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setStep(1)}>← Cambia numero</button>
              <button
                className="text-primary disabled:text-muted-foreground"
                disabled={cooldown > 0 || sending}
                onClick={handleSend}
              >
                {cooldown > 0 ? `Reinvia in ${cooldown}s` : "Reinvia codice"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
