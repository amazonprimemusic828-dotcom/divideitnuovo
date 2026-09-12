import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ArrowRight, Shield, Users, Wallet, Lock, RefreshCw, Flame,
  CheckCircle2, CreditCard, Sparkles, TrendingDown,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const } }),
};

const steps = [
  { icon: Users, title: "Scegli o crea il gruppo", desc: "Filtra per servizio e prezzo. Ogni gruppo mostra i posti liberi in tempo reale: quando resta un solo posto, lo vedi subito." },
  { icon: Shield, title: "Verifica la tua identità", desc: "Numero di telefono via SMS e OTP via email. Niente bot: ogni membro ha un punteggio di affidabilità visibile." },
  { icon: CreditCard, title: "Paga in sicurezza con Stripe", desc: "Il pagamento resta in hold protetto. L'admin riceve i soldi solo dopo il periodo di garanzia." },
  { icon: Lock, title: "Ricevi le credenziali cifrate", desc: "Le credenziali del servizio sono cifrate end-to-end (AES-256-GCM). Le copi con un tap, non transitano mai in chiaro." },
  { icon: RefreshCw, title: "Rinnovo automatico", desc: "Ogni mese l'addebito parte da solo. Disattivi il rinnovo quando vuoi dalla scheda del gruppo." },
  { icon: Wallet, title: "Rimborsi sul wallet", desc: "Se un gruppo salta, l'importo torna come credito DivideIt e si applica automaticamente al prossimo acquisto." },
];

const faqs = [
  { q: "Perché costa così poco?", a: "Perché il piano famiglia di un servizio costa quasi come quello singolo, ma include più posti. Dividendolo tra persone verificate, il costo per persona crolla fino al 75%." },
  { q: "Cosa significa 'Solo 1 posto rimasto'?", a: "Ogni gruppo ha un numero massimo di posti definito dal piano del servizio. La barra mostra la percentuale di riempimento: quando è al 75% o più, i posti si esauriscono in genere in poche ore." },
  { q: "I miei soldi sono protetti?", a: "Sì. Ogni pagamento passa da Stripe con hold di 25 giorni. Se l'accesso non funziona, apri una disputa e ricevi il rimborso." },
  { q: "Chi vede le mie credenziali?", a: "Nessuno oltre ai membri autorizzati del gruppo, e solo in forma cifrata lato client. Neanche il server può leggerle." },
];

