import React from "react";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: "blue" | "green" | "purple" | "orange";
  hint?: string;
}

/**
 * Le vecchie chiavi colore restano nell'API, ma puntano ai token semantici:
 * niente più palette Tailwind grezza dentro la dashboard.
 */
const toneMap: Record<StatsCardProps["color"], { icon: string; hint: string; glow: string }> = {
  blue: {
    icon: "bg-surface-muted text-foreground",
    hint: "text-muted-foreground",
    glow: "bg-foreground/5",
  },
  purple: {
    icon: "bg-primary text-primary-foreground",
    hint: "text-primary",
    glow: "bg-primary/15",
  },
  green: {
    icon: "bg-mint",
    hint: "text-mint",
    glow: "bg-mint-soft",
  },
  orange: {
    icon: "bg-surface-muted text-foreground",
    hint: "text-muted-foreground",
    glow: "bg-foreground/5",
  },
};

export default function StatsCard({ title, value, icon: Icon, color, hint }: StatsCardProps) {
  const tone = toneMap[color];
  return (
    <div className="panel group relative overflow-hidden p-5 transition-colors duration-300 hover:border-primary/30 lg:p-6">
      <div
        className={`absolute -right-10 -top-10 h-28 w-28 rounded-full ${tone.glow} opacity-60 blur-2xl transition-opacity group-hover:opacity-90`}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
          <p className="tnum mt-3 font-display text-2xl font-extrabold tracking-[-0.03em] text-foreground lg:text-3xl">{value}</p>
          {hint && <p className={`mt-2 text-xs font-medium ${tone.hint}`}>{hint}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
