import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Icona lucide-react */
  icon?: ComponentType<{ className?: string }>;
  title: string;
  /** Una sola riga di copy: spiega il perché, non le istruzioni */
  description?: string;
  /** CTA pill, di solito un <Button asChild> */
  action?: ReactNode;
  /** Azione secondaria testuale */
  secondaryAction?: ReactNode;
  /** compact per gli stati vuoti dentro una sezione */
  size?: "default" | "compact";
  className?: string;
}

/**
 * Stato vuoto condiviso: un'unica forma per tutte le liste dell'app.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  size = "default",
  className,
}: EmptyStateProps) {
  const compact = size === "compact";

  return (
    <div
      className={cn(
        "panel-quiet flex flex-col items-center justify-center text-center",
        compact ? "gap-3 px-6 py-10" : "gap-4 px-6 py-16",
        className,
      )}
    >
      {Icon && (
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-surface-elevated border border-border text-muted-foreground",
            compact ? "h-11 w-11" : "h-14 w-14",
          )}
        >
          <Icon className={compact ? "h-5 w-5" : "h-6 w-6"} />
        </span>
      )}
      <div className="flex flex-col gap-1.5">
        <h3 className={cn("font-display font-bold text-foreground", compact ? "text-base" : "text-lg")}>
          {title}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed text-pretty max-w-sm mx-auto">
            {description}
          </p>
        )}
      </div>
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
