CREATE OR REPLACE FUNCTION public.enforce_ticket_daily_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NEW.ticket_type IN ('refund','help') THEN
    SELECT count(*) INTO v_count
    FROM public.support_tickets
    WHERE user_id = NEW.user_id
      AND ticket_type = NEW.ticket_type
      AND created_at >= (now() - interval '24 hours');

    IF v_count >= 1 THEN
      IF NEW.ticket_type = 'refund' THEN
        RAISE EXCEPTION 'Puoi inviare solo una richiesta di rimborso ogni 24 ore. Riprova più tardi.'
          USING ERRCODE = 'check_violation';
      ELSE
        RAISE EXCEPTION 'Puoi inviare solo una richiesta di aiuto ogni 24 ore. Riprova più tardi.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_ticket_daily_limit ON public.support_tickets;
CREATE TRIGGER trg_enforce_ticket_daily_limit
BEFORE INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.enforce_ticket_daily_limit();