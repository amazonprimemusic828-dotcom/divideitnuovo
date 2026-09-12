import React from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import UserAvatar from '@/components/UserAvatar';
import ReadReceipt from './ReadReceipt';
import type { ChatMessage as ChatMessageType } from '@/lib/supabaseChatClient';

interface ChatMessageProps {
  message: ChatMessageType;
  isMe: boolean;
  onDelete?: (id: string) => void;
  isNew?: boolean;
}

export default function ChatMessage({ message, isMe, onDelete, isNew = false }: ChatMessageProps) {
  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return format(date, 'HH:mm');
    }
    return format(date, 'dd MMM HH:mm', { locale: it });
  };

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 10, scale: 0.95 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex w-full ${isMe ? 'justify-end pr-1' : 'justify-start pl-1'}`}
    >
      <div 
        className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
        style={{ maxWidth: 'calc(100% - 40px)' }}
      >
        {/* Avatar solo per gli altri */}
        {!isMe && (
          <UserAvatar
            userEmail=""
            userName={message.sender_name}
            avatarUrl={message.sender_avatar}
            size="sm"
            className="w-6 h-6 shrink-0 mb-1"
          />
        )}
        
        <div className={`flex flex-col min-w-0 ${isMe ? 'items-end' : 'items-start'}`}>
          {/* Nome e ora */}
          <div className="flex items-center gap-1.5 mb-0.5 px-1">
            <span className="text-sm text-muted-foreground font-medium truncate max-w-[100px]">
              {isMe ? 'Tu' : message.sender_name}
            </span>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {formatMessageTime(message.created_at)}
            </span>
            
            {/* Menu elimina - solo per i miei messaggi */}
            {isMe && onDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-4 w-4 p-0 opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[120px]">
                  <DropdownMenuItem 
                    onClick={() => onDelete(message.id)}
                    className="text-destructive text-sm"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Elimina
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          
          {/* Bubble del messaggio - stili speciali per richieste */}
          {(() => {
            const mt = (message as any).message_type as string | undefined;
            const isRefundReq = mt === 'refund_request';
            const isRefundOk = mt === 'refund_approved';
            const isHelp = mt === 'help_request';
            const isProblem = mt === 'problem_report';
            const special = isRefundReq || isRefundOk || isHelp || isProblem;

            const specialClasses = isRefundReq
              ? 'bg-red-100 text-red-900 border border-red-300 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800'
              : isRefundOk
              ? 'bg-green-100 text-green-900 border border-green-300 dark:bg-green-950/40 dark:text-green-200 dark:border-green-800'
              : isHelp
              ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800'
              : isProblem
              ? 'bg-orange-100 text-orange-900 border border-orange-300 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-800'
              : '';

            const prefix = isRefundReq
              ? '💸 Richiesta di rimborso'
              : isHelp
              ? '🆘 Richiesta di aiuto all\'admin'
              : isProblem
              ? '⚠️ Segnalazione problema'
              : isRefundOk
              ? '✅ Rimborso approvato'
              : null;

            return (
              <div
                className={`chat-bubble px-4 py-3 rounded-2xl max-w-full ${
                  special
                    ? `${specialClasses} rounded-bl-sm`
                    : isMe
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                }`}
              >
                {prefix && (
                  <p className="text-[11px] font-bold mb-1 opacity-90">{prefix}</p>
                )}
                <div className="flex items-end gap-1.5">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words min-w-0">
                    {message.message}
                  </p>
                  {/* Read receipt */}
                  {isMe && !special && (
                    <ReadReceipt
                      isRead={Boolean(message.read_by && message.read_by.length > 0)}
                      className="shrink-0 ml-1"
                    />
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </motion.div>
  );
}
