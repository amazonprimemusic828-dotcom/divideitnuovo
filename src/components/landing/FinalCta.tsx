import React from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/Reveal";

export default function FinalCta({
  onStart,
  isLoading,
}: {
  onStart: () => void;
  isLoading?: boolean;
}) {
  return (
    <section className="hairline py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-foreground px-7 py-16 text-center sm:px-12 sm:py-20 lg:py-24">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-70"
              style={{
                background:
                  "radial-gradient(50% 100% at 50% 0%, hsl(var(--primary) / 0.55) 0%, transparent 70%)",
              }}
            />
            <div className="relative">
              <span className="eyebrow eyebrow-center text-background/60">
                Registrazione gratuita
              </span>
              <h2 className="display-lg mx-auto mt-6 max-w-2xl text-background text-balance">
                Il tuo prossimo abbonamento costa un quarto.
              </h2>
              <p className="mx-auto mt-6 max-w-md text-[17px] leading-relaxed text-background/70">
                Crea un account, verifica il numero e unisciti al primo gruppo. Non serve la carta
                per iniziare.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  onClick={onStart}
                  disabled={isLoading}
                  size="lg"
                  className="btn-lift h-14 w-full rounded-full bg-background px-8 text-[15px] font-semibold text-foreground hover:bg-background/90 sm:w-auto"
                >
                  {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  Inizia gratis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-[13px] text-background/60">
                  Cancelli quando vuoi, senza penali.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
