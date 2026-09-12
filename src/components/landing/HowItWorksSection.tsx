import React from "react";
import { Search, BadgeCheck, CreditCard } from "lucide-react";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";

const steps = [
  {
    icon: Search,
    title: "Trova o crea il gruppo",
    body: "Cerca tra i gruppi aperti per il servizio che ti interessa, oppure aprine uno tuo e decidi quanti posti mettere a disposizione.",
    meta: "≈ 40 secondi",
  },
  {
    icon: BadgeCheck,
    title: "Verifica la tua identità",
    body: "Un codice SMS conferma che sei una persona reale. Il trust score cresce con ogni pagamento puntuale e resta visibile agli altri membri.",
    meta: "Una sola volta",
  },
  {
    icon: CreditCard,
    title: "Paga e ricevi le credenziali",
    body: "Stripe trattiene la quota per 25 giorni. L'admin viene pagato solo se l'accesso funziona: se qualcosa va storto, vieni rimborsato.",
    meta: "Rimborso garantito",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="come-funziona" className="hairline bg-surface-muted/40 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <div className="max-w-2xl">
            <span className="eyebrow">Il flusso</span>
            <h2 className="display-lg mt-5 text-foreground text-balance">
              Tre passaggi, nessuna
              <br />
              conversazione imbarazzante.
            </h2>
          </div>
        </Reveal>

        <RevealGroup className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-3">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <RevealItem
                key={s.title}
                as="article"
                className="group relative flex flex-col bg-surface-elevated p-7 transition-colors duration-300 hover:bg-surface-elevated lg:p-9"
              >
                <div className="flex items-center justify-between">
                  <span className="tnum font-display text-[13px] font-bold tracking-[0.16em] text-muted-foreground">
                    0{i + 1}
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft transition-transform duration-300 group-hover:-translate-y-0.5">
                    <Icon className="h-5 w-5 text-primary" />
                  </span>
                </div>

                <h3 className="display-md mt-8 text-foreground">{s.title}</h3>
                <p className="mt-3.5 flex-1 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>

                <p className="mt-7 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                  {s.meta}
                </p>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}
