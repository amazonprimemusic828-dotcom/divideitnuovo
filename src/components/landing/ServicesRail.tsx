import React from "react";
import ServiceLogo from "@/components/ServiceLogo";
import { Reveal } from "@/components/motion/Reveal";

const services = [
  { name: "Netflix", price: "17,99" },
  { name: "Spotify", price: "17,99" },
  { name: "Disney+", price: "11,99" },
  { name: "YouTube Premium", price: "19,99" },
  { name: "Apple Music", price: "16,99" },
  { name: "Prime Video", price: "8,99" },
  { name: "HBO Max", price: "13,99" },
  { name: "Paramount+", price: "10,99" },
  { name: "Crunchyroll", price: "9,99" },
  { name: "Apple One", price: "34,95" },
  { name: "Microsoft 365", price: "10,00" },
  { name: "PlayStation Plus", price: "16,99" },
  { name: "Xbox Game Pass", price: "17,99" },
  { name: "NOW", price: "14,99" },
  { name: "Nintendo Switch Online", price: "34,99" },
  { name: "Audible", price: "9,99" },
];

function Tile({ name, price }: { name: string; price: string }) {
  return (
    <div className="group mx-1.5 flex w-[168px] shrink-0 flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-4 transition-colors duration-300 hover:border-primary/40">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-muted p-1.5 transition-transform duration-300 group-hover:scale-[1.08]">
        <ServiceLogo name={name} className="h-full w-full" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-foreground">{name}</p>
        <p className="tnum text-xs text-muted-foreground">
          da <span className="font-semibold text-mint">€{(Number(price.replace(",", ".")) / 4).toFixed(2).replace(".", ",")}</span>{" "}
          /mese
        </p>
      </div>
    </div>
  );
}

export default function ServicesRail() {
  const half = Math.ceil(services.length / 2);
  const rowA = services.slice(0, half);
  const rowB = services.slice(half);

  return (
    <section id="servizi" className="hairline py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <div className="max-w-2xl">
            <span className="eyebrow">Catalogo</span>
            <h2 className="display-lg mt-5 text-foreground text-balance">
              16 servizi già pronti,
              <br />
              con il prezzo diviso calcolato.
            </h2>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted-foreground">
              I costi mostrati sono la quota reale per un gruppo al completo. Nessuna commissione
              nascosta: quello che vedi è quello che paghi.
            </p>
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.1} className="marquee-mask mt-14 space-y-3 overflow-hidden">
        <div className="marquee-track">
          {[...rowA, ...rowA].map((s, i) => (
            <Tile key={`a-${s.name}-${i}`} {...s} />
          ))}
        </div>
        <div className="marquee-track [animation-direction:reverse] [animation-duration:52s]">
          {[...rowB, ...rowB].map((s, i) => (
            <Tile key={`b-${s.name}-${i}`} {...s} />
          ))}
        </div>
      </Reveal>
    </section>
  );
}
