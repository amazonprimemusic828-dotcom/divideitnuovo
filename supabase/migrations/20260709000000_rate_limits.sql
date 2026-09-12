-- Server-side rate limiting infrastructure
-- Sliding window counters keyed by (identity, endpoint, window)

CREATE TABLE IF NOT EXISTS public.rate_limits (
  rl_key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (rl_key, endpoint, window_start)
);

-- Lock the table down: only service_role (edge functions) may touch it
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;

-- Atomic consume: returns TRUE if the request is within the limit
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key TEXT,
  p_endpoint TEXT,
  p_max INT,
  p_window_seconds INT DEFAULT 60
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window TIMESTAMPTZ;
  v_count INT;
BEGIN
  v_window := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);

  INSERT INTO public.rate_limits (rl_key, endpoint, window_start, count)
  VALUES (p_key, p_endpoint, v_window, 1)
  ON CONFLICT (rl_key, endpoint, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

-- Only service role can execute the limiter
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, TEXT, INT, INT) FROM PUBLIC, anon, authenticated;

-- Housekeeping: purge windows older than 1 day (call from cron or hold-release)
CREATE OR REPLACE FUNCTION public.purge_rate_limits() RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day';
$$;

REVOKE EXECUTE ON FUNCTION public.purge_rate_limits() FROM PUBLIC, anon, authenticated;
