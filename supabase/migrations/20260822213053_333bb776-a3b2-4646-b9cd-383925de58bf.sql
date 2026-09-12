-- Trusted writes flag honoured by the profile guard
CREATE OR REPLACE FUNCTION public.user_profiles_protect_sensitive()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role'
     OR auth.role() = 'service_role'
     OR coalesce(current_setting('app.trusted_profile_write', true), '') = 'on' THEN
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
END; $$;

CREATE OR REPLACE FUNCTION public.user_profiles_protect_sensitive_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role'
     OR auth.role() = 'service_role'
     OR coalesce(current_setting('app.trusted_profile_write', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  NEW.trust_level        := 0;
  NEW.trust_badges       := ARRAY[]::text[];
  NEW.phone_e164         := NULL;
  NEW.phone_verified_at  := NULL;
  NEW.identity_status    := 'unverified';
  NEW.identity_verified_at := NULL;
  RETURN NEW;
END; $$;

-- Server-side helpers mark their writes as trusted
CREATE OR REPLACE FUNCTION public.mark_phone_verified(_phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  em TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  PERFORM set_config('app.trusted_profile_write', 'on', true);

  SELECT email INTO em FROM auth.users WHERE id = uid;

  INSERT INTO public.user_profiles (user_id, user_email, phone_e164, phone_verified_at, trust_badges)
  VALUES (uid, em, _phone, now(), ARRAY['phone_verified'])
  ON CONFLICT (user_id) DO UPDATE
    SET phone_e164 = _phone,
        phone_verified_at = now(),
        trust_badges = CASE
          WHEN 'phone_verified' = ANY(public.user_profiles.trust_badges)
            THEN public.user_profiles.trust_badges
          ELSE array_append(public.user_profiles.trust_badges, 'phone_verified')
        END;

  UPDATE public.phone_verifications
     SET verified_at = now()
   WHERE user_id = uid AND verified_at IS NULL;

  PERFORM set_config('app.trusted_profile_write', 'off', true);
END; $$;

CREATE OR REPLACE FUNCTION public.award_trust_badge(_user_id uuid, _badge text, _points integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('app.trusted_profile_write', 'on', true);

  INSERT INTO public.user_profiles (user_id, trust_badges, trust_level)
  VALUES (_user_id, ARRAY[_badge], LEAST(100, GREATEST(0, _points)))
  ON CONFLICT (user_id) DO UPDATE
  SET trust_badges = CASE
        WHEN _badge = ANY(public.user_profiles.trust_badges)
          THEN public.user_profiles.trust_badges
        ELSE array_append(public.user_profiles.trust_badges, _badge)
      END,
      trust_level = CASE
        WHEN _badge = ANY(public.user_profiles.trust_badges)
          THEN public.user_profiles.trust_level
        ELSE LEAST(100, public.user_profiles.trust_level + _points)
      END,
      updated_at = now();

  PERFORM set_config('app.trusted_profile_write', 'off', true);
END; $$;