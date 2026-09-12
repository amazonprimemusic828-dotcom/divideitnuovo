import { TrendingUp, Users, CreditCard, TrendingDown } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: 'savings' | 'groups' | 'spending';
  trend?: string;
  trendDown?: boolean;
}

export function StatsCard({ title, value, subtitle, icon, trend, trendDown }: StatsCardProps) {
  const iconComponents = {
    savings: <TrendingUp className="w-5 h-5" />,
    groups: <Users className="w-5 h-5" />,
    spending: <CreditCard className="w-5 h-5" />,
  };

  const iconColors = {
    savings: 'icon-green',
    groups: 'icon-blue',
    spending: 'icon-coral',
  };

  return (
    <div className="card-stats group">
      <div>
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        <p className="text-3xl font-bold text-foreground mt-1.5 tracking-tight">{value}</p>
        {trend && (
          <p className={`text-sm font-semibold mt-2 flex items-center gap-1 ${trendDown ? 'text-destructive' : 'text-primary'}`}>
            {trendDown ? (
              <TrendingDown className="w-3.5 h-3.5" />
            ) : (
              <TrendingUp className="w-3.5 h-3.5" />
            )}
            {trend}
          </p>
        )}
        {subtitle && <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>}
      </div>
      <div className={`icon-container ${iconColors[icon]} group-hover:scale-110 transition-transform`}>
        {iconComponents[icon]}
      </div>
    </div>
  );
}
