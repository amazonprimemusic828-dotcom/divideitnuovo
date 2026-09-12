import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Headphones, MessageCircle, Send, Clock, 
  AlertCircle, ChevronRight, ExternalLink, HelpCircle,
  FileText, Shield, CreditCard, Users
} from "lucide-react";

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: 'open' | 'pending' | 'closed';
  createdAt: string;
}

export default function SupportPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'new' | 'my-tickets'>('new');
  const [formData, setFormData] = useState({
    subject: '',
    category: 'Altro',
    description: ''
  });

  const tickets: Ticket[] = [
    { id: '1', subject: 'Problema con il pagamento', category: 'Pagamenti', status: 'open', createdAt: '15 gen 2026' },
    { id: '2', subject: 'Come invitare nuovi membri?', category: 'Gruppi', status: 'closed', createdAt: '10 gen 2026' },
  ];

  const categories = [
    { icon: <CreditCard className="w-5 h-5" />, label: 'Pagamenti', value: 'Pagamenti' },
    { icon: <Users className="w-5 h-5" />, label: 'Gruppi', value: 'Gruppi' },
    { icon: <Shield className="w-5 h-5" />, label: 'Sicurezza', value: 'Sicurezza' },
    { icon: <HelpCircle className="w-5 h-5" />, label: 'Altro', value: 'Altro' },
  ];

  const faqs = [
    { question: 'Come creo un nuovo gruppo?', answer: 'Clicca su "Crea Gruppo" nella navbar e segui le istruzioni.' },
    { question: 'Come ricevo i pagamenti?', answer: 'Configura il tuo IBAN nelle impostazioni e i pagamenti saranno automatici.' },
    { question: 'Posso cambiare il prezzo dopo aver creato il gruppo?', answer: 'Sì, puoi modificare il prezzo dalle impostazioni del gruppo.' },
  ];

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
              <h1 className="font-bold text-xl text-foreground">Centro Assistenza</h1>
              <p className="text-sm text-muted-foreground">Il nostro team è qui per aiutarti</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Hero */}
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Headphones className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-extrabold text-foreground mb-2">Centro Assistenza</h2>
          <p className="text-muted-foreground">Il nostro team è qui per aiutarti</p>
        </div>

        {/* AI Chat Suggestion */}
        <div className="bg-accent/10 border border-accent/20 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Hai provato la chat AI?</p>
              <p className="text-sm text-muted-foreground mt-1">
                La maggior parte delle domande trova risposta immediata con il nostro assistente AI in basso a destra. 
                Compila questo form solo se hai bisogno di assistenza personalizzata.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-card rounded-2xl overflow-hidden shadow-sm">
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab('new')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors relative ${
                activeTab === 'new' ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Apri un Nuovo Ticket
              {activeTab === 'new' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('my-tickets')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors relative ${
                activeTab === 'my-tickets' ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              I Miei Ticket
              {activeTab === 'my-tickets' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
              )}
            </button>
          </div>

          {activeTab === 'new' && (
            <div className="p-6">
              {/* Ticket Header */}
              <div className="bg-gradient-to-r from-accent to-purple-600 rounded-xl p-5 text-white mb-6">
                <h3 className="font-bold text-lg">Apri un Ticket</h3>
                <p className="text-sm opacity-80 mt-1">Un operatore umano ti risponderà via email</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Oggetto *</label>
                  <input
                    type="text"
                    placeholder="Riassumi il tuo problema"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-3 bg-secondary rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Categoria *</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => setFormData({ ...formData, category: cat.value })}
                        className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                          formData.category === cat.value
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border hover:border-accent/50'
                        }`}
                      >
                        {cat.icon}
                        <span className="text-sm font-medium">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Descrizione Dettagliata *</label>
                  <textarea
                    placeholder="Descrivi il problema in dettaglio. Più informazioni fornisci, più velocemente potremo aiutarti."
                    rows={5}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-secondary rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  />
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-800 dark:text-amber-200">Importante</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        Riceverai una risposta via email all'indirizzo <strong>calcium9282@gmail.com</strong> entro 24 ore nei giorni lavorativi. Controlla anche la cartella spam.
                      </p>
                    </div>
                  </div>
                </div>

                <button className="w-full bg-gradient-to-r from-accent to-purple-600 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg">
                  <Send className="w-5 h-5" />
                  Invia Richiesta
                </button>
              </div>
            </div>
          )}

          {activeTab === 'my-tickets' && (
            <div className="p-6">
              {tickets.length > 0 ? (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="bg-secondary/50 rounded-xl p-4 hover:bg-secondary transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-foreground">{ticket.subject}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{ticket.category}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            ticket.status === 'open' 
                              ? 'bg-primary/10 text-primary' 
                              : ticket.status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {ticket.status === 'open' ? 'Aperto' : ticket.status === 'pending' ? 'In attesa' : 'Chiuso'}
                          </span>
                          <p className="text-xs text-muted-foreground mt-2">{ticket.createdAt}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">Nessun ticket aperto</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FAQs */}
        <div className="bg-card rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-lg text-foreground mb-4">Domande Frequenti</h3>
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <details key={index} className="group">
                <summary className="flex items-center justify-between p-4 bg-secondary rounded-xl cursor-pointer list-none hover:bg-secondary/80 transition-colors">
                  <span className="font-medium text-foreground">{faq.question}</span>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-open:rotate-90 transition-transform" />
                </summary>
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="bg-card rounded-2xl p-6 shadow-sm text-center">
          <p className="text-muted-foreground mb-3">Hai bisogno di aiuto immediato?</p>
          <a 
            href="mailto:support@divideit.com" 
            className="text-accent hover:underline font-semibold flex items-center justify-center gap-2"
          >
            support@divideit.com
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </main>
    </div>
  );
}
