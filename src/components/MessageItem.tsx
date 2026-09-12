import { Clock, Users, ChevronRight } from "lucide-react";

interface MessageItemProps {
  groupName: string;
  serviceType: 'apple-music' | 'netflix' | 'disney' | 'spotify';
  lastMessage: string;
  sender: string;
  messageCount: number;
  time: string;
}

const serviceGradients = {
  'apple-music': 'from-pink-500 to-rose-500',
  'netflix': 'from-red-600 to-red-700',
  'disney': 'from-blue-600 to-indigo-900',
  'spotify': 'from-green-500 to-green-600',
};

const serviceIcons = {
  'apple-music': '🎵',
  'netflix': 'N',
  'disney': 'D+',
  'spotify': '🎧',
};

export function MessageItem({ groupName, serviceType, lastMessage, sender, messageCount, time }: MessageItemProps) {
  return (
    <div className="card-subscription hover:shadow-lg transition-all cursor-pointer group">
      <div className="p-4 flex items-center gap-4">
        <div className={`service-icon bg-gradient-to-br ${serviceGradients[serviceType]}`}>
          <span className="text-lg">{serviceIcons[serviceType]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-foreground group-hover:text-accent transition-colors">{groupName}</h4>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center ring-2 ring-card">
              <span className="text-[10px] text-accent-foreground font-bold">
                {sender.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm text-muted-foreground truncate">
              <span className="font-medium text-foreground">{sender}:</span> {lastMessage}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              <span>{messageCount} messaggi</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{time}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </div>
  );
}
