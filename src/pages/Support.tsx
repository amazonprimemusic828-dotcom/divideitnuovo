import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Headphones, Mail, MessageCircle, Send, HelpCircle, CheckCircle, 
  ChevronLeft, Clock, User, Loader2, Ticket, Youtube 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthContext";
import {
  isPlatformAdmin,
  listYoutubeRequests,
  markYoutubeInvited,
  YOUTUBE_MONTHLY_SLOTS,
  type YoutubeAdminRow,
} from "@/lib/youtube";


interface SupportTicket {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  subject: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_name: string;
  sender_type: string;
  message: string;
  created_at: string;
}

type ViewMode = "main" | "tickets" | "chat" | "form" | "youtube";

export default function Support() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("main");
  const [formData, setFormData] = useState({ subject: "", message: "", email: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ytRows, setYtRows] = useState<YoutubeAdminRow[]>([]);
  const [ytLoading, setYtLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const ytPending = ytRows.filter((r) => r.status === "email_submitted").length;
  const ytSlotsLeft = ytRows[0]?.slots_left ?? YOUTUBE_MONTHLY_SLOTS;

  const loadYoutube = async () => {
    setYtLoading(true);
    setYtRows(await listYoutubeRequests());
    setYtLoading(false);
  };

  const handleMarkInvited = async (id: string) => {
    const ok = await markYoutubeInvited(id);
    if (!ok) {
      toast.error("Operazione non riuscita");
      return;
    }
    toast.success("Segnato come invitato");
    void loadYoutube();
  };

  useEffect(() => {
    let active = true;
    if (!user?.uid) {
      setIsAdmin(false);
      return;
    }
    void (async () => {
      const admin = await isPlatformAdmin();
      if (!active) return;
      setIsAdmin(admin);
      if (admin) void loadYoutube();
    })();
    return () => {
      active = false;
    };
  }, [user?.uid]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [ticketMessages]);


  useEffect(() => {
    if (user?.uid && viewMode === "tickets") {
      loadUserTickets();
    }
  }, [user?.uid, viewMode]);

  useEffect(() => {
    if (!user?.uid) return;

    const channel = supabase
      .channel('user-tickets-list')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'support_tickets',
        filter: `user_id=eq.${user.uid}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTickets(prev => [payload.new as SupportTicket, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as SupportTicket;
          setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
        } else if (payload.eventType === 'DELETE') {
          const deleted = payload.old as { id: string };
          setTickets(prev => prev.filter(t => t.id !== deleted.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.uid]);

  const loadUserTickets = async () => {
    if (!user?.uid) return;
    setTicketsLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.uid)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets((data || []) as SupportTicket[]);
    } catch (err) {
      console.error("Error loading tickets:", err);
      toast.error("Errore nel caricamento dei ticket");
    } finally {
      setTicketsLoading(false);
    }
  };

  const loadTicketMessages = async (ticketId: string) => {
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTicketMessages((data || []) as TicketMessage[]);
    } catch (err) {
      console.error("Error loading messages:", err);
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedTicket) return;

    const channel = supabase
      .channel(`user-ticket-${selectedTicket.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `ticket_id=eq.${selectedTicket.id}`
      }, (payload) => {
        const newMsg = payload.new as TicketMessage;
        setTicketMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        if (newMsg.sender_type === 'operator') {
          if ('vibrate' in navigator) {
            navigator.vibrate(100);
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'support_tickets',
        filter: `id=eq.${selectedTicket.id}`
      }, (payload) => {
        const updated = payload.new as SupportTicket;
        setSelectedTicket(updated);
        setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicket?.id]);

  const openTicketChat = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    loadTicketMessages(ticket.id);
    setViewMode("chat");
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket || !user) return;

    setReplySending(true);
    try {
      const { error } = await supabase.from('support_messages').insert({
        ticket_id: selectedTicket.id,
        sender_id: user.uid,
        sender_name: user.full_name || 'Utente',
        sender_type: 'user',
        message: replyText.trim()
      });

      if (error) throw error;
      setReplyText("");
    } catch (err) {
      console.error("Error sending reply:", err);
      toast.error("Errore nell'invio del messaggio");
    } finally {
      setReplySending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject || !formData.message) {
      toast.error("Compila tutti i campi obbligatori");
      return;
    }
    if (!user && !formData.email) {
      toast.error("Inserisci la tua email");
      return;
    }

    setSending(true);
    try {
      const userEmail = user?.email || formData.email;
      const userName = user?.full_name || 'Utente';
      const userId = user?.uid || `contact_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const { error } = await supabase.from('support_tickets').insert({
        user_id: userId,
        user_email: userEmail,
        user_name: userName,
        subject: `[Contatto] ${formData.subject}`,
        category: 'general',
        description: formData.message,
        status: 'open',
        priority: 'medium',
        ai_attempted: false
      });

      if (error) throw error;

      toast.success("Richiesta inviata! Ti risponderemo presto.");
      setFormData({ subject: "", message: "", email: "" });
      setSent(true);
    } catch (err) {
      console.error("Error sending support request:", err);
      toast.error("Errore nell'invio. Riprova.");
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      waiting_operator: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      in_progress: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      closed: "bg-muted text-muted-foreground"
    };
    const labels: Record<string, string> = {
      open: "Aperto",
      waiting_operator: "In attesa",
      in_progress: "In corso",
      closed: "Chiuso"
    };
    return <Badge className={styles[status] || styles.open}>{labels[status] || status}</Badge>;
  };

  const faqItems = [
    { question: "Come funziona DIVIDEIT?", answer: "DIVIDEIT ti permette di condividere abbonamenti con altre persone in modo sicuro. Crea o unisciti a un gruppo, paga la tua quota mensile e goditi il risparmio!" },
    { question: "I pagamenti sono sicuri?", answer: "Tutti i pagamenti sono gestiti tramite Stripe, il sistema di pagamento pi\u00f9 sicuro al mondo. I tuoi dati sono sempre protetti." },
    { question: "Posso uscire da un gruppo?", answer: "Certo! Puoi uscire da qualsiasi gruppo in qualsiasi momento dalla pagina dettaglio del gruppo." },
    { question: "Come faccio a creare un gruppo?", answer: "Vai alla Dashboard e clicca su 'Crea Gruppo'. Seleziona il servizio, il piano e configura le impostazioni." }
  ];

  if (viewMode === "chat" && selectedTicket) {
    return (
      <div className="p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-3xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => { setViewMode("tickets"); setSelectedTicket(null); }}
            className="mb-4"
            data-testid="button-back-tickets"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            I miei ticket
          </Button>

          <Card className="overflow-hidden flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
            <div className="p-4 border-b bg-muted/30">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-bold text-foreground text-lg truncate">{selectedTicket.subject}</h2>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{selectedTicket.description}</p>
                </div>
                {getStatusBadge(selectedTicket.status)}
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : ticketMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Nessun messaggio ancora. Un operatore ti risponder\u00e0 presto.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ticketMessages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
                      data-testid={`message-${msg.id}`}
                    >
                      <div className={`flex items-end gap-2 max-w-[85%] ${msg.sender_type === 'user' ? 'flex-row-reverse' : ''}`}>
                        {msg.sender_type !== 'user' && (
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                            msg.sender_type === 'operator' ? 'bg-green-500' : 'bg-muted'
                          }`}>
                            {msg.sender_type === 'operator' ? (
                              <Headphones className="w-4 h-4 text-white" />
                            ) : (
                              <MessageCircle className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        )}
                        <div className={`px-4 py-3 rounded-2xl ${
                          msg.sender_type === 'user'
                            ? 'gradient-divideit text-white rounded-br-sm'
                            : msg.sender_type === 'operator'
                            ? 'bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-200 border border-green-200 dark:border-green-800 rounded-bl-sm'
                            : 'bg-muted text-foreground rounded-bl-sm'
                        }`}>
                          {msg.sender_type === 'operator' && (
                            <p className="text-xs font-semibold mb-1 opacity-80">{msg.sender_name}</p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          <p className="text-[10px] opacity-60 mt-1">
                            {new Date(msg.created_at).toLocaleString('it-IT', { 
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                            })}
                          </p>
                        </div>
                        {msg.sender_type === 'user' && (
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {selectedTicket.status !== 'closed' ? (
              <form onSubmit={handleSendReply} className="p-4 border-t bg-card">
                <div className="flex gap-2">
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Scrivi un messaggio..."
                    disabled={replySending}
                    className="flex-1 rounded-xl"
                    data-testid="input-ticket-reply"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={replySending || !replyText.trim()}
                    className="gradient-divideit text-white rounded-xl shrink-0"
                    data-testid="button-send-reply"
                  >
                    {replySending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="p-4 border-t bg-muted/30 text-center">
                <p className="text-sm text-muted-foreground">Questo ticket \u00e8 stato chiuso. Per nuove richieste, apri un nuovo ticket.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  if (viewMode === "youtube" && isAdmin) {
    return (
      <div className="p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" onClick={() => setViewMode("main")} className="mb-4">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Supporto
          </Button>

          <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-1">Invita YouTube</h1>
              <p className="text-muted-foreground">Invia gli inviti entro 24 ore dalla richiesta.</p>
            </div>
            <Card className="px-5 py-3 text-center">
              <p className="text-2xl font-black leading-none">
                {ytSlotsLeft} / {YOUTUBE_MONTHLY_SLOTS}
              </p>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-1">
                Slot rimasti questo mese
              </p>
            </Card>
          </div>

          {ytLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : ytRows.length === 0 ? (
            <Card className="p-8 text-center">
              <Youtube className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">Nessuna richiesta al momento.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {ytRows.map((r) => {
                const isNew = r.status === "email_submitted";
                return (
                  <Card
                    key={r.id}
                    className={`p-4 ${isNew ? "border-primary/60 bg-primary/5" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {r.google_email || "— email non ancora inserita —"}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {r.nickname || r.user_email} · mese {r.month}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(r.email_submitted_at || r.qualified_at).toLocaleString("it-IT")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={r.status === "invited" ? "secondary" : "default"}>
                          {r.status}
                        </Badge>
                        {r.status !== "invited" && r.google_email && (
                          <Button
                            size="sm"
                            className="rounded-xl gradient-divideit text-white"
                            onClick={() => handleMarkInvited(r.id)}
                          >
                            Segna come invitato
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (viewMode === "tickets") {

    return (
      <div className="p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-3xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => setViewMode("main")}
            className="mb-4"
            data-testid="button-back-support"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Supporto
          </Button>

          <div className="mb-6">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-1">I Miei Ticket</h1>
            <p className="text-muted-foreground">Segui le tue richieste di supporto</p>
          </div>

          {ticketsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.length === 0 ? (
            <Card className="p-8 text-center">
              <Ticket className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-bold text-foreground mb-2">Nessun ticket</h3>
              <p className="text-muted-foreground mb-6">Non hai ancora aperto richieste di supporto.</p>
              <Button
                onClick={() => setViewMode("form")}
                className="gradient-divideit text-white rounded-xl"
                data-testid="button-new-ticket-empty"
              >
                <Send className="w-4 h-4 mr-2" />
                Apri una richiesta
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {tickets.map(ticket => (
                <Card
                  key={ticket.id}
                  className="p-4 cursor-pointer hover-elevate transition-all"
                  onClick={() => openTicketChat(ticket)}
                  data-testid={`card-ticket-${ticket.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground truncate">{ticket.subject}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ticket.description}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(ticket.created_at).toLocaleDateString('it-IT', {
                            day: '2-digit', month: 'short', year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                    {getStatusBadge(ticket.status)}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (viewMode === "form") {
    return (
      <div className="p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => setViewMode("main")}
            className="mb-4"
            data-testid="button-back-support-form"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Supporto
          </Button>

          <Card className="panel p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl gradient-divideit flex items-center justify-center">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Contattaci</h2>
                <p className="text-sm text-muted-foreground">Ti risponderemo entro 24 ore</p>
              </div>
            </div>

            {sent ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Richiesta Inviata!</h3>
                <p className="text-muted-foreground mb-6">Ti risponderemo il prima possibile. Puoi seguire lo stato nella sezione "I Miei Ticket".</p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <Button onClick={() => { setSent(false); setViewMode("main"); }} variant="outline" className="rounded-xl" data-testid="button-back-after-sent">
                    Torna al supporto
                  </Button>
                  {user && (
                    <Button onClick={() => { setSent(false); loadUserTickets(); setViewMode("tickets"); }} className="gradient-divideit text-white rounded-xl" data-testid="button-view-tickets-after-sent">
                      Vedi i miei ticket
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {!user && (
                  <div>
                    <Label>La tua Email *</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@esempio.com"
                      className="mt-2"
                      data-testid="input-support-email"
                    />
                  </div>
                )}
                <div>
                  <Label>Oggetto *</Label>
                  <Input
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Di cosa hai bisogno?"
                    className="mt-2"
                    data-testid="input-support-subject"
                  />
                </div>
                <div>
                  <Label>Messaggio *</Label>
                  <Textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Descrivi il tuo problema o la tua richiesta..."
                    className="mt-2 min-h-[150px]"
                    data-testid="input-support-message"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={sending}
                  className="btn-lift h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground"
                  data-testid="button-submit-support"
                >
                  {sending ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Invio in corso...
                    </div>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Invia Richiesta
                    </>
                  )}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-10 pb-24 lg:pb-10">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <span className="eyebrow">Assistenza</span>
          <h1 className="display-lg mt-4 text-foreground">Supporto</h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">Come possiamo aiutarti?</p>
        </div>

        {user && (
          <Card className="p-5 mb-6 bg-gradient-to-r from-primary/5 to-secondary/5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Ticket className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">I Miei Ticket</h3>
                  <p className="text-sm text-muted-foreground">Vedi lo stato delle tue richieste</p>
                </div>
              </div>
              <Button
                onClick={() => { loadUserTickets(); setViewMode("tickets"); }}
                variant="outline"
                className="rounded-xl"
                data-testid="button-view-my-tickets"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Vedi Ticket
              </Button>
            </div>
          </Card>
        )}

        {isAdmin && (
          <Card className="p-5 mb-6 border-red-500/30 bg-red-500/5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <Youtube className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    Invita YouTube
                    {ytPending > 0 && (
                      <Badge className="rounded-full bg-red-600 text-white">{ytPending}</Badge>
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Richieste premio · slot rimasti {ytSlotsLeft}/{YOUTUBE_MONTHLY_SLOTS}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => { void loadYoutube(); setViewMode("youtube"); }}
                variant="outline"
                className="rounded-xl"
              >
                Gestisci inviti
              </Button>
            </div>
          </Card>
        )}



        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
          <Card className="panel p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl gradient-divideit flex items-center justify-center">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Contattaci</h2>
                <p className="text-sm text-muted-foreground">Apri una nuova richiesta di supporto</p>
              </div>
            </div>
            <p className="text-muted-foreground mb-4">Hai un problema o una domanda? Inviaci un messaggio e ti risponderemo il prima possibile.</p>
            <Button
              onClick={() => setViewMode("form")}
              className="btn-lift h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground"
              data-testid="button-open-contact-form"
            >
              <Send className="w-4 h-4 mr-2" />
              Apri Richiesta
            </Button>
          </Card>

          <Card className="panel p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <HelpCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">FAQ</h2>
                <p className="text-sm text-muted-foreground">Domande frequenti</p>
              </div>
            </div>
            <div className="space-y-4">
              {faqItems.map((item, index) => (
                <div key={index} className="p-4 bg-muted/30 rounded-xl">
                  <h3 className="font-semibold text-foreground mb-2">{item.question}</h3>
                  <p className="text-sm text-muted-foreground">{item.answer}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="mt-8 p-6 lg:p-8 bg-gradient-to-r from-primary/10 to-secondary/10">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-semibold text-foreground">support@divideit.com</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Chat Live</p>
                <p className="font-semibold text-foreground">Disponibile 24 ore</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center">
                <Headphones className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Risposta media</p>
                <p className="font-semibold text-foreground">&lt; 4 ore</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
