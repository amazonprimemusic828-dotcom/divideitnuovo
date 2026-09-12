import { Users, Calendar, DollarSign } from "lucide-react";

interface SubscriptionCardProps {
  serviceName: string;
  serviceType: 'apple-music' | 'netflix' | 'disney' | 'spotify';
  admin: string;
  spots: number;
  pricePerPerson: string;
  members: string;
  billingDay: number;
  isMember?: boolean;
  isPaid?: boolean;
  isFull?: boolean;
  onAction?: () => void;
  actionLabel?: string;
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

export function SubscriptionCard({
  serviceName,
  serviceType,
  admin,
  spots,
  pricePerPerson,
  members,
  billingDay,
  isMember,
  isPaid,
  isFull,
  onAction,
  actionLabel = "Vai al Gruppo"
}: SubscriptionCardProps) {
  return (
    <div className="card-subscription group">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className={`service-icon bg-gradient-to-br ${serviceGradients[serviceType]}`}>
            <span className="text-lg">{serviceIcons[serviceType]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground group-hover:text-accent transition-colors">
              {serviceName}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">Admin: {admin}</p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {spots > 0 ? (
                <span className="badge-spots">{spots} posti</span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                  0 posti
                </span>
              )}
              {isMember && (
                <span className="badge-member">Membro</span>
              )}
              {isPaid && (
                <span className="badge-paid">✓ Pagato</span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">A Persona</p>
              <p className="text-lg font-bold text-primary">{pricePerPerson}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Membri</p>
              <p className="text-lg font-bold text-accent">{members}</p>
            </div>
          </div>
        </div>

        {/* Billing */}
        <div className="flex items-center gap-2 mt-4 text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span className="text-sm">Fatturazione: giorno {billingDay}</span>
        </div>

        {/* Action Button */}
        <button
          onClick={onAction}
          disabled={isFull}
          className={`w-full mt-5 py-3 rounded-xl font-semibold transition-all ${
            isFull 
              ? 'bg-muted text-muted-foreground cursor-not-allowed' 
              : 'btn-primary'
          }`}
        >
          {isFull ? 'Pieno' : actionLabel}
        </button>
      </div>
    </div>
  );
}
