import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/components/AuthContext";
import { useUserDashboard } from "@/hooks/useGroupsData";

import { Button } from "@/components/ui/button";
import { Plus, Search, TrendingDown, Users, CreditCard, Crown, Compass } from "lucide-react";
import GroupCard from "@/components/dashboard/GroupCard";
import StatsCard from "@/components/dashboard/StatsCard";
import QuickActions from "@/components/dashboard/QuickActions";
import { PageHeader, SectionCard, EmptyState, StatusPill } from "@/components/shared";

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: dashboardData, isLoading: loading } = useUserDashboard(user?.email);
  const groups = dashboardData?.groups || [];
  const memberships = dashboardData?.memberships || [];

  const totalMonthlySpending = groups.reduce((sum, g) => sum + g.total_cost / g.max_members, 0);
  const potentialSavings = groups.reduce((sum, g) => sum + (g.total_cost - g.total_cost / g.max_members), 0);

  const membershipFor = (groupId: string) => memberships.find((m) => m.group_id === groupId);
  const adminGroups = groups.filter((g) => membershipFor(g.id)?.role === "admin");
  const memberGroups = groups.filter((g) => membershipFor(g.id)?.role !== "admin");

  const pendingCount = memberGroups.filter(
    (g) => membershipFor(g.id)?.payment_status !== "paid",
  ).length;

  if (loading) {
    return (
      <div className="p-4 lg:p-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="skeleton h-40 w-full" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-28" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-24" />
            ))}
          </div>
          <div className="skeleton h-72 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-24 lg:p-10 lg:pb-10">
      <div className="mx-auto max-w-7xl space-y-6 lg:space-y-8">
        <PageHeader
          eyebrow={`Ciao, ${user?.full_name?.split(" ")[0] || "utente"}`}
          title="I tuoi gruppi in un colpo d'occhio"
          description="Quote, membri e scadenze: tutto quello che gestisci e tutto quello a cui partecipi."
          action={
            <>
              <Button
                onClick={() => navigate("/BrowseGroups")}
                variant="outline"
                className="h-11 rounded-full border-border bg-surface-elevated px-5"
              >
                <Search className="mr-2 h-4 w-4" />
                {t("explore")}
              </Button>
              <Button
                onClick={() => navigate("/CreateGroup")}
                className="btn-lift h-11 rounded-full bg-primary px-5 font-semibold text-primary-foreground shadow-[0_14px_28px_-18px_hsl(var(--primary)/0.8)] hover:bg-primary/90"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("createGroup")}
              </Button>
            </>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:gap-6 [&>*:nth-child(3)]:col-span-2 md:[&>*:nth-child(3)]:col-span-1">
          <StatsCard
            title={t("activeGroups")}
            value={groups.length}
            icon={Users}
            color="blue"
            hint={groups.length === 1 ? "1 gruppo attivo" : `${groups.length} gruppi attivi`}
          />
          <StatsCard
            title={t("monthlySpending")}
            value={`€${totalMonthlySpending.toFixed(2)}`}
            icon={CreditCard}
            color="purple"
            hint="al mese"
          />
          <StatsCard
            title={t("savings")}
            value={`€${potentialSavings.toFixed(2)}`}
            icon={TrendingDown}
            color="green"
            hint={`€${(potentialSavings * 12).toFixed(0)} l'anno`}
          />
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="eyebrow mb-4">Azioni rapide</h2>
          <QuickActions />
        </div>

        {/* Gruppi che gestisci */}
        <SectionCard
          title="Gruppi che gestisci"
          meta={<StatusPill tone="brand">{adminGroups.length}</StatusPill>}
          description="Sei tu l'amministratore: incassi, posti e credenziali"
          icon={Crown}
          flush={adminGroups.length === 0}
          action={
            adminGroups.length > 0 ? (
              <button
                onClick={() => navigate("/CreateGroup")}
                className="link-underline text-sm font-semibold text-primary"
              >
                Nuovo gruppo
              </button>
            ) : undefined
          }
        >
          {adminGroups.length === 0 ? (
            <EmptyState
              icon={Crown}
              title="Non gestisci ancora nessun gruppo"
              description="Crea un gruppo, imposta la quota e invita chi vuoi: incassi in automatico ogni mese."
              action={
                <Button
                  onClick={() => navigate("/CreateGroup")}
                  className="btn-lift h-11 rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("createGroup")}
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {adminGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  membership={membershipFor(group.id)}
                  variant="manage"
                  onClick={() => navigate(`/GroupDetail?id=${group.id}`)}
                />
              ))}
            </div>
          )}
        </SectionCard>

        {/* Gruppi a cui partecipi */}
        <SectionCard
          title="Gruppi a cui partecipi"
          meta={
            <StatusPill tone={pendingCount > 0 ? "warning" : "neutral"}>
              {memberGroups.length}
            </StatusPill>
          }
          description={
            pendingCount > 0
              ? `${pendingCount} ${pendingCount === 1 ? "quota" : "quote"} da saldare`
              : "Tutte le quote sono in regola"
          }
          icon={Users}
          flush={memberGroups.length === 0}
          action={
            memberGroups.length > 0 ? (
              <button
                onClick={() => navigate("/BrowseGroups")}
                className="link-underline text-sm font-semibold text-primary"
              >
                Trova altri gruppi
              </button>
            ) : undefined
          }
        >
          {memberGroups.length === 0 ? (
            <EmptyState
              icon={Compass}
              title="Non partecipi a nessun gruppo"
              description="Esplora i gruppi aperti e unisciti in pochi secondi: paghi solo la tua quota."
              action={
                <Button
                  onClick={() => navigate("/BrowseGroups")}
                  variant="outline"
                  className="h-11 rounded-full border-border bg-surface-elevated px-5 font-semibold"
                >
                  <Search className="mr-2 h-4 w-4" />
                  {t("browseGroups")}
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {memberGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  membership={membershipFor(group.id)}
                  variant="member"
                  onClick={() => navigate(`/GroupDetail?id=${group.id}`)}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
