import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/components/AuthContext";
import { getGroupByInviteCode, Group } from "@/lib/supabaseClient";
import { usePublicGroups, useUserMemberships, useTrustScores, useAdminRatings } from "@/hooks/useGroupsData";
import { SERVICE_COLORS } from "@/lib/serviceConstants";
import { getCatalogPlans, JOIN_FEE_CENTS, totalWithFeeCents } from "@/lib/servicePlans";

import ServiceLogo from "@/components/ServiceLogo";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PremiumSearchInput from "@/components/search/PremiumSearchInput";
import { PageHeader, EmptyState, StatusPill } from "@/components/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Filter, Users, Calendar, DollarSign, Target, Ticket, ArrowLeft, ChevronRight, Zap, Star } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";

import MatchmakingOverlay from "@/components/MatchmakingOverlay";
import WaitlistResultDialog from "@/components/WaitlistResultDialog";
import { toast } from "sonner";

type MatchmakingPlan = {
  serviceName: string;
  planType: string | null;
  perMemberCents: number;
  label: string;
};

/** Piani disponibili per un servizio, dal catalogo condiviso con la creazione gruppo. */
function catalogPlansFor(type: string): MatchmakingPlan[] {
  return getCatalogPlans(type).map((p) => ({
    serviceName: type,
    planType: p.planType,
    perMemberCents: p.perMemberCents,
    label: p.planType,
  }));
}


