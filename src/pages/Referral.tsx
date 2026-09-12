import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Check, Share2, Gift, Users, Sparkles, ArrowRight, Clock, Trophy, Youtube, Loader2, XCircle } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { EuroCoin } from "@/components/euro-coin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import {
  getMyReferralCode,
  getReferralSummary,
  listMyReferrals,
  type ReferralRow,
  type ReferralSummary,
} from "@/lib/referral";
import {
  getYoutubeStatus,
  submitYoutubeEmail,
  YOUTUBE_MONTHLY_SLOTS,
  type YoutubeStatus,
} from "@/lib/youtube";

const TABS = ["Tutti gli inviti", "In corso", "Completati"] as const;

const eur = (cents: number) =>
  new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    (cents || 0) / 100,
  ) + " €";


export default function Referral() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0]);
  const [code, setCode] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [yt, setYt] = useState<YoutubeStatus | null>(null);
  const [ytEmail, setYtEmail] = useState("");
  const [ytSaving, setYtSaving] = useState(false);
  const [ytOpen, setYtOpen] = useState(false);
  const [ytConfirm, setYtConfirm] = useState(false);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    const myCode = await getMyReferralCode();
    setCode(myCode);
    const [s, list, y] = await Promise.all([
      getReferralSummary(),
      listMyReferrals(user.uid),
      getYoutubeStatus(),
    ]);
    if (s) setSummary(s);
    setRows(list);
    setYt(y);
    if (y?.google_email) setYtEmail(y.google_email);
  }, [user?.uid]);

  const submitYt = async () => {
    setYtSaving(true);
    const res = await submitYoutubeEmail(ytEmail.trim());
    setYtSaving(false);
    if (res === "ok") {
      toast({ title: "Email inviata", description: "Riceverai l'invito YouTube Premium entro 24 ore." });
      setYtOpen(false);
      void load();
    } else if (res === "invalid_email") {
      toast({ title: "Email non valida", variant: "destructive" });
    } else if (res === "email_locked_12_months") {
      toast({
        title: "Email non utilizzabile",
        description:
          "Questa email Google è già stata usata negli ultimi 12 mesi: indica un indirizzo Google diverso.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Non è stato possibile salvare l'email", variant: "destructive" });
    }
  };


  useEffect(() => {
    void load();
  }, [load]);

  const link = code ? `https://huggy-coder-tool.lovable.app/Auth?ref=${code}` : "";

  const filtered = useMemo(() => {
    if (tab === "In corso") return rows.filter((r) => r.status === "pending");
    if (tab === "Completati") return rows.filter((r) => r.status === "confirmed");
    return rows;
  }, [rows, tab]);

  const copy = async () => {
    if (!link) {
      toast({ title: "Codice non ancora pronto", description: "Riprova tra un istante." });
      void load();
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: "Link copiato", description: "Condividilo con i tuoi amici." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Impossibile copiare", variant: "destructive" });
    }
  };


  const share = async () => {
    const data = {
      title: "DIVIDEIT",
      text: "Dividi i tuoi abbonamenti e risparmia ogni mese. Iscriviti con il mio link:",
      url: link,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch {
        /* utente ha annullato */
      }
    }
    copy();
  };

  return (
    <div className="relative overflow-hidden">
      {/* sfondo morbido */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary-soft/50 via-background to-background" />
      <div className="pointer-events-none absolute -left-24 top-10 -z-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-40 -z-10 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />

      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
        {/* HERO */}
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary-strong" /> Programma referral
          </span>

          <h1 className="mt-5 max-w-2xl text-balance text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            Ogni nuovo amico si iscrive{" "}
            <span className="text-gradient-divideit">con successo</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Invita amici mai registrati su DIVIDEIT: quando entrano in un gruppo, il bonus arriva
            direttamente nel tuo portafoglio.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <EuroCoin size={132} asLink={false} />
            <div className="flex items-baseline gap-1 text-4xl font-black text-primary-strong sm:text-5xl">
              +1,00 <span className="text-2xl">€</span>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              per ogni amico confermato
            </p>
          </div>

          {/* CTA */}
          <div className="mt-8 w-full max-w-md space-y-3">
            <Button onClick={share} disabled={!link} size="lg" className="h-14 w-full rounded-2xl gradient-divideit text-base font-bold text-white shadow-floating">
              <Share2 className="mr-2 h-5 w-5" /> Invita i tuoi amici
            </Button>

            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/90 p-2 pl-4 backdrop-blur">
              <p className="min-w-0 flex-1 truncate text-left text-sm font-medium text-muted-foreground">
                {link || "Generazione del tuo link personale…"}
              </p>
              <Button onClick={copy} disabled={!link} variant="secondary" className="h-10 shrink-0 rounded-xl font-semibold">
                {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
                {copied ? "Copiato" : "Copia"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Il tuo codice invito:{" "}
              <span className="font-bold text-foreground">{code ?? "…"}</span>
            </p>

          </div>
        </div>

        {/* PREMIO YOUTUBE PREMIUM */}
        {user && (
          <div className="mt-10 overflow-hidden rounded-3xl border border-border/60 bg-card/95 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center gap-4 border-b border-border/60 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                <Youtube className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold">Invita 3 amici, ricevi YouTube Premium</p>
                <p className="text-sm text-muted-foreground">
                  3 amici nuovi devono registrarsi con il tuo link, pagare ed entrare in un gruppo.
                </p>
              </div>
              <div className="w-full rounded-2xl bg-muted px-4 py-2 text-center sm:w-auto">
                <p className="text-lg font-black leading-none">
                  {yt ? yt.slots_left : "…"} / {yt?.total_slots ?? YOUTUBE_MONTHLY_SLOTS}
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Slot rimasti questo mese
                </p>
              </div>
            </div>

            <div className="p-5">
              {/* progresso 3 amici */}
              <div className="mb-4 flex items-center gap-2">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`h-2 flex-1 rounded-full ${
                      (yt?.confirmed_friends ?? 0) > i ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
                <span className="ml-2 shrink-0 text-sm font-bold">
                  {Math.min(yt?.confirmed_friends ?? 0, 3)}/3
                </span>
              </div>

              {yt?.status === "invited" ? (
                <p className="break-words text-sm font-semibold text-primary-strong">
                  Invito inviato a {yt.google_email}. Controlla la tua casella Google.
                </p>
              ) : yt?.status ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">
                    Hai sbloccato YouTube Premium! Inserisci la tua email Google: riceverai l'invito
                    entro 24 ore.
                  </p>
                  {yt.status === "email_submitted" && (
                    <p className="break-words text-xs text-muted-foreground">
                      Richiesta ricevuta per {yt.google_email}: invito in arrivo entro 24 ore.
                    </p>
                  )}
                  <Button
                    onClick={() => setYtOpen(true)}
                    className="h-12 w-full rounded-xl gradient-divideit font-bold text-white"
                  >
                    {yt.status === "email_submitted" ? "Modifica email Google" : "Inserisci email Google"}
                  </Button>
                </div>
              ) : (yt?.slots_left ?? 0) <= 0 ? (
                <p className="text-sm font-semibold text-muted-foreground">
                  Posti esauriti questo mese — si riparte il 1° del prossimo mese.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ti mancano {Math.max(0, 3 - (yt?.confirmed_friends ?? 0))} amici confermati per
                  sbloccare il premio.
                </p>
              )}
            </div>
          </div>
        )}

        {/* POPUP EMAIL GOOGLE */}
        <Dialog open={ytOpen} onOpenChange={setYtOpen}>
          <DialogContent className="w-[calc(100vw-32px)] max-w-[calc(100vw-32px)] rounded-3xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Ricevi YouTube Premium</DialogTitle>
              <DialogDescription>
                Inserisci l'indirizzo Google su cui vuoi ricevere l'invito: lo mandiamo entro 24 ore.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={ytEmail}
                onChange={(e) => setYtEmail(e.target.value)}
                placeholder="latuaemail@gmail.com"
                className="h-12 rounded-xl"
              />
              <div className="space-y-2 rounded-2xl border border-amber-300/70 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                <p className="font-bold uppercase tracking-wide">Importante — regola dei 12 mesi</p>
                <p>
                  Google non permette di entrare in un nuovo gruppo famiglia se quell&apos;email è
                  già entrata in un gruppo famiglia negli ultimi <strong>12 mesi</strong>.
                </p>
                <p>
                  Se questa email è già stata in un gruppo famiglia da meno di 12 mesi,{" "}
                  <strong>l&apos;invito non funzionerà</strong>: inserisci una email Google nuova
                  (puoi crearne una gratis in 1 minuto) e indica quella qui sotto.
                </p>
              </div>
              <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={ytConfirm}
                  onChange={(e) => setYtConfirm(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                />
                <span>
                  Confermo che questa email Google non è entrata in un gruppo famiglia negli ultimi
                  12 mesi.
                </span>
              </label>
              <Button
                onClick={submitYt}
                disabled={ytSaving || !ytEmail.trim() || !ytConfirm}
                className="h-12 w-full rounded-xl gradient-divideit font-bold text-white"
              >
                {ytSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Conferma email
              </Button>
            </div>
          </DialogContent>
        </Dialog>


        {/* CONTEST */}

        <Link
          to="/Contest"
          className="mt-10 flex items-center gap-4 rounded-3xl border border-border/60 bg-card/90 p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold">Contest referral: in gara per 500 €</p>
            <p className="text-sm text-muted-foreground">
              Iscriviti, scala la classifica e leggi il regolamento ufficiale.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>

        {/* COME FUNZIONA */}
        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: Share2, title: "1. Condividi il link", text: "Manda il tuo link personale ad amici, famiglia o gruppi." },
            { icon: Users, title: "2. L'amico si iscrive", text: "Si registra su DIVIDEIT con una nuova email e poi entra in un gruppo." },
            { icon: Gift, title: "3. Ricevi 1,00 €", text: "Il bonus viene accreditato nel tuo portafoglio come credito." },
          ].map((s) => (
            <div key={s.title} className="rounded-3xl border border-border/60 bg-card/90 p-6 shadow-sm backdrop-blur">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft">
                <s.icon className="h-5 w-5 text-primary-strong" />
              </div>
              <h3 className="font-bold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>

        {/* SALDI */}
        <div className="mt-8 overflow-hidden rounded-3xl border border-border/60 bg-card/95 shadow-sm backdrop-blur">
          <div className="grid divide-y divide-border/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div className="p-7 text-center">
              <p className="text-3xl font-black sm:text-4xl">{eur(summary?.earned_cents ?? 0)}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Guadagni totali referral
              </p>
            </div>
            <div className="p-7 text-center">
              <p className="text-3xl font-black text-primary-strong sm:text-4xl">
                +{eur(summary?.pending_cents ?? 0)}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bonus in arrivo
              </p>
            </div>
          </div>

          <div className="space-y-2 border-t border-border/60 bg-muted/30 p-5 text-sm text-muted-foreground">
            <p className="font-bold text-foreground">Quando si sblocca il bonus?</p>
            <p>
              <strong className="text-foreground">Non basta creare il gruppo.</strong> Se il tuo
              amico apre un gruppo ma non entra nessuno, il bonus resta in{" "}
              <em>Bonus in arrivo</em>.
            </p>
            <p>
              Il bonus passa nei <strong className="text-foreground">Guadagni totali</strong> quando
              il tuo amico si unisce a un gruppo pagando la sua quota{" "}
              <strong className="text-foreground">oppure</strong> quando il primo co-abbonato entra
              e paga nel gruppo che ha creato lui. Non serve riempire tutti i posti: basta il primo
              partecipante pagante.
            </p>
            <p>
              I bonus confermati vengono accreditati nel{" "}
              <Link to="/Wallet" className="font-semibold text-primary hover:underline">
                portafoglio DIVIDEIT
              </Link>{" "}
              e puoi usarli subito per pagare le tue quote sul sito.
            </p>
          </div>
        </div>


        {/* STORICO */}
        <div className="mt-8 overflow-hidden rounded-3xl border border-border/60 bg-card/95 shadow-sm backdrop-blur">
          <div className="flex gap-1 overflow-x-auto border-b border-border/60 px-3 pt-3">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`whitespace-nowrap rounded-t-xl px-4 py-3 text-sm font-bold transition-colors ${
                  tab === t
                    ? "border-b-2 border-primary text-primary-strong"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-semibold">Nessun invito in questa sezione</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Condividi il tuo link: qui vedrai lo stato di ogni amico invitato e i bonus maturati.
              </p>
              <Button onClick={share} variant="secondary" className="mt-2 rounded-xl font-semibold">
                Invita ora <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {filtered.map((r) => {
                const done = r.status === "confirmed";
                const rejected = r.status === "rejected";
                return (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                        done ? "bg-primary-soft" : "bg-muted"
                      }`}
                    >
                      {done ? (
                        <Check className="h-5 w-5 text-primary-strong" />
                      ) : rejected ? (
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{r.referred_email}</p>
                      <p className="text-xs text-muted-foreground">
                        {done
                          ? `Confermato il ${new Date(r.confirmed_at ?? r.created_at).toLocaleDateString("it-IT")}`
                          : rejected
                            ? "Non idoneo: account già registrato in passato"
                            : "In attesa che entri in un gruppo"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-black ${
                        done ? "text-primary-strong" : "text-muted-foreground"
                      }`}
                    >
                      {done ? "+1,00 €" : rejected ? "Non valido" : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Il bonus viene riconosciuto una sola volta, esclusivamente per nuove email mai registrate,
          dopo l'ingresso confermato dell'amico in un gruppo. Inviti duplicati o non idonei non vengono conteggiati.
        </p>
      </div>
    </div>
  );
}
