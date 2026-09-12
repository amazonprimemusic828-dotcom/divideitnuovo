import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/components/AuthContext";
import { useConversations } from "@/hooks/useGroupsData";
import { SERVICE_COLORS } from "@/lib/serviceConstants";
import ServiceLogo from "@/components/ServiceLogo";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageCircle, Search, Clock } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";

export default function Messages() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState("");

  // React Query — data from external Supabase database (no localStorage)
  const { data: conversations = [], isLoading: loading } = useConversations(user?.uid, user?.email);

  const filteredConversations = conversations.filter(c => 
    c.service_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.last_message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Adesso";
    if (diffMins < 60) return `${diffMins} min fa`;
    if (diffHours < 24) return `${diffHours} ore fa`;
    if (diffDays === 1) return "Ieri";
    if (diffDays < 7) return `${diffDays} giorni fa`;
    return messageDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-10 pb-24 lg:pb-10">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <span className="eyebrow">Comunicazione</span>
          <h1 className="display-lg mt-4 text-foreground">{t('messages')}</h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">Tutti i tuoi messaggi in un unico posto</p>
        </div>

        {/* Search Bar */}
        <Card className="panel mb-6 p-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cerca messaggi o gruppi..."
              className="pl-12 h-12 rounded-xl border-2"
            />
          </div>
        </Card>

        {/* Messages List */}
        {filteredConversations.length === 0 ? (
          <Card className="p-12 text-center bg-card/80 rounded-3xl shadow-lg">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="w-10 h-10 text-purple-600" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-3">Nessun messaggio</h3>
            <p className="text-muted-foreground">Inizia a chattare con i tuoi gruppi!</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredConversations.map((conv) => {
              const color = SERVICE_COLORS[conv.service_type] || "linear-gradient(135deg, #5B6FBD 0%, #7DD3C0 100%)";
                            
              return (
                <Card
                  key={conv.group_id}
                  onClick={() => navigate(`/GroupDetail?id=${conv.group_id}`)}
                  className="bg-card/80 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer overflow-hidden"
                >
                  <div className="h-1" style={{ background: color }}></div>
                  <div className="p-4 flex items-center gap-4">
                    <div 
                      className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: color }}
                    >
                      <div className="w-10 h-10 rounded-lg bg-white/95 flex items-center justify-center p-1.5">
                          <ServiceLogo name={conv.service_type} size={24} className="h-6 w-6" />
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-foreground truncate">{conv.service_name}</h3>
                        {conv.unread_count > 0 && (
                          <Badge className="bg-primary text-primary-foreground text-xs">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          userEmail=""
                          userName={conv.last_sender_name}
                          size="xs"
                        />
                        <p className="text-sm text-muted-foreground truncate">
                          <span className="font-medium">{conv.last_sender_name}:</span> {conv.last_message}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {getTimeAgo(conv.last_message_date)}
                      </div>
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
