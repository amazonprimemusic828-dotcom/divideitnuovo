import { Plus, Search, ArrowRight } from "lucide-react";

interface ActionCardProps {
  type: 'create' | 'explore';
  onClick?: () => void;
}

export function ActionCard({ type, onClick }: ActionCardProps) {
  const config = {
    create: {
      icon: <Plus className="w-6 h-6" />,
      gradient: 'from-primary to-teal-500',
      title: 'Crea Gruppo',
      description: 'Avvia un nuovo gruppo di abbonamento',
    },
    explore: {
      icon: <Search className="w-6 h-6" />,
      gradient: 'from-accent to-purple-600',
      title: 'Esplora Gruppi',
      description: 'Trova gruppi disponibili da unire',
    },
  };

  const { icon, gradient, title, description } = config[type];

  return (
    <button
      onClick={onClick}
      className="bg-card rounded-2xl p-5 flex items-center gap-4 w-full text-left hover:shadow-lg transition-all duration-300 group border border-transparent hover:border-border"
    >
      <div className={`w-14 h-14 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-bold text-foreground group-hover:text-accent transition-colors">{title}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
    </button>
  );
}
