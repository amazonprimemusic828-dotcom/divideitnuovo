import { Link } from "react-router-dom";
import Brand from "@/components/Brand";
import { Separator } from "@/components/ui/separator";
import { legalConfig } from "@/lib/legal-config";

const columns: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: "Prodotto",
    links: [
      { label: "Come funziona", to: "/ComeFunziona" },
      { label: "Esplora gruppi", to: "/BrowseGroups" },
      { label: "Calcolatore risparmio", to: "/Calcolatore" },
      { label: "Invita un amico", to: "/Referral" },
    ],
  },
  {
    title: "Assistenza",
    links: [
      { label: "Centro supporto", to: "/Support" },
      { label: "Accedi", to: "/Auth" },
      { label: "Password dimenticata", to: "/forgot-password" },
    ],
  },
  {
    title: "Legale",
    links: [
      { label: "Termini di servizio", to: "/TermsOfService" },
      { label: "Privacy policy", to: "/PrivacyPolicy" },
      { label: "Cookie policy", to: "/legal/cookie" },
      { label: "Rimborsi", to: "/legal/rimborsi" },
      { label: "Note legali", to: "/legal/note-legali" },
      { label: "Regole di condivisione", to: "/legal/regole-condivisione" },
    ],
  },
];

export default function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="marketing-container">
        <div className="footer-top">
          <div className="flex flex-col items-start gap-5">
            <Brand />
            <p className="max-w-xs text-base leading-relaxed text-muted-foreground">Le tue passioni, le tue persone. Un solo spazio per organizzare gli abbonamenti e dividere le spese.</p>
            <a href={`mailto:${legalConfig.contactEmail}`} className="footer-link text-sm font-semibold">{legalConfig.contactEmail}</a>
          </div>
          <div className="footer-columns">
            {columns.map((column) => (
              <nav key={column.title} aria-label={column.title} className="flex flex-col gap-5">
                <h3 className="text-sm font-semibold">{column.title}</h3>
                <ul className="flex flex-col gap-3">
                  {column.links.map((link) => <li key={link.to}><Link to={link.to} className="footer-link text-sm text-muted-foreground">{link.label}</Link></li>)}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <Separator />
        <div className="footer-disclosure">
          <p className="text-sm leading-relaxed text-muted-foreground">DivideIt è una piattaforma indipendente, non affiliata ai servizi citati. I nomi dei servizi appartengono ai rispettivi titolari e sono usati a scopo descrittivo. La condivisione è consentita soltanto quando prevista dal piano e nel rispetto dei suoi requisiti. Leggi le <Link to="/legal/note-legali" className="footer-link underline underline-offset-4">note legali</Link> e le <Link to="/legal/regole-condivisione" className="footer-link underline underline-offset-4">regole di condivisione</Link>.</p>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} {legalConfig.companyName}. Tutti i diritti riservati.</p>
          <p>Le cose belle, condivise.</p>
        </div>
      </div>
    </footer>
  );
}
