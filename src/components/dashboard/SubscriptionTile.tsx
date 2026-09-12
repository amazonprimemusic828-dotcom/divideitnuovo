import { ArrowUpRight, CalendarDays, Check, Crown, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import ServiceLogo from "@/components/ServiceLogo";
import UserAvatar from "@/components/UserAvatar";
import { cn } from "@/lib/utils";

export interface SubscriptionSummary {
  id: string;
  service: string;
  name: string;
  plan: string;
  category?: string;
  total: number;
  capacity: number;
  members: number;
  role: "admin" | "member";
  paid: boolean;
  renewal?: string;
  owner?: string;
  avatars?: string[];
}

export const euro = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);

export function MemberAvatars({ names = [], count }: { names?: string[]; count?: number }) {
  return (
    <div className="member-avatars" aria-label={count ? `${count} membri` : "Membri del gruppo"}>
      {names.slice(0, 4).map((name) => <UserAvatar key={name} userEmail="" userName={name} avatarUrl={`/avatars/premium/${name}.png`} size="xs" />)}
      {count && count > 4 ? <span className="member-overflow">+{count - 4}</span> : null}
    </div>
  );
}

export default function SubscriptionTile({ group, explore = false }: { group: SubscriptionSummary; explore?: boolean }) {
  const quota = group.total / Math.max(group.capacity, 1);
  const available = group.capacity - group.members;
  return (
    <Link to={`/GroupDetail?id=${encodeURIComponent(group.id)}`} className="group block h-full rounded-2xl focus-visible:ring-2 focus-visible:ring-primary" aria-label={`${group.name}, ${euro(quota)} al mese, apri gruppo`}>
      <Card className="subscription-tile h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <span className="service-tile"><ServiceLogo name={group.service} size={34} /></span>
            {explore ? <Badge variant="secondary">{Math.max(available, 0)} posti</Badge> : group.role === "admin" ? <Badge variant="secondary"><Crown className="size-3.5" /> Admin</Badge> : <ArrowUpRight className="size-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />}
          </div>
          <div className="pt-4"><CardTitle>{group.name}</CardTitle><CardDescription className="pt-1">{group.plan}</CardDescription></div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-1.5"><span className="font-display text-[28px] font-bold tracking-tight tabular-nums">{euro(quota)}</span><span className="text-sm text-muted-foreground">/ mese</span></div>
          <div className="flex items-center justify-between pt-5">
            {group.avatars?.length ? <MemberAvatars names={group.avatars} count={group.members} /> : <Users className="size-5 text-muted-foreground" />}
            <span className="text-sm text-muted-foreground">{group.members}/{group.capacity} membri</span>
          </div>
        </CardContent>
        <Separator />
        <CardFooter className="justify-between pb-4 pt-4">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><CalendarDays className="size-4" />{group.renewal || "Mensile"}</span>
          <span className={cn("flex items-center gap-1 text-sm font-medium", group.paid ? "text-mint" : "text-muted-foreground")}><Check className="size-3.5" />{explore ? "Scopri" : group.paid ? "In regola" : "Da saldare"}</span>
        </CardFooter>
      </Card>
    </Link>
  );
}
