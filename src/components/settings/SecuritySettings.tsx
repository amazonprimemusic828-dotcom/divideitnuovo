import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ShieldAlert, LogOut, KeyRound, Smartphone, Loader2, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { useUserProfile } from "@/hooks/useUserProfile";
import PhoneVerificationDialog from "@/components/PhoneVerificationDialog";
import { supabase } from "@/integrations/supabase/client";



export default function SecuritySettings() {
  const { profile, loading, reload } = useUserProfile();
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [pwd, setPwd] = useState({ now: "", next: "", confirm: "" });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);


  const changePassword = async () => {
    if (pwd.next.length < 8) { toast.error("La nuova password deve avere almeno 8 caratteri"); return; }
    if (pwd.next !== pwd.confirm) { toast.error("Le password non corrispondono"); return; }
    setPwdLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd.next });
    setPwdLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Password aggiornata"); setPwd({ now: "", next: "", confirm: "" }); }
  };

  const signOutAll = async () => {
    setLogoutLoading(true);
    await supabase.auth.signOut({ scope: "global" });
    setLogoutLoading(false);
    toast.success("Disconnesso da tutti i dispositivi");
    window.location.href = "/";
  };

  if (loading || !profile) {
    return <Card className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></Card>;
  }

  const phoneVerified = !!profile.phone_verified_at;

  return (
    <div className="space-y-6">
      {/* Dati di prelievo (Stripe Connect) */}
      <Card className="p-6 rounded-2xl border-border/60">
        <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
          <BadgeCheck className="w-5 h-5" /> Dati di prelievo e IBAN
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Completa i dati di pagamento e inserisci il tuo IBAN per ricevere i prelievi: sblocchi +15 PT di affidabilità.
        </p>
        <Button asChild className="gradient-divideit text-white rounded-xl">
          <a href="/Wallet">Gestisci prelievi</a>
        </Button>
      </Card>




      {/* Phone */}
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Smartphone className="w-5 h-5" /> Numero di telefono</h3>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {phoneVerified ? <ShieldCheck className="w-5 h-5 text-green-600" /> : <ShieldAlert className="w-5 h-5 text-orange-500" />}
            <div>
              <p className="font-semibold">{profile.phone_e164 || "Nessun numero collegato"}</p>
              <p className="text-xs text-muted-foreground">
                {phoneVerified ? `Verificato il ${new Date(profile.phone_verified_at!).toLocaleDateString("it-IT")}` : "Non verificato"}
              </p>
            </div>
          </div>
          <Button variant={phoneVerified ? "outline" : "default"} className={phoneVerified ? "" : "gradient-divideit text-white"} onClick={() => setPhoneOpen(true)}>
            {phoneVerified ? "Cambia numero" : "Verifica ora"}
          </Button>
        </div>
      </Card>

      {/* Password */}
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><KeyRound className="w-5 h-5" /> Cambia password</h3>
        <div className="grid gap-3 sm:max-w-md">
          <div>
            <Label>Nuova password</Label>
            <Input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} className="mt-2" />
          </div>
          <div>
            <Label>Conferma nuova password</Label>
            <Input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} className="mt-2" />
          </div>
          <Button onClick={changePassword} disabled={pwdLoading} className="w-fit gradient-divideit text-white">
            {pwdLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Aggiorna password
          </Button>
          <p className="text-xs text-muted-foreground">Funziona solo per account email/password. Per gli account Google modifica la password dal tuo account Google.</p>
        </div>
      </Card>

      {/* Sessions */}
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-2 flex items-center gap-2"><LogOut className="w-5 h-5" /> Sessioni</h3>
        <p className="text-sm text-muted-foreground mb-4">Termina tutte le sessioni attive su tutti i dispositivi.</p>
        <Button variant="destructive" onClick={signOutAll} disabled={logoutLoading}>
          {logoutLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Disconnetti tutti i dispositivi
        </Button>
      </Card>

      <PhoneVerificationDialog open={phoneOpen} onOpenChange={setPhoneOpen} onVerified={reload} />
    </div>
  );
}
