import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthContext";
import { useSearchParams } from "react-router-dom";
import { getGroups } from "@/lib/supabaseClient";
import { stripeApi } from "@/lib/stripeApi";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRateLimit } from "@/hooks/useRateLimit";
import { getWallet, centsToEur, type WalletTransaction } from "@/lib/walletApi";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { humanizeStripeRequirements, humanizeStripeDisabledReason } from "@/lib/stripeRequirements";
import AutoPayoutCard from "@/components/wallet/AutoPayoutCard";

import {
  Wallet as WalletIcon, TrendingUp, Calendar, Clock,
  ArrowUpRight, Loader2, Download, Shield, CheckCircle, AlertCircle, RotateCcw, ExternalLink,
  Gift, ArrowDownLeft,
} from "lucide-react";

interface LedgerEntry {
  id: string;
  group_id: string | null;
  gross_amount: number;
  platform_fee: number;
  net_amount: number;
  paid_at: string;
  release_at: string;
  payout_at: string | null;
  status: string;
}
interface LedgerSummary {
  in_hold_total: number;
  available_total: number;
  paid_out_total: number;
  next_release_date: string | null;
  in_hold_count: number;
  available_count: number;
}
interface OwnerStatus {
  status: string;
  stripe_account_id: string | null;
  payouts_enabled: boolean;
  charges_enabled: boolean;
  details_submitted?: boolean;
  requirements?: string[];
  disabled_reason?: string | null;
}

const MIN_PAYOUT_EUR = 10;

const cacheKey = (email?: string | null) => `divideit:wallet:${email || "anon"}`;

