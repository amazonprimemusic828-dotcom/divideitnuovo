
-- support_messages: harden INSERT to prevent impersonation
DROP POLICY IF EXISTS support_messages_insert_own_ticket ON public.support_messages;
CREATE POLICY support_messages_insert_own_ticket
  ON public.support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()::text
    AND sender_type = 'user'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND lower(t.user_email) = public.current_email()
    )
  );

-- trust_scores: deny all writes from authenticated; only service_role may write
CREATE POLICY trust_scores_no_insert_authenticated
  ON public.trust_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY trust_scores_no_update_authenticated
  ON public.trust_scores
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY trust_scores_no_delete_authenticated
  ON public.trust_scores
  FOR DELETE
  TO authenticated
  USING (false);

-- wallet_ledger: deny all writes from authenticated; only service_role may write
CREATE POLICY wallet_ledger_no_insert_authenticated
  ON public.wallet_ledger
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY wallet_ledger_no_update_authenticated
  ON public.wallet_ledger
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY wallet_ledger_no_delete_authenticated
  ON public.wallet_ledger
  FOR DELETE
  TO authenticated
  USING (false);
