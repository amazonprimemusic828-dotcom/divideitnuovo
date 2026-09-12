import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, CheckCheck, Info, MessageSquare, Paperclip, Search, Send, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { PageHeader } from "@/components/shared/PageHeader";
import ChatMessage from "@/components/chat/ChatMessage";
import ServiceLogo from "@/components/ServiceLogo";
import UserAvatar from "@/components/UserAvatar";
import { cn } from "@/lib/utils";

export interface ConversationSummary { id: string; name: string; service: string; members?: number; lastMessage: string; time: string; unread: number }
export interface PreviewMessage { id: string; group_id: string; sender_email: string; sender_name: string; sender_avatar?: string; message: string; created_at: string; read_by: string[]; user_id?: string }
const openingMessages: Record<string, PreviewMessage[]> = {
  "preview-netflix": [
    { id: "m1", group_id: "preview-netflix", sender_email: "sofia@example.com", sender_name: "Sofia", sender_avatar: "/avatars/premium/sofia.png", message: "Ciao a tutti! Ho appena inviato la mia quota per questo mese.", created_at: "2026-09-07T10:32:00", read_by: [] },
    { id: "m2", group_id: "preview-netflix", sender_email: "luca.rossi@example.com", sender_name: "Luca", sender_avatar: "/avatars/premium/luca.png", message: "Ciao Sofia, ricevuta! Il rinnovo è tutto a posto, buona visione a tutti.", created_at: "2026-09-07T10:35:00", read_by: ["sofia"] },
    { id: "m3", group_id: "preview-netflix", sender_email: "andrea@example.com", sender_name: "Andrea", sender_avatar: "/avatars/premium/andrea.png", message: "Perfetto! Avete qualche serie da consigliarmi per il weekend?", created_at: "2026-09-07T10:38:00", read_by: [] },
    { id: "m4", group_id: "preview-netflix", sender_email: "sofia@example.com", sender_name: "Sofia", sender_avatar: "/avatars/premium/sofia.png", message: "Io ho appena iniziato una nuova serie. Stasera vi dico com’è!", created_at: "2026-09-07T10:42:00", read_by: [] },
  ],
};

