import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Repeat, Loader2, Info, CalendarClock } from "lucide-react";
import { toast } from "sonner";

interface AutoPayoutCardProps {
  userId?: string | null;
  isVerified: boolean;
}

export default function AutoPayoutCard({ userId, isVerified }: AutoPayoutCardProps) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await (supabase as any)
        .from("user_profiles")
        .select("auto_payout_enabled")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) setEnabled(!!data.auto_payout_enabled);
      setLoading(false);
    })();
  }, [userId]);

  const handleToggle = async (value: boolean) => {
    if (!userId) return;
    if (value && !isVerified) {
      toast.error("Completa prima la verifica Stripe: serve un IBAN attivo per il bonifico automatico.");
      return;
    }
    setEnabled(value);
    setSaving(true);
    const { error } = await (supabase as any)
      .from("user_profiles")
      .upsert({ user_id: userId, auto_payout_enabled: value }, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      setEnabled(!value);
      toast.error("Impossibile salvare la preferenza. Riprova.");
      return;
    }
    toast.success(value ? "Bonifico automatico attivato" : "Bonifico automatico disattivato");
  };

  return (
    <Card className="rounded-2xl border-2 border-primary/15 overflow-hidden mb-8">
      <div className="p-5 lg:p-6 flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Repeat className="w-6 h-6 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-base">Bonifico bancario automatico</h3>
            {enabled ? (
              <Badge className="bg-green-600 text-white text-[10px]">Attivo</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">Disattivo</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Il <strong>28 di ogni mese</strong> ti inviamo automaticamente sull'IBAN collegato{" "}
            <strong>tutto il saldo disponibile</strong> del tuo portafoglio. Non devi più tornare sul sito
            per prelevare.
          </p>

          <div className="mt-4 flex items-center gap-3">
            {loading || saving ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : null}
            <Switch checked={enabled} onCheckedChange={handleToggle} disabled={loading || saving} />
            <span className="text-sm font-medium">{enabled ? "Attivo" : "Disattivo"}</span>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/60">
              <CalendarClock className="w-4 h-4 text-muted-foreground shrink-0 mt-[2px]" />
              <p className="text-xs text-muted-foreground leading-snug">
                <strong>Data fissa di accredito:</strong> il bonifico viene elaborato il 28 di ogni mese.
              </p>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/60">
              <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-[2px]" />
              <p className="text-xs text-muted-foreground leading-snug">
                <strong>Cosa viene trasferito:</strong> l'intero saldo che in quella data risulta
                "disponibile", cioè le quote dei tuoi Joiner per cui sono già passati i 25 giorni di tutela.
                Il bonifico arriva sull'IBAN in 1-2 giorni lavorativi e trovi ogni operazione nello storico
                qui sotto.
                {!isVerified && " Attiva la verifica Stripe per poter usare questa funzione."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
