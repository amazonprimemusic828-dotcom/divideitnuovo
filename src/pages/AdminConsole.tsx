import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/components/AuthContext";
import NotFound from "@/pages/NotFound";
import { stripeApi } from "@/lib/stripeApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, RefreshCw, TrendingUp, CreditCard, Banknote, ShieldAlert,
  Activity, Users, ArrowUpRight, AlertTriangle, CheckCircle2, Settings2, PieChart,
} from "lucide-react";

interface Totals {
  gross_volume: number; profit_payments: number; profit_ledger: number;
  pending_payouts: number; refunded_amount: number; payments_count: number;
  paid_count: number; groups_count: number; active_groups: number;
  members_count: number; paid_members: number;
}
interface GrowthPoint { month: string; revenue: number; profit: number; payments: number; groups: number; members: number; }
interface Issue { level: "ok" | "info" | "warning" | "critical"; title: string; detail: string; count: number; }

interface Overview {
  totals: Totals;
  growth: GrowthPoint[];
  payments: any[];
  ledger: any[];
  refunds: any[];
  audit: any[];
  issues: Issue[];
}

const eur = (n: number) => `€${Number(n || 0).toFixed(2)}`;
const monthLabel = (m: string) => {
  const [y, mm] = m.split("-");
  return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString("it-IT", { month: "short" });
};

