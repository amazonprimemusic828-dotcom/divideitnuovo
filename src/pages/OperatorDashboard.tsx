import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Headphones,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  MessageCircle,
  Send,
  X,
  User,
  Bot,
  RefreshCw,
  Loader2,
  ShieldAlert,
  Banknote,
  Mail,
  Youtube,
  Gift,
  LifeBuoy,
  UserX,

} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthContext";
import { stripeApi } from "@/lib/stripeApi";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { listYoutubeRequests, markYoutubeInvited, YoutubeAdminRow } from "@/lib/youtube";
import {
  listDeletionRequests, approveDeletionRequest, rejectDeletionRequest,
  type DeletionAdminRow,
} from "@/lib/accountDeletion";


interface Ticket {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  subject: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  assigned_operator: string | null;
  ai_attempted: boolean;
  created_at: string;
  updated_at: string;
  ticket_type?: string;
  group_id?: string | null;
  group_admin_email?: string | null;
  membership_id?: string | null;
  refund_amount?: number | null;
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

export default function OperatorDashboard() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [isOperator, setIsOperator] = useState<boolean | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [section, setSection] = useState<"tickets" | "refunds" | "referral" | "accounts">("tickets");
  const [delRows, setDelRows] = useState<DeletionAdminRow[]>([]);
  const [delLoading, setDelLoading] = useState(false);
  const [delBusy, setDelBusy] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<DeletionAdminRow | null>(null);
  const [delAction, setDelAction] = useState<"approve" | "reject">("approve");
  const [delNote, setDelNote] = useState("");

  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [ytRows, setYtRows] = useState<YoutubeAdminRow[]>([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytBusy, setYtBusy] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedTicketRef = useRef<Ticket | null>(null);
  selectedTicketRef.current = selectedTicket;

  // Check operator role
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user?.uid) {
      setIsOperator(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.uid)
        .in("role", ["operator", "admin"]);
      if (error) {
        console.error(error);
        setIsOperator(false);
        return;
      }
      setIsOperator((data?.length ?? 0) > 0);
    })();
  }, [authLoading, isAuthenticated, user?.uid]);

  // Load tickets + realtime
  useEffect(() => {
    if (!isOperator) return;
    loadTickets();

    const channel = supabase
      .channel("operator-support")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets" },
        () => loadTickets()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload) => {
          const msg = payload.new as TicketMessage;
          const current = selectedTicketRef.current;
          if (current && msg.ticket_id === current.id) {
            setMessages((prev) =>
              prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
            );
            requestAnimationFrame(scrollToBottom);
          } else if (msg.sender_type === "user") {
            setUnread((u) => ({ ...u, [msg.ticket_id]: (u[msg.ticket_id] || 0) + 1 }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOperator]);

  const loadYoutube = async () => {
    setYtLoading(true);
    const rows = await listYoutubeRequests();
    setYtRows(rows);
    setYtLoading(false);
  };

  useEffect(() => {
    if (isOperator && section === "referral") void loadYoutube();
    if (isOperator && section === "accounts") void loadDeletions();
  }, [isOperator, section]);

  const loadDeletions = async () => {
    setDelLoading(true);
    setDelRows(await listDeletionRequests());
    setDelLoading(false);
  };

  const handleDeletionDecision = async (approve: boolean) => {
    const row = delTarget;
    if (!row) return;
    setDelBusy(row.id);
    const res = approve
      ? await approveDeletionRequest(row.id, delNote)
      : await rejectDeletionRequest(row.id, delNote);
    setDelBusy(null);
    setDelTarget(null);
    setDelNote("");
    if (res === "ok") {
      toast.success(approve ? "Account eliminato (dati conservati per legge)" : "Richiesta respinta");
      void loadDeletions();
    } else if (res === "forbidden") {
      toast.error("Non hai i permessi per questa operazione");
    } else {
      toast.error("Operazione non riuscita");
    }
  };


  const handleMarkInvited = async (row: YoutubeAdminRow) => {
    setYtBusy(row.id);
    const ok = await markYoutubeInvited(row.id);
    setYtBusy(null);
    if (ok) {
      toast.success("Invito segnato come inviato");
      void loadYoutube();
    } else {
      toast.error("Operazione non riuscita");
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  const loadTickets = async () => {
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTickets((data || []) as Ticket[]);
    } catch (err) {
      console.error("Error loading tickets:", err);
      toast.error("Errore nel caricamento ticket");
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMessages((data || []) as TicketMessage[]);
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  };

  const selectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setUnread((u) => ({ ...u, [ticket.id]: 0 }));
    loadMessages(ticket.id);
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = newMessage.trim();
    if (!text || !selectedTicket || sending) return;
    setSending(true);

    // Optimistic
    const tempId = `temp-${Date.now()}`;
    const optimistic: TicketMessage = {
      id: tempId,
      ticket_id: selectedTicket.id,
      sender_id: user?.uid || "operator",
      sender_name: "Operatore DIVIDEIT",
      sender_type: "operator",
      message: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setNewMessage("");
    requestAnimationFrame(scrollToBottom);

    try {
      const { data, error } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: user?.uid || "operator",
          sender_name: "Operatore DIVIDEIT",
          sender_type: "operator",
          message: text,
        })
        .select()
        .single();
      if (error) throw error;
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? (data as TicketMessage) : m))
      );
      if (selectedTicket.status !== "in_progress") {
        await supabase
          .from("support_tickets")
          .update({ status: "in_progress", assigned_operator: user?.email || "operator" })
          .eq("id", selectedTicket.id);
      }
    } catch (err) {
      console.error("Error sending message:", err);
      toast.error("Errore nell'invio");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const approveRefund = async () => {
    if (!selectedTicket || !user?.uid || !user?.email) return;
    if (selectedTicket.ticket_type !== "refund") return;
    setConfirmRefund(false);
    try {
      const { ok, data } = await stripeApi("process-refund", {
        ticketId: selectedTicket.id,
        actorEmail: user.email,
        actorUid: user.uid,
      });
      if (!ok || !data.success) {
        toast.error(data.error || "Errore durante il rimborso");
        return;
      }
      toast.success(
        data.stripe_refund_id
          ? `Rimborso eseguito (€${(data.amount || 0).toFixed(2)})`
          : "Rimborso registrato (utente rimosso)"
      );
      setSelectedTicket(null);
      loadTickets();
    } catch (e: any) {
      toast.error(e.message || "Errore");
    }
  };

  const closeTicket = async () => {
    if (!selectedTicket) return;
    setConfirmClose(false);
    try {
      await supabase.from("support_messages").insert({
        ticket_id: selectedTicket.id,
        sender_id: user?.uid || "operator",
        sender_name: "Operatore DIVIDEIT",
        sender_type: "operator",
        message:
          "✅ Ticket risolto. Grazie per averci contattato! Se hai altre domande, non esitare a scriverci.",
      });
      await supabase
        .from("support_tickets")
        .update({ status: "closed" })
        .eq("id", selectedTicket.id);
      toast.success("Ticket chiuso e utente notificato");
      setSelectedTicket(null);
      loadTickets();
    } catch (err) {
      toast.error("Errore nella chiusura");
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: "bg-blue-100 text-blue-800",
      ai_handled: "bg-purple-100 text-purple-800",
      waiting_operator: "bg-amber-100 text-amber-800",
      in_progress: "bg-green-100 text-green-800",
      closed: "bg-gray-100 text-gray-800",
    };
    const labels: Record<string, string> = {
      open: "Nuovo",
      ai_handled: "Gestito AI",
      waiting_operator: "In attesa",
      in_progress: "In corso",
      closed: "Chiuso",
    };
    return <Badge className={styles[status] || styles.open}>{labels[status] || status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      low: "bg-gray-100 text-gray-600",
      medium: "bg-blue-100 text-blue-600",
      high: "bg-orange-100 text-orange-600",
      urgent: "bg-red-100 text-red-600",
    };
    return <Badge className={styles[priority] || styles.medium}>{priority}</Badge>;
  };

  const filteredTickets = useMemo(
    () =>
      tickets.filter((t) => {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          t.subject.toLowerCase().includes(q) ||
          t.user_name.toLowerCase().includes(q) ||
          t.user_email.toLowerCase().includes(q) ||
          (t.group_admin_email || "").toLowerCase().includes(q);
        const matchesStatus = statusFilter === "all" || t.status === statusFilter;
        const isContactForm = t.subject.startsWith("[Contatto]");
        const isRefund = t.ticket_type === "refund";
        let matchesCategory = true;
        if (categoryFilter === "refund") matchesCategory = isRefund;
        else if (categoryFilter === "contact_form") matchesCategory = isContactForm && !isRefund;
        else if (categoryFilter === "chat") matchesCategory = !isContactForm && !isRefund;
        return matchesSearch && matchesStatus && matchesCategory;
      }),
    [tickets, searchTerm, statusFilter, categoryFilter]
  );

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  const formatRelative = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "ora";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return new Date(iso).toLocaleDateString("it-IT");
  };

  // Loading / gating
  if (authLoading || isOperator === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-blue-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Accesso richiesto</h1>
          <p className="text-muted-foreground mb-6">
            Devi essere autenticato per accedere al portale operatore.
          </p>
          <Button onClick={() => navigate("/Auth")} className="gradient-divideit text-white w-full">
            Accedi
          </Button>
        </Card>
      </div>
    );
  }

  if (!isOperator) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-blue-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Permesso negato</h1>
          <p className="text-muted-foreground mb-2">
            Il tuo account non ha il ruolo <code className="font-mono">operator</code>.
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            Account: {user?.email}
          </p>
          <Button variant="outline" onClick={() => navigate("/Dashboard")} className="w-full">
            Torna alla Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-xl border-b shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-divideit flex items-center justify-center relative">
              <Headphones className="w-5 h-5 text-white" />
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {totalUnread}
                </span>
              )}
            </div>
            <div>
              <h1 className="font-bold text-foreground">Portale Operatore</h1>
              <p className="text-xs text-muted-foreground">
                Connesso come {user?.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                section === "referral"
                  ? loadYoutube()
                  : section === "accounts"
                  ? loadDeletions()
                  : loadTickets()
              }

            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Aggiorna
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/Dashboard")}>
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4">
        {/* Sezioni principali */}
        <nav className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-2xl border bg-card p-1.5 shadow-sm">
          {([
            { key: "tickets", label: "Assistenza", icon: LifeBuoy },
            { key: "refunds", label: "Rimborsi", icon: Banknote },
            { key: "referral", label: "Referral", icon: Gift },
            { key: "accounts", label: "Account", icon: UserX },
          ] as const).map((item) => {
            const active = section === item.key;
            const pending =
              item.key === "refunds"
                ? tickets.filter((t) => t.ticket_type === "refund" && t.status !== "closed").length
                : item.key === "referral"
                ? ytRows.filter((r) => r.status === "email_submitted").length
                : item.key === "accounts"
                ? delRows.filter((r) => r.status === "pending").length
                : tickets.filter((t) => t.status === "open" || t.status === "waiting_operator").length;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setSection(item.key);
                  setSelectedTicket(null);
                  setCategoryFilter(item.key === "refunds" ? "refund" : "all");
                }}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "gradient-divideit text-white shadow-sm"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden">{item.label.slice(0, 8)}</span>
                {pending > 0 && (
                  <span
                    className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      active ? "bg-white/25 text-white" : "bg-primary/10 text-primary"
                    }`}
                  >
                    {pending}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Stats */}
        {section !== "referral" && section !== "accounts" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {tickets.filter((t) => t.status === "open" || t.status === "waiting_operator").length}
                </p>
                <p className="text-xs text-muted-foreground">In attesa</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {tickets.filter((t) => t.status === "in_progress").length}
                </p>
                <p className="text-xs text-muted-foreground">In corso</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Bot className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tickets.filter((t) => t.ai_attempted).length}</p>
                <p className="text-xs text-muted-foreground">Gestiti AI</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {tickets.filter((t) => t.status === "closed").length}
                </p>
                <p className="text-xs text-muted-foreground">Chiusi</p>
              </div>
            </div>
          </Card>
        </div>
        )}

        {section === "accounts" ? (
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <UserX className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold">Account · Richieste di eliminazione</h2>
                <p className="text-xs text-muted-foreground">
                  Approvando, l'accesso viene disattivato. I dati restano conservati per il periodo
                  previsto dalla legge e poi vengono cancellati.
                </p>
              </div>
              <Badge variant="outline">
                In attesa: {delRows.filter((r) => r.status === "pending").length}
              </Badge>
            </div>

            {delLoading ? (
              <div className="p-10 text-center text-muted-foreground">Caricamento…</div>
            ) : delRows.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                Nessuna richiesta di eliminazione.
              </div>
            ) : (
              <div className="divide-y">
                {delRows.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-sm">{r.user_email || r.user_id}</p>
                      <p className="text-xs text-muted-foreground">
                        Richiesta del {new Date(r.created_at).toLocaleString("it-IT")}
                      </p>
                      {r.reason && (
                        <p className="mt-1 text-xs text-muted-foreground">Motivo: {r.reason}</p>
                      )}
                      {r.operator_note && (
                        <p className="mt-1 text-xs text-muted-foreground">Nota: {r.operator_note}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          r.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : r.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-gray-700"
                        }
                      >
                        {r.status === "approved"
                          ? "Eliminato"
                          : r.status === "pending"
                          ? "Da approvare"
                          : r.status === "rejected"
                          ? "Respinta"
                          : "Annullata"}
                      </Badge>
                      {r.status === "pending" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={delBusy === r.id}
                            onClick={() => {
                              setDelAction("reject");
                              setDelNote("");
                              setDelTarget(r);
                            }}
                          >
                            Respingi
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={delBusy === r.id}
                            onClick={() => {
                              setDelAction("approve");
                              setDelNote("");
                              setDelTarget(r);
                            }}
                          >
                            {delBusy === r.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Approva eliminazione"
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : section === "referral" ? (

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <Youtube className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold">Referral · Premi YouTube Premium</h2>
                <p className="text-xs text-muted-foreground">
                  Utenti con 3 amici confermati che hanno inviato la loro email Google.
                </p>
              </div>
              <Badge variant="outline">
                Slot rimasti: {ytRows[0]?.slots_left ?? "—"}
              </Badge>
            </div>

            {ytLoading ? (
              <div className="p-10 text-center text-muted-foreground">Caricamento…</div>
            ) : ytRows.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                Nessuna richiesta referral al momento.
              </div>
            ) : (
              <div className="divide-y">
                {ytRows.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-sm">
                        {r.nickname || r.user_email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{r.user_email}</p>
                      <p className="mt-1 flex items-center gap-1 truncate text-xs font-medium text-primary">
                        <Mail className="h-3 w-3 shrink-0" />
                        {r.google_email || "email Google non ancora inviata"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          r.status === "invited"
                            ? "bg-green-100 text-green-800"
                            : r.status === "email_submitted"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }
                      >
                        {r.status === "invited"
                          ? "Invito inviato"
                          : r.status === "email_submitted"
                          ? "Da invitare"
                          : "Qualificato"}
                      </Badge>
                      {r.google_email && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            void navigator.clipboard.writeText(r.google_email as string);
                            toast.success("Email Google copiata");
                          }}
                        >
                          Copia email
                        </Button>
                      )}
                      {r.status === "email_submitted" && (
                        <Button
                          size="sm"
                          className="gradient-divideit text-white"
                          disabled={ytBusy === r.id}
                          onClick={() => handleMarkInvited(r)}
                        >
                          {ytBusy === r.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Segna come invitato"
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Tickets List */}
          <Card className="lg:col-span-1 overflow-hidden">
            <div className="p-4 border-b">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cerca ticket..."
                  className="pl-10 h-10 rounded-xl"
                />
              </div>
              <div className="flex gap-2 flex-wrap mb-3">
                <Badge
                  variant={categoryFilter === "all" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setCategoryFilter("all")}
                >
                  Tutti
                </Badge>
                <Badge
                  variant={categoryFilter === "chat" ? "default" : "outline"}
                  className="cursor-pointer bg-blue-100 text-blue-800 hover:bg-blue-200"
                  onClick={() => setCategoryFilter("chat")}
                >
                  🎧 Chat Live
                </Badge>
                <Badge
                  variant={categoryFilter === "contact_form" ? "default" : "outline"}
                  className="cursor-pointer bg-purple-100 text-purple-800 hover:bg-purple-200"
                  onClick={() => setCategoryFilter("contact_form")}
                >
                  📧 Gmail
                </Badge>
                <Badge
                  variant={categoryFilter === "refund" ? "default" : "outline"}
                  className="cursor-pointer bg-red-100 text-red-800 hover:bg-red-200"
                  onClick={() => setCategoryFilter("refund")}
                >
                  💸 Rimborsi
                  {(() => {
                    const n = tickets.filter(t => t.ticket_type === "refund" && t.status !== "closed").length;
                    return n > 0 ? (
                      <span className="ml-1 px-1.5 rounded-full bg-red-500 text-white text-[9px] font-bold">{n}</span>
                    ) : null;
                  })()}
                </Badge>
              </div>
              <div className="flex gap-2 flex-wrap">
                {["all", "open", "waiting_operator", "in_progress", "closed"].map((status) => (
                  <Badge
                    key={status}
                    variant={statusFilter === status ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setStatusFilter(status)}
                  >
                    {status === "all" ? "Tutti" : status === "waiting_operator" ? "In attesa" : status}
                  </Badge>
                ))}
              </div>
            </div>

            <ScrollArea className="h-[600px]">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">Caricamento...</div>
              ) : filteredTickets.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nessun ticket trovato</div>
              ) : (
                <div className="divide-y">
                  {filteredTickets.map((ticket) => {
                    const u = unread[ticket.id] || 0;
                    const active = selectedTicket?.id === ticket.id;
                    return (
                      <div
                        key={ticket.id}
                        onClick={() => selectTicket(ticket)}
                        className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                          active ? "bg-primary/5 border-l-4 border-l-primary" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {ticket.ticket_type === "refund" ? (
                              <span className="text-red-600">💸</span>
                            ) : ticket.subject.startsWith("[Contatto]") ? (
                              <span className="text-purple-600">📧</span>
                            ) : ticket.ticket_type === "help" ? (
                              <span className="text-amber-600">🆘</span>
                            ) : ticket.ticket_type === "problem" ? (
                              <span className="text-orange-600">⚠️</span>
                            ) : (
                              <span className="text-blue-600">🎧</span>
                            )}
                            <h3 className="font-semibold text-sm truncate">{ticket.subject}</h3>
                          </div>
                          {u > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                              {u}
                            </span>
                          )}
                          {getStatusBadge(ticket.status)}
                        </div>
                        <p className="text-xs text-muted-foreground mb-1 truncate">
                          {ticket.user_name}
                        </p>
                        <p className="text-xs text-primary font-medium mb-1 truncate">
                          {ticket.user_email}
                        </p>
                        {ticket.group_admin_email && (
                          <p className="text-[11px] text-muted-foreground mb-2 truncate flex items-center gap-1">
                            <Mail className="w-3 h-3" /> Admin: {ticket.group_admin_email}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          {getPriorityBadge(ticket.priority)}
                          <span className="text-xs text-muted-foreground">
                            {formatRelative(ticket.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </Card>

          {/* Chat Panel */}
          <Card className="lg:col-span-2 overflow-hidden flex flex-col h-[700px]">
            {selectedTicket ? (
              <>
                {/* Ticket Header */}
                <div className="p-4 border-b bg-muted/30">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-bold text-lg truncate">{selectedTicket.subject}</h2>
                      <div className="flex items-center gap-2 mt-1 text-sm">
                        <span className="font-medium">{selectedTicket.user_name}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{selectedTicket.user_email}</span>
                      </div>
                      {selectedTicket.group_admin_email && (
                        <a
                          href={`mailto:${selectedTicket.group_admin_email}?subject=${encodeURIComponent(`Verifica rimborso: ${selectedTicket.subject}`)}`}
                          className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                        >
                          <Mail className="w-3 h-3" /> Contatta admin gruppo: {selectedTicket.group_admin_email}
                        </a>
                      )}
                      {selectedTicket.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {selectedTicket.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getStatusBadge(selectedTicket.status)}
                      {selectedTicket.ticket_type === "refund" && selectedTicket.status !== "closed" && (
                        <Button
                          size="sm"
                          onClick={() => setConfirmRefund(true)}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          <Banknote className="w-4 h-4 mr-1" /> Approva rimborso
                        </Button>
                      )}
                      {selectedTicket.status !== "closed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmClose(true)}
                          className="text-green-600 border-green-300 hover:bg-green-50"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" /> Chiudi
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedTicket(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4 bg-gradient-to-b from-background to-muted/20">
                  <div className="space-y-3 max-w-3xl mx-auto">
                    {messages.length === 0 ? (
                      <div className="text-center text-muted-foreground py-12">
                        <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nessun messaggio. Inizia la conversazione!</p>
                      </div>
                    ) : (
                      messages.map((msg, idx) => {
                        const isOp = msg.sender_type === "operator";
                        const isAi = msg.sender_type === "ai";
                        const prev = messages[idx - 1];
                        const grouped =
                          prev &&
                          prev.sender_type === msg.sender_type &&
                          new Date(msg.created_at).getTime() -
                            new Date(prev.created_at).getTime() <
                            60_000;
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isOp ? "justify-end" : "justify-start"} ${
                              grouped ? "mt-1" : "mt-3"
                            }`}
                          >
                            <div
                              className={`flex items-end gap-2 max-w-[75%] ${
                                isOp ? "flex-row-reverse" : ""
                              }`}
                            >
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                  grouped ? "invisible" : ""
                                } ${
                                  isOp
                                    ? "gradient-divideit"
                                    : isAi
                                    ? "bg-purple-100"
                                    : "bg-blue-100"
                                }`}
                              >
                                {isOp ? (
                                  <Headphones className="w-4 h-4 text-white" />
                                ) : isAi ? (
                                  <Bot className="w-4 h-4 text-purple-600" />
                                ) : (
                                  <User className="w-4 h-4 text-blue-600" />
                                )}
                              </div>
                              <div
                                className={`px-4 py-2.5 rounded-2xl shadow-sm ${
                                  isOp
                                    ? "gradient-divideit text-white rounded-br-md"
                                    : isAi
                                    ? "bg-purple-50 text-foreground border border-purple-100 rounded-bl-md"
                                    : "bg-card text-foreground border rounded-bl-md"
                                }`}
                              >
                                {!grouped && !isOp && (
                                  <p className="text-[11px] font-semibold mb-0.5 opacity-70">
                                    {msg.sender_name}
                                  </p>
                                )}
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {msg.message}
                                </p>
                                <p
                                  className={`text-[10px] mt-1 ${
                                    isOp ? "text-white/70" : "text-muted-foreground"
                                  } text-right`}
                                >
                                  {formatTime(msg.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input */}
                <div className="p-4 border-t bg-card">
                  <form onSubmit={sendMessage} className="flex gap-2 items-end">
                    <Textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Scrivi una risposta...  (Invio per inviare, Shift+Invio per andare a capo)"
                      className="flex-1 min-h-[52px] max-h-[140px] rounded-xl resize-none"
                      disabled={sending || selectedTicket.status === "closed"}
                    />
                    <Button
                      type="submit"
                      className="gradient-divideit text-white rounded-xl h-[52px] px-5"
                      disabled={sending || !newMessage.trim() || selectedTicket.status === "closed"}
                    >
                      {sending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Seleziona un ticket per vedere i dettagli</p>
                </div>
              </div>
            )}
          </Card>
        </div>
        )}
      </div>

      {/* Conferma chiusura ticket */}
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Chiudere questo ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;utente riceverà il messaggio di chiusura e non potrà più rispondere in questa
              conversazione. Conferma solo se il problema è risolto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="rounded-xl">Annulla</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl" onClick={closeTicket}>
              Sì, chiudi il ticket
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conferma rimborso */}
      <AlertDialog open={confirmRefund} onOpenChange={setConfirmRefund}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Approvare il rimborso?</AlertDialogTitle>
            <AlertDialogDescription>
              Il rimborso verrà inviato a {selectedTicket?.user_email} e l&apos;utente sarà rimosso
              dal gruppo. L&apos;operazione non è reversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="rounded-xl">Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={approveRefund}
            >
              Approva rimborso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {delAction === "approve"
                ? "Approvare l'eliminazione dell'account?"
                : "Respingere la richiesta?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {delAction === "approve" ? (
                <>
                  L'account di <strong>{delTarget?.user_email}</strong> verrà chiuso e l'accesso
                  disattivato. I dati non vengono cancellati subito: restano conservati per il
                  periodo previsto dalla legge e poi vengono eliminati definitivamente.
                </>
              ) : (
                <>La richiesta di {delTarget?.user_email} verrà respinta e l'utente riceverà una notifica.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={delNote}
            onChange={(e) => setDelNote(e.target.value)}
            placeholder="Nota per l'utente (facoltativa)"
            className="rounded-xl"
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Annulla</AlertDialogCancel>
            <AlertDialogAction
              className={
                delAction === "approve"
                  ? "rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "rounded-xl"
              }
              onClick={(e) => {
                e.preventDefault();
                void handleDeletionDecision(delAction === "approve");
              }}
            >
              {delAction === "approve" ? "Approva ed elimina" : "Respingi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
}
