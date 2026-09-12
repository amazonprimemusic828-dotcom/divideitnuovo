import React, { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";


interface Props {
  groupId: string;
  adminEmail: string;
  viewerEmail?: string | null;
  viewerUid?: string | null;
  /** true se chi guarda è l'admin del gruppo (non può votare se stesso) */
  isAdmin: boolean;
}

export default function RatingStarPopover({
  groupId,
  adminEmail,
  viewerEmail,
  viewerUid,
  isAdmin,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState("");
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);


  const canVote = !!viewerUid && !!viewerEmail && !isAdmin;

  useEffect(() => {
    if (!open || !viewerUid) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("ratings")
        .select("id, stars, review")
        .eq("group_id", groupId)
        .ilike("ratee_email", (adminEmail || "").trim())
        .eq("rater_uid", viewerUid as any)
        .maybeSingle();

      if (!active || !data) return;
      setExistingId(data.id);
      setStars(data.stars);
      setReview(data.review || "");
    })();
    return () => {
      active = false;
    };
  }, [open, groupId, adminEmail, viewerUid]);

  const submit = async () => {
    if (!viewerUid || !viewerEmail) return;
    if (stars < 1) {
      toast({ title: "Seleziona un voto", description: "Scegli da 1 a 5 stelle." });
      return;
    }
    setSaving(true);
    const base = {
      stars,
      review: review.trim() || null,
    };
    const rateeEmail = (adminEmail || "").toLowerCase();
    const res = existingId
      ? await supabase
          .from("ratings")
          .update(base)
          .eq("id", existingId)
      : await supabase.from("ratings").insert({
          group_id: groupId,
          rater_uid: viewerUid as any,
          rater_email: (viewerEmail || "").toLowerCase(),
          ratee_email: rateeEmail,
          rater_role: "member",
          stars,
          review: review.trim() || null,
        });
    setSaving(false);
    if (res.error) {
      toast({ title: "Errore", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Grazie!", description: "Recensione salvata." });
    queryClient.invalidateQueries({ queryKey: ["adminRatings"] });
    setOpen(false);

  };

  if (!canVote) return null;

  const shown = hover || stars;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Lascia una recensione all'admin"
          className="flex flex-col items-center gap-0 shrink-0 px-1 py-0.5 rounded-lg hover:bg-amber-50 transition-colors"
        >
          <Star
            className={`w-4 h-4 ${stars > 0 ? "fill-amber-400 text-amber-400" : "text-amber-500"}`}
          />
          <span className="text-[9px] leading-none font-medium text-muted-foreground">
            Recensione
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" side="bottom" className="w-64 p-3">
        <p className="text-sm font-semibold text-foreground mb-2">Valuta l'admin</p>
        <div className="flex items-center gap-1 mb-2" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onClick={() => setStars(n)}
              aria-label={`${n} stelle`}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`w-6 h-6 ${
                  n <= shown ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
                }`}
              />
            </button>
          ))}
        </div>
        <Textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Commento (facoltativo)"
          rows={2}
          className="text-sm mb-2 resize-none"
        />
        <Button size="sm" className="w-full" onClick={submit} disabled={saving}>
          {saving ? "Salvataggio…" : existingId ? "Aggiorna recensione" : "Invia recensione"}
        </Button>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          Un solo voto per gruppo, modificabile.
        </p>
      </PopoverContent>
    </Popover>
  );
}
