import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Gift, PartyPopper, Sparkles, Users } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EuroCoin } from "@/components/euro-coin";
import { useAuth } from "@/components/AuthContext";
import {
  getMyInviter,
  REFERRAL_WELCOME_EVENT,
  WELCOME_KEY,
  type MyInviter,
} from "@/lib/referral";

/**
 * Schermata di benvenuto mostrata una sola volta all'utente che si è
 * registrato tramite un link di invito valido.
 */
export default function ReferralWelcome() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [inviter, setInviter] = useState<MyInviter | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const showWelcome = (event?: Event) => {
      let pending: string | null = null;
      try {
        const detail = (event as CustomEvent<{ code?: string }> | undefined)?.detail;
        pending = detail?.code ?? localStorage.getItem(WELCOME_KEY);
      } catch {
        pending = null;
      }
      if (!pending) return;
      setCode(pending);
      setOpen(true);
      void getMyInviter().then((info) => info && setInviter(info));
    };

    showWelcome();
    window.addEventListener(REFERRAL_WELCOME_EVENT, showWelcome);
    return () => window.removeEventListener(REFERRAL_WELCOME_EVENT, showWelcome);
  }, [user?.uid]);

  const close = () => {
    try {
      localStorage.removeItem(WELCOME_KEY);
    } catch {
      /* noop */
    }
    setOpen(false);
  };

  const firstName = (user?.full_name || user?.email?.split("@")[0] || "").split(" ")[0];

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? close() : setOpen(v))}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-[calc(100vw-32px)] overflow-hidden rounded-3xl border-border/60 p-0 sm:max-w-md">
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary-soft/70 via-background to-background" />
          <div className="relative px-6 pb-6 pt-9 text-center">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl gradient-divideit shadow-floating"
            >
              <PartyPopper className="h-8 w-8 text-white" />
            </motion.div>

            <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary-strong" /> Benvenuto su DIVIDEIT
            </span>

            <h2 className="mt-3 text-balance text-2xl font-black leading-tight tracking-tight sm:text-3xl">
              {firstName ? `Ciao ${firstName},` : "Ciao,"} il tuo account è{" "}
              <span className="text-gradient-divideit">attivo</span>
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Da oggi dividi i tuoi abbonamenti preferiti e paghi solo la tua parte.
            </p>

            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="mt-6 flex items-center gap-3 rounded-2xl border border-border/60 bg-card/95 p-4 text-left shadow-sm"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft">
                <Users className="h-5 w-5 text-primary-strong" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">
                  Hai usato il codice invito{" "}
                  <span className="text-primary-strong">
                    {inviter?.referral_code ?? code ?? "—"}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {inviter?.referrer_name
                    ? `Ti ha invitato ${inviter.referrer_name}`
                    : "Invito di un amico registrato correttamente"}
                </p>
              </div>
            </motion.div>

            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border/60 bg-card/95 p-4 text-left shadow-sm">
              <EuroCoin size={44} asLink={false} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Il tuo amico riceve 1,00 €</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Il bonus gli arriva quando entri nel tuo primo gruppo.
                </p>
              </div>
              <Gift className="h-5 w-5 shrink-0 text-primary-strong" />
            </div>

            <Button
              onClick={close}
              className="mt-6 h-12 w-full rounded-xl gradient-divideit text-base font-bold text-white"
            >
              Inizia a risparmiare
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
