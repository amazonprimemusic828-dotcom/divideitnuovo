import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Clapperboard, Gamepad2, Grid2X2, Laptop, Music2, Plus, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { PageHeader } from "@/components/shared/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import SubscriptionTile, { type SubscriptionSummary } from "@/components/dashboard/SubscriptionTile";

const categories = [{ name: "Tutti", icon: Grid2X2 }, { name: "Video", icon: Clapperboard }, { name: "Musica", icon: Music2 }, { name: "Produttività", icon: Laptop }, { name: "Gaming", icon: Gamepad2 }];
export default function GroupExplorer({ groups }: { groups: SubscriptionSummary[] }) {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") || "";
  const [category, setCategory] = useState("Tutti");
  const [sort, setSort] = useState("recommended");
  const [availableOnly, setAvailableOnly] = useState(false);
  const filtered = groups.filter((group) => `${group.name} ${group.service}`.toLowerCase().includes(search.toLowerCase()) && (category === "Tutti" || group.category === category) && (!availableOnly || group.members < group.capacity)).sort((a, b) => sort === "price" ? a.total / a.capacity - b.total / b.capacity : sort === "seats" ? (b.capacity - b.members) - (a.capacity - a.members) : 0);
  return (
    <div className="studio-page">
      <PageHeader title="Trova la tua prossima passione." description="Persone diverse, gli stessi interessi. Il gruppo giusto è qui da qualche parte." action={<Button asChild><Link to="/CreateGroup"><Plus data-icon="inline-start" />Crea un gruppo</Link></Button>} />
      <div className="explore-intro"><div><Badge variant="secondary">PIÙ COSE CHE AMI</Badge><h2 className="font-display text-3xl font-bold leading-tight tracking-tight">Le passioni si moltiplicano.<br />Le spese si dividono.</h2><p className="text-sm leading-relaxed text-muted-foreground">Trova il piano giusto e condividilo nel rispetto delle condizioni del servizio.</p></div><div className="explore-portraits" aria-hidden="true">{["sofia", "andrea", "giulia"].map((name) => <img src={`/avatars/premium/${name}.png`} alt="" key={name} width={130} height={130} loading="lazy" />)}</div></div>
      <div className="flex flex-col gap-5"><div className="flex flex-col gap-3 sm:flex-row"><div className="flex-1"><InputGroup><InputGroupInput aria-label="Cerca gruppi per servizio" placeholder="Qual è la tua prossima passione? Cerca un servizio..." value={search} onChange={(event) => setParams(event.target.value ? { q: event.target.value } : {})} /><InputGroupAddon><Search /></InputGroupAddon></InputGroup></div><Button variant={availableOnly ? "secondary" : "outline"} aria-pressed={availableOnly} onClick={() => setAvailableOnly(!availableOnly)}><SlidersHorizontal data-icon="inline-start" />Solo posti disponibili</Button></div><ToggleGroup type="single" value={category} onValueChange={(value) => value && setCategory(value)} className="filter-pills" aria-label="Categoria del servizio">{categories.map(({ name, icon: Icon }) => <ToggleGroupItem value={name} key={name}><Icon className="mr-2 size-4" />{name}</ToggleGroupItem>)}</ToggleGroup></div>
      <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground"><strong className="text-foreground">{filtered.length} gruppi</strong> da scoprire</p><Select value={sort} onValueChange={setSort}><SelectTrigger className="w-48" aria-label="Ordina i gruppi"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="recommended">Consigliati per te</SelectItem><SelectItem value="price">Quota più bassa</SelectItem><SelectItem value="seats">Più posti disponibili</SelectItem></SelectGroup></SelectContent></Select></div>
      <Reveal key={`${category}-${availableOnly}`} y={10}>{filtered.length ? <div className="explore-grid">{filtered.map((group) => <SubscriptionTile key={group.id} group={group} explore />)}</div> : <Card><Empty><EmptyHeader><EmptyMedia variant="icon"><Search /></EmptyMedia><EmptyTitle>Questa passione si fa aspettare.</EmptyTitle><EmptyDescription>Prova un altro servizio oppure rimuovi i filtri per vedere tutti i gruppi.</EmptyDescription></EmptyHeader><EmptyContent><Button variant="outline" onClick={() => { setCategory("Tutti"); setAvailableOnly(false); setParams({}); }}>Mostra tutti i gruppi<ArrowUpRight data-icon="inline-end" /></Button></EmptyContent></Empty></Card>}</Reveal>
      <p className="text-sm leading-relaxed text-muted-foreground">I gruppi e i prezzi di questa anteprima sono dimostrativi. Prima di condividere, verifica sempre i requisiti del servizio, inclusi eventuali vincoli di nucleo familiare.</p>
    </div>
  );
}
