-- Create messages table for group chat
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT NOT NULL,
  sender_uid TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  read_by TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_messages_group ON public.messages(group_id);
CREATE INDEX idx_messages_created ON public.messages(created_at DESC);

-- RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Anyone can insert messages" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete own messages" ON public.messages FOR DELETE USING (true);
CREATE POLICY "Anyone can update messages" ON public.messages FOR UPDATE USING (true);

-- Function for marking messages as read
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_group_id TEXT, p_user_uid TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.messages 
  SET read_by = array_append(read_by, p_user_uid)
  WHERE group_id = p_group_id 
    AND NOT (read_by @> ARRAY[p_user_uid]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;