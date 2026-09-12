import { Bell, Clock, Trash2 } from "lucide-react";

interface NotificationItemProps {
  title: string;
  message: string;
  time: string;
  onDelete?: () => void;
}

export function NotificationItem({ title, message, time, onDelete }: NotificationItemProps) {
  return (
    <div className="bg-card rounded-2xl p-5 flex items-start gap-4 hover:shadow-lg transition-all duration-300 group border border-transparent hover:border-border">
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent/20 to-purple-600/10 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
        <Bell className="w-5 h-5 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{message}</p>
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>{time}</span>
        </div>
      </div>
      <button
        onClick={onDelete}
        className="p-2.5 hover:bg-destructive/10 rounded-xl transition-all text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
