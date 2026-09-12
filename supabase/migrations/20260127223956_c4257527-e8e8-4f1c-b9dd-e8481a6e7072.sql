-- 1) Drop all existing RLS policies FIRST (before dropping column they depend on)
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can read messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;

-- 2) Add sender_uid column (nullable first for backfill)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_uid text;

-- 3) Backfill existing rows: use sender_email as temporary uid
UPDATE public.messages SET sender_uid = sender_email WHERE sender_uid IS NULL AND sender_email IS NOT NULL;

-- 4) Set default for rows without sender_email
UPDATE public.messages SET sender_uid = 'unknown' WHERE sender_uid IS NULL;

-- 5) Make sender_uid NOT NULL
ALTER TABLE public.messages ALTER COLUMN sender_uid SET NOT NULL;

-- 6) Now we can safely drop sender_email column
ALTER TABLE public.messages DROP COLUMN IF EXISTS sender_email;

-- 7) Create index on sender_uid for efficient lookups
CREATE INDEX IF NOT EXISTS idx_messages_sender_uid ON public.messages(sender_uid);

-- 8) Create new RLS policies
-- SELECT: Allow everyone to read messages (needed for realtime + history)
CREATE POLICY "Anyone can read messages"
ON public.messages
FOR SELECT
TO anon, authenticated
USING (true);

-- INSERT: Block direct client inserts (edge function uses service role)
CREATE POLICY "No direct inserts"
ON public.messages
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

-- DELETE: Block direct client deletes (edge function uses service role)
CREATE POLICY "No direct deletes"
ON public.messages
FOR DELETE
TO anon, authenticated
USING (false);