import { supabase } from "@/lib/supabaseClient";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface ChatMessage {
  id: string;
  group_id: string;
  sender_uid: string;
  sender_name: string;
  sender_avatar: string | null;
  message: string;
  message_type: string;
  created_at: string;
  read_by?: string[];
}

// 👁️ Mark messages as read
export const markMessagesAsRead = async (groupId: string, userUid: string): Promise<boolean> => {
  console.log(`👁️ Marking messages as read for user ${userUid} in group ${groupId}`);
  
  try {
    const { error } = await supabase.rpc('mark_messages_read', {
      p_group_id: groupId,
      p_user_uid: userUid
    });
    
    if (error) {
      console.error('❌ Error marking messages as read:', error);
      return false;
    }
    
    console.log('✅ Messages marked as read');
    return true;
  } catch (err) {
    console.error('❌ Exception marking messages as read:', err);
    return false;
  }
};
// Direct DB calls - no edge functions needed

// 📥 Fetch historical messages (latest first, then reversed for UI)
export const fetchMessages = async (groupId: string, limit = 200): Promise<ChatMessage[]> => {
  console.log(`📥 Supabase: Loading messages for group ${groupId}`);
  
  const { data, error } = await supabase
    .from('messages')
    .select('id, group_id, sender_uid, sender_name, sender_avatar, message, message_type, created_at, read_by')
    .eq('group_id', groupId)
    // IMPORTANT: order DESC + limit, otherwise you end up loading only the oldest N messages
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ Error loading messages:', error);
    return [];
  }

  console.log(`✅ Loaded ${data?.length || 0} messages`);
  // Reverse so UI renders chronological (oldest -> newest)
  return ((data || []) as ChatMessage[]).reverse();
};

// 💬 Send message directly to DB
export const sendMessage = async (data: {
  group_id: string;
  message: string;
  sender_name: string;
  sender_uid: string;
  sender_avatar?: string | null;
  message_type?: string;
}): Promise<ChatMessage | null> => {
  console.log(`💬 Supabase: Sending message to group ${data.group_id}`);

  try {
    const { data: newMessage, error } = await supabase
      .from('messages')
      .insert({
        group_id: data.group_id,
        sender_uid: data.sender_uid,
        sender_name: data.sender_name,
        sender_avatar: data.sender_avatar || null,
        message: data.message.trim(),
        message_type: data.message_type || 'text',
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error sending message:', error);
      return null;
    }

    console.log(`✅ Message sent:`, newMessage?.id);
    return newMessage as ChatMessage;
  } catch (err) {
    console.error('❌ Exception sending message:', err);
    return null;
  }
};

// 🗑️ Delete message directly from DB
export const deleteMessage = async (messageId: string, senderUid: string): Promise<boolean> => {
  console.log(`🗑️ Supabase: Deleting message ${messageId}`);

  try {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_uid', senderUid);

    if (error) {
      console.error('❌ Error deleting message:', error);
      return false;
    }

    console.log(`✅ Message deleted`);
    return true;
  } catch (err) {
    console.error('❌ Exception deleting message:', err);
    return false;
  }
};

// 🔥 Realtime subscription
export const subscribeToMessages = (
  groupId: string,
  onNewMessage: (message: ChatMessage) => void,
  onDeleteMessage?: (messageId: string) => void,
  onStatusChange?: (status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => void
): RealtimeChannel => {
  console.log(`🔥 Supabase Realtime: Subscribing to group ${groupId}`);

  const channel = supabase
    .channel(`messages-${groupId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `group_id=eq.${groupId}`
      },
      (payload) => {
        console.log(`📩 New message received:`, payload.new);
        onNewMessage(payload.new as ChatMessage);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `group_id=eq.${groupId}`
      },
      (payload) => {
        console.log(`🗑️ Message deleted:`, payload.old);
        if (onDeleteMessage && payload.old?.id) {
          onDeleteMessage(payload.old.id as string);
        }
      }
    )
    .subscribe((status) => {
      console.log(`📡 Subscription status: ${status}`);
      if (onStatusChange) {
        onStatusChange(status as 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED');
      }
    });

  return channel;
};

// 🔌 Unsubscribe
export const unsubscribeFromMessages = async (channel: RealtimeChannel): Promise<void> => {
  console.log(`🔌 Supabase Realtime: Unsubscribing`);
  await supabase.removeChannel(channel);
};

// ⌨️ Typing indicator channel
export const createTypingChannel = (
  groupId: string,
  currentUserUid: string,
  onTypingChange: (typingUsers: { uid: string; name: string }[]) => void
): RealtimeChannel => {
  console.log(`⌨️ Creating typing channel for group ${groupId}`);
  
  const typingUsers = new Map<string, { name: string; timeout: ReturnType<typeof setTimeout> }>();
  
  const channel = supabase
    .channel(`typing-${groupId}`, {
      config: {
        broadcast: { self: false }
      }
    })
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      console.log('⌨️ Received typing event:', payload);
      if (payload.uid === currentUserUid) return; // Ignore own typing
      
      // Clear existing timeout for this user
      const existing = typingUsers.get(payload.uid);
      if (existing) {
        clearTimeout(existing.timeout);
      }
      
      // Set new timeout (user stops typing after 3s of no events)
      const timeout = setTimeout(() => {
        typingUsers.delete(payload.uid);
        onTypingChange(Array.from(typingUsers.entries()).map(([uid, data]) => ({ uid, name: data.name })));
      }, 3000);
      
      typingUsers.set(payload.uid, { name: payload.name, timeout });
      onTypingChange(Array.from(typingUsers.entries()).map(([uid, data]) => ({ uid, name: data.name })));
    })
    .on('broadcast', { event: 'stop_typing' }, ({ payload }) => {
      console.log('⌨️ Received stop_typing event:', payload);
      if (payload.uid === currentUserUid) return;
      
      const existing = typingUsers.get(payload.uid);
      if (existing) {
        clearTimeout(existing.timeout);
        typingUsers.delete(payload.uid);
        onTypingChange(Array.from(typingUsers.entries()).map(([uid, data]) => ({ uid, name: data.name })));
      }
    })
    .subscribe((status) => {
      console.log(`⌨️ Typing channel status: ${status}`);
    });

  return channel;
};

// 📤 Emit typing event
export const emitTyping = async (channel: RealtimeChannel, uid: string, name: string) => {
  const result = await channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: { uid, name }
  });
  console.log('⌨️ Emit typing result:', result);
};

// 📤 Emit stop typing event
export const emitStopTyping = async (channel: RealtimeChannel, uid: string) => {
  await channel.send({
    type: 'broadcast',
    event: 'stop_typing',
    payload: { uid }
  });
};
