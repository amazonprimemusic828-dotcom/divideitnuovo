// Calcolo dell'affidabilità e dei badge dell'Admin a partire dalle recensioni.
// Modello meritocratico a stelle: ogni voto alimenta (o penalizza) la
// percentuale di fiducia mostrata prima di entrare nel gruppo.

export interface AdminReputation {
  /** media ponderata delle stelle (1-5), null se nessuna recensione */
  avgStars: number | null;
  /** numero di recensioni totali */
  reviewCount: number;
  /** percentuale di affidabilità 0-100 */
  trust: number;
  /** badge/livello assegnato */
  badge: AdminBadge;
}

export type AdminBadge = "Base" | "Explorer" | "Adventurer" | "Hero";

export interface AdminBadgeMeta {
  id: AdminBadge;
  minStars: number;
  color: string;
  icon: string;
  description: string;
}

/** 5 stelle = massima affidabilità (fino al 100%). 1 stella = forte penalizzazione. */
export const STAR_WEIGHTS: Record<number, number> = {
  5: 1.0,
  4: 0.75,
  3: 0.5,
  2: 0.25,
  1: 0.0,
};

export const BADGES: AdminBadgeMeta[] = [
  {
    id: "Hero",
    minStars: 40,
    color: "bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950",
    icon: "🏆",
    description: "Decine di recensioni a 5 stelle e nessuna contestazione",
  },
  {
    id: "Adventurer",
    minStars: 20,
    color: "bg-gradient-to-r from-sky-500 to-blue-600 text-white",
    icon: "🚀",
    description: "Una solida raccolta di recensioni positive",
  },
  {
    id: "Explorer",
    minStars: 5,
    color: "bg-gradient-to-r from-emerald-500 to-green-600 text-white",
    icon: "🧭",
    description: "Ha ricevuto le prime recensioni positive",
  },
  {
    id: "Base",
    minStars: 0,
    color: "bg-muted text-muted-foreground",
    icon: "🌱",
    description: "Livello iniziale appena iscritto",
  },
];

export function trustFromStars(avg: number | null, count: number): number {
  if (avg === null || count === 0) return 0;
  // ponderazione: percentuale = (media / 5) * 100, 5 stelle → 100%, 1 → 0%.
  return Math.round((Math.min(5, Math.max(1, avg)) / 5) * 100);
}

export function badgeFromCount(count: number): AdminBadge {
  for (const b of BADGES) if (count >= b.minStars) return b.id;
  return "Base";
}

export function computeAdminReputation(
  stars: (number | null | undefined)[],
): AdminReputation {
  const valid = (stars || []).filter((s): s is number => typeof s === "number");
  if (valid.length === 0) {
    return { avgStars: null, reviewCount: 0, trust: 0, badge: "Base" };
  }
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
  const trust = trustFromStars(avg, valid.length);
  return {
    avgStars: avg,
    reviewCount: valid.length,
    trust,
    badge: badgeFromCount(valid.length),
  };
}
