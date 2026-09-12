-- Reconcile paid group payments that were finalized without an owner ledger row.
INSERT INTO public.wallet_ledger (
  owner_uid,
  owner_email,
  group_id,
  payment_id,
  gross_amount,
  platform_fee,
  net_amount,
  paid_at,
  release_at,
  status
)
SELECT
  COALESCE(g.owner_id::text, up.user_id::text, g.admin_email),
  lower(g.admin_email),
  p.group_id,
  p.id,
  p.amount,
  p.platform_fee,
  p.owner_amount,
  COALESCE(p.payment_date, p.created_date, now()),
  COALESCE(p.payment_date, p.created_date, now()) + interval '25 days',
  CASE
    WHEN COALESCE(p.payment_date, p.created_date, now()) + interval '25 days' <= now() THEN 'available'
    ELSE 'in_hold'
  END
FROM public.payments p
JOIN public.groups g ON g.id = p.group_id
LEFT JOIN public.user_profiles up ON lower(up.user_email) = lower(g.admin_email)
LEFT JOIN public.wallet_ledger wl ON wl.payment_id = p.id
WHERE p.status IN ('paid', 'completed')
  AND wl.id IS NULL
ON CONFLICT (payment_id) WHERE payment_id IS NOT NULL DO NOTHING;

-- Reconstruct the missing in-app owner notifications for settled payments.
INSERT INTO public.notifications (user_email, type, title, content, read, created_date)
SELECT
  lower(g.admin_email),
  'payment_received',
  'Pagamento ricevuto',
  split_part(p.user_email, '@', 1) || ' ha pagato ' || g.service_name || ': €' || to_char(p.owner_amount, 'FM999999990.00') || ' sono ora in hold.',
  false,
  COALESCE(p.payment_date, p.created_date, now())
FROM public.payments p
JOIN public.groups g ON g.id = p.group_id
WHERE p.status IN ('paid', 'completed')
  AND NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE lower(n.user_email) = lower(g.admin_email)
      AND n.type = 'payment_received'
      AND n.content = split_part(p.user_email, '@', 1) || ' ha pagato ' || g.service_name || ': €' || to_char(p.owner_amount, 'FM999999990.00') || ' sono ora in hold.'
  );

-- Daily, idempotent release. A CTE ensures notifications are produced only for
-- rows that actually transition from in_hold to available in this execution.
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'release-wallet-holds-daily';

SELECT cron.schedule(
  'release-wallet-holds-daily',
  '0 4 * * *',
  $job$
    WITH released AS (
      UPDATE public.wallet_ledger
      SET status = 'available'
      WHERE status = 'in_hold'
        AND release_at <= now()
      RETURNING owner_email, net_amount
    )
    INSERT INTO public.notifications (user_email, type, title, content, read, created_date)
    SELECT
      lower(owner_email),
      'funds_available',
      'Fondi disponibili',
      '€' || to_char(net_amount, 'FM999999990.00') || ' sono ora disponibili per il prelievo.',
      false,
      now()
    FROM released;
  $job$
);