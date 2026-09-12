-- One owner ledger entry per finalized payment. Historical duplicate rows are
-- preserved for audit; the earliest entry becomes the canonical paid record
-- and later duplicates are detached before the uniqueness constraint is added.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY payment_id ORDER BY created_at, id) AS rn
  FROM public.wallet_ledger
  WHERE payment_id IS NOT NULL
)
UPDATE public.wallet_ledger AS ledger
SET payment_id = NULL,
    refund_reason = concat_ws(' | ', nullif(ledger.refund_reason, ''), 'duplicate payment ledger detached during idempotency migration')
FROM ranked
WHERE ledger.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_wallet_ledger_payment_id
  ON public.wallet_ledger (payment_id)
  WHERE payment_id IS NOT NULL;
