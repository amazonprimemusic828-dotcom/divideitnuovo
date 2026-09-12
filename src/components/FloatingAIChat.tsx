import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, Bot, User, Headphones, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthContext";
import aiChatLogo from "@/assets/ai-chat-logo.png";

interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "operator";
  content: string;
  timestamp: Date;
}


// AI Gemini edge function endpoint (uses project edge functions)
const CHAT_URL = `${SUPABASE_URL}/functions/v1/ai-support`;
const AI_FUNCTION_KEY = SUPABASE_PUBLISHABLE_KEY;

// Strip markdown formatting (bold, italic) for cleaner display
const stripMarkdown = (text: string): string => {
  return text
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')  // ***bold italic***
    .replace(/\*\*(.*?)\*\*/g, '$1')       // **bold**
    .replace(/\*(.*?)\*/g, '$1')           // *italic*
    .replace(/__(.*?)__/g, '$1')           // __underline__
    .replace(/^#{1,6}\s+/gm, '')           // # headers
    .replace(/`([^`]+)`/g, '$1');          // `code`
};

export default function FloatingAIChat() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: "welcome",
      role: "assistant", 
      content: "Ciao! 👋 Sono l'assistente AI di DIVIDEIT. Posso aiutarti con:\n\n• Come funziona DIVIDEIT\n• Problemi con pagamenti\n• Gestione gruppi\n• Domande su abbonamenti\n\nCome posso aiutarti oggi?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showOperatorOption, setShowOperatorOption] = useState(false);
  const [currentTicketId, setCurrentTicketId] = useState<string | null>(null);
  const [isConnectedToOperator, setIsConnectedToOperator] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Listen for operator messages and ticket status in real-time
  useEffect(() => {
    if (!currentTicketId) return;

    const channel = supabase
      .channel(`ticket-${currentTicketId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `ticket_id=eq.${currentTicketId}`
      }, (payload) => {
        const newMsg = payload.new as { sender_type: string; message: string; sender_name: string; id: string };
        if (newMsg.sender_type === 'operator') {
          setMessages(prev => [...prev, {
            id: newMsg.id,
            role: "operator",
            content: newMsg.message,
            timestamp: new Date()
          }]);
          // Play notification sound or vibrate
          if ('vibrate' in navigator) {
            navigator.vibrate(100);
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'support_tickets',
        filter: `id=eq.${currentTicketId}`
      }, (payload) => {
        const updated = payload.new as { status: string };
        if (updated.status === 'closed') {
          // Ticket was closed by operator
          setMessages(prev => [...prev, {
            id: `system-closed-${Date.now()}`,
            role: "system",
            content: "✅ Il ticket è stato chiuso dall'operatore. Grazie per averci contattato!\n\nSe hai altre domande, sono qui per aiutarti.",
            timestamp: new Date()
          }]);
          setIsConnectedToOperator(false);
          setCurrentTicketId(null);
          setShowOperatorOption(false);
          toast.success("Ticket risolto!", { description: "L'operatore ha chiuso la conversazione" });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTicketId]);

  const streamChat = async (userMessages: { role: string; content: string }[]) => {
    // Auth: the edge function requires the logged-in user's JWT
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      throw new Error("Devi effettuare l'accesso per usare l'assistente AI");
    }

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: AI_FUNCTION_KEY,
      },
      body: JSON.stringify({ messages: userMessages }),
    });

    if (!resp.ok) {
      const error = await resp.json().catch(() => ({}));
      throw new Error(error.error || "Errore nella risposta AI");
    }

    if (!resp.body) throw new Error("No response body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let fullContent = "";

    const assistantId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date()
    }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            fullContent += content;
            const cleanContent = stripMarkdown(fullContent);
            setMessages(prev => 
              prev.map(m => m.id === assistantId ? { ...m, content: cleanContent } : m)
            );
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Check if AI suggests operator
    if (fullContent.toLowerCase().includes("operatore") || 
        fullContent.toLowerCase().includes("contatta") ||
        fullContent.toLowerCase().includes("supporto umano")) {
      setShowOperatorOption(true);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = input.trim();
    setInput("");
    setIsLoading(true);

    // If connected to operator, send to ticket
    if (isConnectedToOperator && currentTicketId) {
      try {
        await supabase.from('support_messages').insert({
          ticket_id: currentTicketId,
          sender_id: user?.uid || 'anonymous',
          sender_name: user?.full_name || 'Utente',
          sender_type: 'user',
          message: messageText
        });
      } catch (err) {
        console.error("Error sending to operator:", err);
        toast.error("Errore nell'invio messaggio");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Otherwise, use AI
    try {
      const chatHistory = messages
        .filter(m => m.role !== "system" && m.role !== "operator")
        .map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
      
      chatHistory.push({ role: "user", content: messageText });

      await streamChat(chatHistory);
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Errore nella chat. Riprova.");
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Mi dispiace, ho avuto un problema tecnico. 😔 Vuoi provare di nuovo o parlare con un operatore?",
        timestamp: new Date()
      }]);
      setShowOperatorOption(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOperatorRequest = async () => {
    setIsLoading(true);
    
    try {
      // Create a real support ticket
      const chatSummary = messages
        .filter(m => m.role !== "system")
        .map(m => `${m.role === "user" ? "Utente" : "AI"}: ${m.content}`)
        .join("\n\n");

      // Generate a unique user identifier for anonymous users
      const uniqueUserId = user?.uid || `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const userEmail = user?.email || `guest_${Date.now()}@divideit.app`;
      const userName = user?.full_name || 'Ospite';

      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: uniqueUserId,
          user_email: userEmail,
          user_name: userName,
          subject: 'Richiesta supporto operatore',
          category: 'general',
          description: chatSummary.slice(0, 500),
          status: 'waiting_operator',
          priority: 'high',
          ai_attempted: true,
          ai_resolution: chatSummary.slice(0, 1000)
        })
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        throw error;
      }

      setCurrentTicketId(ticket.id);
      setIsConnectedToOperator(true);
      setShowOperatorOption(false);

      // Add system message about operator connection
      setMessages(prev => [...prev, {
        id: `system-${Date.now()}`,
        role: "system",
        content: "🎧 Ticket creato! Un operatore ti risponderà a breve.\n\nPuoi continuare a scrivere qui - il tuo messaggio arriverà direttamente all'operatore.",
        timestamp: new Date()
      }]);

      // Add initial message to ticket
      await supabase.from('support_messages').insert({
        ticket_id: ticket.id,
        sender_id: uniqueUserId,
        sender_name: userName,
        sender_type: 'system',
        message: `Conversazione AI precedente:\n\n${chatSummary.slice(0, 2000)}`
      });

      toast.success("Richiesta operatore inviata!", {
        description: "Ti risponderemo il prima possibile"
      });

    } catch (err) {
      console.error("Error creating ticket:", err);
      toast.error("Errore nella creazione del ticket");
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: "system",
        content: "❌ Errore nella creazione del ticket. Riprova tra poco.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6.25rem)' }}
        className="fixed right-4 w-14 h-14 lg:!bottom-6 lg:right-6 lg:w-16 lg:h-16 rounded-full shadow-2xl flex items-center justify-center z-40 group overflow-hidden"
      >
        <div className="absolute inset-0 gradient-divideit opacity-90" />
        <div className="absolute inset-0 rounded-full gradient-divideit opacity-50 blur-lg group-hover:blur-xl transition-all" />
        <img 
          src={aiChatLogo} 
          alt="AI Chat" 
          className="relative w-12 h-12 object-contain rounded-full"
        />
        {isConnectedToOperator && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
        )}
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6.25rem)' }}
        className="fixed right-2 left-2 sm:left-auto sm:right-4 lg:!bottom-6 lg:right-6 z-40"
      >
        <Card className="w-full sm:w-[400px] max-w-[400px] mx-auto h-[70vh] max-h-[600px] sm:h-[600px] bg-card rounded-3xl shadow-2xl overflow-hidden flex flex-col border-0">
          {/* Header */}
          <div className={`${isConnectedToOperator ? 'bg-green-600' : 'gradient-divideit'} text-white p-4 flex items-center justify-between transition-colors`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                {isConnectedToOperator ? (
                  <Headphones className="w-5 h-5" />
                ) : (
                  <img src={aiChatLogo} alt="AI" className="w-8 h-8 object-contain" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-sm">
                  {isConnectedToOperator ? 'Chat con Operatore' : 'Assistente DIVIDEIT'}
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-white/80">
                    {isConnectedToOperator ? 'Connesso' : 'Online'}
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`flex items-end gap-2 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    {msg.role !== "user" && (
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
                        msg.role === "system" ? "bg-amber-100" : 
                        msg.role === "operator" ? "bg-green-500" : 
                        "gradient-divideit"
                      }`}>
                        {msg.role === "system" ? (
                          <MessageSquare className="w-4 h-4 text-amber-600" />
                        ) : msg.role === "operator" ? (
                          <Headphones className="w-4 h-4 text-white" />
                        ) : (
                          <img src={aiChatLogo} alt="AI" className="w-6 h-6 object-contain" />
                        )}
                      </div>
                    )}
                    <div className={`px-4 py-3 rounded-2xl ${
                      msg.role === "user" 
                        ? "gradient-divideit text-white rounded-br-sm"
                        : msg.role === "system"
                        ? "bg-amber-50 text-amber-900 border border-amber-200 rounded-bl-sm"
                        : msg.role === "operator"
                        ? "bg-green-50 text-green-900 border border-green-200 rounded-bl-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2"
                >
                  <div className="w-7 h-7 rounded-full gradient-divideit flex items-center justify-center overflow-hidden">
                    {isConnectedToOperator ? (
                      <Headphones className="w-4 h-4 text-white" />
                    ) : (
                      <img src={aiChatLogo} alt="AI" className="w-6 h-6 object-contain" />
                    )}
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-muted rounded-bl-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {isConnectedToOperator ? 'Invio in corso...' : 'Sto scrivendo...'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Operator CTA */}
          <AnimatePresence>
            {showOperatorOption && !isConnectedToOperator && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 pb-2"
              >
                <Button
                  variant="outline"
                  onClick={handleOperatorRequest}
                  disabled={isLoading}
                  className="w-full rounded-xl border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800"
                >
                  <Headphones className="w-4 h-4 mr-2" />
                  Parla con un operatore
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <form onSubmit={handleSend} className="p-4 border-t bg-card">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isConnectedToOperator ? "Scrivi all'operatore..." : "Scrivi un messaggio..."}
                disabled={isLoading}
                className="flex-1 rounded-xl border-2 focus-visible:ring-primary h-11"
              />
              <Button 
                type="submit" 
                size="icon" 
                disabled={isLoading || !input.trim()}
                className={`h-11 w-11 rounded-xl shrink-0 ${isConnectedToOperator ? 'bg-green-600 hover:bg-green-700' : 'gradient-divideit'}`}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              {isConnectedToOperator ? '🟢 Connesso con operatore DIVIDEIT' : 'AI assistant • Powered by DIVIDEIT'}
            </p>
          </form>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
