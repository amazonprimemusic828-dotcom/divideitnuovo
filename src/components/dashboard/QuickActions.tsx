import React from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Wallet, Settings, ArrowRight } from "lucide-react";

export default function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { icon: Plus, label: "Crea gruppo", hint: "Nuovo abbonamento", tone: "primary", onClick: () => navigate("/CreateGroup") },
    { icon: Search, label: "Esplora", hint: "Trova gruppi aperti", tone: "sky", onClick: () => navigate("/BrowseGroups") },
    { icon: Wallet, label: "Portafoglio", hint: "Saldo e movimenti", tone: "mint", onClick: () => navigate("/Wallet") },
    { icon: Settings, label: "Impostazioni", hint: "Profilo e sicurezza", tone: "slate", onClick: () => navigate("/Settings") },
  ] as const;

  const toneMap: Record<string, string> = {
    primary: "from-violet-500 to-fuchsia-500",
    sky: "from-sky-500 to-indigo-500",
    mint: "from-emerald-500 to-teal-500",
    slate: "from-slate-500 to-slate-700",
  };

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4">
      {actions.map((a, i) => {
        const Icon = a.icon;
        return (
          <button
            key={i}
            onClick={a.onClick}
            className="panel group relative overflow-hidden p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 lg:p-5"
          >
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${toneMap[a.tone]} shadow-md`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display font-bold text-foreground truncate">{a.label}</p>
                <p className="text-xs text-muted-foreground truncate">{a.hint}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary shrink-0" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
