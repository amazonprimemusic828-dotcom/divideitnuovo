import { Search, Home, MessageCircle, Bell, Wallet, Headphones, Settings, Plus, LogOut, Globe, ChevronDown, Menu, ShieldCheck } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthContext";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  badge?: number;
}

function NavItem({ icon, label, active, onClick, badge }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 ${
        active 
          ? 'bg-gradient-to-br from-accent to-purple-600 text-accent-foreground shadow-lg shadow-accent/20' 
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      <div className="relative">
        {icon}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className="text-[11px] font-semibold tracking-wide">{label}</span>
    </button>
  );
}

interface NavbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onCreateGroup: () => void;
}

export function Navbar({ activeTab, onTabChange, onCreateGroup }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [isOperator, setIsOperator] = useState(false);
  const [pendingTickets, setPendingTickets] = useState(0);

  useEffect(() => {
    if (!user?.uid) { setIsOperator(false); return; }
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.uid)
        .in("role", ["operator", "admin"]);
      const op = (data?.length ?? 0) > 0;
      setIsOperator(op);
      if (op) {
        const { count } = await supabase
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "waiting_operator"]);
        setPendingTickets(count || 0);
      }
    })();
  }, [user?.uid]);

  const navItems = [
    { id: 'esplora', icon: <Search className="w-[18px] h-[18px]" />, label: 'Esplora' },
    { id: 'gruppi', icon: <Home className="w-[18px] h-[18px]" />, label: 'Gruppi' },
    { id: 'messaggi', icon: <MessageCircle className="w-[18px] h-[18px]" />, label: 'Messaggi', badge: 2 },
    { id: 'notifiche', icon: <Bell className="w-[18px] h-[18px]" />, label: 'Notifiche', badge: 3 },
    { id: 'portafoglio', icon: <Wallet className="w-[18px] h-[18px]" />, label: 'Portafoglio' },
    { id: 'assistenza', icon: <Headphones className="w-[18px] h-[18px]" />, label: 'Assistenza', route: '/assistenza' },
    { id: 'impostazioni', icon: <Settings className="w-[18px] h-[18px]" />, label: 'Impostazioni', route: '/impostazioni' },
  ];

  const handleNavClick = (item: typeof navItems[0]) => {
    if (item.route) {
      navigate(item.route);
    } else {
      if (location.pathname !== '/') {
        navigate('/');
      }
      onTabChange(item.id);
    }
  };

  const isActiveItem = (item: typeof navItems[0]) => {
    if (item.route) {
      return location.pathname === item.route;
    }
    return location.pathname === '/' && activeTab === item.id;
  };

  return (
    <nav className="bg-card/95 backdrop-blur-md border-b border-border/50 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 md:px-4">
        {/* Desktop Nav */}
        <div className="h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <div 
            onClick={() => { navigate('/'); onTabChange('gruppi'); }}
            className="flex items-center gap-2 cursor-pointer group flex-shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent via-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-accent/25 group-hover:shadow-xl group-hover:shadow-accent/30 transition-shadow">
              <span className="text-white font-black text-sm">D</span>
            </div>
            <span className="font-extrabold text-lg bg-gradient-to-r from-accent via-purple-500 to-purple-600 bg-clip-text text-transparent hidden sm:block">
              DIVIDEIT
            </span>
          </div>

          {/* Nav Items - Desktop */}
          <div className="hidden lg:flex items-center gap-0.5 bg-secondary/50 p-1 rounded-2xl">
            {navItems.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={isActiveItem(item)}
                onClick={() => handleNavClick(item)}
                badge={item.badge}
              />
            ))}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Operator Dashboard (only for operators/admins) */}
            {isOperator && (
              <button
                onClick={() => navigate('/OperatorDashboard')}
                className="relative flex items-center gap-1.5 px-2.5 md:px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all"
                title="Centro assistenza operatore"
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="hidden lg:inline">Operatore</span>
                {pendingTickets > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {pendingTickets > 9 ? '9+' : pendingTickets}
                  </span>
                )}
              </button>
            )}

            {/* Language */}
            <button className="hidden md:flex items-center gap-1.5 px-2.5 py-2 rounded-xl hover:bg-secondary transition-colors">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">IT</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>

            {/* Create Group */}
            <button 
              onClick={onCreateGroup}
              className="bg-gradient-to-r from-accent to-purple-600 text-white font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-accent/25 hover:shadow-xl hover:shadow-accent/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Crea Gruppo</span>
            </button>

            {/* User Profile */}
            <div 
              onClick={() => navigate('/impostazioni')}
              className="flex items-center gap-2 bg-gradient-to-r from-accent to-purple-600 rounded-full pl-1 pr-3 py-1 cursor-pointer hover:shadow-lg hover:shadow-accent/20 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center ring-2 ring-white/20">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <div className="hidden md:block">
                <p className="text-white text-sm font-semibold leading-tight">Cal</p>
                <p className="text-white/70 text-[10px] leading-tight">calcium9282@gmail.com</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        <div className="lg:hidden flex items-center justify-around py-2 -mx-3 px-1 border-t border-border/50">
          {navItems.slice(0, 5).map((item) => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={isActiveItem(item)}
              onClick={() => handleNavClick(item)}
              badge={item.badge}
            />
          ))}
          <NavItem
            icon={<Menu className="w-[18px] h-[18px]" />}
            label="Altro"
            onClick={() => {}}
          />
        </div>
      </div>
    </nav>
  );
}
