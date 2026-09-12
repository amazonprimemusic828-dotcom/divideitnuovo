import { useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from '@/lib/supabaseChatClient';

interface UseMessageNotificationsOptions {
  enabled: boolean;
  currentUserUid: string;
  groupName: string;
  isWindowFocused?: boolean;
}

// Smart notification system - avoids spam
export function useMessageNotifications({
  enabled,
  currentUserUid,
  groupName,
  isWindowFocused = true
}: UseMessageNotificationsOptions) {
  const lastNotificationTime = useRef<number>(0);
  const pendingMessages = useRef<number>(0);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Minimum 30 seconds between notifications to avoid spam
  const MIN_NOTIFICATION_INTERVAL = 30000;
  // Wait 5 seconds after last message before showing notification (batching)
  const BATCH_DELAY = 5000;

  const showNotification = useCallback((title: string, body: string) => {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: `chat-${groupName}`, // Replace existing notifications for same group
        silent: false,
      });
      
      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
      
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }, [groupName]);

  const scheduleNotification = useCallback(() => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    
    notificationTimeoutRef.current = setTimeout(() => {
      const now = Date.now();
      const timeSinceLastNotification = now - lastNotificationTime.current;
      
      // Only show if enough time has passed since last notification
      if (timeSinceLastNotification >= MIN_NOTIFICATION_INTERVAL && pendingMessages.current > 0) {
        const count = pendingMessages.current;
        const body = count === 1 
          ? 'Hai un nuovo messaggio'
          : `Hai ${count} nuovi messaggi`;
        
        showNotification(groupName, body);
        lastNotificationTime.current = now;
        pendingMessages.current = 0;
      }
    }, BATCH_DELAY);
  }, [groupName, showNotification]);

  const handleNewMessage = useCallback((message: ChatMessage) => {
    // Don't notify for own messages
    if (message.sender_uid === currentUserUid) return;
    
    // Don't notify if window is focused (user is looking at chat)
    if (isWindowFocused && document.hasFocus()) return;
    
    // Don't notify if disabled
    if (!enabled) return;
    
    // Increment pending count and schedule batched notification
    pendingMessages.current += 1;
    scheduleNotification();
  }, [currentUserUid, isWindowFocused, enabled, scheduleNotification]);

  // Request permission on mount
  useEffect(() => {
    if (!enabled) return;
    
    if ('Notification' in window && Notification.permission === 'default') {
      // Don't immediately ask - wait for user interaction
      const handleInteraction = () => {
        Notification.requestPermission();
        document.removeEventListener('click', handleInteraction);
      };
      document.addEventListener('click', handleInteraction, { once: true });
      
      return () => {
        document.removeEventListener('click', handleInteraction);
      };
    }
  }, [enabled]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  return { handleNewMessage };
}
