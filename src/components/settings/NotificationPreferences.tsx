import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Mail, Smartphone, Megaphone, Users, CreditCard, MessageCircle, Loader2 } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";

export default function NotificationPreferences() {
  const { profile, loading, update } = useUserProfile();

  if (loading || !profile) {
    return <Card className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></Card>;
  }

  const toggle = async (key: keyof typeof profile, val: boolean) => {
    await update({ [key]: val } as any);
    toast.success("Preferenza aggiornata");
  };

  const Row = ({ icon: Icon, title, desc, k }: any) => (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <Label className="font-semibold">{title}</Label>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch checked={!!(profile as any)[k]} onCheckedChange={(v) => toggle(k, v)} />
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-2 flex items-center gap-2"><Bell className="w-5 h-5" /> Canali</h3>
        <p className="text-sm text-muted-foreground mb-2">Scegli dove vuoi ricevere le notifiche.</p>
        <div className="divide-y">
          <Row icon={Mail} title="Email" desc="Aggiornamenti importanti via email" k="notify_email" />
          <Row icon={Smartphone} title="Push" desc="Notifiche in tempo reale nel browser" k="notify_push" />
          <Row icon={Megaphone} title="Marketing" desc="Novità, offerte e suggerimenti" k="notify_marketing" />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-xl font-bold mb-2">Eventi</h3>
        <p className="text-sm text-muted-foreground mb-2">Quali eventi devono generare una notifica.</p>
        <div className="divide-y">
          <Row icon={Users} title="Nuovi membri" desc="Quando qualcuno entra o esce da un tuo gruppo" k="notify_new_member" />
          <Row icon={CreditCard} title="Pagamenti" desc="Conferme di pagamento, prelievi, accrediti" k="notify_payment" />
          <Row icon={MessageCircle} title="Chat" desc="Nuovi messaggi nelle chat di gruppo" k="notify_chat" />
        </div>
      </Card>
    </div>
  );
}