const HIDDEN_SERVICES = new Set([
  "xbox game pass",
  "xbox game pass ultimate",
  "canva pro",
  "canva",
]);

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export default function BrowseGroups() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();

  // React Query — cached data, instant tab switching, parallel trust scores
  const { data: rawGroups = [], isLoading: groupsLoading } = usePublicGroups();
  const allMemberships: { group_id: string; user_email: string }[] = [];
  const membershipsLoading = false;

  const { data: myMemberships = [] } = useUserMemberships(user?.email);

  // Filter valid UUIDs + hide deprecated services
  const groups = React.useMemo(
    () =>
      rawGroups.filter(
        (g) =>
          isValidUUID(g.id) &&
          !HIDDEN_SERVICES.has((g.service_type || "").toLowerCase()) &&
          !HIDDEN_SERVICES.has((g.service_name || "").toLowerCase())
      ),
    [rawGroups]
  );

  // Public groups come from groups_public, where admin_email is intentionally omitted.
  const uniqueAdmins = React.useMemo(
    () => [...new Set(groups.map(g => g.admin_email).filter((e): e is string => typeof e === "string" && e.includes("@")))],
    [groups]
  );
  const { data: trustScores = {} } = useTrustScores(uniqueAdmins);
  const { data: adminRatings = {} } = useAdminRatings(uniqueAdmins);
  const adminNames = React.useMemo(() => {
    const names: Record<string, string> = {};
    uniqueAdmins.forEach(email => { names[email] = email.includes('@') ? email.split('@')[0] : "Admin"; });
    return names;
  }, [uniqueAdmins]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [matchmakingFor, setMatchmakingFor] = useState<{ serviceName: string; planType?: string | null; preauthAmountCents: number } | null>(null);
  const [variantPicker, setVariantPicker] = useState<{
    type: string;
    variants: { serviceName: string; planType: string | null; perMemberCents: number; label: string }[];
  } | null>(null);

  const loading = groupsLoading || membershipsLoading;

  const startMatchmaking = (serviceName: string, planType: string | null | undefined, perMemberCents: number) => {
    if (!isAuthenticated) {
      toast.error("Devi effettuare il login");
      navigate('/Auth');
      return;
    }
    setMatchmakingFor({ serviceName, planType: planType || null, preauthAmountCents: totalWithFeeCents(perMemberCents) });
  };

  /** Se un abbonamento offre più piani/servizi (es. Netflix, Discovery+, NOW)
   *  chiediamo SEMPRE all'utente quale piano vuole prima del matchmaking.
   *  Se ne offre uno solo (es. Apple Music) partiamo diretti. */
  const startMatchmakingForService = (type: string, svcGroups: Group[]) => {
    if (!isAuthenticated) {
      toast.error("Devi effettuare il login");
      navigate('/Auth');
      return;
    }

    const map = new Map<string, MatchmakingPlan>();
    // 1) Catalogo ufficiale: è l'UNICA fonte di verità sui piani offerti dal servizio.
    //    Non mostriamo mai piani non creabili su DivideIt (es. "Netflix 4K").
    for (const plan of catalogPlansFor(type)) {
      map.set((plan.planType ?? "").toLocaleLowerCase("it-IT"), plan);
    }
    const hasCatalog = map.size > 0;
    // 2) Gruppi reali: affinano solo il prezzo dei piani già a catalogo.
    //    Se il servizio non è a catalogo, usiamo i gruppi come fallback.
    for (const g of svcGroups) {
      const planType = (g.plan_type as string | null) || null;
      const key = (planType ?? "").toLocaleLowerCase("it-IT");
      const perMemberCents = Math.round((g.total_cost / g.max_members) * 100);
      const existing = map.get(key);
      if (!existing) {
        if (hasCatalog) continue;
        map.set(key, {
          serviceName: type,
          planType,
          perMemberCents,
          label: planType || g.service_name,
        });
      } else if (perMemberCents > 0 && perMemberCents < existing.perMemberCents) {
        map.set(key, { ...existing, perMemberCents });
      }
    }


    const variants = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    if (variants.length <= 1) {
      const v = variants[0];
      if (!v) return;
      startMatchmaking(v.serviceName, v.planType, v.perMemberCents);
      return;
    }
    setVariantPicker({ type, variants });
  };


  const handleJoinWithCode = async () => {
    if (!inviteCode.trim()) {
      toast.error("Inserisci un codice");
      return;
    }

    if (!isAuthenticated) {
      toast.error("Devi effettuare il login");
      navigate('/Auth');
      return;
    }

    try {
      const group = await getGroupByInviteCode(inviteCode);
      
      if (!group) {
        toast.error("Codice non valido");
        return;
      }

      const alreadyMember = myMemberships.some(m => m.group_id === group.id);
      if (alreadyMember) {
        navigate(`/GroupDetail?id=${group.id}`);
        setShowInviteModal(false);
        setInviteCode("");
        return;
      }

      navigate(`/JoinGroup?id=${group.id}&code=${inviteCode}`);
    } catch (error) {
      console.error("❌ Errore:", error);
      toast.error("Errore nella verifica del codice");
    }
  };

  const handleJoinGroup = (group: Group) => {
    if (!isAuthenticated) {
      toast.error("Devi effettuare il login");
      navigate('/Auth');
      return;
    }

    const alreadyMember = myMemberships.some(m => m.group_id === group.id);
    if (alreadyMember) {
      navigate(`/GroupDetail?id=${group.id}`);
      return;
    }

    const memberCount = (group as any).member_count ?? 0;
    if (memberCount >= group.max_members) {
      toast.error("Gruppo pieno!");
      return;
    }


    navigate(`/JoinGroup?id=${group.id}`);
  };

  // Smart matching: prefix on the full string or on any word (so "n" doesn't match "amazoN")
  const matches = React.useCallback((text: string, q: string) => {
    const s = (text || "").toLowerCase();
    if (!q) return true;
    if (s.startsWith(q)) return true;
    return s.split(/[^a-z0-9+]+/i).some((w) => w && w.startsWith(q));
  }, []);

  const filteredGroups = React.useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return groups
      .filter((g) => {
        if (selectedService && g.service_type !== selectedService) return false;
        if (!q) return true;
        return matches(g.service_name || "", q) || matches(g.service_type || "", q);
      })
      .sort((a, b) => (a.service_name || "").localeCompare(b.service_name || ""));
  }, [groups, searchTerm, selectedService, matches]);

  // Group by service_type for the service overview
  const servicesGrouped = React.useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const map = new Map<string, { type: string; groups: Group[]; totalSpots: number; minPrice: number }>();
    for (const g of groups) {
      if (q && !matches(g.service_type, q) && !matches(g.service_name || "", q)) continue;
      const entry = map.get(g.service_type) || { type: g.service_type, groups: [], totalSpots: 0, minPrice: Infinity };
      entry.groups.push(g);
      const spots = g.max_members - ((g as any).member_count ?? 0);
      entry.totalSpots += Math.max(0, spots);
      const perMember = g.total_cost / g.max_members;
      if (perMember < entry.minPrice) entry.minPrice = perMember;
      map.set(g.service_type, entry);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (q) {
        const ap = a.type.toLowerCase().startsWith(q) ? 0 : 1;
        const bp = b.type.toLowerCase().startsWith(q) ? 0 : 1;
        if (ap !== bp) return ap - bp;
      }
      return a.type.localeCompare(b.type);
    });
  }, [groups, searchTerm, matches]);

  // Suggestions = servizi con gruppi + catalogo completo (es. "n" → Netflix)
  const suggestions = React.useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return [] as { type: string; count: number; minPrice: number }[];
    const list = servicesGrouped.map((s) => ({ type: s.type, count: s.groups.length, minPrice: s.minPrice }));
    const seen = new Set(list.map((s) => s.type.toLowerCase()));
    for (const name of Object.keys(SERVICE_COLORS)) {
      if (HIDDEN_SERVICES.has(name.toLowerCase())) continue;
      if (seen.has(name.toLowerCase())) continue;
      if (!matches(name, q)) continue;
      list.push({ type: name, count: 0, minPrice: 0 });
    }
    return list.slice(0, 7);
  }, [servicesGrouped, searchTerm, matches]);



  const getAvailableSpots = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return 0;
    const currentMembers = (group as any).member_count ?? 0;
    return group.max_members - currentMembers;
  };


  if (loading) {
    return (
      <div className="min-h-screen p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-7xl mx-auto flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <div className="skeleton h-3 w-20 rounded-full" />
            <div className="skeleton h-10 w-64" />
            <div className="skeleton h-4 w-full max-w-md" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-20 rounded-3xl" />
            ))}
          </div>
          <div className="skeleton h-16 rounded-3xl" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="panel overflow-hidden">
                <div className="skeleton h-28 rounded-none" />
                <div className="flex flex-col gap-3 p-4">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-1/2" />
                  <div className="skeleton h-10 rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalGroups = groups.length;
  const totalMembers = groups.reduce((acc, g) => acc + ((g as any).member_count ?? 0), 0);
  const avgSavings = groups.length > 0 
    ? groups.reduce((acc, g) => acc + (g.total_cost / g.max_members), 0) / groups.length
    : 0;

  return (
    <div className="min-h-screen p-4 lg:p-10 pb-24 lg:pb-10">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <PageHeader
          eyebrow="Scopri"
          title={t('explore')}
          description={t('browseDescription')}
          className="mb-6 lg:mb-8"
          action={
            <Button
              variant="outline"
              onClick={() => setShowInviteModal(true)}
              className="h-11 rounded-2xl px-4 font-semibold"
            >
              <Ticket className="w-4 h-4 mr-2" />
              Ho un codice invito
            </Button>
          }
        >
          {/* Metriche del catalogo: filetti, non gradienti */}
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: t('totalGroups'), value: String(totalGroups), icon: Target },
              { label: t('activeMembers'), value: String(totalMembers), icon: Users },
              {
                label: t('avgSavings'),
                value: `€${avgSavings.toFixed(2)}`,
                icon: DollarSign,
                span: true,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`panel-quiet flex items-center gap-3 px-4 py-3 ${stat.span ? "col-span-2 md:col-span-1" : ""}`}
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-surface-elevated border border-border text-primary">
                  <stat.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                    {stat.label}
                  </dt>
                  <dd className="tnum text-xl font-bold leading-tight text-foreground">{stat.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </PageHeader>

        {/* Ricerca — resta agganciata in alto durante lo scorrimento */}
        <div className="sticky-bar mb-8 p-3 lg:p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {selectedService && (
              <button
                type="button"
                onClick={() => setSelectedService(null)}
                className="chip-toggle flex-none self-start sm:self-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Tutti i servizi
              </button>
            )}
            <div className="flex-1 min-w-0">
              <PremiumSearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={selectedService ? `Cerca in ${selectedService}...` : t("searchGroups")}
              />
            </div>
            <p className="hidden lg:block flex-none text-xs text-muted-foreground tnum pr-1">
              {selectedService
                ? `${filteredGroups.length} ${filteredGroups.length === 1 ? "gruppo" : "gruppi"}`
                : `${servicesGrouped.length} ${servicesGrouped.length === 1 ? "servizio" : "servizi"}`}
            </p>
          </div>

          {/* Live suggestions */}
          {!selectedService && searchTerm.trim() && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface-elevated row-divide">
              {suggestions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  {`Nessun servizio trovato per "${searchTerm}"`}
                </div>
              ) : (
                suggestions.map((svc) => (
                  <button
                    key={svc.type}
                    type="button"
                    onClick={() =>
                      svc.count > 0 ? setSelectedService(svc.type) : navigate("/CreateGroup")
                    }
                    className="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-left transition-colors hover:bg-surface-muted"
                  >
                    <span className="w-8 h-8 flex-none rounded-lg bg-surface-muted border border-border flex items-center justify-center p-1">
                      <ServiceLogo name={svc.type} size={32} className="w-full h-full" />
                    </span>
                    <span className="flex-1 min-w-0 truncate font-medium text-foreground">{svc.type}</span>
                    {svc.count > 0 ? (
                      <span className="flex-none text-xs text-muted-foreground tnum">
                        {`${svc.count} ${svc.count === 1 ? "gruppo" : "gruppi"} · da €${svc.minPrice.toFixed(2)}`}
                      </span>
                    ) : (
                      <StatusPill tone="brand" className="flex-none">Creane uno</StatusPill>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>


        {/* Service overview OR groups list */}
        {!selectedService ? (
          servicesGrouped.length === 0 ? (
            <EmptyState
              icon={Filter}
              title={t('noGroupsFound')}
              description={
                searchTerm.trim()
                  ? "Nessun servizio corrisponde alla ricerca. Prova un altro nome o crea tu il gruppo."
                  : "Non ci sono ancora gruppi pubblici. Puoi essere il primo ad aprirne uno."
              }
              action={
                <Button onClick={() => navigate("/CreateGroup")} className="h-11 rounded-2xl px-5 gradient-divideit text-primary-foreground font-semibold">
                  Crea un gruppo
                </Button>
              }
              secondaryAction={
                searchTerm.trim() ? (
                  <Button variant="ghost" onClick={() => setSearchTerm("")} className="h-11 rounded-2xl px-4">
                    Azzera ricerca
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {servicesGrouped.map((svc) => {
                const color = SERVICE_COLORS[svc.type] || "linear-gradient(135deg, #5B6FBD 0%, #7DD3C0 100%)";
                const capacity = svc.groups.reduce((acc, g) => acc + g.max_members, 0);
                const taken = Math.max(0, capacity - svc.totalSpots);
                const fill = capacity > 0 ? Math.round((taken / capacity) * 100) : 0;
                const scarce = svc.totalSpots > 0 && svc.totalSpots <= 2;
                return (
                  <div
                    key={svc.type}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedService(svc.type)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedService(svc.type);
                      }
                    }}
                    aria-label={`Esplora i gruppi ${svc.type}`}
                    className="panel-interactive group flex cursor-pointer flex-col overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {/* Copertina: colore del marchio, logo su tessera neutra */}
                    <div
                      className="relative flex h-28 lg:h-32 items-center justify-center overflow-hidden"
                      style={{ background: color }}
                    >
                      <div className="absolute inset-0 cover-scrim opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      <div className="flex h-16 w-16 lg:h-[4.5rem] lg:w-[4.5rem] items-center justify-center rounded-2xl bg-surface-elevated p-3.5 shadow-lg transition-transform duration-300 group-hover:scale-105">
                        <ServiceLogo name={svc.type} size={56} className="h-full w-full" />
                      </div>
                      <span className="badge-glass absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-bold tnum">
                        {svc.groups.length}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div className="flex flex-col gap-0.5">
                        <h3 className="truncate font-display text-base lg:text-lg font-bold text-foreground">{svc.type}</h3>
                        <p className="text-xs text-muted-foreground">
                          {svc.groups.length} {svc.groups.length === 1 ? "gruppo attivo" : "gruppi attivi"}
                        </p>
                      </div>

                      {/* Il prezzo è l'informazione che porta alla decisione */}
                      <div className="flex items-baseline gap-1">
                        <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">da</span>
                        <span className="tnum font-display text-2xl font-bold leading-none text-foreground">
                          €{svc.minPrice.toFixed(2)}
                        </span>
                        <span className="text-xs text-muted-foreground">/mese</span>
                      </div>

                      <div className="mt-auto flex flex-col gap-1.5">
                        <div className={`meter ${scarce ? "meter-warning" : "meter-positive"}`}>
                          <span style={{ width: `${fill}%` }} />
                        </div>
                        <p className={`text-[0.6875rem] font-semibold ${scarce ? "text-warning" : "text-muted-foreground"}`}>
                          {svc.totalSpots > 0
                            ? `${svc.totalSpots} ${svc.totalSpots === 1 ? "posto libero" : "posti liberi"}`
                            : "Nessun posto libero"}
                        </p>
                      </div>

                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          startMatchmakingForService(svc.type, svc.groups);
                        }}
                        className="h-11 w-full rounded-2xl gradient-divideit px-2 text-[13px] sm:text-sm font-semibold text-primary-foreground btn-lift"
                      >
                        <Zap className="mr-1.5 h-4 w-4 flex-none" />
                        <span className="truncate">Partecipa</span>
                      </Button>
                      <span className="flex items-center justify-center text-xs font-medium text-primary">
                        oppure esplora <ChevronRight className="ml-0.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : filteredGroups.length === 0 ? (
          <EmptyState
            icon={Filter}
            title={t('noGroupsFound')}
            description={`Nessun gruppo ${selectedService} corrisponde a questa ricerca.`}
            action={
              <Button variant="outline" onClick={() => setSelectedService(null)} className="h-11 rounded-2xl px-5">
                <ArrowLeft className="mr-2 h-4 w-4" /> Tutti i servizi
              </Button>
            }
          />
        ) : (
          <>
            {/* Big CTA for instant matchmaking on selected service */}
            {selectedService && filteredGroups.length > 0 && (
              <div className="panel mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between lg:p-6">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary-soft text-primary">
                    <Zap className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display font-bold text-foreground">Matchmaking istantaneo</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
                      {`Ti assegniamo automaticamente al miglior gruppo ${selectedService} disponibile.`}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => startMatchmakingForService(selectedService, filteredGroups)}
                  className="h-12 w-full flex-none rounded-2xl gradient-divideit px-5 text-sm font-semibold text-primary-foreground btn-lift sm:w-auto"
                >
                  <Zap className="mr-1.5 h-4 w-4 flex-none" /> Paga e partecipa
                </Button>
              </div>
            )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {filteredGroups.map((group) => {
              const availableSpots = getAvailableSpots(group.id);
              const costPerMember = (group.total_cost / group.max_members).toFixed(2);
              const isMember = myMemberships.some(m => m.group_id === group.id);
              const adminEmail = typeof group.admin_email === "string" ? group.admin_email : "";
              const adminName =
                ((group as any).admin_name as string | null) ||
                (adminEmail ? adminNames[adminEmail] || "Admin" : "Admin");
              const color = SERVICE_COLORS[group.service_type] || "linear-gradient(135deg, #5B6FBD 0%, #7DD3C0 100%)";
              const cover = (group as any).cover_image_url as string | null | undefined;

              const trust = adminEmail ? trustScores[adminEmail] ?? 60 : 60;

              const rating = adminRatings[adminEmail.toLowerCase()];
              const fill = group.max_members > 0
                ? Math.round(((group.max_members - availableSpots) / group.max_members) * 100)
                : 0;
              const scarce = availableSpots > 0 && availableSpots <= 1;

              return (
                <article key={group.id} className="panel-interactive flex flex-col overflow-hidden">
                  {/* Copertina */}
                  <div
                    className="relative h-28 bg-cover bg-center"
                    style={cover ? { backgroundImage: `url(${cover})` } : { background: color }}
                  >
                    <div className="absolute inset-0 cover-scrim" />
                    <div className="absolute left-3 top-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-elevated p-2.5 shadow-lg">
                      <ServiceLogo name={group.service_type} size={48} className="h-full w-full" />
                    </div>
                    <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
                      {rating && rating.review_count > 0 && (
                        <span className="badge-glass flex items-center gap-1 rounded-full px-2 py-1">
                          <Star className="h-3 w-3 fill-current text-warning" />
                          <span className="tnum text-[0.6875rem] font-bold leading-none">
                            {rating.avg_stars.toFixed(1)}
                          </span>
                        </span>
                      )}
                      {isMember && <StatusPill tone="positive" dot>Iscritto</StatusPill>}
                      {!isMember && availableSpots === 0 && <StatusPill tone="critical" dot>Pieno</StatusPill>}
                      {!isMember && scarce && <StatusPill tone="warning" dot>Ultimo posto</StatusPill>}
                    </div>
                    <h3 className="absolute bottom-2.5 left-3 right-3 truncate font-display text-base font-bold leading-tight text-primary-foreground">
                      {group.service_name}
                    </h3>
                  </div>

                  {/* Corpo */}
                  <div className="flex flex-1 flex-col gap-3.5 p-4">
                    {/* Chi gestisce il gruppo: è la vera decisione di fiducia */}
                    <div className="flex items-center gap-2.5">
                      <UserAvatar
                        userEmail={adminEmail}
                        userName={adminName}
                        size="sm"
                        trustScore={trust}
                        showTrustValue={false}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{adminName}</p>
                        <p className="text-[0.6875rem] text-muted-foreground">
                          Admin
                          {rating && rating.review_count > 0
                            ? ` · ${rating.review_count} ${rating.review_count === 1 ? "recensione" : "recensioni"}`
                            : ""}
                        </p>
                      </div>
                      {typeof trust === "number" && (
                        <span className="flex-none rounded-full bg-primary-soft px-2 py-1 text-[0.6875rem] font-bold leading-none text-primary tnum">
                          {Math.round(trust)}
                        </span>
                      )}
                    </div>

                    {/* Prezzo in evidenza, occupazione come indicatore */}
                    <div className="flex flex-col gap-2 border-t border-border pt-3.5">
                      <div className="flex items-end justify-between gap-2">
                        <div className="flex items-baseline gap-1">
                          <span className="tnum font-display text-2xl font-bold leading-none text-foreground">
                            €{costPerMember}
                          </span>
                          <span className="text-xs text-muted-foreground">/mese</span>
                        </div>
                        <span className={`text-[0.6875rem] font-semibold ${scarce ? "text-warning" : "text-muted-foreground"}`}>
                          {group.max_members - availableSpots}/{group.max_members} posti
                        </span>
                      </div>
                      <div className={`meter ${scarce ? "meter-warning" : "meter-positive"}`}>
                        <span style={{ width: `${fill}%` }} />
                      </div>
                      <p className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
                        <Calendar className="h-3 w-3 flex-none" />
                        {`Rinnovo il ${group.billing_date} di ogni mese`}
                      </p>
                    </div>

                    {isMember ? (
                      <Button
                        onClick={() => navigate(`/GroupDetail?id=${group.id}`)}
                        variant="outline"
                        className="mt-auto h-11 w-full rounded-2xl text-sm font-semibold"
                      >
                        {t('viewGroup')}
                      </Button>
                    ) : availableSpots > 0 ? (
                      <Button
                        onClick={() => handleJoinGroup(group)}
                        className="mt-auto h-11 w-full rounded-2xl gradient-divideit text-sm font-semibold text-primary-foreground btn-lift"
                      >
                        {t('join')}
                      </Button>
                    ) : (
                      <Button disabled className="mt-auto h-11 w-full rounded-2xl text-sm font-semibold">
                        {t('groupFull')}
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}

          </div>
          </>
        )}

      </div>

      <WaitlistResultDialog />

      {/* Codice invito: percorso diretto per chi è stato invitato da un amico */}
      <Dialog
        open={showInviteModal}
        onOpenChange={(o) => {
          setShowInviteModal(o);
          if (!o) setInviteCode("");
        }}
      >
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Hai un codice invito?</DialogTitle>
          </DialogHeader>
          <p className="-mt-2 text-sm text-muted-foreground leading-relaxed">
            Inserisci il codice che ti ha mandato l&apos;admin per entrare direttamente nel suo gruppo.
          </p>
          <Input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) handleJoinWithCode();
            }}
            placeholder="Es. DIV-4F7K2"
            autoFocus
            className="h-12 rounded-2xl text-center text-base font-semibold tracking-widest uppercase"
          />
          <Button
            onClick={handleJoinWithCode}
            disabled={!inviteCode.trim()}
            className="h-12 w-full rounded-2xl gradient-divideit text-sm font-semibold text-primary-foreground"
          >
            <Ticket className="mr-2 h-4 w-4" /> Entra nel gruppo
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!variantPicker} onOpenChange={(o) => !o && setVariantPicker(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Quale {variantPicker?.type} ti interessa?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2 mb-2">
            Questo abbonamento include più opzioni: scegli quella che vuoi e cerchiamo un posto disponibile.
            I prezzi mostrati includono la commissione di servizio di €{(JOIN_FEE_CENTS / 100).toFixed(2)}.
          </p>
          <div className="space-y-2">
            {variantPicker?.variants.map((v) => (
              <button
                key={`${v.serviceName}-${v.planType ?? ""}`}
                onClick={() => {
                  setVariantPicker(null);
                  startMatchmaking(v.serviceName, v.planType, v.perMemberCents);
                }}
                className="w-full flex items-center justify-between gap-3 rounded-2xl border border-border p-4 text-left hover:border-primary/50 hover:bg-muted/50 transition"
              >
                <span className="font-medium text-foreground">{v.label}</span>
                <span className="text-right shrink-0">
                  <span className="block text-sm font-semibold text-green-600">
                    €{(totalWithFeeCents(v.perMemberCents) / 100).toFixed(2)}/mese
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    €{(v.perMemberCents / 100).toFixed(2)} + €{(JOIN_FEE_CENTS / 100).toFixed(2)} servizio
                  </span>
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {matchmakingFor && (
        <MatchmakingOverlay
          open={!!matchmakingFor}
          onClose={() => setMatchmakingFor(null)}
          userEmail={user?.email || ""}
          userName={(user as any)?.user_metadata?.full_name || user?.email?.split("@")[0] || null}
          serviceName={matchmakingFor.serviceName}
          planType={matchmakingFor.planType}
          preauthAmountCents={matchmakingFor.preauthAmountCents}
        />
      )}
    </div>
  );
}
