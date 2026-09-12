import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Flame, Heart, TrendingDown, Users } from "lucide-react";
import { STRIPE_FEE_PER_PERSON } from "@/lib/serviceConstants";
import { euro, useSavingsServices } from "@/hooks/useSavingsServices";

export default function SavingsCalculator() {
  const navigate = useNavigate();
  const { services: allServices, groups, isLoading } = useSavingsServices();

  // In home mostriamo solo i 3 abbonamenti che fanno risparmiare di più
  const services = useMemo(() => allServices.slice(0, 3), [allServices]);

  const [selected, setSelected] = useState<string[]>([]);
  const selectedKeys = selected;
  const picks = useMemo(
    () => services.filter((s) => selectedKeys.includes(s.key)),
    [services, selectedKeys]
  );

  const toggle = (key: string) =>
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );

  const { solo, shared, monthly, yearly, pct } = useMemo(() => {
    const solo = picks.reduce((a, s) => a + s.solo, 0);
    const shared = picks.reduce((a, s) => a + s.perPerson, 0);
    const monthly = Math.max(0, solo - shared);
    return { solo, shared, monthly, yearly: monthly * 12, pct: solo ? (monthly / solo) * 100 : 0 };
  }, [picks]);

  // Gruppi reali quasi pieni
  const almostFull = useMemo(() => {
    return (groups as any[])
      .map((g) => {
        const filled = g.member_count ?? 0;
        const left = g.max_members - filled;
        return {
          id: g.id,
          name: g.service_name,
          filled,
          total: g.max_members,
          left,
          price: Number(g.total_cost) / g.max_members + STRIPE_FEE_PER_PERSON,
        };
      })
      .filter((g) => g.left > 0 && g.left <= 2 && g.total > 1)
      .sort((a, b) => a.left - b.left || b.filled / b.total - a.filled / a.total)
      .slice(0, 3);
  }, [groups]);

  return (
    <section id="risparmio" className="hairline relative overflow-hidden py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <span className="eyebrow">Il conto</span>
          <h2 className="display-lg mt-5 text-foreground text-balance">
            Quanto stai buttando via
            <br />
            <span className="text-primary">ogni mese?</span>
          </h2>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-muted-foreground">
            Questi sono i tre abbonamenti su cui oggi si risparmia di più. Confrontiamo il prezzo del
            piano <strong className="font-semibold text-foreground">singolo</strong> — quello che
            pagheresti da solo — con la quota su DivideIt.
          </p>
        </div>

        <div className="mt-14 grid items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
          {/* Picker */}
          <div className="panel p-6 sm:p-8">
            <p className="mb-5 text-[15px] leading-relaxed text-muted-foreground">
              Tocca gli abbonamenti che paghi da solo: prezzi reali dei piani individuali, niente esempi
              inventati.
            </p>

            {isLoading ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-11 w-36 rounded-2xl bg-surface-muted animate-pulse" />
                ))}
              </div>
            ) : services.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Al momento non ci sono gruppi attivi. Torna tra poco: se ne aprono di nuovi ogni giorno.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {services.map((s) => {
                  const on = selectedKeys.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      onClick={() => toggle(s.key)}
                      aria-pressed={on}
                      className={`flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-300 ${
                        on
                          ? "border-transparent bg-primary text-primary-foreground shadow-[0_10px_24px_-12px_hsl(var(--primary)/0.7)]"
                          : "border-border bg-surface-elevated text-foreground/80 hover:-translate-y-0.5 hover:border-primary/50"
                      }`}
                    >
                      {on && <Check className="w-3.5 h-3.5" />}
                      {s.name}
                      <span className={`tnum text-xs font-medium ${on ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                        {euro(s.solo)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {picks.length > 0 && (
              <div className="panel-quiet mt-7 p-5">
                <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Il tuo conto, voce per voce
                </p>
                <ul className="space-y-2">
                  {picks.map((s) => (
                    <li key={s.key} className="flex items-center justify-between text-sm gap-3">
                      <span className="text-foreground/80 truncate">
                        {s.name}
                        <span className="block text-[11px] text-muted-foreground">
                          Piano {s.soloPlan}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-muted-foreground line-through">{euro(s.solo)}</span>
                        <span className="font-bold text-foreground">{euro(s.perPerson)}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {s.seats}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground mt-3">
                  Quote già comprensive di {euro(STRIPE_FEE_PER_PERSON)} di commissione a persona: quello che
                  vedi è quello che paghi.
                </p>
              </div>
            )}

            <button
              onClick={() => navigate("/Calcolatore")}
              className="mt-6 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-border text-sm font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-primary-soft hover:text-primary"
            >
              Scopri di più — tutti gli abbonamenti
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Result */}
          <motion.div layout className="panel relative overflow-hidden p-6 sm:p-8">
            <div className="relative">
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-muted-foreground">Oggi paghi</span>
                <span className="tnum font-display text-2xl font-extrabold text-muted-foreground line-through decoration-2">
                  {euro(solo)}
                  <span className="text-sm font-semibold">/mese</span>
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-muted-foreground">Con DivideIt</span>
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={shared.toFixed(2)}
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -12, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="tnum font-display text-4xl font-extrabold tracking-[-0.03em] text-primary"
                  >
                    {euro(shared)}
                  </motion.span>
                </AnimatePresence>
              </div>

              {/* bar */}
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-surface-muted">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  animate={{ width: `${Math.min(100, pct)}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Tieni in tasca il <strong className="text-foreground">{pct.toFixed(0)}%</strong> di quello che
                spendi oggi
              </p>

              <div className="mt-7 rounded-2xl bg-foreground p-6 text-background">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-background/60">
                  In un anno
                </p>
                <AnimatePresence mode="popLayout">
                  <motion.p
                    key={yearly.toFixed(0)}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 16 }}
                    className="tnum mt-1.5 font-display text-5xl font-extrabold leading-none tracking-[-0.04em]"
                  >
                    €{yearly.toFixed(0)}
                  </motion.p>
                </AnimatePresence>
                <p className="mt-3 flex items-center gap-1.5 text-sm text-background/70">
                  <TrendingDown className="w-4 h-4" />
                  {euro(monthly)} in meno ogni mese, senza rinunciare a niente
                </p>
              </div>

              <p className="text-xs text-muted-foreground mt-4 flex items-start gap-1.5">
                <Heart className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                Nessun vincolo: entri, dividi e se cambi idea smetti quando vuoi.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={() => navigate("/Auth")}
                  className="btn-lift h-12 flex-1 rounded-full bg-primary font-semibold text-primary-foreground shadow-[0_14px_30px_-16px_hsl(var(--primary)/0.7)] hover:bg-primary/90"
                >
                  Inizia a risparmiare
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/Calcolatore")}
                  className="h-12 flex-1 rounded-full border-border bg-surface-elevated font-semibold"
                >
                  Scopri di più
                </Button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Scarcity — gruppi reali */}
        {almostFull.length > 0 && (
          <div className="mt-20">
            <div className="mb-1.5 flex items-center gap-2">
              <Flame className="h-5 w-5 text-destructive" />
              <h3 className="display-md text-foreground">Posti che stanno finendo adesso</h3>
            </div>
            <p className="mb-6 text-[15px] text-muted-foreground">
              Gruppi veri, aperti in questo momento da persone come te.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {almostFull.map((g) => {
                const pctFull = (g.filled / g.total) * 100;
                return (
                  <motion.div
                    key={g.id}
                    whileHover={{ y: -4 }}
                    onClick={() => navigate("/BrowseGroups")}
                    className="panel relative cursor-pointer overflow-hidden p-5 transition-colors duration-300 hover:border-primary/40"
                  >
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <p className="truncate font-display font-bold text-foreground">{g.name}</p>
                      <span className="chip chip-danger shrink-0 text-xs font-bold">
                        {g.left === 1 ? "Solo 1 posto" : `${g.left} posti`}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${pctFull}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.9, ease: "easeOut" }}
                        className="h-full rounded-full bg-destructive"
                      />
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {g.filled} su {g.total} dentro
                      </span>
                      <span className="tnum font-bold text-foreground">{euro(g.price)}/mese</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
