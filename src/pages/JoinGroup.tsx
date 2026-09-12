import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/components/AuthContext";
import {
  getGroupById,
  getMembershipsByGroupId,
  Group
} from "@/lib/supabaseClient";
import { stripeApi } from "@/lib/stripeApi";
import { getWallet, centsToEur } from "@/lib/walletApi";
import { SERVICE_COLORS, STRIPE_FEE_PER_PERSON } from "@/lib/serviceConstants";
import ServiceLogo from "@/components/ServiceLogo";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, CreditCard, Calendar, Shield, Loader2, Wallet as WalletIcon } from "lucide-react";
import { toast } from "sonner";

const RELATIONS = ["Amici", "Famiglia", "Stesso nucleo domestico", "Team di lavoro"] as const;

const waitForPaidMembership = async (groupId: string, userEmail: string) => {
  const normalizedEmail = userEmail.toLowerCase();
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const members = await getMembershipsByGroupId(groupId);
    const paidMembership = members.some((membership) =>
      membership.payment_status === "paid" &&
      membership.user_email?.toLowerCase() === normalizedEmail
    );
    if (paidMembership) return true;
    await new Promise((resolve) => window.setTimeout(resolve, 1_000));
  }
  return false;
};


export default function JoinGroup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get("id");
  const paymentResult = searchParams.get("payment");
  const sessionIdParam = searchParams.get("session_id");
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [walletBalanceCents, setWalletBalanceCents] = useState(0);
  const [useWallet, setUseWallet] = useState(true);
  const [relation, setRelation] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);


  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { navigate('/Auth'); return; }

    if (paymentResult === 'success' && groupId && user?.email && user?.uid) {
      const storageKey = `divideit_checkout_${groupId}`;
      const savedSessionId = sessionIdParam || localStorage.getItem(storageKey);
      if (savedSessionId) {
        setVerifying(true);
        // Stripe's signed webhook is the primary finalizer. Waiting for it first
        // avoids an unnecessary browser-side verification race immediately after
        // a first Google/referral login. The authenticated verify call remains a
        // recovery path if webhook delivery is delayed.
        waitForPaidMembership(groupId, user.email).then(async (webhookFinalized) => {
          if (webhookFinalized) {
            localStorage.removeItem(storageKey);
            toast.success("Pagamento verificato! Sei entrato nel gruppo.");
            navigate(`/GroupDetail?id=${groupId}`);
            return;
          }

          const { ok, data } = await stripeApi('verify-session', {
            sessionId: savedSessionId, groupId,
            userEmail: user.email, userId: user.uid,
          });
          if (ok && data.verified) {
            localStorage.removeItem(storageKey);
            toast.success("Pagamento verificato! Sei entrato nel gruppo.");
            navigate(`/GroupDetail?id=${groupId}`);
          } else {
            toast.info("Pagamento ricevuto. La conferma è ancora in elaborazione: riprova tra poco.");
            setVerifying(false);
          }
        }).catch(() => {
          void waitForPaidMembership(groupId, user.email).then((paidMembership) => {
            if (paidMembership) {
              localStorage.removeItem(storageKey);
              toast.success("Pagamento verificato! Sei entrato nel gruppo.");
              navigate(`/GroupDetail?id=${groupId}`);
              return;
            }
            setVerifying(false);
            toast.info("Pagamento ricevuto. La conferma è ancora in elaborazione: riprova tra poco.");
          });
        });
      } else { toast.info("Pagamento in fase di conferma..."); loadData(); }
      return;
    }

    if (paymentResult === 'cancelled') {
      const sid = sessionIdParam || localStorage.getItem(`divideit_checkout_${groupId}`);
      if (sid && user?.email) {
        // Refund any wallet reservation
        stripeApi('checkout-cancelled', { sessionId: sid, userEmail: user.email })
          .then(({ data }) => {
            if (data?.reversed_cents) {
              toast.info(`Credito Wallet ripristinato: €${centsToEur(data.reversed_cents)}`);
            }
          })
          .catch(() => {});
      }
      if (groupId) localStorage.removeItem(`divideit_checkout_${groupId}`);
      toast.error("Pagamento annullato.");
    }

    loadData();
  }, [authLoading, isAuthenticated, groupId, paymentResult]);

  const loadData = async () => {
    if (!groupId || !user?.email) return;
    try {
      const [foundGroup, groupMembers, wallet] = await Promise.all([
        getGroupById(groupId),
        getMembershipsByGroupId(groupId),
        getWallet(user.email),
      ]);
      if (!foundGroup) { toast.error("Gruppo non trovato"); navigate('/BrowseGroups'); return; }
      const existingMembership = groupMembers.find(m => m.user_email?.toLowerCase() === user.email?.toLowerCase());
      if (existingMembership && existingMembership.payment_status === 'paid') {
        if (paymentResult !== 'success') toast.success("Sei già membro di questo gruppo!");
        navigate(`/GroupDetail?id=${groupId}`); return;
      }
      const joinersPaid = groupMembers.filter(m => m.payment_status === 'paid' && m.user_email?.toLowerCase() !== foundGroup.admin_email?.toLowerCase()).length;
      if (joinersPaid >= foundGroup.max_members) {
        toast.error("Questo gruppo è pieno!");
        navigate('/BrowseGroups'); return;
      }
      setGroup(foundGroup);
      setWalletBalanceCents(wallet.balance_cents);
    } catch (e) {
      console.error(e);
      toast.error("Errore caricamento");
    } finally { setLoading(false); }
  };

  const handlePayAndJoin = async () => {
    if (!user?.email || !group || !groupId) return;
    setPaying(true);

    try {
      const { ok, data } = await stripeApi('checkout', {
        userEmail: user.email,
        userId: user.uid,
        userName: user.full_name || user.email,
        groupId,
        returnUrl: window.location.origin,
        useWalletCents: useWallet ? walletBalanceCents : 0,
      });

      if (!ok) {
        toast.error(data.error || 'Errore nella creazione del pagamento');
        setPaying(false);
        return;
      }

      if (data.alreadyMember) {
        toast.success("Pagamento già confermato. Sei nel gruppo.");
        navigate(data.redirect || `/GroupDetail?id=${groupId}`);
        return;
      }

      // Scenario 1: wallet covers all → immediate redirect
      if (data.wallet_only) {
        toast.success(`Iscritto con €${centsToEur(data.wallet_cents_used)} dal Wallet!`);
        navigate(`/GroupDetail?id=${groupId}`);
        return;
      }

      if (data.url) {
        if (data.sessionId) localStorage.setItem(`divideit_checkout_${groupId}`, data.sessionId);
        window.location.href = data.url;
      } else {
        toast.error('Errore nella creazione del pagamento');
        setPaying(false);
      }
    } catch (e) {
      console.error(e);
      toast.error("Errore durante il pagamento. Riprova.");
      setPaying(false);
    }
  };

  if (loading || verifying) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">
            {verifying ? "Verifica pagamento in corso..." : "Caricamento..."}
          </h2>
        </Card>
      </div>
    );
  }

  if (paymentResult === 'success') {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-3xl font-bold mb-3">Pagamento completato!</h2>
          <p className="text-muted-foreground mb-4">
            Benvenuto nel gruppo <strong>{group?.service_name || ''}</strong>!
          </p>
        </Card>
      </div>
    );
  }

  if (!group) return null;

  const quotaEur = group.total_cost / group.max_members;
  const totalCents = Math.round((quotaEur + STRIPE_FEE_PER_PERSON) * 100);
  const quotaCents = Math.round(quotaEur * 100);
  const feeCents = totalCents - quotaCents;
  const walletApply = useWallet ? Math.min(walletBalanceCents, totalCents) : 0;
  const cardCents = totalCents - walletApply;
  const hasWallet = walletBalanceCents > 0;
    const color = SERVICE_COLORS[group.service_type] || "linear-gradient(135deg, #5B6FBD 0%, #7DD3C0 100%)";

  return (
    <div className="min-h-screen p-4 lg:p-10 pb-24 lg:pb-10">
      <div className="max-w-3xl mx-auto">
        <Card className="overflow-hidden mb-8">
          <div className="h-28 lg:h-32 flex items-center justify-center bg-cover bg-center" style={(group as any).cover_image_url ? { backgroundImage: `url(${(group as any).cover_image_url})` } : { background: color }}>
            <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-white/95 shadow-lg flex items-center justify-center p-3">
                <ServiceLogo name={group.service_type} size={48} className="h-10 w-10 lg:h-12 lg:w-12" />
              </div>
          </div>

          <div className="p-6 lg:p-8">
            <h1 className="text-2xl lg:text-3xl font-bold mb-2">Unisciti a {group.service_name}</h1>
            <p className="text-muted-foreground mb-6">{group.description}</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                  <CreditCard className="w-4 h-4" />
                  <span className="text-sm font-medium">Quota Mensile</span>
                </div>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  €{(totalCents/100).toFixed(2)}
                </p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">Fatturazione</span>
                </div>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">Giorno {group.billing_date}</p>
              </div>
            </div>

            {/* Wallet section */}
            {hasWallet && (
              <Card className="p-4 mb-6 border-2 border-primary/30 bg-primary/5 rounded-xl">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl gradient-divideit flex items-center justify-center shrink-0">
                    <WalletIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">Credito Wallet disponibile</p>
                      <Switch checked={useWallet} onCheckedChange={setUseWallet} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Saldo: <strong className="text-foreground">€{centsToEur(walletBalanceCents)}</strong>
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Breakdown */}
            <Card className="p-4 mb-6 bg-muted/30 rounded-xl">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quota mensile</span>
                  <span>€{(totalCents/100).toFixed(2)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-medium">
                  <span>Totale</span>
                  <span>€{(totalCents/100).toFixed(2)}</span>
                </div>

                {walletApply > 0 && (
                  <div className="flex justify-between text-primary">
                    <span>Credito Wallet</span>
                    <span>-€{centsToEur(walletApply)}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between text-lg font-bold">
                  <span>{cardCents === 0 ? "Da pagare" : "Da pagare con carta"}</span>
                  <span>€{(cardCents/100).toFixed(2)}</span>
                </div>
              </div>
            </Card>

            {/* Relazione con l'admin + termini */}
            <Card className="p-4 mb-6 rounded-xl">
              <p className="text-sm font-semibold mb-3">
                Dichiara la relazione che hai con l'admin:
              </p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {RELATIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRelation(r)}
                    className={`min-h-[44px] px-3 py-2 rounded-xl border-2 text-sm font-medium transition-colors ${
                      relation === r
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={acceptedTerms}
                  onCheckedChange={(v) => setAcceptedTerms(v === true)}
                  className="mt-0.5"
                />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  Confermo di aver compreso che DivideIt non è associato o affiliato con{" "}
                  <strong className="text-foreground">{group.service_name}</strong> e di aver letto,
                  compreso e accettato di rispettare i termini e le condizioni di condivisione di{" "}
                  <strong className="text-foreground">{group.service_name}</strong>.
                </span>
              </label>
            </Card>

            <Card className="p-4 mb-6 bg-muted/50">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold mb-1">Pagamento sicuro</p>
                  <p className="text-xs text-muted-foreground">
                    {cardCents === 0
                      ? "Stai pagando interamente con il tuo credito Wallet DivideIt. Nessun addebito su carta."
                      : "Il pagamento viene elaborato tramite Stripe. I fondi vengono trattenuti per 25 giorni prima di essere rilasciati al proprietario."}
                  </p>
                </div>
              </div>
            </Card>

            <Button
              onClick={handlePayAndJoin}
              disabled={paying || !relation || !acceptedTerms}
              className="w-full h-14 gradient-divideit text-white text-lg rounded-xl disabled:opacity-50"
            >

              {paying ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {cardCents === 0 ? "Iscrizione..." : "Reindirizzamento..."}
                </div>
              ) : cardCents === 0 ? (
                <>
                  <WalletIcon className="w-5 h-5 mr-2" />
                  Unisciti con Wallet (€{centsToEur(walletApply)})
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  Paga €{(cardCents/100).toFixed(2)} e Unisciti
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              L'accesso al gruppo e alla chat sarà disponibile solo dopo il pagamento.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
