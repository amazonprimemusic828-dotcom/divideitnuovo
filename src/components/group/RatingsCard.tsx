import React, { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthContext";
import {
  computeAdminReputation,
  BADGES,
  type AdminBadge,
} from "@/lib/adminReputation";

interface RatingsCardProps {
  groupId: string;
  adminEmail: string;
  /** email dell'utente connesso (per sapere se può votare) */
  viewerEmail?: string | null;
  /** uid dell'utente connesso */
  viewerUid?: string | null;
  isAdmin: boolean;
}

export function AdminReputationBadge({ badge }: { badge: AdminBadge }) {
  const meta = BADGES.find((b) => b.id === badge) || BADGES[BADGES.length - 1];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-sm ${meta.color}`}
      title={meta.description}
    >
      <span>{meta.icon}</span>
      {meta.id}
    </span>
  );
}

function StarsInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          aria-label={`${n} stelle`}
          className="transition-transform hover:scale-125 disabled:cursor-not-allowed"
        >
          <Star
            className={`w-7 h-7 ${
              n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function RatingsCard({
  groupId,
  adminEmail,
  viewerEmail,
  viewerUid,
  isAdmin,
}: RatingsCardProps) {
  const { toast } = useToast();
  const [myRating, setMyRating] = useState<number | null>(null);
  const [review, setReview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);

  const normalizedViewerUid = viewerUid?.trim();
  const hasValidViewerUid = !!normalizedViewerUid && normalizedViewerUid.toLowerCase() !== "undefined" && normalizedViewerUid.toLowerCase() !== "null";
  const canVote = hasValidViewerUid && !!viewerEmail && !isAdmin;

  const load = async () => {
    setLoading(true);
    const raterUid = hasValidViewerUid ? normalizedViewerUid : null;
    const normalizedAdminEmail = adminEmail.trim();
    const minePromise = raterUid
      ? supabase
        .from("ratings")
        .select("stars, review")
        .eq("group_id", groupId)
        .ilike("ratee_email", normalizedAdminEmail)
        .eq("rater_uid", raterUid)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null });
    const [mine, all] = await Promise.all([
      minePromise,
      supabase
        .from("ratings")
        .select("stars, review, rater_email, created_at")
        .eq("group_id", groupId)
        .ilike("ratee_email", normalizedAdminEmail)
        .order("created_at", { ascending: false }),
    ]);
    if (mine.data) {
      setMyRating(mine.data.stars);
      setReview(mine.data.review || "");
    }
    setReviews(all.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, adminEmail, viewerUid]);


  const rep = useMemo(
    () => computeAdminReputation(reviews.map((r) => r.stars)),
    [reviews],
  );

  const submit = async () => {
    if (!hasValidViewerUid || !normalizedViewerUid || !viewerEmail) return;
    if (myRating === null) {
      toast({ title: "Seleziona un voto", description: "Scegli da 1 a 5 stelle." });
      return;
    }
    setSaving(true);
    const payload = {
      group_id: groupId,
      rater_uid: normalizedViewerUid as any,
      rater_email: viewerEmail,
      ratee_email: adminEmail,
      rater_role: "member",
      stars: myRating,
      review: review.trim() || null,
    };
    const existing = await supabase
      .from("ratings")
      .select("id")
      .eq("group_id", groupId)
      .ilike("ratee_email", adminEmail.trim())
      .eq("rater_uid", normalizedViewerUid as any)
      .maybeSingle();

    let res;
    if (existing.data?.id) {
      res = await supabase
        .from("ratings")
        .update({ stars: myRating, review: review.trim() || null })
        .eq("id", existing.data.id);
    } else {
      res = await supabase.from("ratings").insert(payload);
    }
    setSaving(false);
    if (res.error) {
      toast({
        title: "Errore",
        description: res.error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Grazie per la recensione!",
      description: "La valutazione dell'admin è stata aggiornata.",
    });
    load();
  };

  if (loading) {
    return (
      <Card className="p-5 animate-pulse">
        <div className="h-5 w-1/3 bg-muted rounded mb-3" />
        <div className="h-4 w-2/3 bg-muted rounded" />
      </Card>
    );
  }

  const badgeMeta = BADGES.find((b) => b.id === rep.badge) || BADGES[3];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-bold text-foreground text-lg">Affidabilità dell'Admin</h3>
          <p className="text-sm text-muted-foreground">Basata sulle recensioni dei membri</p>
        </div>
        {rep.reviewCount > 0 && (
          <span className="text-3xl font-black text-primary">{rep.trust}%</span>
        )}
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={`w-5 h-5 ${
                rep.avgStars !== null && n <= Math.round(rep.avgStars)
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground"
              }`}
            />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          {rep.avgStars !== null ? `${rep.avgStars.toFixed(1)} / 5` : "Nessuna recensione"} ·{" "}
          {rep.reviewCount} {rep.reviewCount === 1 ? "recensione" : "recensioni"}
        </span>
        <AdminReputationBadge badge={rep.badge} />
      </div>

      {rep.trust > 0 && rep.trust < 80 && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3 mb-4">
          L'affidabilità dell'admin è sotto la soglia di visibilità: il gruppo
          potrebbe perdere visibilità nelle ricerche.
        </p>
      )}




      {reviews.length > 0 && (
        <div className="mt-5 border-t border-border pt-4 space-y-3 max-h-64 overflow-y-auto">
          {reviews.slice(0, 10).map((r, i) => (
            <div key={i} className="text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {r.rater_email?.split("@")[0]}
                </span>
                <span className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star
                      key={j}
                      className={`w-3.5 h-3.5 ${
                        j < r.stars ? "fill-amber-400 text-amber-400" : "text-muted"
                      }`}
                    />
                  ))}
                </span>
              </div>
              {r.review && <p className="text-muted-foreground mt-1">{r.review}</p>}
            </div>
          ))}
        </div>
      )}

      <span className="sr-only">{badgeMeta.description}</span>
    </Card>
  );
}
