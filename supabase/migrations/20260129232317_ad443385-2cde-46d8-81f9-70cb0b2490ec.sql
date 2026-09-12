-- ============================================
-- 📊 TABELLE SISTEMA SUPPORTO AI DIVIDEIT
-- ============================================

-- TABELLA: support_tickets
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('payment', 'technical', 'account', 'group', 'general')),
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'ai_handled', 'waiting_operator', 'in_progress', 'closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_operator TEXT,
  ai_attempted BOOLEAN DEFAULT false,
  ai_resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELLA: support_messages  
CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'ai', 'operator', 'system')),
  message TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDICI
CREATE INDEX idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_assigned ON public.support_tickets(assigned_operator);
CREATE INDEX idx_support_messages_ticket ON public.support_messages(ticket_id);

-- TRIGGER Auto-update per updated_at
CREATE OR REPLACE FUNCTION public.update_support_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER support_tickets_updated_at 
  BEFORE UPDATE ON public.support_tickets 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_support_updated_at();

-- ROW LEVEL SECURITY
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Policies per support_tickets
CREATE POLICY "Users can view their own tickets" 
  ON public.support_tickets FOR SELECT 
  USING (true);

CREATE POLICY "Users can create tickets" 
  ON public.support_tickets FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update their own tickets" 
  ON public.support_tickets FOR UPDATE 
  USING (true);

-- Policies per support_messages
CREATE POLICY "Users can view messages for their tickets" 
  ON public.support_messages FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can insert messages" 
  ON public.support_messages FOR INSERT 
  WITH CHECK (true);

-- Enable realtime per i ticket
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;