import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowDownToLine, ArrowUpRight, Building2, Check, CheckCircle2, ChevronRight, Clock3, Download, Eye, EyeOff, LockKeyhole, Plus, ReceiptText, Search, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import ServiceLogo from "@/components/ServiceLogo";
import { euro } from "@/components/dashboard/SubscriptionTile";
import { cn } from "@/lib/utils";

export interface WalletMovement { id: string; name: string; detail: string; service?: string; amount: number; date: string; dateValue?: string; type: "income" | "expense"; status: string }
interface WalletOverviewProps { balance: number; pending?: number; withdrawn?: number; transactions: WalletMovement[]; preview?: boolean; onWithdraw?: () => void; withdrawLoading?: boolean; extraContent?: ReactNode }

export default function WalletOverview({ balance, pending = 0, withdrawn = 0, transactions, preview = false, onWithdraw, withdrawLoading = false, extraContent }: WalletOverviewProps) {
  const [hidden, setHidden] = useState(false);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [action, setAction] = useState<"withdraw" | "topup" | null>(null);
  const [amount, setAmount] = useState("20");
  const [showResult, setShowResult] = useState(false);
  const filtered = useMemo(() => transactions.filter((transaction) => (tab === "all" || transaction.type === tab) && `${transaction.name} ${transaction.detail}`.toLowerCase().includes(search.toLowerCase()) && (period === "all" || transaction.dateValue?.startsWith(period))), [transactions, tab, search, period]);
  const money = (value: number) => hidden ? "••••••" : euro(value);
  const exportCsv = () => {
    const safeCell = (value: string) => `"${(/^[=+\-@]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
    const rows = [["Data", "Descrizione", "Servizio", "Importo EUR", "Stato"], ...filtered.map((item) => [item.date, item.name, item.detail, item.amount.toFixed(2), item.status])];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(safeCell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = preview ? "divideit-movimenti-anteprima.csv" : "divideit-movimenti.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(preview ? "Esportati i movimenti dimostrativi." : "Movimenti esportati.");
  };
  return (
    <div className="studio-page">
      <PageHeader title="I tuoi soldi, senza pensieri." description="Quote ricevute, spese e movimenti. Tutto al suo posto." action={<Button variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download data-icon="inline-start" />Esporta movimenti</Button>} />
      <Reveal><div className="wallet-summary-grid">
        <div className="balance-card"><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-medium"><Wallet className="size-4" />Saldo disponibile</span><button onClick={() => setHidden(!hidden)} aria-label={hidden ? "Mostra importi" : "Nascondi importi"} className="balance-visibility">{hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div><p className="balance-number font-display">{money(balance)}</p><p className="text-sm opacity-75">Il tuo piccolo spazio di libertà.</p><div className="flex items-center gap-3 pt-7"><Button variant="inverse" onClick={() => { if (preview) { setAction("withdraw"); setShowResult(false); } else onWithdraw?.(); }} disabled={withdrawLoading || (!preview && !onWithdraw) || balance <= 0}><ArrowDownToLine data-icon="inline-start" />{withdrawLoading ? "Attendi..." : "Preleva"}</Button>{preview && <Button variant="inverse" onClick={() => { setAction("topup"); setShowResult(false); }}><Plus data-icon="inline-start" />Ricarica</Button>}</div></div>
        <Card className="wallet-stat-card"><CardHeader><span className="wallet-stat-icon"><Clock3 className="size-5" /></span><CardDescription>In elaborazione</CardDescription><CardTitle>{money(pending)}</CardTitle></CardHeader><CardContent><p className="text-sm leading-relaxed text-muted-foreground">Quote in attesa di diventare disponibili nel tuo portafoglio.</p></CardContent><CardFooter><Badge variant="outline">Tutto sotto controllo</Badge></CardFooter></Card>
        <Card className="wallet-stat-card"><CardHeader><span className="wallet-stat-icon positive"><ArrowUpRight className="size-5" /></span><CardDescription>Totale prelevato</CardDescription><CardTitle>{money(withdrawn)}</CardTitle></CardHeader><CardContent><p className="text-sm leading-relaxed text-muted-foreground">Le quote che hai già trasferito dal portafoglio al tuo conto.</p></CardContent><CardFooter><span className="flex items-center gap-1.5 text-sm text-mint"><CheckCircle2 className="size-4" />Trasferimenti completati</span></CardFooter></Card>
      </div></Reveal>
      <Reveal delay={0.08}><Card className="transaction-card"><CardHeader><div className="section-heading"><div><CardTitle>Ogni movimento, in chiaro.</CardTitle><CardDescription className="pt-1">La storia del tuo portafoglio, senza righe nascoste.</CardDescription></div><Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-44"><SelectValue placeholder="Periodo" /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">Tutti i periodi</SelectItem><SelectItem value="2026-09">Settembre 2026</SelectItem><SelectItem value="2026-08">Agosto 2026</SelectItem></SelectGroup></SelectContent></Select></div></CardHeader><CardContent><div className="wallet-filters"><Tabs value={tab} onValueChange={setTab}><TabsList className="studio-tabs"><TabsTrigger value="all">Tutti</TabsTrigger><TabsTrigger value="income">Entrate</TabsTrigger><TabsTrigger value="expense">Uscite</TabsTrigger></TabsList></Tabs><div className="w-full sm:w-60"><InputGroup><InputGroupInput aria-label="Cerca nei movimenti" placeholder="Cerca un movimento..." value={search} onChange={(event) => setSearch(event.target.value)} /><InputGroupAddon><Search /></InputGroupAddon></InputGroup></div></div>
        {filtered.length ? <Table><TableHeader><TableRow><TableHead>Movimento</TableHead><TableHead className="hidden sm:table-cell">Data</TableHead><TableHead className="hidden md:table-cell">Stato</TableHead><TableHead className="text-right">Importo</TableHead></TableRow></TableHeader><TableBody>{filtered.map((transaction) => <TableRow key={transaction.id}><TableCell><div className="flex items-center gap-3"><span className="service-tile small">{transaction.service ? <ServiceLogo name={transaction.service} size={27} /> : <Building2 className="size-5 text-muted-foreground" />}</span><div><p className="text-sm font-semibold">{transaction.name}</p><p className="text-sm text-muted-foreground">{transaction.detail}</p></div></div></TableCell><TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{transaction.date}</TableCell><TableCell className="hidden md:table-cell"><span className="transaction-status"><span className="size-1.5 rounded-full bg-mint" />{transaction.status}</span></TableCell><TableCell className={cn("text-right text-sm font-semibold tabular-nums", transaction.amount > 0 && "text-mint")}>{hidden ? "••••" : `${transaction.amount > 0 ? "+" : ""}${euro(transaction.amount)}`}</TableCell></TableRow>)}</TableBody></Table> : <Empty><EmptyHeader><EmptyMedia variant="icon"><ReceiptText /></EmptyMedia><EmptyTitle>Qui è tutto tranquillo.</EmptyTitle><EmptyDescription>Non ci sono movimenti per i filtri selezionati.</EmptyDescription></EmptyHeader></Empty>}
      </CardContent><CardFooter className="justify-between"><p className="text-sm text-muted-foreground">{filtered.length} movimenti{preview ? " dimostrativi" : ""}</p><span className="flex items-center gap-1.5 text-sm text-muted-foreground"><LockKeyhole className="size-3.5" />Solo per i tuoi occhi</span></CardFooter></Card></Reveal>
      {extraContent || <div className="wallet-assurance"><ShieldCheck className="size-5 shrink-0 text-primary" /><p className="flex-1 text-sm leading-relaxed text-muted-foreground">La tranquillità viene prima. Nell’anteprima nessuna ricarica, prelievo o addebito viene eseguito.</p><Button variant="ghost" asChild><Link to="/Support">Serve una mano?<ChevronRight data-icon="inline-end" /></Link></Button></div>}
      <Dialog open={!!action} onOpenChange={(open) => { if (!open) setAction(null); }}><DialogContent><DialogHeader><DialogTitle>{showResult ? "Ecco come apparirà la richiesta." : action === "withdraw" ? "Trasferisci sul tuo conto." : "Dai spazio alle tue passioni."}</DialogTitle><DialogDescription>{showResult ? "Questa è soltanto una simulazione visiva: non è stata eseguita alcuna operazione e il saldo è rimasto invariato." : "Modalità anteprima. Nessun denaro verrà spostato e nessun dato bancario verrà richiesto."}</DialogDescription></DialogHeader>{showResult ? <><div className="flex flex-col items-center gap-3 py-8"><span className="wallet-stat-icon positive"><Check className="size-6" /></span><p className="font-display text-4xl font-bold">{euro(Number(amount))}</p><Badge variant="secondary">Richiesta dimostrativa, non inviata</Badge></div><DialogFooter><Button onClick={() => setAction(null)}>Torna al portafoglio</Button></DialogFooter></> : <form onSubmit={(event) => { event.preventDefault(); const value = Number(amount); if (!Number.isFinite(value) || value < 10 || value > (action === "withdraw" ? balance : 1000)) return; setShowResult(true); }}><FieldGroup className="py-5"><Field><FieldLabel htmlFor="wallet-amount">Importo in euro</FieldLabel><Input id="wallet-amount" type="number" min="10" max={action === "withdraw" ? balance : 1000} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /><FieldDescription>{action === "withdraw" ? `Disponibile: ${euro(balance)} · minimo 10 €` : "Minimo 10 € · massimo 1.000 €"}</FieldDescription></Field></FieldGroup><DialogFooter><Button variant="outline" type="button" onClick={() => setAction(null)}>Annulla</Button><Button type="submit">Visualizza anteprima<ArrowRightIcon /></Button></DialogFooter></form>}</DialogContent></Dialog>
    </div>
  );
}

function ArrowRightIcon() { return <ArrowUpRight data-icon="inline-end" />; }
