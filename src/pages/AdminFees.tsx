import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { Navigate } from "react-router-dom";
import { stripeApi } from "@/lib/stripeApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Banknote, Settings } from "lucide-react";
import { toast } from "sonner";

interface Cfg {
  joiner_fee_cents: string;
  admin_payout_fee_percent: string;
  min_payout_cents: string;
  hold_days: string;
  dunning_max_attempts: string;
  platform_fee_percent: string;
}

const empty: Cfg = {
  joiner_fee_cents: "99",
  admin_payout_fee_percent: "0",
  min_payout_cents: "1000",
  hold_days: "25",
  dunning_max_attempts: "3",
  platform_fee_percent: "0",
};

export default function AdminFees() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payingOut, setPayingOut] = useState(false);
  const [cfg, setCfg] = useState<Cfg>(empty);
  const [platformAcc, setPlatformAcc] = useState(0);
  const [forbidden, setForbidden] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");

  useEffect(() => {
    if (!user?.email) return;
    (async () => {
      const res = await stripeApi("admin-config-read", { actorEmail: user.email });
      if (res.status === 403) { setForbidden(true); setLoading(false); return; }
      if (res.ok) {
        const merged = { ...empty } as any;
        for (const k of Object.keys(empty)) if (res.data.config?.[k]) merged[k] = res.data.config[k];
        setCfg(merged);
        setPlatformAcc(res.data.platform_fees_accumulated_eur || 0);
      }
      setLoading(false);
    })();
  }, [user?.email]);

  if (!user) return <Navigate to="/Auth" replace />;
  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  if (forbidden) {
    return (
      <div className="p-10 max-w-2xl mx-auto">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Accesso negato</h2>
          <p className="text-muted-foreground">Solo gli amministratori DivideIt possono accedere. Chiedi di essere aggiunto in <code>config.admin_emails</code>.</p>
        </Card>
      </div>
    );
  }

  const save = async () => {
    if (!user?.email) return;
    setSaving(true);
    const res = await stripeApi("admin-config-write", { actorEmail: user.email, updates: cfg });
    if (res.ok) toast.success("Configurazione salvata");
    else toast.error(res.data?.error || "Errore");
    setSaving(false);
  };

  const platformPayout = async () => {
    if (!user?.email) return;
    const amountEur = parseFloat(payoutAmount);
    if (!amountEur || amountEur <= 0) { toast.error("Importo non valido"); return; }
    setPayingOut(true);
    const res = await stripeApi("admin-platform-payout", { actorEmail: user.email, amountCents: Math.round(amountEur * 100) });
    if (res.ok && res.data.success) {
      toast.success(`Payout fee piattaforma avviato: €${amountEur.toFixed(2)}`);
      setPayoutAmount("");
    } else {
      toast.error(res.data?.error || "Errore");
    }
    setPayingOut(false);
  };

  const upd = (k: keyof Cfg, v: string) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="p-4 lg:p-10 pb-24 lg:pb-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-2 flex items-center gap-3"><Settings className="w-8 h-8 text-primary" /> Admin · Fee & Configurazione</h1>
          <p className="text-muted-foreground">Modifica le commissioni di servizio applicate a tutta la piattaforma.</p>
        </div>

        <Card className="p-6 rounded-2xl">
          <h2 className="font-bold text-lg mb-4">Commissioni</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Fee Joiner (centesimi, per transazione)</Label>
              <Input type="number" value={cfg.joiner_fee_cents} onChange={e => upd("joiner_fee_cents", e.target.value)} />
              <p className="text-xs text-muted-foreground">Sommata al costo quota. 99 = €0,99</p>
            </div>
            <div className="space-y-2">
              <Label>Fee Admin payout (percentuale 0-100)</Label>
              <Input type="number" step="0.01" value={cfg.admin_payout_fee_percent} onChange={e => upd("admin_payout_fee_percent", e.target.value)} />
              <p className="text-xs text-muted-foreground">Trattenuta sul prelievo dell'admin. 0 = niente.</p>
            </div>
            <div className="space-y-2">
              <Label>Soglia minima prelievo (centesimi)</Label>
              <Input type="number" value={cfg.min_payout_cents} onChange={e => upd("min_payout_cents", e.target.value)} />
              <p className="text-xs text-muted-foreground">1000 = €10,00</p>
            </div>
            <div className="space-y-2">
              <Label>Hold days (anti-rimborso)</Label>
              <Input type="number" value={cfg.hold_days} onChange={e => upd("hold_days", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tentativi dunning</Label>
              <Input type="number" value={cfg.dunning_max_attempts} onChange={e => upd("dunning_max_attempts", e.target.value)} />
              <p className="text-xs text-muted-foreground">Tentativi pagamento prima di rimuovere il Joiner.</p>
            </div>
            <div className="space-y-2">
              <Label>Fee piattaforma % (legacy)</Label>
              <Input type="number" step="0.01" value={cfg.platform_fee_percent} onChange={e => upd("platform_fee_percent", e.target.value)} />
              <p className="text-xs text-muted-foreground">Compatibilità calcolo precedente.</p>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={save} disabled={saving} className="gradient-divideit text-white rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salva configurazione
            </Button>
          </div>
        </Card>

        <Card className="p-6 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10">
          <h2 className="font-bold text-lg mb-2 flex items-center gap-2"><Banknote className="w-5 h-5" /> Fee piattaforma accumulate</h2>
          <p className="text-4xl font-extrabold mb-2">€{platformAcc.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground mb-4">
            Somma dei <code>platform_fee</code> di tutti i wallet_ledger. Restano sul tuo account Stripe principale e puoi prelevarle quando vuoi.
          </p>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="space-y-2 flex-1 min-w-[200px]">
              <Label>Importo da prelevare (€)</Label>
              <Input type="number" step="0.01" placeholder="50.00" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} />
            </div>
            <Button onClick={platformPayout} disabled={payingOut} className="rounded-xl">
              {payingOut ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Banknote className="w-4 h-4 mr-2" />}
              Preleva fee sul mio IBAN
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Il payout esce dal saldo del tuo account Stripe principale verso l'IBAN configurato in Stripe Dashboard.
          </p>
        </Card>
      </div>
    </div>
  );
}
