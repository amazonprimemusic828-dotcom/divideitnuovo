
-- Roles infrastructure
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_can_view_own_roles" ON public.user_roles;
CREATE POLICY "users_can_view_own_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_operator()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('operator','admin')
  )
$$;

-- Update support_tickets policies for operators
DROP POLICY IF EXISTS "support_tickets_select_operator" ON public.support_tickets;
CREATE POLICY "support_tickets_select_operator" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (public.is_operator());

DROP POLICY IF EXISTS "support_tickets_update_operator" ON public.support_tickets;
CREATE POLICY "support_tickets_update_operator" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.is_operator())
  WITH CHECK (public.is_operator());

-- Update support_messages policies for operators
DROP POLICY IF EXISTS "support_messages_select_operator" ON public.support_messages;
CREATE POLICY "support_messages_select_operator" ON public.support_messages
  FOR SELECT TO authenticated
  USING (public.is_operator());

DROP POLICY IF EXISTS "support_messages_insert_operator" ON public.support_messages;
CREATE POLICY "support_messages_insert_operator" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_operator()
    AND sender_type IN ('operator','ai')
  );

-- Enable realtime
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Auto-grant operator role to known admin email if user already exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'operator'::public.app_role FROM auth.users
WHERE lower(email) = 'dogeshibarium@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
