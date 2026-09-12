import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldGroup, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import Brand from "@/components/Brand";
import AuthAside from "./AuthAside";

export default function AccessPreview() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const reset = location.pathname.toLowerCase().includes("password");
  const registration = params.get("mode") === "register";
  const [showPassword, setShowPassword] = useState(false);
  const [terms, setTerms] = useState(false);
  const mode = registration ? "register" : "login";
  return (
    <div className="auth-layout font-sans">
      <AuthAside />
      <main className="auth-form-side"><div className="auth-form">
        <div className="pb-10 lg:hidden"><Brand /></div>
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" />Torna alla home</Link>
        <div className="auth-form-intro pt-10"><span className="auth-welcome-icon"><LockKeyhole className="size-6" /></span><h1 className="auth-form-title pt-5">{reset ? "Ritrova il tuo spazio." : registration ? "Le cose belle iniziano qui." : "Bentornato, davvero."}</h1><p className="pb-7 pt-3 text-base leading-relaxed text-muted-foreground">{reset ? "Inserisci l’email associata al tuo account." : registration ? "Crea il tuo spazio e inizia a condividere quello che ami." : "Il tuo spazio ti aspetta. Riprendi da dove eri rimasto."}</p></div>
        {!reset && <Tabs value={mode} onValueChange={(value) => { setParams(value === "register" ? { mode: "register" } : {}); setTerms(false); }}><TabsList className="studio-tabs w-full"><TabsTrigger value="login" className="flex-1">Accedi</TabsTrigger><TabsTrigger value="register" className="flex-1">Crea un account</TabsTrigger></TabsList></Tabs>}
        <form className="auth-form-fields pt-7" onSubmit={(event) => { event.preventDefault(); toast.info("Questa è un’anteprima del design. Nessun account, accesso o email è stato creato.", { description: "Usa “Esplora senza login” per vedere tutte le schermate." }); }}>
          <FieldGroup className="gap-5">
            {registration && <Field><FieldLabel htmlFor="access-name">Come ti chiami?</FieldLabel><Input id="access-name" placeholder="Nome e cognome" autoComplete="name" required minLength={2} maxLength={100} /></Field>}
            <Field><FieldLabel htmlFor="access-email">La tua email</FieldLabel><InputGroup><InputGroupInput id="access-email" type="email" placeholder="nome@esempio.it" required autoComplete="email" /><InputGroupAddon><Mail /></InputGroupAddon></InputGroup></Field>
            {!reset && <Field><div className="flex items-center justify-between"><FieldLabel htmlFor="access-password">Password</FieldLabel>{!registration && <Link to="/forgot-password" className="text-sm font-medium text-primary">L’hai dimenticata?</Link>}</div><InputGroup><InputGroupInput id="access-password" type={showPassword ? "text" : "password"} placeholder={registration ? "Almeno 8 caratteri" : "La tua password"} required minLength={8} autoComplete={registration ? "new-password" : "current-password"} /><InputGroupAddon align="inline-start"><LockKeyhole /></InputGroupAddon><InputGroupAddon align="inline-end"><Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Nascondi password" : "Mostra password"}>{showPassword ? <EyeOff /> : <Eye />}</Button></InputGroupAddon></InputGroup>{registration && <FieldDescription>Usa una password unica di almeno 8 caratteri.</FieldDescription>}</Field>}
            {registration && <Field orientation="horizontal"><Checkbox id="access-terms" checked={terms} onCheckedChange={(checked) => setTerms(checked === true)} required /><FieldLabel htmlFor="access-terms" className="block leading-relaxed">Accetto i <Link to="/TermsOfService" className="text-primary underline">Termini di servizio</Link> e la <Link to="/PrivacyPolicy" className="text-primary underline">Privacy policy</Link>.</FieldLabel></Field>}
            <Button type="submit" size="lg" className="w-full" disabled={registration && !terms}>{reset ? "Visualizza recupero password" : registration ? "Crea il tuo account" : "Entra nel tuo spazio"}<ArrowRight data-icon="inline-end" /></Button>
          </FieldGroup>
        </form>
        <div className="auth-form-divider relative py-7"><Separator /><span className="auth-divider-label">oppure dai un’occhiata</span></div>
        <Button variant="outline" size="lg" className="w-full" asChild><Link to="/Dashboard">Esplora senza login<ArrowRight data-icon="inline-end" /></Link></Button>
        <p className="auth-preview-note pt-5 text-center text-sm leading-relaxed text-muted-foreground">Modalità anteprima: nessun dato viene inviato.<br />Puoi navigare liberamente in tutte le schermate.</p>
        <p className="auth-form-footnote flex items-center justify-center gap-2 pt-8 text-sm text-muted-foreground"><ShieldCheck className="size-4 text-mint" />Le tue passioni meritano uno spazio sicuro.</p>
      </div></main>
    </div>
  );
}