export default function HowItWorks() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen bg-background"
    >
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 min-h-[44px]">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-display font-black text-gradient-divideit">DIVIDEIT</span>
          </Link>
          <Button onClick={() => navigate("/Auth")} className="gradient-divideit text-white rounded-xl px-5 shadow-floating">
            Inizia gratis
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-16 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0 gradient-mesh -z-10" />
        <div className="absolute top-16 -right-24 w-96 h-96 rounded-full bg-primary/20 blur-3xl -z-10" />
        <div className="max-w-4xl mx-auto text-center">
          <motion.span variants={fadeUp} initial="hidden" animate="show" className="chip chip-primary mb-5">
            <Sparkles className="w-3.5 h-3.5" /> Come funziona, nel dettaglio
          </motion.span>
          <motion.h1
            variants={fadeUp} initial="hidden" animate="show" custom={1}
            className="font-display text-4xl sm:text-6xl font-black tracking-tight leading-[1.05] text-foreground"
          >
            Paghi <span className="text-gradient-divideit">una frazione</span>,<br />ottieni tutto il servizio.
          </motion.h1>
          <motion.p
            variants={fadeUp} initial="hidden" animate="show" custom={2}
            className="text-lg text-muted-foreground max-w-2xl mx-auto mt-5"
          >
            Dal momento in cui scegli un gruppo a quello in cui ricevi le credenziali cifrate: ecco ogni singolo passaggio,
            e cosa protegge i tuoi soldi lungo la strada.
          </motion.p>
        </div>
      </section>

      {/* Numbers */}
      <section className="px-4 sm:px-6 pb-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: TrendingDown, k: "fino al 75%", v: "di risparmio per servizio" },
            { icon: Shield, k: "25 giorni", v: "di hold anti-frode Stripe" },
            { icon: Lock, k: "AES-256-GCM", v: "cifratura end-to-end" },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.k} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i}
                className="card-premium p-6 flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-2xl gradient-divideit flex items-center justify-center shrink-0 shadow-floating">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-display text-xl font-extrabold text-foreground">{s.k}</p>
                  <p className="text-sm text-muted-foreground">{s.v}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Steps timeline */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-foreground mb-10 tracking-tight">
            Il percorso completo
          </h2>
          <div className="relative">
            <div className="absolute left-11 top-2 bottom-2 w-px bg-border hidden sm:block" />
            <div className="space-y-4">
              {steps.map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.div
                    key={s.title}
                    variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} custom={i}
                    className="relative card-premium p-6 sm:pl-20"
                  >
                    <div className="sm:absolute sm:left-5 sm:top-6 w-12 h-12 rounded-2xl gradient-divideit flex items-center justify-center shadow-floating mb-4 sm:mb-0">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary mb-1">
                      Passo {String(i + 1).padStart(2, "0")}
                    </p>
                    <h3 className="font-display text-xl font-bold text-foreground mb-1.5">{s.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Scarcity explained */}
      <section className="py-16 px-4 sm:px-6 border-t border-border/60 bg-surface-muted/40">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-5 h-5 text-destructive" />
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">Come leggere i posti disponibili</h2>
          </div>
          <p className="text-muted-foreground mb-8 max-w-2xl">
            Ogni gruppo mostra una barra di riempimento aggiornata in tempo reale. Ecco cosa significano gli stati.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: "Posti liberi", pct: 40, tone: "from-emerald-500 to-teal-500", desc: "Puoi entrare con calma, il gruppo è appena partito." },
              { label: "Gruppo completo al 75%", pct: 75, tone: "from-amber-500 to-orange-500", desc: "Restano pochi posti: di solito si esauriscono in poche ore." },
              { label: "Solo 1 posto rimasto", pct: 90, tone: "from-orange-500 to-destructive", desc: "Ultimo posto: chi conferma per primo entra nel gruppo." },
            ].map((s, i) => (
              <motion.div
                key={s.label} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i}
                className="card-premium p-5"
              >
                <p className="font-display font-bold text-foreground mb-3">{s.label}</p>
                <div className="h-2.5 rounded-full bg-surface-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }} whileInView={{ width: `${s.pct}%` }} viewport={{ once: true }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                    className={`h-full bg-gradient-to-r ${s.tone}`}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-3">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-foreground mb-8 tracking-tight">Domande frequenti</h2>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <motion.div
                key={f.q} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i}
                className="card-premium p-6"
              >
                <p className="font-display font-bold text-foreground mb-2 flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  {f.q}
                </p>
                <p className="text-muted-foreground leading-relaxed pl-7">{f.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto rounded-[2rem] p-10 text-center gradient-divideit text-white shadow-floating relative overflow-hidden">
          <div className="absolute -top-20 -right-12 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
          <div className="relative">
            <h2 className="font-display text-3xl sm:text-4xl font-black mb-3 tracking-tight">Ogni mese che passa è denaro perso.</h2>
            <p className="text-white/90 mb-7">Entra in un gruppo verificato e inizia a risparmiare da oggi.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate("/Auth")} size="lg" className="bg-white text-primary hover:bg-white/95 h-14 px-8 rounded-2xl font-bold shadow-2xl">
                Inizia gratis <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button onClick={() => navigate("/")} size="lg" variant="outline" className="h-14 px-8 rounded-2xl border-2 border-white/60 bg-transparent hover:bg-white/10">
                Torna alla home
              </Button>
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
