import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Menu, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Brand from "@/components/Brand";

const links = [{ label: "Come funziona", href: "/#come-funziona" }, { label: "Gli abbonamenti", href: "/#servizi" }, { label: "Perché DivideIt", href: "/#sicurezza" }];
export default function LandingNav({ onStart, isLoading }: { onStart: () => void; isLoading?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="marketing-nav">
      <div className="marketing-container">
        <div className="flex h-20 items-center justify-between">
          <Brand />
          <nav aria-label="Navigazione principale" className="hidden items-center gap-8 lg:flex">{links.map((link) => <a className="marketing-link" key={link.href} href={link.href}>{link.label}</a>)}</nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild className="hidden sm:inline-flex"><Link to="/Auth">Accedi</Link></Button>
            <Button variant="ink" onClick={onStart} disabled={isLoading}>{isLoading && <Loader2 className="animate-spin" data-icon="inline-start" />}Inizia gratis<ArrowUpRight data-icon="inline-end" /></Button>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label={open ? "Chiudi menu" : "Apri menu"} aria-expanded={open} aria-controls="mobile-marketing-nav" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</Button>
          </div>
        </div>
        {open && <nav id="mobile-marketing-nav" className="flex flex-col border-t border-border lg:hidden" aria-label="Navigazione mobile">{links.map((link) => <a className="py-4 text-sm" href={link.href} key={link.href} onClick={() => setOpen(false)}>{link.label}</a>)}<Link to="/Auth" className="py-4 font-semibold text-primary" onClick={() => setOpen(false)}>Accedi al tuo account</Link></nav>}
      </div>
    </header>
  );
}
