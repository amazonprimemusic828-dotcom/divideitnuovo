import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Bell, BellRing, CalendarDays, Check, CheckCheck, ChevronRight, MessageSquare, Settings2, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/lib/utils";

export interface NotificationSummary {
  id: string;
  title: string;
  content: string;
  type: string;
  read: boolean;
  time: string;
  dateGroup?: string;
  link?: string | null;
}

export default function NotificationCenter({ notifications, onRead, onReadAll, onOpen }: { notifications: NotificationSummary[]; onRead: (id: string) => void; onReadAll: () => void; onOpen: (notification: NotificationSummary) => void }) {
  const [filter, setFilter] = useState("all");
  const reduce = useReducedMotion();
  const unread = notifications.filter((notification) => !notification.read).length;
  const visible = notifications.filter((notification) => filter === "all" || (filter === "unread" ? !notification.read : filter === "payments" ? notification.type === "payment" || notification.type === "renewal" : notification.type === "member_joined" || notification.type === "message"));
  const dateGroups = [...new Set(visible.map((notification) => notification.dateGroup || "Aggiornamenti recenti"))];
  const iconFor = (type: string) => ({ payment: ArrowDownLeft, message: MessageSquare, member_joined: UsersRound, renewal: CalendarDays, milestone: Sparkles, account: ShieldCheck }[type] || Bell);
  return (
    <div className="studio-page">
      <PageHeader title="Tutto quello che conta." description={unread ? `Hai ${unread} nuovi aggiornamenti. Ti aiutiamo a non perdere niente.` : "Sei al passo con tutto. Ti avvisiamo noi quando c’è qualcosa di nuovo."} action={<Button variant="outline" onClick={onReadAll} disabled={!unread}><CheckCheck data-icon="inline-start" />Segna tutte come lette</Button>} />
      <div className="notification-layout">
        <div className="min-w-0">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="studio-tabs notification-tabs"><TabsTrigger value="all">Tutte<Badge variant="secondary" className="ml-2">{notifications.length}</Badge></TabsTrigger><TabsTrigger value="unread">Non lette{unread > 0 && <span className="ml-2 size-1.5 rounded-full bg-primary" />}</TabsTrigger><TabsTrigger value="payments">Pagamenti</TabsTrigger><TabsTrigger value="groups">Gruppi</TabsTrigger></TabsList>
            {["all", "unread", "payments", "groups"].map((tab) => <TabsContent value={tab} key={tab} className="pt-3">
              {!visible.length ? <Card><Empty><EmptyHeader><EmptyMedia variant="icon"><CheckCheck /></EmptyMedia><EmptyTitle>Tutto letto. Mente libera.</EmptyTitle><EmptyDescription>Non ci sono aggiornamenti in questa sezione. Goditi le tue passioni, al resto pensiamo insieme.</EmptyDescription></EmptyHeader></Empty></Card> : dateGroups.map((dateGroup) => <section className="notification-date-group" key={dateGroup}><h2 className="notification-date-label">{dateGroup}</h2><Card className="overflow-hidden shadow-none">{visible.filter((notification) => (notification.dateGroup || "Aggiornamenti recenti") === dateGroup).map((notification, index) => { const Icon = iconFor(notification.type); return <motion.div layout={!reduce} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: index * 0.035 }} key={notification.id} className={cn("notification-row", !notification.read && "notification-unread")}><span className={cn("notification-icon", notification.type === "payment" && "positive")}><Icon className="size-5" /></span><button className="min-w-0 flex-1 text-left" onClick={() => onOpen(notification)}><span className="flex items-start justify-between gap-4"><span className="text-sm font-semibold leading-relaxed">{notification.title}</span><span className="shrink-0 text-sm font-normal text-muted-foreground">{notification.time}</span></span><span className="block pt-1.5 text-sm leading-relaxed text-muted-foreground">{notification.content}</span></button><div className="flex flex-col items-center gap-2">{!notification.read ? <Button variant="ghost" size="icon" aria-label={`Segna come letta: ${notification.title}`} onClick={() => onRead(notification.id)}><Check /></Button> : <ChevronRight className="size-4 text-muted-foreground" />}</div></motion.div>; })}</Card></section>)}
            </TabsContent>)}
          </Tabs>
        </div>
        <aside className="notification-aside"><Card className="notification-summary"><CardHeader><span className="notification-summary-icon"><BellRing className="size-6" /></span><CardTitle>Le novità, a modo tuo.</CardTitle><CardDescription>Solo gli aggiornamenti che ti interessano, dove preferisci riceverli.</CardDescription></CardHeader><CardContent><div className="flex flex-col gap-4"><div className="flex items-center justify-between text-sm"><span>Nuovi messaggi</span><Check className="size-4 text-mint" /></div><div className="flex items-center justify-between text-sm"><span>Scadenze e pagamenti</span><Check className="size-4 text-mint" /></div><div className="flex items-center justify-between text-sm"><span>Aggiornamenti dei gruppi</span><Check className="size-4 text-mint" /></div><Button variant="outline" asChild><Link to="/Settings?tab=notifications"><Settings2 data-icon="inline-start" />Gestisci preferenze</Link></Button></div></CardContent></Card><div className="notification-tip"><ShieldCheck className="size-5 shrink-0 text-muted-foreground" /><p className="text-sm leading-relaxed text-muted-foreground">Non ti chiederemo mai la password in un messaggio. Hai un dubbio? <Link to="/Support" className="font-medium text-primary">Siamo qui per te.<ArrowUpRight className="inline size-3.5" /></Link></p></div></aside>
      </div>
    </div>
  );
}
