import React from "react";
import { Users, Crown, CalendarClock, Check, Clock } from "lucide-react";
import { SERVICE_COLORS } from "@/lib/serviceConstants";
import ServiceLogo from "@/components/ServiceLogo";
import { StatusPill } from "@/components/shared";

interface Group {
  id: string;
  service_name: string;
  service_type: string;
  plan_type?: string;
  total_cost: number;
  max_members: number;
  billing_date: number;
  status: string;
  member_count?: number;
}

interface Membership {
  id: string;
  role: string;
  payment_status: string;
}

interface GroupCardProps {
  group: Group;
  membership?: Membership;
  /** manage: gruppi che gestisci. member: gruppi a cui partecipi. */
  variant?: "manage" | "member";
  onClick: () => void;
}

/** Prossima data di addebito a partire dal giorno di fatturazione. */
function nextChargeLabel(billingDay: number): string {
  if (!billingDay || billingDay < 1 || billingDay > 31) return "—";
  const today = new Date();
  const day = today.getDate();
  const target = new Date(today.getFullYear(), today.getMonth() + (day >= billingDay ? 1 : 0), 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(billingDay, lastDay));
  return target.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export default function GroupCard({ group, membership, variant = "member", onClick }: GroupCardProps) {
  const isAdmin = variant === "manage" || membership?.role === "admin";
  const quota = group.total_cost / Math.max(group.max_members, 1);
  const members = group.member_count ?? group.max_members;
  const filled = Math.min(Math.round((members / Math.max(group.max_members, 1)) * 100), 100);
  const color =
    SERVICE_COLORS[group.service_type] || "linear-gradient(135deg, #5B6FBD 0%, #7DD3C0 100%)";
  const paid = membership?.payment_status === "paid";

  return (
    <button
      type="button"
      onClick={onClick}
      className="panel group w-full overflow-hidden p-0 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary/35"
    >
      <div className="flex items-start gap-4 p-5">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl p-2.5 shadow-soft"
          style={{ background: color }}
        >
          <ServiceLogo name={group.service_type} size={28} className="h-7 w-7" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-display text-base font-bold text-foreground">
              {group.service_name}
            </h3>
            {isAdmin && (
              <StatusPill tone="brand" icon={Crown} className="shrink-0">
                Admin
              </StatusPill>
            )}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {group.plan_type || "Piano condiviso"}
          </p>
        </div>
      </div>

      <div className="px-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              La tua quota
            </p>
            <p className="tnum mt-1 font-display text-2xl font-extrabold tracking-[-0.03em] text-foreground">
              €{quota.toFixed(2)}
              <span className="ml-1 text-xs font-semibold text-muted-foreground">/mese</span>
            </p>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Posti
            </p>
            <p className="tnum mt-1 flex items-center justify-end gap-1.5 text-sm font-bold text-foreground">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {members}/{group.max_members}
            </p>
          </div>
        </div>

        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-primary/70 transition-all"
            style={{ width: `${filled}%` }}
          />
        </div>
      </div>

      <div className="mt-5 hairline" />

      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          {variant === "manage" ? "Rinnovo" : "Prossimo addebito"} {nextChargeLabel(group.billing_date)}
        </span>

        {membership && (
          <StatusPill tone={paid ? "positive" : "warning"} icon={paid ? Check : Clock}>
            {paid ? "Pagato" : "In sospeso"}
          </StatusPill>
        )}
      </div>
    </button>
  );
}
