import type { SubscriptionSummary } from "@/components/dashboard/SubscriptionTile";
import type { NotificationSummary } from "@/components/notifications/NotificationCenter";
import type { ConversationSummary } from "@/components/messages/Inbox";

// These presentation fixtures never represent an authenticated user or a server record.
export const previewProfile = {
  name: "Luca Rossi",
  email: "luca.rossi@example.com",
  phone: "+39 333 123 4567",
  avatar: "/avatars/premium/luca.png",
};

export const previewGroups: SubscriptionSummary[] = [
  { id: "preview-netflix", service: "Netflix", name: "Netflix Premium", plan: "Film e serie TV · 4K UHD", category: "Video", total: 17.99, capacity: 4, members: 4, role: "admin", paid: true, renewal: "13 set", owner: "Luca", avatars: ["luca", "sofia", "andrea", "giulia"] },
  { id: "preview-spotify", service: "Spotify", name: "Spotify Family", plan: "La tua musica, senza limiti", category: "Musica", total: 21.99, capacity: 6, members: 5, role: "member", paid: true, renewal: "15 set", owner: "Sofia", avatars: ["sofia", "marco", "amina", "luca"] },
  { id: "preview-disney", service: "Disney+", name: "Disney+ Premium", plan: "Storie che ci uniscono", category: "Video", total: 13.99, capacity: 4, members: 3, role: "member", paid: true, renewal: "18 set", owner: "Andrea", avatars: ["andrea", "giulia", "luca"] },
  { id: "preview-microsoft", service: "Microsoft 365", name: "Microsoft 365", plan: "Family · 1 TB per persona", category: "Produttività", total: 9.99, capacity: 6, members: 4, role: "admin", paid: true, renewal: "22 set", owner: "Luca", avatars: ["luca", "amina", "sofia", "marco"] },
  { id: "preview-youtube", service: "YouTube Premium", name: "YouTube Premium", plan: "Video e musica, senza pubblicità", category: "Video", total: 25.99, capacity: 6, members: 4, role: "member", paid: false, renewal: "24 set", owner: "Giulia", avatars: ["giulia", "sofia", "marco"] },
  { id: "preview-nintendo", service: "Nintendo Switch Online", name: "Nintendo Switch", plan: "Online · Piano famiglia", category: "Gaming", total: 5.83, capacity: 8, members: 5, role: "member", paid: true, renewal: "28 set", owner: "Marco", avatars: ["marco", "amina", "andrea"] },
];

export const previewNotifications: NotificationSummary[] = [
  { id: "n1", title: "La quota di Sofia è arrivata", content: "Sofia ha versato 4,50 € per Netflix Premium. Tutto in regola, buona visione!", type: "payment", read: false, time: "10 min fa", dateGroup: "Oggi", link: "/Wallet" },
  { id: "n2", title: "Un nuovo messaggio ti aspetta", content: "Andrea ha scritto nel gruppo Disney+ Premium: «Perfetto, grazie a tutti!»", type: "message", read: false, time: "35 min fa", dateGroup: "Oggi", link: "/Messages?group=preview-disney" },
  { id: "n3", title: "Benvenuta nel gruppo, Giulia", content: "Giulia si è unita al tuo gruppo Microsoft 365. Condividere è ancora più bello.", type: "member_joined", read: false, time: "2 ore fa", dateGroup: "Oggi", link: "/GroupDetail?id=preview-microsoft" },
  { id: "n4", title: "Il prossimo rinnovo è vicino", content: "Netflix Premium si rinnova il 13 settembre. La tua quota è di 4,50 €.", type: "renewal", read: true, time: "18:42", dateGroup: "Ieri", link: "/GroupDetail?id=preview-netflix" },
  { id: "n5", title: "Il tuo mese, un po’ più leggero", content: "Hai risparmiato 50,63 € questo mese condividendo i tuoi abbonamenti. Continua così!", type: "milestone", read: true, time: "09:15", dateGroup: "Ieri", link: "/Dashboard" },
  { id: "n6", title: "Profilo aggiornato", content: "Il tuo nuovo avatar è pronto. Un piccolo dettaglio che parla di te.", type: "account", read: true, time: "6 set", dateGroup: "Questa settimana", link: "/Settings" },
];

export const previewConversations: ConversationSummary[] = [
  { id: "preview-netflix", name: "Netflix Premium", service: "Netflix", members: 4, lastMessage: "Sofia: Tutto perfetto, grazie!", time: "10:42", unread: 2 },
  { id: "preview-spotify", name: "Spotify Family", service: "Spotify", members: 5, lastMessage: "Marco: Ho appena inviato la quota.", time: "09:18", unread: 1 },
  { id: "preview-disney", name: "Disney+ Premium", service: "Disney+", members: 3, lastMessage: "Andrea: Perfetto, grazie a tutti!", time: "Ieri", unread: 0 },
  { id: "preview-microsoft", name: "Microsoft 365", service: "Microsoft 365", members: 4, lastMessage: "Tu: Benvenuta nel gruppo, Giulia!", time: "Ieri", unread: 0 },
];

export const previewTransactions = [
  { id: "tx1", name: "Quota da Sofia", detail: "Netflix Premium", service: "Netflix", amount: 4.5, date: "7 set 2026", dateValue: "2026-09-07", type: "income" as const, status: "Completato" },
  { id: "tx2", name: "Rinnovo abbonamento", detail: "Spotify Family", service: "Spotify", amount: -3.67, date: "5 set 2026", dateValue: "2026-09-05", type: "expense" as const, status: "Completato" },
  { id: "tx3", name: "Quota da Andrea", detail: "Netflix Premium", service: "Netflix", amount: 4.5, date: "4 set 2026", dateValue: "2026-09-04", type: "income" as const, status: "Completato" },
  { id: "tx4", name: "Quota da Amina", detail: "Microsoft 365", service: "Microsoft 365", amount: 1.67, date: "3 set 2026", dateValue: "2026-09-03", type: "income" as const, status: "Completato" },
  { id: "tx5", name: "Rinnovo abbonamento", detail: "Disney+ Premium", service: "Disney+", amount: -3.5, date: "1 set 2026", dateValue: "2026-09-01", type: "expense" as const, status: "Completato" },
  { id: "tx6", name: "Prelievo sul conto", detail: "Bonifico bancario", service: "", amount: -20, date: "28 ago 2026", dateValue: "2026-08-28", type: "expense" as const, status: "Completato" },
];
