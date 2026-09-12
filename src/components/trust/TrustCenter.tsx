import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check, Lock, Loader2, Sparkles, Target, Trophy, TriangleAlert, ChevronRight,
} from "lucide-react";
import { useTrustScore, TrustItem } from "@/hooks/useTrustScore";
import { cn } from "@/lib/utils";

function ScoreRing({ score }: { score: number }) {
  const r = 62;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const label =
    score >= 90 ? "Eccellente" : score >= 70 ? "Ottima" : score >= 45 ? "In crescita" : "Da migliorare";

  return (
    <div className="relative w-[168px] h-[168px] shrink-0">
      <svg viewBox="0 0 148 148" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="trustGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--secondary))" />
          </linearGradient>
        </defs>
        <circle cx="74" cy="74" r={r} strokeWidth="12" className="stroke-muted" fill="none" />
        <motion.circle
          cx="74" cy="74" r={r} strokeWidth="12" fill="none"
          stroke="url(#trustGrad)" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-extrabold tracking-tight text-foreground">{score}</span>
        <span className="text-xs font-medium text-muted-foreground">/ 100</span>
        <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-primary">{label}</span>
      </div>
    </div>
  );
}

function Row({ item }: { item: TrustItem }) {
  const isMalus = item.kind === "malus";
  const active = item.done;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-3 py-3.5 px-3 rounded-xl transition-colors",
        active && !isMalus && "bg-primary/5",
        active && isMalus && "bg-destructive/5",
      )}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
          isMalus
            ? active ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"
            : active ? "gradient-divideit text-white" : "bg-muted text-muted-foreground",
        )}
      >
        {isMalus ? (
          <TriangleAlert className="w-4 h-4" />
        ) : active ? (
          <Check className="w-4 h-4" />
        ) : (
          <Lock className="w-3.5 h-3.5" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold leading-tight", !active && !isMalus && "text-muted-foreground")}>
          {item.label}
        </p>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
        )}
      </div>

      {!active && item.action && (
        <Button asChild size="sm" variant="ghost" className="h-8 px-2 text-primary shrink-0">
          <Link to={item.action.to}>
            {item.action.label}
            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </Link>
        </Button>
      )}

      <Badge
        variant="outline"
        className={cn(
          "shrink-0 font-bold tabular-nums border-0",
          isMalus
            ? active ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
            : active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {item.points > 0 ? `+${item.points}` : item.points} PT
      </Badge>
    </motion.div>
  );
}

function Section({
  icon: Icon, title, subtitle, items, tone,
}: {
  icon: any; title: string; subtitle: string; items: TrustItem[]; tone: "primary" | "destructive";
}) {
  if (!items.length) return null;
  const earned = items.filter((i) => i.done).length;

  return (
    <Card className="p-5 sm:p-6 rounded-2xl border-border/60">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-11 h-11 rounded-2xl flex items-center justify-center",
              tone === "primary" ? "gradient-divideit text-white" : "bg-destructive/10 text-destructive",
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold leading-tight">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-muted-foreground shrink-0 pt-1 tabular-nums">
          {earned}/{items.length}
        </span>
      </div>
      <div className="space-y-1">
        {items.map((i) => <Row key={i.key} item={i} />)}
      </div>
    </Card>
  );
}

export default function TrustCenter() {
  const { loading, score, missions, milestones, malus, earnedPoints, penaltyPoints } = useTrustScore();

  if (loading) {
    return (
      <Card className="p-14 flex justify-center rounded-2xl">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  const activeMalus = malus.filter((m) => m.done);

  return (
    <div className="space-y-6">
      <Card className="p-6 sm:p-8 rounded-2xl overflow-hidden relative border-border/60 bg-gradient-to-br from-primary/8 via-transparent to-secondary/8">
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          <ScoreRing score={score} />
          <div className="text-center sm:text-left flex-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 rounded-full px-3 py-1 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Punteggio di affidabilità
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
              Costruisci la tua reputazione
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Un punteggio alto ti rende più visibile nella ricerca dei gruppi e aumenta la fiducia
              di admin e joiner. Completa le missioni per arrivare al 100%.
            </p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-4">
              <Badge className="gradient-divideit text-white border-0">+{earnedPoints} PT guadagnati</Badge>
              {penaltyPoints < 0 && (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-0">
                  {penaltyPoints} PT malus
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Section
        icon={Target}
        title="Missioni"
        subtitle="Completa il tuo profilo per sbloccare punti"
        items={missions}
        tone="primary"
      />

      <Section
        icon={Trophy}
        title="Traguardi"
        subtitle="Ottieni punti grazie al tuo comportamento"
        items={milestones}
        tone="primary"
      />

      <Section
        icon={TriangleAlert}
        title="Malus"
        subtitle={activeMalus.length ? "Penalità attualmente attive" : "Nessuna penalità attiva. Continua così!"}
        items={malus}
        tone="destructive"
      />
    </div>
  );
}
