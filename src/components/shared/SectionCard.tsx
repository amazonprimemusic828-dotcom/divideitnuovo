import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  /** Titolo di sezione: diventa un <h2> */
  title?: string;
  /** Sottotitolo su una riga */
  description?: string;
  /** Icona lucide-react accanto al titolo */
  icon?: ComponentType<{ className?: string }>;
  /** Contatore o badge a destra del titolo */
  meta?: ReactNode;
  /** Azione in testata (bottone ghost, link) */
  action?: ReactNode;
  /** Piede opzionale separato da filetto */
  footer?: ReactNode;
  /** Rimuove il padding del corpo: per liste a tutta larghezza */
  flush?: boolean;
  /** Superficie più quieta, per blocchi informativi */
  quiet?: boolean;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * Contenitore di sezione standard: testata + corpo + piede opzionale.
 * È il mattone che rende coerenti tutte le pagine interne.
 */
export function SectionCard({
  title,
  description,
  icon: Icon,
  meta,
  action,
  footer,
  flush = false,
  quiet = false,
  children,
  className,
  bodyClassName,
}: SectionCardProps) {
  const hasHeader = Boolean(title || description || action || meta);

  return (
    <section className={cn(quiet ? "panel-quiet" : "panel", "overflow-hidden", className)}>
      {hasHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-6 md:py-5">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {title && (
                  <h2 className="font-display text-base md:text-lg font-bold text-foreground truncate">
                    {title}
                  </h2>
                )}
                {meta}
              </div>
              {description && (
                <p className="text-xs md:text-sm text-muted-foreground leading-relaxed mt-0.5 text-pretty">
                  {description}
                </p>
              )}
            </div>
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}

      {hasHeader && <div className="hairline" />}

      <div className={cn(flush ? "" : "px-5 py-5 md:px-6 md:py-6", bodyClassName)}>{children}</div>

      {footer && (
        <>
          <div className="hairline" />
          <div className="px-5 py-4 md:px-6">{footer}</div>
        </>
      )}
    </section>
  );
}
