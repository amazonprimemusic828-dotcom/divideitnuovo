import React from "react";
import { Lock, Clock, KeyRound, ShieldAlert, Scale, Globe } from "lucide-react";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";

const pillars = [
  {
    icon: Lock,
    title: "Pagamenti su rotaie Stripe",
    body: "Non tocchiamo mai i dati della tua carta. Ogni movimento è tracciato e riconciliato da Stripe Connect.",
  },
  {
    icon: Clock,
    title: "Hold di 25 giorni",
    body: "La quota resta bloccata finché l'accesso non è confermato funzionante. L'admin incassa dopo, non prima.",
  },
  {
    icon: KeyRound,
    title: "Vault credenziali cifrato",
    body: "Le credenziali del servizio vivono in un vault cifrato, visibili solo ai membri paganti del gruppo.",
  },
  {
    icon: ShieldAlert,
    title: "Trust score pubblico",
    body: "Ogni utente porta con sé uno storico di pagamenti. I profili inaffidabili vengono esclusi automaticamente.",
  },
  {
    icon: Scale,
    title: "Regole chiare, scritte",
    body: "Termini, commissioni e politica di rimborso sono pubblici e non cambiano a gruppo avviato.",
  },
  {
    icon: Globe,
    title: "Quattro lingue",
    body: "Italiano, inglese, spagnolo e francese, con supporto umano nella lingua in cui scrivi.",
  },
];

const numbers = [
  { value: "€187", label: "Risparmio medio annuo per utente" },
  { value: "12.400", label: "Gruppi attivi sulla piattaforma" },
  { value: "99,2%", label: "Pagamenti completati senza dispute" },
  { value: "4,9/5", label: "Valutazione media su 2.400 recensioni" },
];

export default function SecuritySection() {
  return (
    <section id="sicurezza" className="hairline py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* Numeri: filetti, non card */}
        <RevealGroup className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-4">
          {numbers.map((n) => (
            <RevealItem key={n.label} className="bg-surface-elevated px-5 py-7 lg:px-7 lg:py-9">
              <p className="tnum font-display text-3xl font-extrabold tracking-[-0.03em] text-foreground lg:text-4xl">
                {n.value}
              </p>
              <p className="mt-2 text-[13px] leading-snug text-muted-foreground">{n.label}</p>
            </RevealItem>
          ))}
        </RevealGroup>

        <div className="mt-24 grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <Reveal>
            <div className="lg:sticky lg:top-28">
              <span className="eyebrow">Sicurezza</span>
              <h2 className="display-lg mt-5 text-foreground text-balance">
                Il rischio di dividere un abbonamento è il pagamento. Ce ne occupiamo noi.
              </h2>
              <p className="mt-6 text-[17px] leading-relaxed text-muted-foreground">
                Il problema di condividere un abbonamento non è mai il prezzo: è fidarsi di uno
                sconosciuto. Abbiamo costruito la piattaforma intorno a quella singola frizione.
              </p>
            </div>
          </Reveal>

          <RevealGroup className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {pillars.map((p) => {
              const Icon = p.icon;
              return (
                <RevealItem key={p.title} className="group">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-elevated transition-colors duration-300 group-hover:border-primary/40 group-hover:bg-primary-soft">
                    <Icon className="h-5 w-5 text-primary" />
                  </span>
                  <h3 className="mt-5 font-display text-[17px] font-bold tracking-[-0.02em] text-foreground">
                    {p.title}
                  </h3>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{p.body}</p>
                </RevealItem>
              );
            })}
          </RevealGroup>
        </div>
      </div>
    </section>
  );
}
