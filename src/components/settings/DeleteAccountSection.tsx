import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, ShieldAlert, Clock, CheckCircle2, XCircle, Ban } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  cancelAccountDeletion,
  getDeletionEligibility,
  getMyDeletionRequest,
  requestAccountDeletion,
  type DeletionEligibility,
  type DeletionRequest,
} from "@/lib/accountDeletion";

export default function DeleteAccountSection() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [request, setRequest] = useState<DeletionRequest | null>(null);
  const [elig, setElig] = useState<DeletionEligibility | null>(null);

  const load = async () => {
    setLoading(true);
    const [req, el] = await Promise.all([getMyDeletionRequest(), getDeletionEligibility()]);
    setRequest(req);
    setElig(el);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async () => {
    setBusy(true);
    const res = await requestAccountDeletion(reason);
    setBusy(false);
    setOpen(false);
    if (res === "deleted") {
      toast.success("Account eliminato. Verrai disconnesso.");
      setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.href = "/";
      }, 1500);
    } else if (res === "blocked") {
      toast.error("Non puoi eliminare l'account: hai gruppi attivi o saldo disponibile.");
      void load();
    } else if (res === "ok") {
      setReason("");
      toast.success("Richiesta inviata al nostro team. Riceverai una notifica con l'esito.");
      void load();
    } else if (res === "exists") {
      toast.info("Hai già una richiesta in attesa di approvazione.");
      void load();
    } else {
      toast.error("Impossibile inviare la richiesta. Riprova.");
    }
  };

  const cancel = async () => {
    setBusy(true);
    const ok = await cancelAccountDeletion();
    setBusy(false);
    if (ok) {
      toast.success("Richiesta annullata.");
      void load();
    } else {
      toast.error("Impossibile annullare la richiesta.");
    }
  };

  const pending = request?.status === "pending";
  const approved = request?.status === "approved";
  const rejected = request?.status === "rejected";
  const blocked = elig ? !elig.eligible : false;
  const eur = (c: number) => (c / 100).toFixed(2);


  return (
    <Card className="p-6 border-destructive/30">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
          <Trash2 className="w-5 h-5 text-destructive" />
        </div>
        <div>
          <h2 className="font-bold text-lg">Elimina account</h2>
          <p className="text-sm text-muted-foreground">
            Chiudi definitivamente il tuo account su DivideIt.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground space-y-2">
        <p className="flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
          <span>
            Puoi eliminare l'account solo se non gestisci gruppi attivi, non partecipi a gruppi
            attivi e non hai denaro nel portafoglio (disponibile o in attesa di svincolo).
            Se non hai nulla in sospeso, l'account viene eliminato subito, senza approvazione.
          </span>
        </p>
        <p>
          I dati non vengono cancellati subito: per obblighi di legge (fatturazione, pagamenti,
          antifrode) alcune informazioni restano conservate per il periodo di conservazione previsto,
          al termine del quale vengono eliminate definitivamente.
        </p>
      </div>

      {loading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : pending ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge className="bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3 mr-1" /> Richiesta in attesa di approvazione
          </Badge>
          <Button variant="outline" className="rounded-xl" disabled={busy} onClick={cancel}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Annulla richiesta
          </Button>
        </div>
      ) : approved ? (
        <div className="mt-4">
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Account eliminato
          </Badge>
        </div>
      ) : blocked ? (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
          <p className="flex items-center gap-2 font-semibold text-destructive text-sm">
            <Ban className="w-4 h-4" /> Non puoi eliminare l'account adesso
          </p>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            {!!elig?.owned_groups && (
              <li>Gestisci {elig.owned_groups} gruppo/i attivo/i: chiudili prima di procedere.</li>
            )}
            {!!elig?.joined_groups && (
              <li>Partecipi a {elig.joined_groups} gruppo/i attivo/i: esci prima di procedere.</li>
            )}
            {!!elig?.balance_cents && (
              <li>Hai {eur(elig.balance_cents)} € disponibili nel portafoglio: ritirali prima di procedere.</li>
            )}
            {!!elig?.hold_cents && (
              <li>Hai {eur(elig.hold_cents)} € in attesa di svincolo: attendi il rilascio.</li>
            )}
          </ul>
          <Button variant="outline" className="rounded-xl" onClick={() => void load()}>
            Ricontrolla
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {rejected && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <XCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
              <span>
                La richiesta precedente è stata respinta.
                {request?.operator_note ? ` Nota: ${request.operator_note}` : ""}
              </span>
            </div>
          )}
          <div>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo dell'eliminazione (facoltativo)"
              className="rounded-xl"
              rows={3}
            />
          </div>
          <Button variant="destructive" className="rounded-xl" onClick={() => setOpen(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Elimina account
          </Button>
        </div>
      )}


      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confermi l'eliminazione dell'account?</AlertDialogTitle>
            <AlertDialogDescription>
              L'account verrà eliminato subito e non potrai più accedere. Alcuni dati resteranno
              conservati per il tempo richiesto dalla legge e poi verranno eliminati definitivamente.
            </AlertDialogDescription>

          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void submit();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Elimina definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
