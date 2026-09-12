import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const legalLinks = [
  { href: "/TermsOfService", label: "Termini di Servizio" },
  { href: "/PrivacyPolicy", label: "Privacy Policy" },
  { href: "/legal/cookie", label: "Cookie Policy" },
  { href: "/legal/rimborsi", label: "Politica di Rimborso" },
  { href: "/legal/note-legali", label: "Note Legali e Marchi" },
  { href: "/legal/aml-kyc", label: "AML / KYC" },
  { href: "/legal/dsa", label: "DSA e Segnalazioni" },
  { href: "/legal/regole-condivisione", label: "Regole di Condivisione" },
];

export function LegalLayout({
  title,
  updated,
  current,
  children,
}: {
  title: string;
  updated: string;
  current: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 md:flex-row md:gap-10 md:px-6 md:py-12">
        <nav aria-label="Documenti legali" className="md:w-56 md:shrink-0">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 -ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna indietro
          </Button>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Documenti legali
          </p>
          <ul className="flex flex-col gap-1 overflow-x-auto md:overflow-visible">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link
                  to={link.href}
                  aria-current={link.href === current ? "page" : undefined}
                  className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                    link.href === current
                      ? "bg-secondary font-medium text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <article className="min-w-0 flex-1">
          <header className="mb-8 border-b border-border pb-6">
            <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Ultimo aggiornamento: {updated}</p>
          </header>
          <div className="flex flex-col gap-6 text-sm leading-relaxed text-foreground/90 [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground md:[&_h2]:text-xl [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_p]:mt-2 [&_section]:scroll-mt-24 [&_ul]:mt-2 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-5 [&_ol]:mt-2 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-1 [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline">
            {children}
          </div>
        </article>
      </div>
    </main>
  );
}

export default LegalLayout;
