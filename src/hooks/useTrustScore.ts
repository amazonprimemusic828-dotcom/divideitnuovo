import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthContext";

export interface TrustItem {
  key: string;
  label: string;
  description?: string;
  points: number;
  done: boolean;
  /** Malus items are negative and "done" means the penalty is active */
  kind: "mission" | "milestone" | "malus";
  action?: { label: string; to: string };
}

export interface TrustData {
  loading: boolean;
  score: number;
  missions: TrustItem[];
  milestones: TrustItem[];
  malus: TrustItem[];
  earnedPoints: number;
  maxPoints: number;
  penaltyPoints: number;
  avgRating: number | null;
  reviewCount: number;
  reload: () => void;
}

const MAX_POINTS = 100;

const CACHE_KEY = "divideit:trustscore";
const LAST_CACHE_KEY = `${CACHE_KEY}:last`;

function readCachedScore(uid?: string): number {
  try {
    const raw = (uid ? localStorage.getItem(`${CACHE_KEY}:${uid}`) : null) || localStorage.getItem(LAST_CACHE_KEY);
    const v = raw ? parseInt(raw, 10) : 0;
    return Number.isNaN(v) ? 0 : Math.max(0, Math.min(MAX_POINTS, v));
  } catch {
    return 0;
  }
}

function writeCachedScore(uid: string | undefined, score: number) {
  if (!uid) return;
  try {
    localStorage.setItem(`${CACHE_KEY}:${uid}`, String(score));
    localStorage.setItem(LAST_CACHE_KEY, String(score));
  } catch {
    /* ignore quota */
  }
}

