CREATE OR REPLACE FUNCTION public.notify_group_members_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_email text;
  v_service_name text;
  v_preview text;
  v_rec record;
  v_existing uuid;
BEGIN
  SELECT lower(email) INTO v_sender_email FROM auth.users WHERE id = NEW.sender_uid::uuid;

  SELECT service_name INTO v_service_name FROM public.groups WHERE id = NEW.group_id;
  IF v_service_name IS NULL THEN
    v_service_name := 'Gruppo';
  END IF;

  v_preview := left(coalesce(NEW.message, ''), 120);

  FOR v_rec IN
    SELECT DISTINCT lower(user_email) AS email
    FROM public.memberships
    WHERE group_id = NEW.group_id
      AND lower(user_email) IS DISTINCT FROM coalesce(v_sender_email, '')
  LOOP
    SELECT id INTO v_existing
    FROM public.notifications
    WHERE lower(user_email) = v_rec.email
      AND group_id = NEW.group_id
      AND type = 'message'
      AND read = false
    ORDER BY created_date DESC
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      UPDATE public.notifications
      SET title = 'Nuovo messaggio in ' || v_service_name,
          content = coalesce(NEW.sender_name, 'Un membro') || ': ' || v_preview,
          link = '/group/' || NEW.group_id::text,
          created_date = now()
      WHERE id = v_existing;
    ELSE
      INSERT INTO public.notifications (user_email, type, title, content, link, group_id, read, created_date)
      VALUES (
        v_rec.email,
        'message',
        'Nuovo messaggio in ' || v_service_name,
        coalesce(NEW.sender_name, 'Un membro') || ': ' || v_preview,
        '/group/' || NEW.group_id::text,
        NEW.group_id,
        false,
        now()
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_group_members_on_message() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_group_members_on_message ON public.messages;
CREATE TRIGGER trg_notify_group_members_on_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_group_members_on_message();