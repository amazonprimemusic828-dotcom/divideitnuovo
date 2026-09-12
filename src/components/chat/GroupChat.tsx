import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/components/AuthContext';
import { notifyByEmail } from "@/lib/notifyEmail";
import { 
  fetchMessages,
  sendMessage,
  deleteMessage,
  subscribeToMessages,
  unsubscribeFromMessages,
  createTypingChannel,
  emitTyping,
  emitStopTyping,
  markMessagesAsRead,
  ChatMessage as ChatMessageType
} from '@/lib/supabaseChatClient';
import { supabase } from '@/lib/supabaseClient';
import { useMessageNotifications } from '@/hooks/useMessageNotifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import TypingIndicator from './TypingIndicator';
import ChatMessage from './ChatMessage';
import { Send, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { RealtimeChannel } from '@supabase/supabase-js';

interface GroupChatProps {
  groupId: string;
  groupName: string;
}

export default function GroupChat({ groupId, groupName }: GroupChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());
  const [newMessage, setNewMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED' | 'CONNECTING'>('CONNECTING');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ uid: string; name: string }[]>([]);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = useRef<number>(0);

  const isConnected = connectionStatus === 'SUBSCRIBED';

  // Smart message notifications
  const { handleNewMessage } = useMessageNotifications({
    enabled: true,
    currentUserUid: user?.uid || '',
    groupName,
    isWindowFocused
  });

  // Track window focus
  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load messages and subscribe to realtime
  useEffect(() => {
    if (!user?.uid || !groupId) return;

    let isMounted = true;

    const loadAndSubscribe = async () => {
      setIsLoading(true);
      setConnectionStatus('CONNECTING');
      
      // Load historical messages
      const history = await fetchMessages(groupId);
      if (!isMounted) return;
      
      console.log(`📥 Loaded ${history.length} messages for group ${groupId}`);
      setMessages(history);
      setIsLoading(false);
      setTimeout(scrollToBottom, 100);

      // Subscribe to new messages with status callback
      channelRef.current = subscribeToMessages(
        groupId,
        (newMsg) => {
          if (!isMounted) return;
          console.log(`📩 Realtime: New message received`, newMsg.id);
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === newMsg.id)) {
              console.log(`⚠️ Duplicate message ignored: ${newMsg.id}`);
              return prev;
            }
            return [...prev, newMsg];
          });
          // Segna come nuovo per animazione
          setNewMessageIds(prev => new Set(prev).add(newMsg.id));
          setTimeout(scrollToBottom, 50);
          // Trigger smart notification
          handleNewMessage(newMsg);
        },
        (deletedId) => {
          if (!isMounted) return;
          console.log(`🗑️ Realtime: Message deleted`, deletedId);
          setMessages(prev => prev.filter(m => m.id !== deletedId));
        },
        (status) => {
          if (!isMounted) return;
          console.log(`📡 Connection status changed: ${status}`);
          setConnectionStatus(status);
        }
      );
    };

    loadAndSubscribe();

    // Setup typing channel
    const senderName = user.full_name || user.email?.split('@')[0] || 'Utente';
    typingChannelRef.current = createTypingChannel(
      groupId,
      user.uid,
      (users) => setTypingUsers(users)
    );

    return () => {
      isMounted = false;
      if (channelRef.current) {
        unsubscribeFromMessages(channelRef.current);
        channelRef.current = null;
      }
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      setConnectionStatus('CLOSED');
      setTypingUsers([]);
    };
  }, [groupId, user, scrollToBottom, handleNewMessage]);

  // Mark messages as read when window is focused and messages are loaded
  useEffect(() => {
    if (!user?.uid || !groupId || !isWindowFocused || messages.length === 0) return;
    
    // Mark messages as read after a short delay
    const markRead = async () => {
      await markMessagesAsRead(groupId, user.uid);
      // Refresh messages to get updated read_by - but MERGE with existing to avoid losing optimistic updates
      const updated = await fetchMessages(groupId);
      setMessages(prev => {
        // Create a map of existing messages by ID for quick lookup
        const existingMap = new Map(prev.map(m => [m.id, m]));
        
        // Merge: use updated messages but keep any that exist locally but not in DB yet (optimistic)
        const mergedMessages = [...updated];
        
        // Add any local messages that aren't in the updated list yet
        prev.forEach(localMsg => {
          if (!updated.some(u => u.id === localMsg.id)) {
            mergedMessages.push(localMsg);
          }
        });
        
        // Sort by created_at
        mergedMessages.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        return mergedMessages;
      });
    };
    
    const timer = setTimeout(markRead, 1500);
    return () => clearTimeout(timer);
  }, [groupId, user?.uid, isWindowFocused, messages.length]);

  // Scroll when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle typing indicator emission
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (!user?.uid || !typingChannelRef.current) return;
    
    const now = Date.now();
    const senderName = user.full_name || user.email?.split('@')[0] || 'Utente';
    
    // Throttle typing emissions to once per 500ms
    if (now - lastTypingEmitRef.current > 500) {
      emitTyping(typingChannelRef.current, user.uid, senderName);
      lastTypingEmitRef.current = now;
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to emit stop typing after 2s of no typing
    typingTimeoutRef.current = setTimeout(() => {
      if (typingChannelRef.current && user?.uid) {
        emitStopTyping(typingChannelRef.current, user.uid);
      }
    }, 2000);
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !user?.uid || isSending) return;

    setIsSending(true);
    const messageText = newMessage.trim();
    setNewMessage('');
    // Keep the keyboard/cursor in the input so the user can keep typing
    inputRef.current?.focus();

    
    // Stop typing indicator when sending
    if (typingChannelRef.current && user?.uid) {
      emitStopTyping(typingChannelRef.current, user.uid);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    const senderName = user.full_name || user.email?.split('@')[0] || 'Utente';

    console.log(`💬 Sending message to group ${groupId}...`);
    
    const result = await sendMessage({
      group_id: groupId,
      message: messageText,
      sender_name: senderName,
      sender_uid: user.uid,
      sender_avatar: user.avatar_url || null
    });

    if (result) {
      console.log(`✅ Message sent successfully: ${result.id}`);
      // Email notification (server-side throttled: max 1 email/hour per group)
      notifyByEmail({ type: "chat_message", group_id: groupId });
      // Optimistically add the message if realtime hasn't delivered it yet
      setMessages(prev => {
        if (prev.some(m => m.id === result.id)) return prev;
        return [...prev, result];
      });
      // Segna come nuovo per animazione
      setNewMessageIds(prev => new Set(prev).add(result.id));
      setTimeout(scrollToBottom, 50);
    } else {
      console.error(`❌ Failed to send message`);
      toast.error('Errore invio messaggio. Riprova.');
      setNewMessage(messageText); // Restore message
    }

    setIsSending(false);
    inputRef.current?.focus();

  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    // Optimistic removal
    setMessages(prev => prev.filter(m => m.id !== messageId));
    
    const success = await deleteMessage(messageId, user.uid);
    if (success) {
      toast.success('Messaggio eliminato');
    } else {
      // Restore on failure (will be reconciled by realtime anyway)
      toast.error('Errore eliminazione messaggio');
    }
  };

  // Rimuovi i newMessageIds dopo l'animazione
  useEffect(() => {
    if (newMessageIds.size === 0) return;
    const timer = setTimeout(() => {
      setNewMessageIds(new Set());
    }, 500);
    return () => clearTimeout(timer);
  }, [newMessageIds]);

  if (!user) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">Devi essere autenticato per usare la chat</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-[calc(100vh-280px)] min-h-[350px] max-h-[600px] lg:h-[600px] lg:max-h-none overflow-hidden">
      {/* Header - compact on mobile */}
      <div className="flex items-center justify-between p-3 lg:p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2 lg:gap-3">
          <Send className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
          <div>
            <h2 className="font-semibold text-foreground text-sm lg:text-base">Chat</h2>
            <div className="flex items-center gap-1.5 text-[10px] lg:text-xs text-muted-foreground">
              {isConnected ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-green-600">Online</span>
                </>
              ) : connectionStatus === 'CONNECTING' ? (
                <>
                  <div className="w-2.5 h-2.5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-yellow-600">Connessione...</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-red-500" />
                  <span className="text-red-600">Offline</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <Badge variant="secondary" className="text-[10px] lg:text-xs px-2 py-0.5 lg:px-2.5 lg:py-1 max-w-[120px] lg:max-w-none truncate">
          {groupName}
        </Badge>
      </div>

      {/* Messages Area - optimized for mobile */}
      <ScrollArea className="flex-1 px-3 py-2 lg:p-4 overflow-x-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 lg:h-8 lg:w-8 border-b-2 border-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Send className="w-10 h-10 lg:w-12 lg:h-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">Nessun messaggio ancora.</p>
            <p className="text-xs text-muted-foreground">Inizia la conversazione!</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  isMe={msg.sender_uid === user.uid}
                  onDelete={msg.sender_uid === user.uid ? handleDeleteMessage : undefined}
                  isNew={newMessageIds.has(msg.id)}
                />
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Typing Indicator */}
      <TypingIndicator typingUsers={typingUsers.map(u => u.name)} />

      {/* Input Area - mobile optimized */}
      <form onSubmit={handleSendMessage} className="p-2 lg:p-4 border-t bg-background">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={handleInputChange}
            placeholder={isConnected ? "Scrivi un messaggio..." : "Connessione..."}
            disabled={!isConnected}
            className="flex-1 rounded-full h-10 lg:h-11 text-sm"
          />

          <Button 
            type="submit"
            size="icon"
            className="rounded-full shrink-0 h-10 w-10 lg:h-11 lg:w-11"
            disabled={!newMessage.trim() || !isConnected || isSending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </Card>
  );
}
