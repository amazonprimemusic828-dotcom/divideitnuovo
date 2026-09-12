import { useQuery } from '@tanstack/react-query';
import {
  getGroups,
  getMemberships,
  getNotifications,
  getTrustScore,
  Group,
  Membership,
  Notification as DBNotification,
  supabase,
} from '@/lib/supabaseClient';

/**
 * React Query hooks for data fetching with automatic caching.
 * Data persists between page/tab switches for instant navigation.
 * All data comes from the external Supabase database.
 */

// ==================== GROUPS ====================

/** Fetch public active groups */
export function usePublicGroups() {
  return useQuery({
    queryKey: ['groups', 'public'],
    queryFn: () => getGroups({ is_public: true, status: 'active' }),
    staleTime: 2 * 60 * 1000, // 2 min
  });
}

// ==================== MEMBERSHIPS ====================

/** Fetch all memberships */
export function useAllMemberships() {
  return useQuery({
    queryKey: ['memberships', 'all'],
    queryFn: () => getMemberships(),
    staleTime: 2 * 60 * 1000,
  });
}

/** Fetch memberships for a specific user */
export function useUserMemberships(email: string | undefined) {
  return useQuery({
    queryKey: ['memberships', 'user', email],
    queryFn: () => getMemberships({ user_email: email! }),
    enabled: !!email,
    staleTime: 2 * 60 * 1000,
  });
}

// ==================== DASHBOARD ====================

/** Fetch user's groups + memberships for Dashboard */
export function useUserDashboard(email: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', email],
    queryFn: async () => {
      if (!email) return { groups: [] as Group[], memberships: [] as Membership[] };
      const [memberships, allGroups] = await Promise.all([
        getMemberships({ user_email: email }),
        getGroups(),
      ]);
      const userGroupIds = new Set(memberships.map(m => m.group_id));
      const groups = allGroups.filter(g => userGroupIds.has(g.id));
      return { groups, memberships };
    },
    enabled: !!email,
    staleTime: 2 * 60 * 1000,
  });
}

// ==================== TRUST SCORES ====================

/** Fetch trust scores for multiple emails in parallel (not sequentially) */
export function useTrustScores(emails: string[]) {
  return useQuery({
    queryKey: ['trustScores', emails.sort().join(',')],
    queryFn: async () => {
      const scores: Record<string, number> = {};
      await Promise.all(
        emails.map(async (email) => {
          const score = await getTrustScore(email);
          scores[email] = score?.score || 60;
        })
      );
      return scores;
    },
    enabled: emails.length > 0,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

/** Fetch public average rating (stars + count) for many admin emails at once */
export function useAdminRatings(emails: string[]) {
  return useQuery({
    queryKey: ['adminRatings', emails.slice().sort().join(',')],
    queryFn: async () => {
      if (emails.length === 0) return {};
      const { data, error } = await supabase.rpc('admin_rating_summary', {
        _emails: emails,
      });
      if (error) return {};
      const map: Record<string, { avg_stars: number; review_count: number }> = {};
      (data || []).forEach((r: any) => {
        map[(r.ratee_email || '').toLowerCase()] = {
          avg_stars: Number(r.avg_stars),
          review_count: Number(r.review_count),
        };
      });
      return map;
    },
    enabled: emails.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// ==================== NOTIFICATIONS ====================

/** Fetch user notifications */
export function useNotifications(email: string | undefined) {
  return useQuery({
    queryKey: ['notifications', email],
    queryFn: () => getNotifications(email!),
    enabled: !!email,
    staleTime: 30 * 1000, // 30 sec
  });
}

// ==================== CONVERSATIONS (Messages page) ====================

interface ConversationItem {
  group_id: string;
  service_name: string;
  service_type: string;
  last_message: string;
  last_sender_name: string;
  last_sender_uid: string;
  last_message_date: string;
  unread_count: number;
}

/** Fetch conversations from the external Supabase database (no localStorage) */
export function useConversations(uid: string | undefined, email: string | undefined) {
  return useQuery<ConversationItem[]>({
    queryKey: ['conversations', uid],
    queryFn: async () => {
      if (!uid || !email) return [];

      // Fetch memberships, messages, and groups from external Supabase in parallel
      const [memberships, { data: messagesData }, { data: groupsData }] = await Promise.all([
        getMemberships({ user_email: email }),
        supabase
          .from('messages')
          .select('id, group_id, sender_uid, sender_name, message, created_at, read_by')
          .order('created_at', { ascending: false }),
        supabase.from('groups').select('id, service_name, service_type'),
      ]);

      const userGroupIds = new Set(memberships.map(m => m.group_id));

      // Group messages by group_id, only for user's groups
      const groupedMessages = new Map<string, any[]>();
      (messagesData || []).forEach(msg => {
        if (!userGroupIds.has(msg.group_id)) return;
        if (!groupedMessages.has(msg.group_id)) {
          groupedMessages.set(msg.group_id, []);
        }
        groupedMessages.get(msg.group_id)?.push(msg);
      });

      const groups = groupsData || [];
      const conversations: ConversationItem[] = [];

      for (const [groupId, messages] of groupedMessages) {
        const lastMsg = messages[0];
        const group = groups.find((g: any) => g.id === groupId);
        const unreadCount = messages.filter((m: any) =>
          m.sender_uid !== uid && (!m.read_by || !m.read_by.includes(uid))
        ).length;

        conversations.push({
          group_id: groupId,
          service_name: group?.service_name || `Gruppo ${groupId.substring(0, 8)}`,
          service_type: group?.service_type || 'Netflix',
          last_message: lastMsg.message,
          last_sender_name: lastMsg.sender_name,
          last_sender_uid: lastMsg.sender_uid,
          last_message_date: lastMsg.created_at,
          unread_count: unreadCount,
        });
      }

      conversations.sort(
        (a, b) => new Date(b.last_message_date).getTime() - new Date(a.last_message_date).getTime()
      );

      return conversations;
    },
    enabled: !!uid && !!email,
    staleTime: 30 * 1000,
  });
}
