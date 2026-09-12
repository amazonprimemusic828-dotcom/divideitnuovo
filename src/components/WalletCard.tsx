import { CreditCard, Download, TrendingUp, Calendar, Wallet } from "lucide-react";

interface WalletCardProps {
  balance: string;
  paymentsReceived: number;
  totalEarnings: string;
  thisMonth: string;
}

export function WalletCard({ balance, paymentsReceived, totalEarnings, thisMonth }: WalletCardProps) {
  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="balance-card">
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="font-semibold text-lg">Saldo Disponibile</span>
          </div>
          <p className="text-5xl font-extrabold mb-2 tracking-tight">{balance}</p>
          <p className="text-sm opacity-80">Pronto per il prelievo</p>
          <button className="mt-6 flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-all px-5 py-2.5 rounded-xl font-semibold backdrop-blur-sm">
            <Download className="w-4 h-4" />
            <span>Preleva Fondi</span>
          </button>
          <p className="text-xs mt-3 opacity-60">Importo minimo di prelievo: €10.00</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-children">
        <div className="bg-card rounded-2xl p-5 flex items-center gap-4 shadow-md hover:shadow-lg transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">Pagamenti Ricevuti</p>
            <p className="text-2xl font-bold text-foreground">{paymentsReceived}</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl p-5 flex items-center gap-4 shadow-md hover:shadow-lg transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-teal-500/10 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">Guadagno Totale</p>
            <p className="text-2xl font-bold text-foreground">{totalEarnings}</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl p-5 flex items-center gap-4 shadow-md hover:shadow-lg transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/10 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">Questo Mese</p>
            <p className="text-2xl font-bold text-foreground">{thisMonth}</p>
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-card rounded-2xl p-6 shadow-md">
        <h3 className="font-bold text-lg text-foreground mb-5">Cronologia Pagamenti</h3>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <CreditCard className="w-8 h-8 opacity-40" />
          </div>
          <p className="text-sm font-medium">Nessun pagamento ricevuto ancora</p>
          <p className="text-xs mt-1 opacity-70">I pagamenti appariranno qui</p>
        </div>
      </div>
    </div>
  );
}
