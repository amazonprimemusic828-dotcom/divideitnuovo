import { Link, useSearchParams } from "react-router-dom";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, CircleHelp, Compass, Plus, Sparkles, TrendingDown, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import ServiceLogo from "@/components/ServiceLogo";
import SubscriptionTile, { euro, type SubscriptionSummary } from "./SubscriptionTile";

export default function DashboardOverview({ name, groups, balance, preview = false }: { name: string; groups: SubscriptionSummary[]; balance?: number; preview?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const monthly = groups.reduce((sum, group) => sum + group.total / Math.max(group.capacity, 1), 0);
  const saved = groups.reduce((sum, group) => sum + group.total - group.total / Math.max(group.capacity, 1), 0);
  const tab = searchParams.get("role") || "all";
  const groupOnly = searchParams.get("tab") === "groups";
  const filtered = groups.filter((group) => tab === "all" || group.role === tab);
  const metrics = [
    { label: "Risparmi questo mese", value: euro(saved), caption: `${euro(saved * 12)} in un anno, a questo ritmo`, icon: TrendingDown, featured: true },
    { label: "Spesa mensile", value: euro(monthly), caption: "Per tutti i tuoi abbonamenti", icon: Wallet },
    { label: "Gruppi attivi", value: String(groups.length).padStart(2, "0"), caption: `${groups.filter((group) => group.role === "admin").length} gestiti da te`, icon: Users },
    { label: balance === undefined ? "Prossimo rinnovo" : "Il tuo portafoglio", value: balance === undefined ? groups[0]?.renewal || "—" : euro(balance), caption: balance === undefined ? groups[0]?.name || "Nessuna scadenza" : "Saldo disponibile", icon: balance === undefined ? CalendarDays : ArrowDownLeft },
  ];
  return (
    <div className="studio-page">
      <PageHeader title={groupOnly ? "I tuoi gruppi, tutti qui." : `Bello ritrovarti, ${name.split(" ")[0] || "ciao"}.`} description={groupOnly ? "Le tue passioni, le tue persone. Gestisci tutto da un solo posto." : "Meno pensieri, più cose che ami. Ecco come sta andando."} action={<Button asChild><Link to="/CreateGroup"><Plus data-icon="inline-start" />Crea un gruppo</Link></Button>} />
      {!groupOnly && <RevealGroup className="dashboard-metrics">{metrics.map(({ label, value, caption, icon: Icon, featured }) => <RevealItem key={label}><div className={featured ? "metric-card metric-featured" : "metric-card"}><div className="flex items-center justify-between"><span className="text-sm font-medium">{label}</span><Icon className="size-[18px] opacity-70" /></div><p className="metric-value font-display">{value}</p><p className="text-sm opacity-70">{caption}</p></div></RevealItem>)}</RevealGroup>}
      <Reveal delay={0.08}>
        <Tabs value={tab} onValueChange={(value) => setSearchParams((params) => { params.set("role", value); return params; })}>
          <div className="section-heading"><div><h2 className="section-title">I tuoi abbonamenti<Badge variant="secondary">{groups.length}</Badge></h2><p className="pt-1 text-sm text-muted-foreground">Un piccolo spazio per tutte le tue passioni.</p></div><Button variant="ghost" asChild><Link to="/BrowseGroups">Esplora altri gruppi<ArrowUpRight data-icon="inline-end" /></Link></Button></div>
          <div className="pt-5"><TabsList className="studio-tabs"><TabsTrigger value="all">Tutti i gruppi</TabsTrigger><TabsTrigger value="admin">Gestiti da me</TabsTrigger><TabsTrigger value="member">A cui partecipo</TabsTrigger></TabsList></div>
          {["all", "admin", "member"].map((value) => <TabsContent key={value} value={value} className="pt-4">{filtered.length ? <div className="subscription-grid">{filtered.map((group) => <SubscriptionTile key={group.id} group={group} />)}</div> : <Card><Empty><EmptyHeader><EmptyMedia variant="icon"><Compass /></EmptyMedia><EmptyTitle>Le cose belle iniziano da un gruppo.</EmptyTitle><EmptyDescription>Non ci sono ancora abbonamenti in questa sezione. Trova quello giusto per te.</EmptyDescription></EmptyHeader><EmptyContent><Button asChild><Link to="/BrowseGroups">Esplora i gruppi<ArrowRight data-icon="inline-end" /></Link></Button></EmptyContent></Empty></Card>}</TabsContent>)}
        </Tabs>
      </Reveal>
      {!groupOnly && <Reveal delay={0.16}><div className="dashboard-lower"><Card><CardHeader><div className="flex items-center justify-between"><CardTitle>Le prossime scadenze</CardTitle><CalendarDays className="size-5 text-muted-foreground" /></div><CardDescription>Ci pensi una volta. Al resto, ci pensiamo insieme.</CardDescription></CardHeader><CardContent><div className="flex flex-col">{groups.slice(0, 3).map((group) => <Link className="compact-payment-row" to={`/GroupDetail?id=${group.id}`} key={group.id}><span className="service-tile small"><ServiceLogo name={group.service} size={26} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{group.name}</p><p className="text-sm text-muted-foreground">Rinnovo automatico</p></div><span className="hidden text-sm text-muted-foreground sm:block">{group.renewal || "Mensile"}</span><span className="text-sm font-semibold tabular-nums">{euro(group.total / Math.max(group.capacity, 1))}</span></Link>)}{!groups.length && <p className="text-sm text-muted-foreground">Nessuna scadenza in arrivo.</p>}</div></CardContent></Card><Card className="sharing-note"><CardHeader><span className="note-icon"><Sparkles className="size-5" /></span><CardTitle>Il bello è che conviene a tutti.</CardTitle><CardDescription>Dividi le spese. Moltiplica le possibilità. Ogni gruppo è un piccolo passo verso un mese più leggero.</CardDescription></CardHeader><CardContent><div className="flex items-center gap-2 text-sm font-medium text-mint"><Check className="size-4" />Solo la tua quota, senza sorprese.</div><div className="pt-6"><Button variant="outline" asChild><Link to="/BrowseGroups">Trova la tua prossima passione<ArrowUpRight data-icon="inline-end" /></Link></Button></div></CardContent></Card></div></Reveal>}
      {preview && <p className="flex items-center gap-2 text-sm text-muted-foreground"><CircleHelp className="size-4 shrink-0" />Importi illustrativi. Ogni condivisione deve rispettare le condizioni del servizio.</p>}
    </div>
  );
}
