import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, Clock, Sparkles, ShieldCheck, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stripeApi } from "@/lib/stripeApi";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { JOIN_FEE_CENTS } from "@/lib/servicePlans";

const MIN_OVERLAY_MS = 2800;

const ROTATING_MESSAGES = [
  { icon: Search, text: "Ricerca slot disponibili…" },
  { icon: ShieldCheck, text: "Verifica affidabilità Admin…" },
  { icon: Sparkles, text: "Prenotazione in corso…" },
];

type Phase = "loading" | "matched" | "waitlist" | "error";

export interface MatchmakingOverlayProps {
  open: boolean;
  onClose: () => void;
  userEmail: string;
  userName?: string | null;
  serviceName: string;
  planType?: string | null;
  preauthAmountCents: number; // estimated quota for waitlist preauth
}

function QueueInfoBox({
  queue, serviceName, confirmed,
}: { queue: { position: number; totalWaiting: number; freeSlots: number; typicalSize: number; groupsAhead: number }; serviceName: string; confirmed: boolean }) {
  return (
    <div className="mb-5 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-left">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-foreground">
          {confirmed ? "La tua posizione in coda" : "Posizione prevista dopo la conferma"}
        </span>
        <span className="text-lg font-bold text-primary">#{queue.position}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {queue.groupsAhead <= 0
          ? `C'è già un posto libero in un gruppo ${serviceName}: verrai assegnato appena confermi.`
          : `Ogni gruppo ${serviceName} può accogliere ${queue.typicalSize} partecipanti oltre all'admin: sei previsto nel ${queue.groupsAhead}° prossimo gruppo che verrà creato o si libererà. Ti avviseremo nelle notifiche ogni volta che la tua posizione migliora.`}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1">
        {confirmed
          ? `${queue.totalWaiting} in coda · ${queue.freeSlots} posti liberi ora`
          : `${queue.totalWaiting} già in attesa · non sei ancora in coda`}
      </p>
    </div>
  );
}

