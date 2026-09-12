import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Micro-label maiuscola sopra il titolo */
  eyebrow?: string;
  /** L'unico <h1> della pagina */
  title: string;
  /** Una riga di contesto, non un paragrafo */
  description?: string;
  /** Azione primaria allineata a destra su desktop */
  action?: ReactNode;
  /** Contenuto extra sotto (chip, contatori, filtri) */
  children?: ReactNode;
  className?: string;
}

/**
 * Intestazione di pagina condivisa.
 * Garantisce un solo <h1> per pagina e una gerarchia identica su tutte le viste.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-5", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2 min-w-0">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-foreground text-balance lg:text-[34px]">{title}</h1>
          {description && (
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed text-pretty max-w-xl">
              {description}
            </p>
          )}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2 md:flex-none">{action}</div>}
      </div>
      {children}
    </header>
  );
}
