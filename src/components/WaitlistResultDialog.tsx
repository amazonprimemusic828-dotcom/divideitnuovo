import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, ShieldCheck, Clock, CreditCard, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * Shows a professional confirmation after the Stripe pre-authorization
 * checkout for the Priority Queue (?waitlist=ok | ?waitlist=cancel).
 */
export default function WaitlistResultDialog() {
  const [params, setParams] = useSearchParams();
  const status = params.get("waitlist");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (status === "ok" || status === "cancel") setOpen(true);
  }, [status]);

  const close = () => {
    setOpen(false);
    const next = new URLSearchParams(params);
    next.delete("waitlist");
    setParams(next, { replace: true });
  };

  if (status !== "ok" && status !== "cancel") return null;

  const success = status === "ok";

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader className="items-center text-center">
          <div
            className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-2 ${
              success ? "bg-primary/10" : "bg-destructive/10"
            }`}
          >
            {success ? (
              <CheckCircle2 className="w-9 h-9 text-primary" />
            ) : (
              <XCircle className="w-9 h-9 text-destructive" />
            )}
          </div>
          <DialogTitle className="text-2xl">
            {success ? "Preautorizzazione confermata" : "Preautorizzazione annullata"}
          </DialogTitle>
          <DialogDescription>
            {success
              ? "Sei ufficialmente nella Coda Prioritaria. Nessun importo è stato addebitato."
              : "Non sei entrato in coda e non è stato bloccato nessun importo sulla tua carta."}
          </DialogDescription>
        </DialogHeader>

        {success && (
          <ul className="space-y-3 text-sm text-muted-foreground bg-muted/40 rounded-2xl p-4">
            <li className="flex gap-3">
              <ShieldCheck className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span>
                L'importo è solo <strong className="text-foreground">bloccato</strong> sulla carta:
                verrà addebitato esclusivamente quando ti assegneremo un posto.
              </span>
            </li>
            <li className="flex gap-3">
              <Clock className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span>
                Validità fino a <strong className="text-foreground">7 giorni</strong>. Se non
                troviamo un posto, il blocco viene rilasciato automaticamente senza costi.
              </span>
            </li>
            <li className="flex gap-3">
              <CreditCard className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span>
                Appena si libera un posto — o viene creato un nuovo gruppo per lo stesso servizio —
                ti aggiungiamo <strong className="text-foreground">automaticamente</strong> e ricevi
                una notifica.
              </span>
            </li>
          </ul>
        )}

        <Button className="w-full h-12 rounded-2xl mt-2" onClick={close}>
          Ho capito
        </Button>
      </DialogContent>
    </Dialog>
  );
}
