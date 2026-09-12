-- Add read status tracking for messages
-- read_by stores an array of user UIDs who have read the message
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS read_by TEXT[] DEFAULT '{}';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_messages_read_by ON public.messages USING GIN(read_by);

-- Create function to mark messages as read
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_group_id UUID, p_user_uid TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.messages
  SET read_by = array_append(read_by, p_user_uid)
  WHERE group_id = p_group_id
    AND sender_uid != p_user_uid
    AND NOT (read_by @> ARRAY[p_user_uid]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;