function readCache(email?: string | null) {
  try {
    const raw = localStorage.getItem(cacheKey(email));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function Wallet() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const cached = useState(() => readCache(user?.email))[0];
  const [loading, setLoading] = useState(!cached);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>(cached?.ledgerEntries || []);
  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummary | null>(cached?.ledgerSummary || null);
  const [ownerGroupId, setOwnerGroupId] = useState<string | null>(cached?.ownerGroupId ?? null);
  const [ownerStatus, setOwnerStatus] = useState<OwnerStatus | null>(cached?.ownerStatus || null);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resetStripeLoading, setResetStripeLoading] = useState(false);
  const [statusRefreshing, setStatusRefreshing] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);

  const [userWalletCents, setUserWalletCents] = useState(cached?.userWalletCents || 0);
  const [userWalletTxs, setUserWalletTxs] = useState<WalletTransaction[]>(cached?.userWalletTxs || []);
  const { executeWithRateLimit, isLocked: withdrawLocked } = useRateLimit(5000);


  useEffect(() => {
    const onboarding = searchParams.get("onboarding");
    if (onboarding === "complete") toast.success("Onboarding completato. Verifico lo stato…");
    if (onboarding === "refresh") toast.info("Riprova la configurazione");
  }, [searchParams]);

  useEffect(() => {
    if (user?.email) loadAll();
    else setLoading(false);
  }, [user?.email]);

  const loadAll = async () => {
    if (!user?.email) return;
    let walletCents = userWalletCents;
    let walletTxs = userWalletTxs;
    let groupId = ownerGroupId;
    try {
      // INSTANT: wallet balance first, render subito
      getWallet(user.email)
        .then((w) => {
          walletCents = w.balance_cents;
          walletTxs = w.transactions;
          setUserWalletCents(w.balance_cents);
          setUserWalletTxs(w.transactions);
        })
        .catch(() => {})
        .finally(() => setLoading(false));

      const ownerGroups = await getGroups({ admin_email: user.email }).catch(() => []);
      if (ownerGroups.length > 0) {
        groupId = ownerGroups[0].id;
        setOwnerGroupId(ownerGroups[0].id);
      }
      setLoading(false);

      // SLOW PATH: hydrate Stripe-dependent sections in background
      const [ledgerRes, statusRes] = await Promise.all([
        stripeApi("ledger", { ownerEmail: user.email }),
        stripeApi("owner-status", { ownerEmail: user.email, ownerUid: user.uid, ownerName: user.full_name }),
      ]);
      const entries = ledgerRes.ok ? ledgerRes.data.entries || [] : [];
      const summary = ledgerRes.ok ? ledgerRes.data.summary || null : null;
      const status = statusRes.ok ? statusRes.data : null;
      setLedgerEntries(entries);
      setLedgerSummary(summary);
      setOwnerStatus(status);
      try {
        localStorage.setItem(
          cacheKey(user.email),
          JSON.stringify({
            userWalletCents: walletCents,
            userWalletTxs: walletTxs,
            ownerGroupId: groupId,
            ledgerEntries: entries,
            ledgerSummary: summary,
            ownerStatus: status,
          })
        );
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseHoldTest = async () => {
    if (!user?.email) return;
    setReleaseLoading(true);
    const { ok, data } = await stripeApi("release-hold-test", {});
    setReleaseLoading(false);
    if (!ok) {
      toast.error(data?.error || "Rilascio non riuscito.");
      return;
    }
    toast.success(`${data.released || 0} importi spostati in "Disponibile".`);
    const ledgerRes = await stripeApi("ledger", { ownerEmail: user.email });
    if (ledgerRes.ok) {
      setLedgerEntries(ledgerRes.data.entries || []);
      setLedgerSummary(ledgerRes.data.summary || null);
    }
  };


  const handleRefreshStatus = async () => {
    if (!user?.email) return;
    setStatusRefreshing(true);
    const res = await stripeApi("owner-status", { ownerEmail: user.email, ownerUid: user.uid, ownerName: user.full_name });
    if (res.ok) {
      setOwnerStatus(res.data);
      if (res.data.payouts_enabled) toast.success("Verifica completata! Puoi prelevare.");
      else if (res.data.requirements?.length)
        toast.info(`Ti mancano ancora: ${humanizeStripeRequirements(res.data.requirements).join(" • ")}`);
      else toast.info("Verifica ancora in corso da parte di Stripe.");
    }
    setStatusRefreshing(false);
  };

  const handleStartVerification = async () => {
    if (!user?.email || !user?.uid) return;
    setVerifyLoading(true);
    try {
      const { ok, data } = await stripeApi("onboarding-link", {
        ownerEmail: user.email,
        ownerUid: user.uid,
        ownerName: user.full_name,
        groupId: ownerGroupId,
      });
      if (ok && data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Impossibile generare il link di verifica.");
      }
    } catch {
      toast.error("Errore di connessione.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResetStripeAccount = async () => {
    if (!user?.email || !user?.uid) return;
    setResetStripeLoading(true);
    try {
      const reset = await stripeApi("reset-stripe-account", {
        ownerEmail: user.email,
        ownerUid: user.uid,
        ownerName: user.full_name,
      });
      if (!reset.ok) {
        toast.error(reset.data.error || "Impossibile riparare l'account Stripe.");
        return;
      }
      toast.success("Account Stripe riparato. Apro la verifica pulita…");
      const link = await stripeApi("onboarding-link", {
        ownerEmail: user.email,
        ownerUid: user.uid,
        ownerName: user.full_name,
        groupId: ownerGroupId,
      });
      if (link.ok && link.data.url) window.location.href = link.data.url;
      else toast.error(link.data.error || "Account riparato, ma link verifica non generato.");
    } catch {
      toast.error("Errore di connessione.");
    } finally {
      setResetStripeLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user?.email) return;
    const available = ledgerSummary?.available_total || 0;
    if (available < MIN_PAYOUT_EUR) {
      toast.error(`Soglia minima di prelievo €${MIN_PAYOUT_EUR.toFixed(2)}.`);
      return;
    }
    if (!ownerStatus?.payouts_enabled) {
      toast.error("Devi completare la verifica identità prima di prelevare.");
      return;
    }
    await executeWithRateLimit(async () => {
      setWithdrawLoading(true);
      try {
        let { ok, data } = await stripeApi("payout", { ownerEmail: user.email, ownerUid: user.uid, ownerName: user.full_name });
        // TEST MODE: if platform balance is still pending, top-up instantly and retry
        if (!ok && data?.code === "platform_balance_pending" && data?.required_cents) {
          toast.info("Modalità test: aggiungo fondi al saldo piattaforma...");
          const topup = await stripeApi("test-fund-platform", { amount_cents: Math.max(data.required_cents, 1000) });
          if (topup.ok && topup.data?.success) {
            toast.success(`Saldo test ricaricato di €${(topup.data.amount_cents / 100).toFixed(2)}. Riprovo il prelievo...`);
            ({ ok, data } = await stripeApi("payout", { ownerEmail: user.email, ownerUid: user.uid, ownerName: user.full_name }));
          } else {
            toast.error(topup.data?.error || "Ricarica test fallita.");
          }
        }
        if (ok && data.success) {
          toast.success(`Prelievo di €${((data.payout_cents || 0) / 100).toFixed(2)} avviato! Arriverà sul tuo IBAN entro 1-2 giorni.`);
          loadAll();
        } else {
          toast.error(data.error || "Errore durante il prelievo.");
        }
      } catch {
        toast.error("Errore di connessione.");
      } finally {
        setWithdrawLoading(false);
      }
      return true;
    });
  };

  const isOwner = ownerGroupId !== null;
  const daysUntilRelease = (d: string) => Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000));

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      in_hold: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      available: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      paid_out: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      reversed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      refunded: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-300 font-bold",
    };
    return map[s] || "bg-muted text-muted-foreground";
  };
  const statusLabel = (s: string) => ({ in_hold: "In hold", available: "Disponibile", paid_out: "Prelevato", reversed: "Annullato", refunded: "Rimborsato" } as any)[s] || s;

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  }

  const txLabel = (t: WalletTransaction) => {
    if (t.type === "refund_credit") return "Rimborso accreditato";
    if (t.type === "checkout_spend") return "Iscrizione a gruppo";
    if (t.type === "spend_reversal") return "Credito ripristinato";
    return "Movimento";
  };
  const txIcon = (t: WalletTransaction) =>
    t.amount_cents > 0 ? <ArrowDownLeft className="w-4 h-4 text-green-600" /> : <ArrowUpRight className="w-4 h-4 text-orange-600" />;

  const hasWalletCredit = userWalletCents > 0;

  const userWalletSection = !hasWalletCredit ? null : (
    <Card className="panel overflow-hidden border-primary/30 bg-primary-soft/35 h-full flex flex-col">
      <div className="p-5 lg:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-14 h-14 rounded-2xl gradient-divideit flex items-center justify-center shrink-0">
            <Gift className="w-7 h-7 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Credito Wallet DivideIt</p>
            <p className="text-3xl lg:text-4xl font-extrabold leading-tight">€{centsToEur(userWalletCents)}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground sm:max-w-[220px] sm:text-right">
          Ottenuto da rimborsi. Si applica automaticamente ai prossimi acquisti, non è prelevabile su IBAN.
        </p>
      </div>

      {userWalletTxs.length > 0 && (
        <div className="border-t bg-background/60">
          <div className="px-5 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Movimenti credito
          </div>
          <div className="divide-y">
            {userWalletTxs.slice(0, 5).map((t) => (
              <div key={t.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {txIcon(t)}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{txLabel(t)}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.description || ""}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-bold text-sm ${t.amount_cents > 0 ? "text-green-600" : "text-orange-600"}`}>
                    {t.amount_cents > 0 ? "+" : ""}€{centsToEur(Math.abs(t.amount_cents))}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(t.created_at), "dd MMM HH:mm", { locale: it })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );


  if (!isOwner) {
    return (
      <div className="px-4 pb-24 pt-8 lg:px-10 lg:pb-10 lg:pt-12">
        <div className="mx-auto max-w-3xl">
          <span className="eyebrow">Finanze</span>
          <h1 className="display-lg mt-4 text-foreground">Portafoglio</h1>
          <p className="mb-8 mt-3 text-muted-foreground leading-relaxed">
            {hasWalletCredit ? "Il tuo credito DivideIt" : "Guadagni e pagamenti dei tuoi gruppi"}
          </p>

          <div className="mb-8">{userWalletSection}</div>
          <Card className="p-10 text-center">
            <WalletIcon className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-bold mb-2">Nessun gruppo gestito</h3>
            <p className="text-muted-foreground text-sm">Crea un gruppo per iniziare a ricevere pagamenti dai membri sul tuo IBAN.</p>
          </Card>
        </div>
      </div>
    );
  }

  const available = ledgerSummary?.available_total || 0;
  const hasAccount = !!ownerStatus?.stripe_account_id;
  const isVerified = !!ownerStatus?.payouts_enabled;
  const canWithdraw = isVerified && available >= MIN_PAYOUT_EUR;

  return (
    <div className="px-4 pb-24 pt-8 lg:px-10 lg:pb-10 lg:pt-12">
      <div className="mx-auto max-w-5xl">
        <span className="eyebrow">Finanze</span>
        <h1 className="display-lg mt-4 text-foreground">Portafoglio</h1>
        <p className="mb-10 mt-3 text-muted-foreground leading-relaxed">
          {hasWalletCredit ? "Credito DivideIt e guadagni dai gruppi che gestisci" : "Guadagni dai gruppi che gestisci"}
        </p>


        {/* Credito + Saldo/Verifica: stessa riga su desktop, separate */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-8 items-stretch">
          {hasWalletCredit ? userWalletSection : null}


          {/* Payout + verifica */}
          <Card className={`panel overflow-hidden border-primary/20 h-full flex flex-col ${hasWalletCredit ? "" : "lg:col-span-2"}`}>
            {/* Saldo e prelievo */}
            <div className="p-5 lg:p-6 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl gradient-divideit flex items-center justify-center shrink-0">
                  <Download className="w-7 h-7 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Saldo disponibile</p>
                  <p className="text-3xl lg:text-4xl font-extrabold leading-tight">€{available.toFixed(2)}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {available < MIN_PAYOUT_EUR
                  ? `Mancano €${(MIN_PAYOUT_EUR - available).toFixed(2)} alla soglia minima di €${MIN_PAYOUT_EUR.toFixed(2)}`
                  : isVerified
                    ? "Prelevabile appena il saldo Stripe piattaforma è disponibile"
                    : "Completa la verifica qui sotto per prelevare"}
              </p>
              <Button
                onClick={handleWithdraw}
                disabled={!canWithdraw || withdrawLoading || withdrawLocked}
                size="lg"
                className="btn-lift w-full rounded-full bg-primary font-semibold text-primary-foreground disabled:opacity-50"
              >
                {withdrawLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ArrowUpRight className="w-5 h-5 mr-2" />}
                Preleva su IBAN
              </Button>
            </div>

            {/* Stato verifica */}
            <div
              className={`p-5 lg:p-6 border-t flex-1 ${
                isVerified ? "bg-green-50/60 dark:bg-green-900/10" : "bg-orange-50/60 dark:bg-orange-900/10"
              }`}
            >
              {isVerified ? (
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold">Identità verificata</h3>
                    <p className="text-sm text-muted-foreground mt-1">Puoi prelevare i fondi disponibili sul tuo IBAN.</p>
                    <Button variant="outline" size="sm" onClick={handleRefreshStatus} disabled={statusRefreshing} className="rounded-xl mt-4">
                      {statusRefreshing ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RotateCcw className="w-3 h-3 mr-2" />}
                      Aggiorna stato
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base">
                      {hasAccount ? "Completa la verifica per prelevare" : "Verifica identità richiesta"}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Onboarding sicuro con Stripe: documento d'identità, codice fiscale e IBAN. Bastano 2 minuti.
                    </p>
                    {ownerStatus?.requirements && ownerStatus.requirements.length > 0 && (
                      <div className="mt-3 p-3 rounded-lg bg-orange-100/50 dark:bg-orange-900/20">
                        <p className="text-xs font-semibold text-orange-800 dark:text-orange-300 mb-2">
                          Ti mancano ancora questi dati:
                        </p>
                        <ul className="space-y-1.5">
                          {humanizeStripeRequirements(ownerStatus.requirements).map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-orange-900 dark:text-orange-200">
                              <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-[11px] text-orange-800/80 dark:text-orange-300/80 mt-2">
                          Li inserisci in pochi secondi nella pagina sicura di Stripe: tocca "{hasAccount ? "Continua verifica" : "Avvia verifica"}".
                        </p>
                      </div>
                    )}

                    {ownerStatus?.disabled_reason && (() => {
                      const info = humanizeStripeDisabledReason(ownerStatus.disabled_reason);
                      return (
                        <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-[2px]" />
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-destructive">{info.title}</p>
                              <p className="text-[12px] leading-snug text-destructive/80 mt-1">{info.detail}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex flex-wrap gap-2 mt-4">
                      <Button onClick={handleStartVerification} disabled={verifyLoading} className="gradient-divideit text-white rounded-xl">
                        {verifyLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                        {hasAccount ? "Continua verifica" : "Avvia verifica"}
                      </Button>
                      {hasAccount && (
                        <Button variant="outline" size="sm" onClick={handleRefreshStatus} disabled={statusRefreshing} className="rounded-xl">
                          {statusRefreshing ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RotateCcw className="w-3 h-3 mr-2" />}
                          Aggiorna stato
                        </Button>
                      )}
                      {hasAccount && !ownerStatus?.payouts_enabled && (
                        <Button variant="outline" size="sm" onClick={handleResetStripeAccount} disabled={resetStripeLoading} className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10">
                          {resetStripeLoading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RotateCcw className="w-3 h-3 mr-2" />}
                          Ripara account
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Prelievo automatico */}
        <AutoPayoutCard userId={user?.uid} isVerified={isVerified} />




        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">In hold</p>
                <p className="text-2xl font-bold">€{(ledgerSummary?.in_hold_total || 0).toFixed(2)}</p>
                {ledgerSummary?.next_release_date && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Prossimo rilascio: {format(new Date(ledgerSummary.next_release_date), "dd MMM yyyy", { locale: it })}
                  </p>
                )}
                {(ledgerSummary?.in_hold_total || 0) > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReleaseHoldTest}
                    disabled={releaseLoading}
                    className="mt-3 rounded-xl"
                  >
                    {releaseLoading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RotateCcw className="w-3 h-3 mr-2" />}
                    Rilascia hold (test)
                  </Button>
                )}
              </div>

            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Disponibile</p>
                <p className="text-2xl font-bold">€{available.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">Soglia min: €{MIN_PAYOUT_EUR.toFixed(2)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Prelevato</p>
                <p className="text-2xl font-bold">€{(ledgerSummary?.paid_out_total || 0).toFixed(2)}</p>
              </div>
            </div>
          </Card>
        </div>




        {/* Ledger */}
        <Card className="rounded-2xl overflow-hidden">
          <div className="p-6 border-b flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Movimenti</h2>
          </div>
          {ledgerEntries.length === 0 ? (
            <div className="p-12 text-center">
              <TrendingUp className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">Nessun movimento. Quando i membri pagano, vedrai qui i fondi.</p>
            </div>
          ) : (
            <div className="divide-y">
              {ledgerEntries.map((entry) => (
                <div key={entry.id} className="p-4 lg:p-6 flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <p className={`font-semibold mb-1 ${entry.status === "refunded" ? "text-red-600 dark:text-red-400" : ""}`}>
                      {entry.status === "in_hold"
                        ? `In hold – disponibile tra ${daysUntilRelease(entry.release_at)} giorni`
                        : entry.status === "available" ? "Disponibile per prelievo"
                        : entry.status === "paid_out" ? "Prelevato sul tuo IBAN"
                        : entry.status === "refunded" ? "Rimborsato all'utente"
                        : "Annullato"}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Pagato: {format(new Date(entry.paid_at), "dd MMM yyyy", { locale: it })}</span>
                      <span>Lordo: €{Number(entry.gross_amount).toFixed(2)}</span>
                      <span>Fee: €{Number(entry.platform_fee).toFixed(2)}</span>
                      <span className="font-semibold text-foreground">Netto: €{Number(entry.net_amount).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">€{Number(entry.net_amount).toFixed(2)}</p>
                    <Badge className={`mt-1 ${statusBadge(entry.status)}`}>{statusLabel(entry.status)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="mt-6 p-5 rounded-2xl bg-muted/30">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold text-sm">Come funzionano fee e prelievi</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Il Joiner paga la quota + €0,99 di fee servizio. La quota netta arriva sul tuo wallet dopo 25 giorni di hold (anti-rimborso).
                Quando hai almeno €{MIN_PAYOUT_EUR} disponibili e hai completato la verifica Stripe, puoi prelevarli sul tuo IBAN. Le fee piattaforma restano a DivideIt.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
