import { useRef, useCallback, useState } from 'react';
import { toast } from 'sonner';

/**
 * Hook for rate limiting user actions (anti-spam protection).
 * Prevents rapid repeated actions like button spamming.
 * 
 * @param cooldownMs - Minimum time between actions in milliseconds (default: 3000)
 * @param message - Toast message to show when rate limited
 */
export function useRateLimit(cooldownMs: number = 3000, message?: string) {
  const lastActionRef = useRef<number>(0);
  const [isLocked, setIsLocked] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    if (isLocked || now - lastActionRef.current < cooldownMs) {
      if (message) {
        toast.error(message);
      } else {
        toast.error("Troppi tentativi. Attendi qualche secondo.");
      }
      return false;
    }
    return true;
  }, [cooldownMs, isLocked, message]);

  const executeWithRateLimit = useCallback(async <T>(
    action: () => Promise<T>
  ): Promise<T | null> => {
    if (!checkRateLimit()) return null;

    lastActionRef.current = Date.now();
    setIsLocked(true);

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    try {
      return await action();
    } finally {
      timeoutRef.current = setTimeout(() => {
        setIsLocked(false);
      }, cooldownMs);
    }
  }, [checkRateLimit, cooldownMs]);

  return { checkRateLimit, executeWithRateLimit, isLocked };
}
