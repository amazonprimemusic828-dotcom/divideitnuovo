import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "brand" | "positive" | "warning" | "critical";

interface StatusPillProps {
  tone?: StatusTone;
  icon?: ComponentType<{ className?: string }>;
  /** Mostra un pallino di stato al posto dell'icona */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

const toneClass: Record<StatusTone, string> = {
  neutral: "bg-surface-muted text-muted-foreground border-border",
  brand: "bg-primary-soft text-primary-strong border-primary/20",
  positive: "bg-positive-soft text-positive border-transparent ring-positive",
  warning: "bg-warning-soft text-warning border-transparent ring-warning",
  critical: "bg-critical-soft text-critical border-transparent ring-critical",
};

const dotClass: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground",
  brand: "bg-primary",
  positive: "bg-[hsl(var(--accent-mint))]",
  warning: "bg-[hsl(var(--warning))]",
  critical: "bg-[hsl(var(--destructive))]",
};

/**
 * Pill di stato tokenizzata. Unica fonte per pagato/in attesa/scaduto,
 * aperto/in corso/risolto, entrata/uscita.
 */
export function StatusPill({
  tone = "neutral",
  icon: Icon,
  dot = false,
  children,
  className,
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-wider whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 flex-none rounded-full", dotClass[tone])} />}
      {!dot && Icon && <Icon className="h-3 w-3 flex-none" />}
      {children}
    </span>
  );
}
