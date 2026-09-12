import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/components/AuthContext";
import { useNotifications } from "@/hooks/useGroupsData";
import { updateNotification, Notification as DBNotification } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, DollarSign, Users, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function Notifications() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // React Query — cached notifications, instant tab switching
  const { data: notifications = [], isLoading: loading } = useNotifications(user?.email);

  // Sort by date (most recent first)
  const sortedNotifications = React.useMemo(
    () => [...notifications].sort((a, b) => 
      new Date(b.created_date || '').getTime() - new Date(a.created_date || '').getTime()
    ),
    [notifications]
  );

  const markAsRead = async (notifId: string) => {
    try {
      await updateNotification(notifId, { read: true });
      // Invalidate cache to reflect the change
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.email] });
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifs = sortedNotifications.filter(n => !n.read);
      await Promise.all(unreadNotifs.map(n => updateNotification(n.id, { read: true })));
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.email] });
      toast.success("Tutte le notifiche sono state lette");
    } catch (error) {
      console.error("Error marking all as read:", error);
      toast.error("Errore durante l'aggiornamento");
    }
  };

  // Legacy links like "/group/<uuid>" pointed to a route that doesn't exist (404).
  const normalizeLink = (link?: string | null, groupId?: string | null) => {
    if (!link) return groupId ? `/GroupDetail?id=${groupId}` : null;
    const legacy = link.match(/^\/group\/([0-9a-fA-F-]{36})$/);
    if (legacy) return `/GroupDetail?id=${legacy[1]}`;
    return link;
  };

  const handleNotificationClick = (notif: DBNotification) => {
    markAsRead(notif.id);
    const target = normalizeLink(notif.link, (notif as any).group_id);
    if (target) {
      navigate(target);
    }
  };


  const getTimeAgo = (date?: string) => {
    if (!date) return "";
    const now = new Date();
    const notifDate = new Date(date);
    const diffMs = now.getTime() - notifDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Adesso";
    if (diffMins < 60) return `${diffMins} min fa`;
    if (diffHours < 24) return `${diffHours} ore fa`;
    if (diffDays === 1) return "Ieri";
    if (diffDays < 7) return `${diffDays} giorni fa`;
    return notifDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "payment": return DollarSign;
      case "member_joined": return Users;
      case "message": return MessageCircle;
      default: return Bell;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "payment": return "bg-green-100 text-green-600";
      case "member_joined": return "bg-blue-100 text-blue-600";
      case "message": return "bg-purple-100 text-purple-600";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const unreadCount = sortedNotifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-10 pb-24 lg:pb-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className="eyebrow">Aggiornamenti</span>
            <h1 className="display-lg mt-4 text-foreground">{t('notifications')}</h1>
            <p className="mt-3 text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} non lette` : "Tutte lette"}
            </p>
          </div>

          {unreadCount > 0 && (
            <Button
              onClick={markAllAsRead}
              variant="outline"
              className="rounded-xl"
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              {t('markAllRead')}
            </Button>
          )}
        </div>

        {sortedNotifications.length === 0 ? (
          <Card className="p-12 text-center bg-card/80 rounded-3xl shadow-lg">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-6">
              <Bell className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-3">{t('noNotifications')}</h3>
            <p className="text-muted-foreground">{t('noNotificationsDescription')}</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedNotifications.map(notif => {
              const Icon = getNotificationIcon(notif.type);
              const colorClass = getNotificationColor(notif.type);

              return (
                <Card
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`panel cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:border-primary/35 ${
                    !notif.read ? "border-primary/35 bg-primary-soft/30" : ""
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                      <Icon className="w-6 h-6" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{notif.title}</h3>
                        {!notif.read && (
                          <Badge className="bg-primary text-primary-foreground text-xs">Nuovo</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{notif.content}</p>
                      <p className="text-xs text-muted-foreground">{getTimeAgo(notif.created_date)}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
