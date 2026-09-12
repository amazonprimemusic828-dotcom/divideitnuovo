import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/shared/PageHeader";
import ServiceLogo from "@/components/ServiceLogo";
import { euro, type SubscriptionSummary } from "@/components/dashboard/SubscriptionTile";
import { cn } from "@/lib/utils";

export default function CreateGroupPreview({ services, onCreate }: { services: SubscriptionSummary[]; onCreate: (group: SubscriptionSummary) => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const service = services.find((item) => item.id === serviceId) || services[0];
  const [name, setName] = useState("");
  const [total, setTotal] = useState(String(service?.total || 20));
  const [capacity, setCapacity] = useState(String(service?.capacity || 4));
  const [day, setDay] = useState("15");
  const [accepted, setAccepted] = useState(false);
  const quota = Number(total) / Math.max(Number(capacity), 1);
  const choose = (id: string) => { setServiceId(id); const item = services.find((entry) => entry.id === id); if (item) { setTotal(String(item.total)); setCapacity(String(item.capacity)); } };
  const submit = () => {
    if (step < 3) { setStep(step + 1); return; }
    if (!accepted) return;
    const group: SubscriptionSummary = { ...service, id: `preview-created-${crypto.randomUUID()}`, name: name.trim() || `Il mio gruppo ${service.service}`, total: Number(total), capacity: Number(capacity), members: 1, role: "admin", owner: "Luca", avatars: ["luca"], paid: true, renewal: `${day} del mese` };
    onCreate(group); navigate(`/GroupDetail?id=${group.id}`);
  };
  return (
    <div className="studio-page">
      <Link to="/Dashboard" className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" />Torna al tuo spazio</Link>
      <PageHeader title="Il prossimo bel gruppo è il tuo." description="Una passione, qualche persona e ognuno fa la sua parte." />
      <ol className="create-steps">{["Scegli la passione", "Dai forma al gruppo", "Pronti a condividere"].map((label, index) => <li key={label} className={cn(index + 1 === step && "current", index + 1 < step && "complete")} aria-current={index + 1 === step ? "step" : undefined}><span>{index + 1 < step ? <Check className="size-4" /> : index + 1}</span>{label}</li>)}</ol>
      <div className="create-group-layout"><Card><form onSubmit={(event) => { event.preventDefault(); submit(); }}><CardHeader><CardTitle>{step === 1 ? "Cosa vuoi condividere?" : step === 2 ? "I piccoli dettagli che contano." : "Sembra già un bel gruppo."}</CardTitle><CardDescription>{step === 1 ? "Scegli un servizio per iniziare." : step === 2 ? "Scegli un nome e definisci come dividere la spesa." : "Dai un’ultima occhiata prima di esplorare il risultato."}</CardDescription></CardHeader><CardContent>{step === 1 ? <RadioGroup value={serviceId} onValueChange={choose} className="create-service-grid" aria-label="Servizio da condividere">{services.slice(0, 6).map((item) => <Label htmlFor={`service-${item.id}`} key={item.id} className={cn("service-choice", serviceId === item.id && "selected")}><RadioGroupItem id={`service-${item.id}`} value={item.id} className="sr-only" /><ServiceLogo name={item.service} size={36} /><span>{item.service}</span>{serviceId === item.id && <Check className="size-4 text-primary" />}</Label>)}</RadioGroup> : step === 2 ? <FieldGroup className="gap-5"><Field><FieldLabel htmlFor="new-group-name">Come si chiama il tuo gruppo?</FieldLabel><Input id="new-group-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={`Il mio gruppo ${service.service}`} maxLength={80} minLength={2} required /></Field><div className="grid gap-5 sm:grid-cols-2"><Field><FieldLabel htmlFor="new-group-cost">Costo totale al mese (€)</FieldLabel><Input id="new-group-cost" type="number" value={total} onChange={(event) => setTotal(event.target.value)} min="0.01" max="1000" step="0.01" required /></Field><Field><FieldLabel htmlFor="new-group-members">Numero di persone</FieldLabel><Input id="new-group-members" type="number" value={capacity} onChange={(event) => setCapacity(event.target.value)} min="2" max="8" step="1" required /></Field></div><Field><FieldLabel htmlFor="new-group-day">Giorno del rinnovo</FieldLabel><Input id="new-group-day" type="number" value={day} onChange={(event) => setDay(event.target.value)} min="1" max="31" step="1" required /><FieldDescription>Il giorno del mese in cui si rinnova l’abbonamento.</FieldDescription></Field></FieldGroup> : <div className="flex flex-col gap-6"><div className="group-confirm-summary"><ServiceLogo name={service.service} size={50} /><div><p className="font-display text-xl font-bold">{name || service.name}</p><p className="pt-1 text-sm text-muted-foreground">{capacity} persone · {euro(Number(total))} al mese</p></div></div><Field orientation="horizontal"><Checkbox id="preview-sharing-rules" checked={accepted} onCheckedChange={(value) => setAccepted(value === true)} required /><FieldLabel htmlFor="preview-sharing-rules" className="block leading-relaxed">Ho verificato le condizioni del servizio. So che questa è soltanto un’anteprima e non crea un gruppo reale.</FieldLabel></Field></div>}</CardContent><CardFooter className="justify-between border-t border-border pt-5"><Button type="button" variant="ghost" disabled={step === 1} onClick={() => setStep(step - 1)}><ArrowLeft data-icon="inline-start" />Indietro</Button><Button type="submit" disabled={step === 3 && !accepted}>{step === 3 ? "Crea nell’anteprima" : "Continua"}<ArrowRight data-icon="inline-end" /></Button></CardFooter></form></Card><Card className="create-quote"><CardHeader><span className="service-tile"><ServiceLogo name={service.service} size={34} /></span><CardTitle className="pt-3">Ognuno fa la sua parte.</CardTitle><CardDescription>Una piccola anteprima del tuo prossimo gruppo.</CardDescription></CardHeader><CardContent><p className="font-display text-4xl font-bold">{euro(Number.isFinite(quota) ? quota : 0)}<span className="text-sm font-normal text-muted-foreground"> / persona</span></p><div className="flex items-center gap-2 pt-6 text-sm text-mint"><ShieldCheck className="size-4 shrink-0" />Nessuna operazione reale.</div></CardContent></Card></div>
    </div>
  );
}
