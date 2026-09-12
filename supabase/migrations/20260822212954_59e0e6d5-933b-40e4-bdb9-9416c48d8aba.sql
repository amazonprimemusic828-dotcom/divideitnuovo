CREATE OR REPLACE FUNCTION public.user_profiles_protect_sensitive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Trusted server-side writes (edge functions / SECURITY DEFINER helpers) bypass this guard
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role'
     OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.user_id            := OLD.user_id;
  NEW.trust_level        := OLD.trust_level;
  NEW.trust_badges       := OLD.trust_badges;
  NEW.phone_e164         := OLD.phone_e164;
  NEW.phone_verified_at  := OLD.phone_verified_at;
  NEW.identity_status    := OLD.identity_status;
  NEW.identity_verified_at := OLD.identity_verified_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_protect_sensitive_trg ON public.user_profiles;
CREATE TRIGGER user_profiles_protect_sensitive_trg
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.user_profiles_protect_sensitive();

-- Same guard on insert: users may create their own row, but not pre-set trust/identity
CREATE OR REPLACE FUNCTION public.user_profiles_protect_sensitive_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role'
     OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.trust_level        := 0;
  NEW.trust_badges       := ARRAY[]::text[];
  NEW.phone_e164         := NULL;
  NEW.phone_verified_at  := NULL;
  NEW.identity_status    := 'unverified';
  NEW.identity_verified_at := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_protect_sensitive_insert_trg ON public.user_profiles;
CREATE TRIGGER user_profiles_protect_sensitive_insert_trg
  BEFORE INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.user_profiles_protect_sensitive_insert();