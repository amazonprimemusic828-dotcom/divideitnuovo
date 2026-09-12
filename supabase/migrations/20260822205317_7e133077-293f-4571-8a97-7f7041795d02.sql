CREATE OR REPLACE FUNCTION public.admin_rating_summary(_emails text[])
RETURNS TABLE(ratee_email text, avg_stars numeric, review_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT lower(r.ratee_email), round(avg(r.stars)::numeric, 1), count(*)::int
  FROM public.ratings r
  WHERE lower(r.ratee_email) = ANY (SELECT lower(e) FROM unnest(_emails) e)
  GROUP BY lower(r.ratee_email)
$$;

GRANT EXECUTE ON FUNCTION public.admin_rating_summary(text[]) TO anon, authenticated;