import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Check, Loader2, Play, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/motion/Reveal";
import { MemberAvatars } from "@/components/dashboard/SubscriptionTile";
import ServiceLogo from "@/components/ServiceLogo";

export default function Hero({ onStart, isLoading }: { onStart: () => void; isLoading?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <section className="landing-hero">
      <div className="marketing-container">
        <div className="hero-layout">
          <div className="hero-copy">
            <Reveal delay={0.05}><Badge variant="secondary" className="hero-eyebrow"><span className="size-1.5 rounded-full bg-primary" />Meno spese. Più possibilità.</Badge></Reveal>
            <Reveal delay={0.12}>
              <h1 className="hero-title font-display">Le cose belle.<br />Ancora meglio<br /><span className="text-primary">se condivise.</span></h1>
            </Reveal>
            <Reveal delay={0.2}><p className="hero-description">I tuoi abbonamenti preferiti, a una frazione del prezzo. Trova il tuo gruppo, dividi le spese e goditi tutto il resto.</p></Reveal>
            <Reveal delay={0.28}>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" onClick={onStart} disabled={isLoading}>{isLoading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}Inizia a condividere<ArrowUpRight data-icon="inline-end" /></Button>
                <Button size="lg" variant="outline" onClick={() => document.getElementById("come-funziona")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" })}><Play data-icon="inline-start" />Come funziona</Button>
              </div>
            </Reveal>
            <Reveal delay={0.36}>
              <div className="hero-reassurance"><span><Check />Nessun costo di iscrizione</span><span><Check />Tutto sotto controllo</span></div>
            </Reveal>
            <Reveal delay={0.42}>
              <div className="hero-community"><MemberAvatars names={["sofia", "andrea", "giulia", "marco"]} /><p>Il tuo prossimo gruppo.<br /><strong>Le tue stesse passioni.</strong></p></div>
            </Reveal>
          </div>
          <div className="hero-visual">
            <motion.figure initial={reduce ? false : { opacity: 0, y: 24, rotate: 2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.15 }} className="hero-photo">
              <img src="/images/together.png" alt="Tre amici condividono una serata sul divano guardando un film" width={1024} height={1024} fetchPriority="high" />
              <figcaption><span className="size-2 rounded-full bg-mint" />La serata è vostra. La spesa è condivisa.</figcaption>
            </motion.figure>
            <motion.div className="hero-split-card" initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.7 }}>
              <div className="flex items-center gap-3"><span className="service-tile"><ServiceLogo name="Netflix" size={32} decorative /></span><div><p className="font-semibold">Serata film, insieme.</p><p className="text-sm text-muted-foreground">Netflix Premium · esempio</p></div><span className="hero-check"><Check className="size-4" /></span></div>
              <div className="hero-split-price"><div><p className="text-sm text-muted-foreground">La tua parte</p><p className="font-display text-3xl font-bold">4,50 €<span className="text-sm font-normal text-muted-foreground"> / mese</span></p></div><Badge variant="secondary">Diviso in 4<ArrowRight className="size-3.5" /></Badge></div>
            </motion.div>
            <motion.div className="hero-trust-chip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}><ShieldCheck className="size-4 text-mint" />Condividi con tranquillità</motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
