import React from "react";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";

const quotes = [
  {
    quote:
      "Gestivo quattro coinquilini con un foglio Excel e promemoria su WhatsApp. Ora il gruppo si paga da solo il 3 di ogni mese e io non devo chiedere niente a nessuno.",
    name: "Giulia Ranieri",
    role: "Admin di 3 gruppi · Milano",
    initials: "GR",
    tone: "bg-[hsl(258_88%_60%)]",
  },
  {
    quote:
      "Ero scettico sull'idea di dare i miei soldi a uno sconosciuto. L'hold di 25 giorni ha risolto la questione: se l'accesso non funziona, i soldi tornano indietro.",
    name: "Marco Tortorelli",
    role: "Membro da 14 mesi · Torino",
    initials: "MT",
    tone: "bg-[hsl(162_72%_38%)]",
  },
  {
    quote:
      "Netflix, Spotify e Disney+ tutti condivisi. Sono passata da 47 euro al mese a poco più di 12, senza rinunciare a niente e senza account bloccati.",
    name: "Sara Pellegrini",
    role: "Membro di 5 gruppi · Bologna",
    initials: "SP",
    tone: "bg-[hsl(24_88%_55%)]",
  },
];

export default function Testimonials() {
  return (
    <section className="hairline bg-surface-muted/40 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <div className="max-w-2xl">
            <span className="eyebrow">Chi lo usa</span>
            <h2 className="display-lg mt-5 text-foreground text-balance">
              2.400 persone hanno smesso
              <br />
              di pagare da sole.
            </h2>
          </div>
        </Reveal>

        <RevealGroup className="mt-16 grid gap-6 lg:grid-cols-3">
          {quotes.map((q) => (
            <RevealItem
              key={q.name}
              as="article"
              className="flex flex-col justify-between rounded-3xl border border-border bg-surface-elevated p-7 transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-primary/40 lg:p-8"
            >
              <blockquote className="text-[15px] leading-[1.7] text-foreground">
                <span aria-hidden className="mr-1 font-display text-2xl leading-none text-primary">
                  &ldquo;
                </span>
                {q.quote}
              </blockquote>

              <footer className="mt-8 flex items-center gap-3 border-t border-border pt-6">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${q.tone}`}
                >
                  {q.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{q.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{q.role}</p>
                </div>
              </footer>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
