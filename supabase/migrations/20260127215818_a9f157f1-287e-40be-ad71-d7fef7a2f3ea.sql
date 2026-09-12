-- Tabella messages per chat di gruppo
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL,
  sender_email TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_messages_group ON public.messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_email);

-- RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policy: tutti gli utenti autenticati possono leggere i messaggi
CREATE POLICY "Authenticated users can read messages" 
ON public.messages FOR SELECT 
TO authenticated 
USING (true);

-- Policy: utenti autenticati possono inserire messaggi
CREATE POLICY "Authenticated users can insert messages" 
ON public.messages FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Policy: utenti possono eliminare i propri messaggi
CREATE POLICY "Users can delete own messages" 
ON public.messages FOR DELETE 
TO authenticated 
USING (sender_email = auth.jwt() ->> 'email');

-- Abilita Realtime per messaggi
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;