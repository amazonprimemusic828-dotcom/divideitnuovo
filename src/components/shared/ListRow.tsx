import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ListRowProps {
  /** Slot sinistro: logo servizio, avatar, icona in cerchio */
  leading?: ReactNode;
  title: ReactNode;
  /** Riga di dettaglio sotto il titolo */
  subtitle?: ReactNode;
  /** Slot destro: importo, pill di stato, chevron */
  trailing?: ReactNode;
  /** Contenuto a piena larghezza sotto la riga (meter, chip) */
  below?: ReactNode;
  /** Rende la riga cliccabile */
  onClick?: () => void;
  /** Indicatore verticale a sinistra (non letto, attivo) */
  active?: boolean;
  className?: string;
}

/**
 * Riga di lista condivisa. Usata da movimenti, notifiche, ticket,
 * conversazioni e gruppi per avere lo stesso ritmo verticale.
 */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  below,
  onClick,
  active = false,
  className,
}: ListRowProps) {
  const interactive = Boolean(onClick);

  return (
    <div
      {...(interactive
        ? { role: "button", tabIndex: 0, onClick, onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick?.();
            }
          } }
        : {})}
      className={cn(
        "relative flex flex-col gap-3 px-5 py-4 md:px-6 transition-colors",
        interactive && "cursor-pointer hover:bg-surface-muted/60 focus-visible:bg-surface-muted/60",
        active && "bg-primary-soft/40",
        className,
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <div className="flex items-center gap-3.5">
        {leading && <div className="flex-none">{leading}</div>}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground truncate">{title}</div>
          {subtitle && (
            <div className="text-xs text-muted-foreground leading-relaxed mt-0.5 truncate">
              {subtitle}
            </div>
          )}
        </div>
        {trailing && <div className="flex-none flex items-center gap-2 text-right">{trailing}</div>}
      </div>
      {below}
    </div>
  );
}
