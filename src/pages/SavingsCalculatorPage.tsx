import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, Sparkles, TrendingDown, Users } from "lucide-react";
import { STRIPE_FEE_PER_PERSON } from "@/lib/serviceConstants";
import { euro, useSavingsServices } from "@/hooks/useSavingsServices";

export default function SavingsCalculatorPage() {
  const navigate = useNavigate();
  const { services, isLoading } = useSavingsServices();

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

  return (
    <main className="relative min-h-screen pb-24">
      <div className="absolute inset-0 gradient-mesh -z-10 opacity-70" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna alla home
        </button>

        <header className="text-center mt-4 mb-10">
          <span className="chip chip-primary mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Calcolatore completo
          </span>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            Tutti gli abbonamenti, <span className="text-gradient-divideit">un solo conto</span>
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto text-lg">
            Seleziona tutto quello che paghi da solo. Usiamo il prezzo ufficiale del piano individuale
            (non quello famiglia) e lo confrontiamo con la quota reale dei gruppi attivi su DivideIt.
          </p>
        </header>

        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-5 lg:gap-6 items-start">
          <div className="card-premium p-5 sm:p-7">
            {isLoading ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-11 w-36 rounded-2xl bg-surface-muted animate-pulse" />
                ))}
              </div>
            ) : services.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Al momento non ci sono gruppi attivi. Torna tra poco.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {services.map((s) => {
                    const on = selectedKeys.includes(s.key);
                    return (
                      <button
                        key={s.key}
                        onClick={() => toggle(s.key)}
                        aria-pressed={on}
                        className={`min-h-[44px] rounded-2xl px-3.5 py-2 text-sm font-semibold border transition-all duration-200 flex items-center gap-2 ${
                          on
                            ? "gradient-divideit text-white border-transparent shadow-floating scale-[1.02]"
                            : "bg-surface-elevated/70 border-border text-foreground/80 hover:border-primary/50 hover:-translate-y-0.5"
                        }`}
                      >
                        {on && <Check className="w-3.5 h-3.5" />}
                        {s.name}
                        <span
                          className={`text-xs font-medium ${on ? "text-white/80" : "text-muted-foreground"}`}
                        >
                          {euro(s.solo)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {picks.length === 0 ? (
                  <p className="mt-6 text-sm text-muted-foreground">
                    Seleziona uno o più abbonamenti qui sopra per vedere il confronto dettagliato.
                  </p>
                ) : (
                  <>
                    <div className="mt-6 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            <th className="text-left font-bold py-2">Servizio</th>
                            <th className="text-right font-bold py-2">Da solo</th>
                            <th className="text-right font-bold py-2">Su DivideIt</th>
                            <th className="text-right font-bold py-2">Risparmi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {picks.map((s) => (
                            <tr key={s.key} className="border-t border-border">
                              <td className="py-2.5 pr-3">
                                <span className="font-semibold text-foreground">{s.name}</span>
                                <span className="block text-[11px] text-muted-foreground">
                                  Piano {s.soloPlan} · {s.seats} posti
                                </span>
                              </td>
                              <td className="py-2.5 text-right text-muted-foreground line-through">
                                {euro(s.solo)}
                              </td>
                              <td className="py-2.5 text-right font-bold text-foreground">
                                {euro(s.perPerson)}
                              </td>
                              <td className="py-2.5 text-right font-bold text-primary">
                                −{euro(s.saving)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <p className="text-xs text-muted-foreground mt-4">
                      Quote già comprensive di {euro(STRIPE_FEE_PER_PERSON)} di commissione a persona. I prezzi
                      dei piani individuali sono quelli ufficiali in Italia e possono variare nel tempo.
                    </p>
                  </>
                )}

              </>
            )}
          </div>

          <motion.div layout className="card-premium p-6 sm:p-8 relative overflow-hidden lg:sticky lg:top-6">
            <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full gradient-divideit-soft blur-3xl" />
            <div className="relative">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm font-semibold text-muted-foreground">Oggi paghi</span>
                <span className="font-display text-2xl font-extrabold text-destructive line-through decoration-2">
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
                    className="font-display text-4xl font-black text-gradient-divideit"
                  >
                    {euro(shared)}
                  </motion.span>
                </AnimatePresence>
              </div>

              <div className="mt-5 h-3 rounded-full bg-surface-muted overflow-hidden">
                <motion.div
                  className="h-full gradient-divideit"
                  animate={{ width: `${Math.min(100, pct)}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Tieni in tasca il <strong className="text-foreground">{pct.toFixed(0)}%</strong> di quello
                che spendi oggi
              </p>

              <div className="mt-6 rounded-3xl p-5 gradient-divideit text-white shadow-floating">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">In un anno</p>
                <AnimatePresence mode="popLayout">
                  <motion.p
                    key={yearly.toFixed(0)}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 16 }}
                    className="font-display text-5xl font-black leading-none mt-1"
                  >
                    €{yearly.toFixed(0)}
                  </motion.p>
                </AnimatePresence>
                <p className="text-white/85 text-sm mt-2 flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4" />
                  {euro(monthly)} in meno ogni mese
                </p>
              </div>

              <p className="text-xs text-muted-foreground mt-4 flex items-start gap-1.5">
                <Users className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                {picks.length} abbonament{picks.length === 1 ? "o" : "i"} selezionat
                {picks.length === 1 ? "o" : "i"}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mt-5">
                <Button
                  onClick={() => navigate("/Auth")}
                  className="gradient-divideit text-white rounded-2xl h-12 flex-1 shadow-floating hover:opacity-95"
                >
                  Inizia a risparmiare
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/ComeFunziona")}
                  className="rounded-2xl h-12 flex-1 border-2 bg-surface-elevated/70 backdrop-blur"
                >
                  Come funziona
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
