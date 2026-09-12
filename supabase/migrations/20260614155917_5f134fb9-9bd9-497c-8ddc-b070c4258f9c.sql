CREATE OR REPLACE FUNCTION public.enforce_ticket_daily_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF NEW.ticket_type IN ('refund','help','problem') THEN
    SELECT count(*) INTO v_count
    FROM public.support_tickets
    WHERE user_id = NEW.user_id
      AND ticket_type = NEW.ticket_type
      AND group_id IS NOT DISTINCT FROM NEW.group_id
      AND created_at >= (now() - interval '24 hours');

    IF v_count >= 1 THEN
      IF NEW.ticket_type = 'refund' THEN
        RAISE EXCEPTION 'Puoi inviare solo una richiesta di rimborso ogni 24 ore per questo gruppo. Riprova più tardi.'
          USING ERRCODE = 'check_violation';
      ELSIF NEW.ticket_type = 'help' THEN
        RAISE EXCEPTION 'Puoi inviare solo una richiesta di aiuto all''admin ogni 24 ore per questo gruppo. Riprova più tardi.'
          USING ERRCODE = 'check_violation';
      ELSE
        RAISE EXCEPTION 'Puoi inviare solo una segnalazione problema ogni 24 ore per questo gruppo. Riprova più tardi.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;