export default function MatchmakingOverlay({
  open, onClose, userEmail, userName, serviceName, planType, preauthAmountCents,
}: MatchmakingOverlayProps) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("loading");
  const [msgIdx, setMsgIdx] = useState(0);
  const [matchedGroupId, setMatchedGroupId] = useState<string | null>(null);
  const [lockId, setLockId] = useState<string | null>(null);
  const [lockSecondsLeft, setLockSecondsLeft] = useState(30);
  const [availability, setAvailability] = useState<{ groups: number; slots: number; trustScore: number } | null>(null);
  const [waitlistBusy, setWaitlistBusy] = useState(false);
  const [existingWaitlist, setExistingWaitlist] = useState<{ created_at: string; expires_at: string } | null>(null);
  const [queue, setQueue] = useState<{ position: number; totalWaiting: number; freeSlots: number; typicalSize: number; groupsAhead: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  // Rotate messages
  useEffect(() => {
    if (!open || phase !== "loading") return;
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % ROTATING_MESSAGES.length), 850);
    return () => clearInterval(t);
  }, [open, phase]);

  // Run matchmaking with min delay
  useEffect(() => {
    if (!open || startedRef.current) return;
    startedRef.current = true;
    setPhase("loading");
    setMsgIdx(0);
    setError(null);

    const t0 = Date.now();
    (async () => {
      const res = await stripeApi("matchmaking-find", {
        userEmail, userName, serviceName, planType,
      });
      const elapsed = Date.now() - t0;
      const remaining = Math.max(0, MIN_OVERLAY_MS - elapsed);
      await new Promise((r) => setTimeout(r, remaining));

      if (!res.ok) {
        if (res.data?.code === "lock_exists") {
          setError("Hai già una prenotazione attiva per questo servizio. Completa quella prima.");
        } else {
          setError(res.data?.error || "Matchmaking fallito");
        }
        setPhase("error");
        return;
      }

      if (res.data?.matched) {
        setMatchedGroupId(res.data.groupId);
        setLockId(res.data.lockId);
        const expires = new Date(res.data.expiresAt).getTime();
        setLockSecondsLeft(Math.max(1, Math.floor((expires - Date.now()) / 1000)));
        setAvailability({
          groups: Number(res.data.availableGroups ?? 1),
          slots: Number(res.data.availableSlots ?? 1),
          trustScore: Number(res.data.trustScore ?? 100),
        });
        setPhase("matched");
      } else {
        setQueue(res.data?.queue ?? null);
        setPhase("waitlist");
      }
    })();
  }, [open, userEmail, userName, serviceName, planType]);

  // Countdown for slot lock
  useEffect(() => {
    if (phase !== "matched") return;
    const t = setInterval(() => {
      setLockSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          toast.error("Lo slot è scaduto, riprova");
          handleCancel();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      setPhase("loading");
      setMatchedGroupId(null);
      setLockId(null);
      setError(null);
      setExistingWaitlist(null);
      setQueue(null);
      setAvailability(null);
    }
  }, [open]);

  const loadExistingWaitlist = async () => {
    const { data } = await supabase
      .from("waitlist")
      .select("created_at, expires_at")
      .eq("service_name", serviceName)
      .filter("plan_type", planType ? "eq" : "is", planType || null)
      .eq("status", "waiting")
      .order("created_at", { ascending: false })
      .limit(1);
    setExistingWaitlist(data?.[0] ?? null);
    return data?.[0] ?? null;
  };

  // When no slot is available, check whether the user is already queued
  useEffect(() => {
    if (phase === "waitlist") void loadExistingWaitlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, serviceName]);

  const handleCancel = async () => {
    if (lockId) {
      await stripeApi("matchmaking-cancel", { lockId });
    }
    onClose();
  };

  const handleConfirm = () => {
    if (!matchedGroupId) return;
    onClose();
    navigate(`/JoinGroup?id=${matchedGroupId}`);
  };

  const handleJoinWaitlist = async () => {
    setWaitlistBusy(true);
    try {
      // Preauth amount is computed server-side from the DB (audit punto 6)
      const res = await stripeApi("waitlist-join", {
        userEmail,
        serviceName,
        planType,
        returnUrl: window.location.origin,
      });
      if (!res.ok) {
        if (res.status === 401) {
          toast.error("Sessione scaduta: accedi di nuovo per entrare in coda.");
          setWaitlistBusy(false);
          return;
        }
        if (res.status === 409 || res.data?.code === "already_waiting") {
          await loadExistingWaitlist();
          toast.info("Sei già in coda per questo servizio.");
          setWaitlistBusy(false);
          return;
        }
        toast.error(res.data?.error || "Impossibile entrare in coda");
        setWaitlistBusy(false);
        return;
      }
      if (res.data?.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
        return;
      }
      if (res.data?.queue) setQueue(res.data.queue);
      toast.success("Sei in coda!");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Errore");
    } finally {
      setWaitlistBusy(false);
    }
  };


  if (!open) return null;

  const Icon = ROTATING_MESSAGES[msgIdx].icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-card shadow-2xl border border-border overflow-hidden">
        {phase !== "loading" && (
          <button
            onClick={phase === "matched" ? handleCancel : onClose}
            className="absolute top-3 right-3 z-10 p-2 rounded-full bg-muted hover:bg-muted/80 transition"
            aria-label="Chiudi"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Loading */}
        {phase === "loading" && (
          <div className="p-8 text-center">
            <div className="relative mx-auto w-24 h-24 mb-6">
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-primary/20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
              </div>
            </div>
            <h2 className="text-xl font-bold mb-2">Trovo il gruppo migliore per te</h2>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground min-h-[24px] transition-all">
              <Icon className="w-4 h-4 text-primary" />
              <span>{ROTATING_MESSAGES[msgIdx].text}</span>
            </div>
          </div>
        )}

        {/* Matched */}
        {phase === "matched" && (
          <div className="p-8 text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-5">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-1">
              {availability && availability.groups > 1 ? "Più slot disponibili" : "Uno slot disponibile"}
            </h2>
            <p className="text-muted-foreground mb-4">
              {availability && availability.groups > 1 ? (
                <>Abbiamo scelto per te il gruppo <strong>{serviceName}</strong> con l'affidabilità più alta ({availability.trustScore}/200).</>
              ) : (
                <>C'è un posto libero nel gruppo <strong>{serviceName}</strong>. Vuoi entrare?</>
              )}
            </p>
            <div className="rounded-2xl bg-muted/50 border border-border p-3 text-sm mb-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Totale da pagare su Stripe</span>
                <strong className="text-foreground">€{(preauthAmountCents / 100).toFixed(2)}/mese</strong>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 text-left">
                Include la commissione di servizio DivideIt di €{(JOIN_FEE_CENTS / 100).toFixed(2)}.
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 flex items-center justify-center gap-2 text-amber-800 text-sm mb-5">
              <Clock className="w-4 h-4" />
              Prenotazione valida ancora <strong>{lockSecondsLeft}s</strong>
            </div>

            <Button className="w-full h-12 rounded-2xl text-base font-semibold" onClick={handleConfirm}>
              Conferma e paga
            </Button>
            <button
              onClick={handleCancel}
              className="mt-3 text-sm text-muted-foreground hover:text-foreground"
            >
              Annulla
            </button>
          </div>
        )}

        {/* Waitlist */}
        {phase === "waitlist" && (
          <div className="p-8 text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-5">
              <Clock className="w-12 h-12 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold mb-1">
              {existingWaitlist ? "Sei già in coda" : "Nessuno slot libero"}
            </h2>
            {existingWaitlist ? (
              <>
                <p className="text-muted-foreground mb-4">
                  La tua prenotazione per <strong>{serviceName}</strong> è attiva. Ti assegneremo automaticamente
                  il primo posto disponibile.
                </p>
                <ul className="text-left text-sm text-muted-foreground space-y-2 mb-5 bg-muted/40 rounded-2xl p-4">
                  <li>• In coda dal {new Date(existingWaitlist.created_at).toLocaleDateString("it-IT")}</li>
                  <li>• Valida fino al {new Date(existingWaitlist.expires_at).toLocaleDateString("it-IT")}</li>
                  <li>• Addebito solo al momento dell'assegnazione</li>
                </ul>
                {queue && <QueueInfoBox queue={queue} serviceName={serviceName} confirmed />}
                <Button className="w-full h-12 rounded-2xl text-base font-semibold" onClick={onClose}>
                  Ho capito
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-4">
                  Tutti i gruppi <strong>{serviceName}</strong> sono pieni. Entra nella <strong>Coda Prioritaria</strong>:
                  ti assegneremo automaticamente il primo posto disponibile.
                </p>
                <ul className="text-left text-sm text-muted-foreground space-y-2 mb-5 bg-muted/40 rounded-2xl p-4">
                  <li>• Pre-autorizzazione di €{(preauthAmountCents / 100).toFixed(2)}/mese (commissione di servizio €{(JOIN_FEE_CENTS / 100).toFixed(2)} inclusa)</li>
                  <li>• Nessun addebito immediato</li>
                  <li>• Validità fino a 7 giorni</li>
                  <li>• Addebito solo quando ti assegniamo il posto</li>
                </ul>
                {queue && <QueueInfoBox queue={queue} serviceName={serviceName} confirmed={false} />}
                <Button
                  className="w-full h-12 rounded-2xl text-base font-semibold"
                  onClick={handleJoinWaitlist}
                  disabled={waitlistBusy}
                >
                  {waitlistBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : "Pre-autorizza e entra in coda"}
                </Button>
                <button onClick={onClose} className="mt-3 text-sm text-muted-foreground hover:text-foreground">
                  No grazie
                </button>
              </>
            )}
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="p-8 text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-5">
              <X className="w-12 h-12 text-red-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">Ops!</h2>
            <p className="text-muted-foreground mb-5">{error}</p>
            <Button className="w-full h-12 rounded-2xl" variant="secondary" onClick={onClose}>
              Chiudi
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
