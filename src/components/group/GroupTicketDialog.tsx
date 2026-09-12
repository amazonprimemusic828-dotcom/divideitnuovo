import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { sendMessage } from "@/lib/supabaseChatClient";
import { notifyByEmail } from "@/lib/notifyEmail";
import { useAuth } from "@/components/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Banknote, LifeBuoy } from "lucide-react";

export type TicketKind = "problem" | "refund" | "help";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: TicketKind;
  groupId: string;
  groupName: string;
  groupAdminEmail: string;
  membershipId?: string | null;
}

const KIND_CONFIG: Record<TicketKind, {
  title: string;
  description: string;
  placeholder: string;
  buttonLabel: string;
  Icon: any;
  category: string;
  priority: string;
  postsChatMessage: boolean;
  messageType?: string;
  chatPrefix?: (name: string) => string;
}> = {
  problem: {
    title: "Segnala un problema",
    description: "Apri un ticket all'assistenza per problemi tecnici, di accesso o di pagamento legati a questo gruppo. La segnalazione verrà mostrata anche nella chat del gruppo.",
    placeholder: "Descrivi il problema in modo dettagliato…",
    buttonLabel: "Invia segnalazione",
    Icon: AlertTriangle,
    category: "group_problem",
    priority: "medium",
    postsChatMessage: true,
    messageType: "problem_report",
    chatPrefix: (name) => `${name} ha segnalato un problema al gruppo.`,
  },
  refund: {
    title: "Richiedi rimborso",
    description: "Il rimborso verrà accreditato sul tuo Wallet DivideIt (non sulla carta). Potrai riutilizzarlo subito per iscriverti ad altri gruppi. Il credito non è prelevabile su IBAN.",
    placeholder: "Spiega il motivo del rimborso (servizio non funzionante, addebito errato, ecc.)…",
    buttonLabel: "Invia richiesta rimborso",
    Icon: Banknote,
    category: "refund",
    priority: "high",
    postsChatMessage: true,
    messageType: "refund_request",
    chatPrefix: (name) => `${name} ha richiesto un rimborso sul Wallet.`,
  },
  help: {
    title: "Chiedi aiuto all'admin",
    description: "Invia una richiesta di aiuto visibile in chat. L'admin del gruppo verrà notificato.",
    placeholder: "Spiega di cosa hai bisogno…",
    buttonLabel: "Invia richiesta di aiuto",
    Icon: LifeBuoy,
    category: "group_help",
    priority: "medium",
    postsChatMessage: true,
    messageType: "help_request",
    chatPrefix: (name) => `${name} ha chiesto aiuto all'admin.`,
  },
};

export default function GroupTicketDialog({
  open, onOpenChange, kind, groupId, groupName, groupAdminEmail, membershipId,
}: Props) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const cfg = KIND_CONFIG[kind];

  const submit = async () => {
    if (!user?.uid || !user?.email) { toast.error("Devi essere autenticato"); return; }
    if (!text.trim()) { toast.error("Descrivi la richiesta"); return; }
    setSending(true);
    try {
      const subject =
        kind === "refund" ? `[Rimborso] ${groupName}` :
        kind === "help"   ? `[Aiuto] ${groupName}` :
                            `[Problema] ${groupName}`;

      const senderName = user.full_name || user.email.split("@")[0];

      // 1. Insert ticket
      const { data: ticket, error: tErr } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user.uid,
          user_email: user.email,
          user_name: senderName,
          subject,
          description: text.trim(),
          category: cfg.category,
          priority: cfg.priority,
          status: "open",
          ticket_type: kind,
          group_id: groupId,
          group_admin_email: groupAdminEmail,
          membership_id: membershipId || null,
        })
        .select()
        .single();
      if (tErr) throw tErr;

      // 2. First message inside ticket
      await supabase.from("support_messages").insert({
        ticket_id: ticket.id,
        sender_id: user.uid,
        sender_name: senderName,
        sender_type: "user",
        message: text.trim(),
      });

      // 3. Email all'admin del gruppo (una sola per ticket)
      notifyByEmail({ type: "ticket", ticket_id: ticket.id });

      // 4. Post highlighted message in group chat for refund/help
      if (cfg.postsChatMessage && cfg.messageType && cfg.chatPrefix) {
        await sendMessage({
          group_id: groupId,
          sender_uid: user.uid,
          sender_name: senderName,
          sender_avatar: user.avatar_url || null,
          message: `${cfg.chatPrefix(senderName)}\n\nMotivo: ${text.trim()}`,
          message_type: cfg.messageType,
        });
      }

      toast.success(
        kind === "refund" ? "Richiesta di rimborso inviata"
        : kind === "help"   ? "Richiesta di aiuto inviata"
        :                     "Segnalazione inviata"
      );
      setText("");
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || "";
      if (msg.includes("ogni 24 ore")) {
        toast.error(msg);
      } else {
        toast.error(msg || "Errore nell'invio");
      }
    } finally {
      setSending(false);
    }
  };

  const Icon = cfg.Icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-primary" />
            {cfg.title}
          </DialogTitle>
          <DialogDescription>{cfg.description}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={cfg.placeholder}
          rows={5}
          className="rounded-xl"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Annulla
          </Button>
          <Button onClick={submit} disabled={sending || !text.trim()} className="gradient-divideit text-white">
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {cfg.buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
