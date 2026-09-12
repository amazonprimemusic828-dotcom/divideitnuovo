import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  membershipId: string;
  /** Next renewal date (ISO) if known */
  renewsAt?: string | null;
  costPerMonth?: number | null;
}

export default function AutoRenewCard({ membershipId, renewsAt, costPerMonth }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("memberships")
        .select("auto_renew")
        .eq("id", membershipId)
        .maybeSingle();
      if (active) setEnabled(((data as any)?.auto_renew ?? true) as boolean);
    })();
    return () => { active = false; };
  }, [membershipId]);

  const toggle = async (value: boolean) => {
    const prev = enabled;
    setEnabled(value);
    setSaving(true);
    const { error } = await (supabase as any).rpc("set_membership_auto_renew", {
      _membership_id: membershipId,
      _value: value,
    });
    setSaving(false);
    if (error) {
      setEnabled(prev);
      toast.error("Impossibile aggiornare il rinnovo automatico");
      return;
    }
    toast.success(value ? "Rinnovo automatico attivo" : "Rinnovo automatico disattivato");
  };

  return (
    <Card className="p-5 rounded-2xl border-border/60">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <RefreshCw className={`w-5 h-5 text-primary ${saving ? "animate-spin" : ""}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold leading-tight">Rinnovo automatico mensile</h4>
              {enabled !== null && (
                <Badge
                  variant="outline"
                  className={enabled ? "border-0 bg-primary/15 text-primary" : "border-0 bg-muted text-muted-foreground"}
                >
                  {enabled ? "Attivo" : "Disattivato"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {enabled
                ? `La tua quota${costPerMonth ? ` di €${Number(costPerMonth).toFixed(2)}` : ""} viene addebitata ogni mese${
                    renewsAt ? `, prossimo rinnovo il ${new Date(renewsAt).toLocaleDateString("it-IT")}` : ""
                  }. Puoi disattivarlo quando vuoi.`
                : "Il tuo posto nel gruppo terminerà alla fine del periodo già pagato."}
            </p>
          </div>
        </div>
        {enabled === null ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mt-2" />
        ) : (
          <Switch checked={enabled} onCheckedChange={toggle} disabled={saving} />
        )}
      </div>
    </Card>
  );
}