export function useTrustScore(): TrustData {
  const { user } = useAuth();
  // Init with the cached score so the ring shows the real value instantly (no 0 flash).
  const [cachedScore, setCachedScore] = useState<number>(() => readCachedScore(user?.uid));
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<{
    missions: TrustItem[];
    milestones: TrustItem[];
    malus: TrustItem[];
    avgRating: number | null;
    reviewCount: number;
  }>({ missions: [], milestones: [], malus: [], avgRating: null, reviewCount: 0 });

  const load = useCallback(async () => {
    if (!user?.uid || !user?.email) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const email = user.email.toLowerCase();

    const [
      { data: profile },
      { data: authUser },
      { data: ownedGroups },
      { data: myRatings },
      { data: myMemberships },
      { data: myPayments },
    ] = await Promise.all([
      (supabase.from("user_profiles" as any) as any)
        .select("*").eq("user_id", user.uid).maybeSingle(),
      supabase.auth.getUser(),
      supabase.from("groups").select("id, created_date, stripe_payouts_enabled, stripe_charges_enabled").eq("admin_email", email),
      (supabase.from("ratings" as any) as any).select("stars").eq("ratee_email", email),
      supabase.from("memberships").select("id, payment_status, auto_renew, current_period_end").eq("user_email", email),
      supabase.from("payments").select("id, status").eq("user_email", email),
    ]);

    const p: any = profile || {};
    const u = authUser?.user;
    const payoutReady = (ownedGroups || []).some((g: any) => g.stripe_payouts_enabled);
    const phoneVerified = !!p.phone_verified_at;
    const hasAvatar = !!(u?.user_metadata?.avatar_url || user.avatar_url);
    const hasAddress = !!(p.address_line && p.address_city && p.address_zip && p.address_country);
    const googleLinked = (u?.app_metadata?.providers || []).includes("google");
    const emailVerified = !!u?.email_confirmed_at || !!u?.confirmed_at;
    const groupsCreated = ownedGroups?.length || 0;

    const stars = (myRatings || []).map((r: any) => r.stars).filter((s: any) => typeof s === "number");
    const reviewCount = stars.length;
    const avgRating = reviewCount ? stars.reduce((a: number, b: number) => a + b, 0) / reviewCount : null;

    const paidPayments = (myPayments || []).filter((x: any) => x.status === "paid").length;
    const late = (myMemberships || []).some(
      (m: any) => m.payment_status === "late" || m.payment_status === "unpaid" || m.payment_status === "past_due",
    );
    const activeMemberships = (myMemberships || []).filter((m: any) => m.payment_status === "paid");
    const sharedThree = groupsCreated + activeMemberships.length >= 3;

    const lastSeen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : Date.now();
    const daysSinceSeen = (Date.now() - lastSeen) / 86400000;
    const inactive = daysSinceSeen > 3;
    const veryActive = daysSinceSeen < 1 && (groupsCreated + activeMemberships.length) > 0;

    const missions: TrustItem[] = [
      {
        key: "payout", kind: "mission", points: 15, done: payoutReady,
        label: "Dati di prelievo e IBAN completati",
        description: "Inserisci i dati di pagamento e l'IBAN per ricevere i prelievi",
        action: { label: "Completa", to: "/Wallet" },
      },
      {
        key: "phone", kind: "mission", points: 10, done: phoneVerified,
        label: "Numero di cellulare verificato",
        description: "Conferma il tuo numero con un codice SMS",
        action: { label: "Verifica", to: "/settings?tab=security" },
      },
      {
        key: "avatar", kind: "mission", points: 5, done: hasAvatar,
        label: "Foto profilo caricata",
        description: "Un volto riconoscibile aumenta la fiducia",
        action: { label: "Carica", to: "/settings" },
      },
      {
        key: "address", kind: "mission", points: 5, done: hasAddress,
        label: "Dati indirizzo inseriti",
        description: "Via, città, CAP e paese completi",
        action: { label: "Completa", to: "/settings" },
      },
      {
        key: "google", kind: "mission", points: 2, done: googleLinked,
        label: "Account Google collegato",
      },
      {
        key: "email", kind: "mission", points: 2, done: emailVerified,
        label: "Email verificata",
      },
      {
        key: "group_created", kind: "mission", points: 1, done: groupsCreated > 0,
        label: "Gruppo di condivisione creato",
        action: { label: "Crea", to: "/CreateGroup" },
      },
    ];

    const goodReviews = avgRating !== null && avgRating > 3.9;
    const noReviews = reviewCount === 0;

    const milestones: TrustItem[] = [
      {
        key: "reviews", kind: "milestone",
        points: noReviews ? 35 : 40,
        done: goodReviews || noReviews,
        label: noReviews ? "Nessuna recensione ricevuta" : "Media recensioni superiore a 3.9",
        description: noReviews
          ? "Riceverai i punti pieni con una media superiore a 3.9"
          : `Media attuale: ${avgRating?.toFixed(1)} su ${reviewCount} recensioni`,
      },
      {
        key: "fast_reply", kind: "milestone", points: 10, done: veryActive && groupsCreated > 0,
        label: "Rispondi ai joiner in meno di 6 ore",
        description: "Mantieni le conversazioni attive nei tuoi gruppi",
      },
      {
        key: "active", kind: "milestone", points: 5, done: veryActive,
        label: "Utente molto attivo sulla piattaforma",
        description: "Accedi almeno una volta al giorno",
      },
      {
        key: "on_time", kind: "milestone", points: 3, done: paidPayments > 0 && !late,
        label: "Puntuale nei pagamenti e nei rinnovi",
      },
      {
        key: "three_subs", kind: "milestone", points: 2, done: sharedThree,
        label: "Condividi almeno 3 abbonamenti",
      },
    ];

    const malus: TrustItem[] = [
      {
        key: "bad_reviews", kind: "malus", points: -35,
        done: avgRating !== null && avgRating < 2,
        label: "Media recensioni inferiore a 2",
      },
      {
        key: "mid_reviews", kind: "malus", points: -10,
        done: avgRating !== null && avgRating >= 2 && avgRating < 3,
        label: "Media recensioni tra 2 e 2.9",
      },
      {
        key: "late_payments", kind: "malus", points: -5, done: late,
        label: "In ritardo nei pagamenti",
      },
      {
        key: "inactive", kind: "malus", points: -5, done: inactive,
        label: "Ultimo accesso più di 3 giorni fa",
      },
    ];

    setState({ missions, milestones, malus, avgRating, reviewCount });
    const earnedNow =
      missions.filter((i) => i.done).reduce((sum, item) => sum + item.points, 0) +
      milestones.filter((i) => i.done).reduce((sum, item) => sum + item.points, 0);
    const penaltiesNow = malus.filter((i) => i.done).reduce((sum, item) => sum + item.points, 0);
    const finalScore = Math.max(0, Math.min(MAX_POINTS, earnedNow + penaltiesNow));
    setCachedScore(finalScore);
    writeCachedScore(user?.uid, finalScore);
    setLoading(false);
  }, [user?.uid, user?.email, user?.avatar_url]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user?.uid) return;
    const stored = readCachedScore(user.uid);
    if (stored > 0) setCachedScore(stored);
  }, [user?.uid]);

  const earnedPoints =
    state.missions.filter((i) => i.done).reduce((a, i) => a + i.points, 0) +
    state.milestones.filter((i) => i.done).reduce((a, i) => a + i.points, 0);
  const penaltyPoints = state.malus.filter((i) => i.done).reduce((a, i) => a + i.points, 0);
  const computed = Math.max(0, Math.min(MAX_POINTS, earnedPoints + penaltyPoints));

  const displayScore = loading ? cachedScore : computed;

  return {
    loading,
    score: displayScore,
    missions: state.missions,
    milestones: state.milestones,
    malus: state.malus,
    earnedPoints,
    maxPoints: MAX_POINTS,
    penaltyPoints,
    avgRating: state.avgRating,
    reviewCount: state.reviewCount,
    reload: load,
  };
}
