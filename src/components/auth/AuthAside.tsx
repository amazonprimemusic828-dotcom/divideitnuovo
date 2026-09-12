import { useId, useState } from "react";
import { ArrowLeft, Pause, Play, ShieldCheck, UsersRound } from "lucide-react";
import Brand from "@/components/Brand";
import UserAvatar from "@/components/UserAvatar";
import { MemberAvatars } from "@/components/dashboard/SubscriptionTile";
import { CategorySymbol } from "@/components/logos/subscription-logos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { ServiceCategory } from "@/lib/serviceConstants";

const passions: { category: ServiceCategory; label: string }[] = [
  { category: "video", label: "Le tue serie" },
  { category: "music", label: "La tua musica" },
  { category: "gaming", label: "I tuoi giochi" },
  { category: "reading", label: "Le tue letture" },
];
const members = [
  { avatar: "luca", label: "Tu" },
  { avatar: "sofia", label: "Sofia" },
  { avatar: "andrea", label: "Andrea" },
  { avatar: "giulia", label: "Giulia" },
];

function PassionCards({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <ul className={duplicate ? "auth-category-set auth-category-copy" : "auth-category-set"} aria-hidden={duplicate || undefined}>
      {passions.map(({ category, label }) => <li key={category}><CategorySymbol category={category} size={34} decorative /><span>{label}</span></li>)}
    </ul>
  );
}

export default function AuthAside() {
  const [paused, setPaused] = useState(false);
  const captionId = useId();
  const trackId = useId();
  return (
    <aside className="auth-aside" data-paused={paused}>
      <Brand inverse />
      <div className="auth-tablet-content">
        <p className="pb-5 text-sm font-medium uppercase tracking-widest opacity-70">Le tue passioni, condivise.</p>
        <h2 className="font-display text-5xl font-semibold leading-[1.14] tracking-tight text-balance">Meno spese.<br />Più cose<br />che ami.</h2>
        <p className="max-w-sm pt-6 text-base leading-relaxed opacity-80">Un solo spazio per i tuoi abbonamenti e le persone con cui condividerli.</p>
        <div className="auth-photo"><img src="/images/together.png" alt="Amici che si godono il tempo insieme" width={1024} height={1024} /></div>
        <div className="flex items-center gap-4 pt-6"><MemberAvatars names={["sofia", "andrea", "giulia"]} /><span className="text-sm">Le cose belle iniziano insieme.</span></div>
      </div>
      <div className="auth-desktop-content">
        <div className="auth-desktop-copy">
          <p>Le tue passioni, condivise.</p>
          <h2 className="font-display text-balance">Meno spese.<br />Più cose che ami.</h2>
        </div>
        <figure className="auth-sharing-scene" aria-describedby={captionId}>
          <Card className="auth-expense-card">
            <CardHeader className="px-5 pb-0 pt-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3"><CategorySymbol category="bundle" size={40} decorative /><div><CardTitle>Una spesa condivisa.</CardTitle><CardDescription>Il tuo gruppo, ogni mese.</CardDescription></div></div>
                <Badge variant="secondary">Esempio</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="auth-split-summary">
                <div><p className="text-sm text-muted-foreground">La tua parte</p><p className="auth-share-amount font-display">6,00 €</p></div>
                <div className="auth-split-direction"><ArrowLeft className="size-5" aria-hidden="true" /><span>diviso 4</span></div>
                <div className="text-right"><p className="text-sm text-muted-foreground">Spesa totale</p><p className="auth-total-amount font-display">24,00 €</p></div>
              </div>
              <div className="auth-share-members" aria-label="Quattro partecipanti illustrativi">
                {members.map(({ avatar, label }) => <div className="auth-share-person" key={avatar}><span className="auth-share-avatar" aria-hidden="true"><UserAvatar userEmail="" userName={label} avatarUrl={`/avatars/premium/${avatar}.png`} size="sm" /></span><span>{label}</span></div>)}
              </div>
            </CardContent>
            <CardFooter className="auth-expense-footer"><UsersRound className="size-4" aria-hidden="true" /><p>Stessa passione. Ognuno fa la sua parte.</p></CardFooter>
          </Card>
          <figcaption id={captionId}>Esempio illustrativo, commissioni escluse. Nessun pagamento effettuato né risparmio garantito.</figcaption>
        </figure>
        <div className="auth-category-rail" aria-label="Passioni da condividere">
          <div id={trackId} className="auth-category-track"><PassionCards /><PassionCards duplicate /></div>
        </div>
      </div>
      <div className="auth-aside-bottom">
        <p className="auth-tablet-footer flex items-center gap-2 text-sm opacity-75"><ShieldCheck className="size-4" />Il tuo spazio. La tua tranquillità.</p>
        <p className="auth-desktop-footer"><UsersRound className="size-4" aria-hidden="true" />Più bello, insieme.</p>
        <Button variant="inverse" size="sm" className="auth-motion-control" aria-controls={trackId} aria-label={paused ? "Riprendi le animazioni" : "Metti in pausa le animazioni"} onClick={() => setPaused((value) => !value)}>
          {paused ? <Play data-icon="inline-start" aria-hidden="true" /> : <Pause data-icon="inline-start" aria-hidden="true" />}{paused ? "Riprendi" : "Pausa"}
        </Button>
        <span className="auth-static-note">Animazioni ridotte</span>
      </div>
    </aside>
  );
}
