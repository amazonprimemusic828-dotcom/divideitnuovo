import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Camera, Shield, Phone, Mail, Calendar, User, 
  CreditCard, Check, AlertCircle, ChevronRight, LogOut, 
  Trash2, Bell, Lock, Globe, HelpCircle
} from "lucide-react";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<'profile' | 'security' | 'notifications' | 'payment'>('profile');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-secondary rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-xl text-foreground">Impostazioni</h1>
              <p className="text-sm text-muted-foreground">Gestisci il tuo profilo</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Trust Score */}
        <div className="bg-card rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-accent" />
            </div>
            <h2 className="font-bold text-lg text-foreground">Affidabilità</h2>
          </div>
          
          <div className="flex items-center gap-4 mb-4">
            <span className="text-5xl font-extrabold text-accent">60</span>
            <span className="text-3xl font-bold text-muted-foreground">/100</span>
            <span className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-semibold">
              Buono
            </span>
          </div>

          <div className="flex gap-4 mb-4">
            <button className="text-sm text-muted-foreground hover:text-accent transition-colors flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Verifica Telefono
            </button>
            <button className="text-sm text-muted-foreground hover:text-accent transition-colors flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Verifica Identità
            </button>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Il tuo punteggio di affidabilità ti aiuta a costruire fiducia con gli altri membri.
          </p>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                <span className="text-[10px]">○</span>
              </div>
              <span>Telefono Verificato (+15 punti)</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                <span className="text-[10px]">○</span>
              </div>
              <span>Identità Verificata (+25 punti)</span>
            </div>
            <div className="flex items-center gap-2 text-primary">
              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
              <span>Pagamenti Completati: 0 (+5 punti ciascuno)</span>
            </div>
          </div>
        </div>

        {/* Profile Photo */}
        <div className="bg-card rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-lg text-foreground mb-4">Foto Profilo</h3>
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                C
              </div>
              <button className="absolute bottom-0 right-0 w-8 h-8 bg-accent rounded-full flex items-center justify-center text-accent-foreground shadow-lg hover:scale-105 transition-transform">
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <div>
              <p className="font-semibold text-foreground">Cambia la tua foto profilo</p>
              <p className="text-sm text-muted-foreground">Formati supportati: JPG, PNG. Dimensione massima: 5MB</p>
              <button className="mt-2 text-sm text-destructive hover:underline">Rimuovi Foto</button>
            </div>
          </div>
        </div>

        {/* Personal Details */}
        <div className="bg-card rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-lg text-foreground mb-6">Dettagli Personali</h3>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Nome Completo</label>
              <input
                type="text"
                defaultValue="Cal"
                className="w-full px-4 py-3 bg-secondary rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Email</label>
              <input
                type="email"
                defaultValue="calcium9282@gmail.com"
                disabled
                className="w-full px-4 py-3 bg-secondary rounded-xl border-0 text-muted-foreground cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground mt-1">Email non modificabile</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Data di Nascita</label>
                <input
                  type="date"
                  className="w-full px-4 py-3 bg-secondary rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Telefono</label>
                <input
                  type="tel"
                  placeholder="+39 123 456 7890"
                  className="w-full px-4 py-3 bg-secondary rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Payment Data */}
        <div className="bg-card rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-lg text-foreground mb-2">Dati per Ricevere Pagamenti</h3>
          <p className="text-sm text-muted-foreground mb-6">Inserisci i tuoi dati per ricevere bonifici bancari dai membri del gruppo</p>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">IBAN</label>
              <input
                type="text"
                placeholder="IT60 X054 2811 1010 0000 0123 456"
                className="w-full px-4 py-3 bg-secondary rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-accent font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Intestatario</label>
              <input
                type="text"
                placeholder="Nome e Cognome"
                className="w-full px-4 py-3 bg-secondary rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
        </div>

        {/* Other Settings */}
        <div className="bg-card rounded-2xl overflow-hidden shadow-sm">
          <button className="w-full p-4 flex items-center justify-between hover:bg-secondary transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <Bell className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="font-medium text-foreground">Notifiche</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="h-px bg-border" />
          <button className="w-full p-4 flex items-center justify-between hover:bg-secondary transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <Lock className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="font-medium text-foreground">Sicurezza</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="h-px bg-border" />
          <button className="w-full p-4 flex items-center justify-between hover:bg-secondary transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <Globe className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="font-medium text-foreground">Lingua</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Italiano</span>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </button>
          <div className="h-px bg-border" />
          <button className="w-full p-4 flex items-center justify-between hover:bg-secondary transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="font-medium text-foreground">Aiuto</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Danger Zone */}
        <div className="space-y-3">
          <button className="w-full bg-card hover:bg-secondary p-4 rounded-2xl flex items-center justify-center gap-3 text-foreground font-medium transition-colors shadow-sm">
            <LogOut className="w-5 h-5" />
            Esci dall'Account
          </button>
          <button className="w-full bg-destructive/10 hover:bg-destructive/20 p-4 rounded-2xl flex items-center justify-center gap-3 text-destructive font-medium transition-colors">
            <Trash2 className="w-5 h-5" />
            Elimina Account
          </button>
        </div>

        {/* Save Button */}
        <div className="sticky bottom-4">
          <button className="w-full btn-primary py-4 text-base font-semibold">
            Salva Modifiche
          </button>
        </div>
      </main>
    </div>
  );
}
