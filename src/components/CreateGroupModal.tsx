import { useState } from "react";
import { X, Search, Check, ChevronRight, DollarSign, Users, Calendar } from "lucide-react";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const services = [
  { id: 'netflix', name: 'Netflix', icon: 'N', gradient: 'from-red-600 to-red-700', plans: [
    { name: 'Base con Pubblicità', price: 5.49, maxMembers: 1 },
    { name: 'Standard', price: 13.99, maxMembers: 2 },
    { name: 'Premium', price: 19.99, maxMembers: 4 },
  ]},
  { id: 'spotify', name: 'Spotify', icon: '🎧', gradient: 'from-green-500 to-green-600', plans: [
    { name: 'Duo', price: 14.99, maxMembers: 2 },
    { name: 'Famiglia', price: 17.99, maxMembers: 6 },
  ]},
  { id: 'apple-music', name: 'Apple Music', icon: '🎵', gradient: 'from-pink-500 to-rose-500', plans: [
    { name: 'Famiglia', price: 16.99, maxMembers: 6 },
  ]},
  { id: 'disney', name: 'Disney+', icon: 'D+', gradient: 'from-blue-600 to-indigo-900', plans: [
    { name: 'Standard', price: 8.99, maxMembers: 2 },
    { name: 'Premium', price: 11.99, maxMembers: 4 },
  ]},
  { id: 'youtube', name: 'YouTube Premium', icon: '▶', gradient: 'from-red-500 to-red-600', plans: [
    { name: 'Famiglia', price: 23.99, maxMembers: 6 },
  ]},
  { id: 'hbo', name: 'HBO Max', icon: 'H', gradient: 'from-purple-600 to-purple-800', plans: [
    { name: 'Standard', price: 9.99, maxMembers: 3 },
  ]},
];

export function CreateGroupModal({ isOpen, onClose }: CreateGroupModalProps) {
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState<typeof services[0] | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<typeof services[0]['plans'][0] | null>(null);
  const [billingDay, setBillingDay] = useState(1);

  const filteredServices = services.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectService = (service: typeof services[0]) => {
    setSelectedService(service);
    setSelectedPlan(null);
    setStep(2);
  };

  const handleSelectPlan = (plan: typeof services[0]['plans'][0]) => {
    setSelectedPlan(plan);
    setStep(3);
  };

  const handleCreate = () => {
    // Here you would create the group
    onClose();
    // Reset state
    setStep(1);
    setSelectedService(null);
    setSelectedPlan(null);
    setSearchQuery('');
  };

  const pricePerPerson = selectedPlan 
    ? (selectedPlan.price / selectedPlan.maxMembers).toFixed(2) 
    : '0';

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
      
      {/* Modal */}
      <div className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg md:max-h-[85vh] bg-card rounded-2xl overflow-hidden z-50 flex flex-col animate-scale-in">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-bold text-xl text-foreground">Crea Gruppo</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Passo {step} di 3</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-5 pt-4">
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  s <= step ? 'bg-accent' : 'bg-secondary'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Seleziona Servizio</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Cerca servizio..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-secondary rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {filteredServices.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => handleSelectService(service)}
                    className="p-4 bg-secondary hover:bg-secondary/80 rounded-xl flex items-center gap-3 transition-all hover:shadow-md group"
                  >
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${service.gradient} flex items-center justify-center text-white font-bold shadow-md group-hover:scale-105 transition-transform`}>
                      {service.icon}
                    </div>
                    <span className="font-semibold text-foreground text-left">{service.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && selectedService && (
            <div className="space-y-4">
              <button
                onClick={() => setStep(1)}
                className="text-sm text-accent hover:underline flex items-center gap-1"
              >
                ← Torna indietro
              </button>

              <div className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${selectedService.gradient} flex items-center justify-center text-white font-bold shadow-lg`}>
                  {selectedService.icon}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">{selectedService.name}</h3>
                  <p className="text-sm text-muted-foreground">Seleziona un piano</p>
                </div>
              </div>

              <div className="space-y-3">
                {selectedService.plans.map((plan, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectPlan(plan)}
                    className="w-full p-4 bg-secondary hover:bg-secondary/80 rounded-xl flex items-center justify-between transition-all hover:shadow-md"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{plan.name}</p>
                      <p className="text-sm text-muted-foreground">Fino a {plan.maxMembers} membri</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-foreground">€{plan.price.toFixed(2)}</p>
                      <p className="text-xs text-primary font-medium">€{(plan.price / plan.maxMembers).toFixed(2)}/persona</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && selectedService && selectedPlan && (
            <div className="space-y-5">
              <button
                onClick={() => setStep(2)}
                className="text-sm text-accent hover:underline flex items-center gap-1"
              >
                ← Torna indietro
              </button>

              {/* Summary */}
              <div className="bg-gradient-to-br from-accent to-purple-600 rounded-xl p-5 text-white">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-14 h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center font-bold shadow-lg`}>
                    {selectedService.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{selectedService.name}</h3>
                    <p className="text-sm opacity-80">{selectedPlan.name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <DollarSign className="w-5 h-5 mx-auto mb-1 opacity-80" />
                    <p className="text-2xl font-bold">€{pricePerPerson}</p>
                    <p className="text-xs opacity-70">a persona</p>
                  </div>
                  <div>
                    <Users className="w-5 h-5 mx-auto mb-1 opacity-80" />
                    <p className="text-2xl font-bold">{selectedPlan.maxMembers}</p>
                    <p className="text-xs opacity-70">membri max</p>
                  </div>
                  <div>
                    <Calendar className="w-5 h-5 mx-auto mb-1 opacity-80" />
                    <p className="text-2xl font-bold">{billingDay}</p>
                    <p className="text-xs opacity-70">giorno fatt.</p>
                  </div>
                </div>
              </div>

              {/* Billing Day */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Giorno di Fatturazione</label>
                <select
                  value={billingDay}
                  onChange={(e) => setBillingDay(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-secondary rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>Giorno {day} del mese</option>
                  ))}
                </select>
              </div>

              {/* Info */}
              <div className="bg-secondary/50 rounded-xl p-4 text-sm text-muted-foreground">
                <p>• Sarai l'admin del gruppo</p>
                <p>• Potrai invitare membri tramite codice</p>
                <p>• I pagamenti saranno gestiti automaticamente</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 3 && (
          <div className="p-5 border-t border-border">
            <button
              onClick={handleCreate}
              className="w-full btn-primary py-4 text-base font-semibold"
            >
              Crea Gruppo
            </button>
          </div>
        )}
      </div>
    </>
  );
}