export default function Inbox({ conversations, preview = false, profile, onOpenGroup, onRead }: { conversations: ConversationSummary[]; preview?: boolean; profile?: { name: string; email: string; avatar?: string | null }; onOpenGroup?: (id: string) => void; onRead?: (id: string) => void }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get("group");
  const [selected, setSelected] = useState(requested || conversations[0]?.id || "");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Record<string, PreviewMessage[]>>(preview ? openingMessages : {});
  const [mobileChat, setMobileChat] = useState(!!requested);
  const [membersOpen, setMembersOpen] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const active = conversations.find((conversation) => conversation.id === selected);
  const visible = conversations.filter((conversation) => (filter === "all" || conversation.unread > 0) && `${conversation.name} ${conversation.lastMessage}`.toLowerCase().includes(search.toLowerCase()));
  const activeMessages = messages[selected] || [];
  useEffect(() => { if (requested && requested !== selected) setSelected(requested); }, [requested, selected]);
  const select = (id: string) => { setSelected(id); setParams({ group: id }); setMobileChat(true); setAttachment(null); setDraft(""); onRead?.(id); };
  const send = () => {
    if (!preview || (!draft.trim() && !attachment)) return;
    const text = [draft.trim(), attachment ? `[Allegato locale: ${attachment.name}]` : ""].filter(Boolean).join("\n");
    const message: PreviewMessage = { id: crypto.randomUUID(), group_id: selected, sender_email: profile?.email || "luca.rossi@example.com", sender_name: profile?.name || "Luca", sender_avatar: profile?.avatar || undefined, message: text, created_at: new Date().toISOString(), read_by: [] };
    setMessages((current) => ({ ...current, [selected]: [...(current[selected] || []), message] }));
    setDraft(""); setAttachment(null);
    toast.info("Messaggio aggiunto all’anteprima. Non è stato inviato.");
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };
  return (
    <div className="studio-page">
      <PageHeader title="Le tue persone. Le tue chat." description="Una conversazione per ogni gruppo. Nessun messaggio perso per strada." />
      <div className={cn("inbox-shell", mobileChat && "mobile-chat-open")}>
        <aside className="inbox-conversations">
          <div className="inbox-list-header"><div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Messaggi</h2><Badge variant="secondary">{conversations.length}</Badge></div><div className="pt-5"><InputGroup><InputGroupInput placeholder="Cerca una conversazione..." aria-label="Cerca una conversazione" value={search} onChange={(event) => setSearch(event.target.value)} /><InputGroupAddon><Search /></InputGroupAddon></InputGroup></div><Tabs value={filter} onValueChange={setFilter} className="pt-4"><TabsList className="studio-tabs"><TabsTrigger value="all">Tutte</TabsTrigger><TabsTrigger value="unread">Non lette</TabsTrigger></TabsList></Tabs></div>
          <ScrollArea className="min-h-0 flex-1"><div>{visible.map((conversation) => <button className={cn("conversation-row", selected === conversation.id && "is-selected")} key={conversation.id} onClick={() => select(conversation.id)} aria-pressed={selected === conversation.id}><span className="service-tile small"><ServiceLogo name={conversation.service} size={28} /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{conversation.name}</span><span className="shrink-0 text-sm text-muted-foreground">{conversation.time}</span></span><span className="flex items-center justify-between gap-2 pt-1.5"><span className="truncate text-sm text-muted-foreground">{conversation.lastMessage}</span>{conversation.unread > 0 && <span className="conversation-count">{conversation.unread}</span>}</span></span></button>)}{!visible.length && <Empty><EmptyHeader><EmptyMedia variant="icon"><Search /></EmptyMedia><EmptyTitle>Nessuna conversazione</EmptyTitle><EmptyDescription>Prova un altro nome o torna a tutte le chat.</EmptyDescription></EmptyHeader></Empty>}</div></ScrollArea>
          <div className="inbox-list-footer"><MessageSquare className="size-4" />Le connessioni belle iniziano qui.</div>
        </aside>
        <section className="inbox-chat" aria-label={active ? `Conversazione ${active.name}` : "Conversazione"}>
          {active ? <>
            <header className="inbox-chat-header"><Button variant="ghost" size="icon" aria-label="Torna alle conversazioni" className="md:hidden" onClick={() => setMobileChat(false)}><ArrowLeft /></Button><span className="service-tile small"><ServiceLogo name={active.service} size={28} /></span><div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold">{active.name}</h2><p className="text-sm text-muted-foreground">{active.members ? `${active.members} membri` : "Chat di gruppo"} · Il tuo spazio condiviso</p></div>{preview && <Button variant="ghost" size="icon" aria-label="Visualizza membri" onClick={() => setMembersOpen(true)}><UsersRound /></Button>}<Button variant="ghost" size="icon" asChild><Link to={`/GroupDetail?id=${active.id}`} aria-label="Apri dettagli gruppo"><Info /></Link></Button></header>
            {preview ? <><ScrollArea className="min-h-0 flex-1"><div className="conversation-transcript"><div className="chat-date">7 settembre 2026</div><div className="chat-system-note"><CheckCheck className="size-4" />Un gruppo, le stesse passioni.</div><div role="log" aria-live="polite" aria-relevant="additions" className="flex flex-col gap-6">{activeMessages.length ? activeMessages.map((message) => <ChatMessage key={message.id} message={message} isMe={message.sender_email === (profile?.email || "luca.rossi@example.com")} />) : <p className="text-center text-sm text-muted-foreground">{active.lastMessage}</p>}<div ref={bottomRef} /></div></div></ScrollArea><div className="chat-composer">{attachment && <div className="flex items-center justify-between pb-3 text-sm"><span className="truncate">{attachment.name}</span><Button variant="ghost" size="icon" aria-label="Rimuovi allegato" onClick={() => setAttachment(null)}><X /></Button></div>}<form onSubmit={(event) => { event.preventDefault(); send(); }}><InputGroup><InputGroupTextarea rows={1} maxLength={4000} placeholder="Scrivi qualcosa di bello..." aria-label="Il tuo messaggio" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.nativeEvent.isComposing || event.keyCode === 229) return; if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} /><InputGroupAddon align="inline-end"><Button type="button" variant="ghost" size="icon" aria-label="Allega un file solo all’anteprima" onClick={() => fileRef.current?.click()}><Paperclip /></Button><Button type="submit" size="icon" aria-label="Invia messaggio nell’anteprima" disabled={!draft.trim() && !attachment}><Send /></Button></InputGroupAddon></InputGroup><input ref={fileRef} type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file && file.size > 5 * 1024 * 1024) toast.error("Scegli un file di massimo 5 MB."); else setAttachment(file || null); event.target.value = ""; }} /></form><p className="pt-3 text-center text-sm text-muted-foreground">Anteprima: i messaggi e gli allegati restano solo in questa schermata.</p></div></> : <Empty><EmptyHeader><EmptyMedia variant="icon"><MessageSquare /></EmptyMedia><EmptyTitle>Continua la conversazione</EmptyTitle><EmptyDescription>Apri il gruppo per leggere e inviare messaggi ai suoi membri.</EmptyDescription></EmptyHeader><Button onClick={() => onOpenGroup?.(active.id)}>Apri la chat del gruppo<ArrowUpRight data-icon="inline-end" /></Button></Empty>}
          </> : <Empty><EmptyHeader><EmptyMedia variant="icon"><MessageSquare /></EmptyMedia><EmptyTitle>Ogni gruppo, una conversazione.</EmptyTitle><EmptyDescription>Seleziona una chat oppure entra in un gruppo per iniziare.</EmptyDescription></EmptyHeader><Button asChild><Link to="/BrowseGroups">Esplora i gruppi</Link></Button></Empty>}
        </section>
      </div>
      <Dialog open={membersOpen} onOpenChange={setMembersOpen}><DialogContent><DialogHeader><DialogTitle>Le persone del tuo gruppo</DialogTitle><DialogDescription>{active?.name} · Membri dimostrativi</DialogDescription></DialogHeader><div className="flex flex-col gap-5 py-3">{["luca", "sofia", "andrea", "giulia"].slice(0, active?.members || 4).map((name, index) => <div className="flex items-center gap-3" key={name}><UserAvatar userEmail="" userName={name} avatarUrl={`/avatars/premium/${name}.png`} /><span className="flex-1 capitalize">{name}</span><Badge variant="secondary">{index === 0 ? "Admin" : "Membro"}</Badge></div>)}</div></DialogContent></Dialog>
    </div>
  );
}