function StatTile({ icon: Icon, label, value, hint, accent }: any) {
  return (
    <Card className="p-5 rounded-2xl border-border/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-extrabold mt-1 truncate">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent || "bg-primary/10 text-primary"}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

function GrowthChart({ data, metric }: { data: GrowthPoint[]; metric: keyof GrowthPoint }) {
  const max = Math.max(1, ...data.map((d) => Number(d[metric] || 0)));
  return (
    <div className="flex items-end gap-2 h-48">
      {data.map((d) => {
        const v = Number(d[metric] || 0);
        const h = Math.max(2, (v / max) * 100);
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-2 group">
            <span className="text-[10px] font-semibold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              {metric === "revenue" || metric === "profit" ? eur(v) : v}
            </span>
            <div className="w-full rounded-t-lg bg-gradient-to-t from-primary/40 to-primary transition-all" style={{ height: `${h}%` }} />
            <span className="text-[10px] text-muted-foreground">{monthLabel(d.month)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminConsole() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [data, setData] = useState<Overview | null>(null);
  const [metric, setMetric] = useState<keyof GrowthPoint>("revenue");
  const [auditFilter, setAuditFilter] = useState<"all" | "success" | "error" | "pending">("all");

  const load = async () => {
    if (!user?.email) return;
    setLoading(true);
    const res = await stripeApi("admin-overview", { actorEmail: user.email });
    if (res.status === 403) setForbidden(true);
    else if (res.ok) setData(res.data as Overview);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.email]);

  const profit = useMemo(() => {
    if (!data) return 0;
    return Math.max(data.totals.profit_ledger, data.totals.profit_payments);
  }, [data]);

  const filteredAudit = useMemo(() => {
    const list = (data?.audit || []) as any[];
    return auditFilter === "all" ? list : list.filter((a) => (a.status || "info") === auditFilter);
  }, [data, auditFilter]);


  if (!user) return <Navigate to="/Auth" replace />;

  if (loading && !data) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  // Non-admins must not even know this console exists: show the standard 404.
  if (forbidden) return <NotFound />;

  const t = data?.totals;

  return (
    <div className="p-4 lg:p-10 pb-24 lg:pb-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight flex items-center gap-3">
              <Activity className="w-8 h-8 text-primary" /> Console Amministratore
            </h1>
            <p className="text-muted-foreground mt-1">Pagamenti Stripe, profitti, crescita e stato di sicurezza della piattaforma.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Aggiorna
            </Button>
            <Button asChild className="gradient-divideit text-white rounded-xl">
              <Link to="/admin/fees"><Settings2 className="w-4 h-4 mr-2" /> Fee & Config</Link>
            </Button>
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile icon={Banknote} label="Profitto fee" value={eur(profit)} hint="Fee piattaforma accumulate" accent="bg-green-500/10 text-green-600" />
          <StatTile icon={CreditCard} label="Volume incassato" value={eur(t?.gross_volume || 0)} hint={`${t?.paid_count || 0} pagamenti riusciti`} />
          <StatTile icon={ArrowUpRight} label="Da liquidare" value={eur(t?.pending_payouts || 0)} hint="Netto admin non ancora prelevato" accent="bg-amber-500/10 text-amber-600" />
          <StatTile icon={Users} label="Utenti attivi" value={String(t?.paid_members || 0)} hint={`${t?.active_groups || 0} gruppi attivi`} accent="bg-blue-500/10 text-blue-600" />
        </div>

        <Tabs defaultValue="payments" className="space-y-6">
          <TabsList className="grid grid-cols-4 gap-2 h-auto p-2 bg-muted/50 rounded-2xl">
            <TabsTrigger value="payments" className="rounded-xl py-2.5 font-semibold text-sm">Pagamenti</TabsTrigger>
            <TabsTrigger value="profit" className="rounded-xl py-2.5 font-semibold text-sm">Profitti</TabsTrigger>
            <TabsTrigger value="growth" className="rounded-xl py-2.5 font-semibold text-sm">Crescita</TabsTrigger>
            <TabsTrigger value="health" className="rounded-xl py-2.5 font-semibold text-sm">Sicurezza</TabsTrigger>
          </TabsList>

          {/* PAYMENTS */}
          <TabsContent value="payments">
            <Card className="rounded-2xl overflow-hidden border-border/60">
              <div className="p-5 border-b border-border/60">
                <h3 className="font-bold text-lg">Pagamenti Stripe recenti</h3>
                <p className="text-sm text-muted-foreground">Ultime {data?.payments?.length || 0} transazioni registrate.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="text-left font-semibold px-4 py-3">Data</th>
                      <th className="text-left font-semibold px-4 py-3">Utente</th>
                      <th className="text-right font-semibold px-4 py-3">Importo</th>
                      <th className="text-right font-semibold px-4 py-3">Fee</th>
                      <th className="text-right font-semibold px-4 py-3">Netto admin</th>
                      <th className="text-left font-semibold px-4 py-3">Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.payments || []).map((p: any) => (
                      <tr key={p.id} className="border-t border-border/50">
                        <td className="px-4 py-3 whitespace-nowrap">{new Date(p.created_date || p.payment_date).toLocaleDateString("it-IT")}</td>
                        <td className="px-4 py-3 max-w-[220px] truncate">{p.user_email}</td>
                        <td className="px-4 py-3 text-right font-semibold">{eur(p.amount)}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-semibold">{eur(p.platform_fee)}</td>
                        <td className="px-4 py-3 text-right">{eur(p.owner_amount)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={p.status === "paid" ? "default" : "destructive"} className="rounded-full">{p.status}</Badge>
                        </td>
                      </tr>
                    ))}
                    {!data?.payments?.length && (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Nessun pagamento registrato.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* PROFIT */}
          <TabsContent value="profit" className="space-y-6">
            <Card className="p-6 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border-border/60">
              <div className="flex items-center gap-2 mb-1"><PieChart className="w-5 h-5 text-primary" /><h3 className="font-bold text-lg">Il tuo profitto</h3></div>
              <p className="text-4xl font-extrabold my-2">{eur(profit)}</p>
              <p className="text-sm text-muted-foreground mb-4">
                Somma delle fee piattaforma su tutte le transazioni. Rimangono sul tuo account Stripe principale.
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div><p className="text-xs text-muted-foreground">Rimborsato</p><p className="font-bold">{eur(t?.refunded_amount || 0)}</p></div>
                <div><p className="text-xs text-muted-foreground">Da liquidare agli admin</p><p className="font-bold">{eur(t?.pending_payouts || 0)}</p></div>
                <div><p className="text-xs text-muted-foreground">Transazioni totali</p><p className="font-bold">{t?.payments_count || 0}</p></div>
              </div>
              <Button asChild className="mt-5 rounded-xl gradient-divideit text-white">
                <Link to="/admin/fees">Preleva le fee sul tuo IBAN</Link>
              </Button>
            </Card>

            <Card className="rounded-2xl overflow-hidden border-border/60">
              <div className="p-5 border-b border-border/60"><h3 className="font-bold text-lg">Registro guadagni (wallet ledger)</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="text-left font-semibold px-4 py-3">Data</th>
                      <th className="text-left font-semibold px-4 py-3">Admin gruppo</th>
                      <th className="text-right font-semibold px-4 py-3">Lordo</th>
                      <th className="text-right font-semibold px-4 py-3">Mia fee</th>
                      <th className="text-right font-semibold px-4 py-3">Netto</th>
                      <th className="text-left font-semibold px-4 py-3">Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.ledger || []).map((r: any) => (
                      <tr key={r.id} className="border-t border-border/50">
                        <td className="px-4 py-3 whitespace-nowrap">{r.paid_at ? new Date(r.paid_at).toLocaleDateString("it-IT") : "—"}</td>
                        <td className="px-4 py-3 max-w-[220px] truncate">{r.owner_email}</td>
                        <td className="px-4 py-3 text-right">{eur(r.gross_amount)}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-semibold">{eur(r.platform_fee)}</td>
                        <td className="px-4 py-3 text-right">{eur(r.net_amount)}</td>
                        <td className="px-4 py-3"><Badge variant="secondary" className="rounded-full">{r.refunded_at ? "refunded" : r.payout_at ? "payout" : r.status || "held"}</Badge></td>
                      </tr>
                    ))}
                    {!data?.ledger?.length && (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Nessun movimento.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* GROWTH */}
          <TabsContent value="growth" className="space-y-6">
            <Card className="p-6 rounded-2xl border-border/60">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-lg">Crescita ultimi 12 mesi</h3>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {([
                    ["revenue", "Ricavi"],
                    ["profit", "Profitto"],
                    ["payments", "Pagamenti"],
                    ["groups", "Gruppi"],
                    ["members", "Membri"],
                  ] as const).map(([k, label]) => (
                    <Button key={k} size="sm" variant={metric === k ? "default" : "outline"} className="rounded-full" onClick={() => setMetric(k as keyof GrowthPoint)}>
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <GrowthChart data={data?.growth || []} metric={metric} />
            </Card>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile icon={Users} label="Gruppi totali" value={String(t?.groups_count || 0)} />
              <StatTile icon={Users} label="Iscrizioni totali" value={String(t?.members_count || 0)} />
              <StatTile icon={CreditCard} label="Tasso pagamenti OK" value={`${t?.payments_count ? Math.round(((t.paid_count || 0) / t.payments_count) * 100) : 0}%`} />
              <StatTile icon={Banknote} label="Ricavo medio / pagamento" value={eur(t?.paid_count ? (t.gross_volume || 0) / t.paid_count : 0)} />
            </div>
          </TabsContent>

          {/* HEALTH / SECURITY */}
          <TabsContent value="health" className="space-y-6">
            <div className="grid gap-4">
              {(data?.issues || []).map((i, idx) => {
                const styles: Record<string, string> = {
                  ok: "bg-green-500/10 text-green-600 border-green-500/30",
                  info: "bg-blue-500/10 text-blue-600 border-blue-500/30",
                  warning: "bg-amber-500/10 text-amber-600 border-amber-500/30",
                  critical: "bg-destructive/10 text-destructive border-destructive/30",
                };
                const Icon = i.level === "ok" ? CheckCircle2 : i.level === "critical" ? ShieldAlert : AlertTriangle;
                return (
                  <Card key={idx} className={`p-5 rounded-2xl border ${styles[i.level]}`}>
                    <div className="flex items-start gap-3">
                      <Icon className="w-5 h-5 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-bold text-foreground">{i.title}</p>
                        <p className="text-sm text-muted-foreground">{i.detail}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <Card className="rounded-2xl overflow-hidden border-border/60">
              <div className="p-5 border-b border-border/60 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="font-bold text-lg">Log eventi recenti</h3>
                  <p className="text-sm text-muted-foreground">Ogni evento indica se è andato a buon fine o in errore.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {([
                    ["all", "Tutti"],
                    ["success", "Successo"],
                    ["error", "Errori"],
                    ["pending", "In corso"],
                  ] as const).map(([k, label]) => (
                    <Button key={k} size="sm" variant={auditFilter === k ? "default" : "outline"} className="rounded-full"
                      onClick={() => setAuditFilter(k)}>
                      {label}
                      {k !== "all" && (
                        <span className="ml-1.5 opacity-70">
                          {(data?.audit || []).filter((a: any) => (a.status || "info") === k).length}
                        </span>
                      )}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="divide-y divide-border/50 max-h-[420px] overflow-y-auto">
                {filteredAudit.map((a: any) => {
                  const status = a.status || "info";
                  const styles: Record<string, string> = {
                    success: "bg-green-500/10 text-green-600 border-green-500/30",
                    error: "bg-destructive/10 text-destructive border-destructive/30",
                    pending: "bg-amber-500/10 text-amber-600 border-amber-500/30",
                    info: "bg-muted text-muted-foreground border-border",
                  };
                  const Icon = status === "success" ? CheckCircle2 : status === "error" ? ShieldAlert : status === "pending" ? Loader2 : Activity;
                  return (
                    <div key={a.id} className="px-5 py-3 flex items-start justify-between gap-4">
                      <div className="min-w-0 flex items-start gap-3">
                        <span className={`mt-0.5 w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${styles[status]}`}>
                          <Icon className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{a.action}</p>
                          <p className="text-xs text-muted-foreground truncate">{a.actor_email || "sistema"} · {a.target_type || "—"}</p>
                          {a.status_detail && <p className="text-xs text-destructive mt-0.5 line-clamp-2">{a.status_detail}</p>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="outline" className={`rounded-full mb-1 ${styles[status]}`}>{a.status_label || "Info"}</Badge>
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(a.created_at).toLocaleString("it-IT")}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {!filteredAudit.length && <p className="px-5 py-10 text-center text-muted-foreground">Nessun evento registrato.</p>}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
