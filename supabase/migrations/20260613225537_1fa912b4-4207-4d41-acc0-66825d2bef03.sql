
-- Extend support_tickets for group-scoped tickets (problem reports & refund requests)
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS ticket_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_admin_email text,
  ADD COLUMN IF NOT EXISTS membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refund_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refund_amount numeric;

CREATE INDEX IF NOT EXISTS idx_support_tickets_type ON public.support_tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_support_tickets_group ON public.support_tickets(group_id);

-- Extend wallet_ledger for refund tracking
ALTER TABLE public.wallet_ledger
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS stripe_refund_id text;

-- Drop and recreate a slightly more permissive INSERT policy for support_tickets to allow
-- the user to attach group_id / group_admin_email / membership_id when filing a ticket.
DROP POLICY IF EXISTS support_tickets_insert_own ON public.support_tickets;
CREATE POLICY support_tickets_insert_own ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    lower(user_email) = public.current_email()
    AND user_id = (auth.uid())::text
    AND ticket_type IN ('general','refund','help','problem')
  );
