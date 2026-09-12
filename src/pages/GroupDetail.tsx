import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/components/AuthContext";
import { 
  getGroupById, 
  getMembershipsByGroupId,
  subscribeToMembershipChanges,
  Group,
  Membership
} from "@/lib/supabaseClient";
import { supabase } from "@/integrations/supabase/client";
import { stripeApi } from "@/lib/stripeApi";

import { SERVICE_COLORS } from "@/lib/serviceConstants";
import ServiceLogo from "@/components/ServiceLogo";
import RatingStarPopover from "@/components/group/RatingStarPopover";
import RatingsCard from "@/components/group/RatingsCard";


import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Users, Calendar, DollarSign, Copy, Trash2, X,
  LogOut, Crown, Shield, AlertCircle, CreditCard,
  AlertTriangle, Banknote, LifeBuoy

} from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { toast } from "sonner";
import GroupChat from "@/components/chat/GroupChat";
import AutoRenewCard from "@/components/group/AutoRenewCard";
import ServiceCredentialsPanel from "@/components/ServiceCredentialsPanel";
import GroupTicketDialog, { TicketKind } from "@/components/group/GroupTicketDialog";

export default function GroupDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get("id");
  const { user, isAuthenticated } = useAuth();

  const cacheKey = groupId ? `divideit:groupdetail:${groupId}` : null;
  const cachedSnapshot = (() => {
    if (!cacheKey) return null;
    try {
      const raw = localStorage.getItem(cacheKey);
      return raw ? (JSON.parse(raw) as { group: Group; members: Membership[] }) : null;
    } catch {
      return null;
    }
  })();

  const [group, setGroup] = useState<Group | null>(cachedSnapshot?.group || null);
  const [members, setMembers] = useState<Membership[]>(cachedSnapshot?.members || []);
  const [loading, setLoading] = useState(!cachedSnapshot);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [removalTarget, setRemovalTarget] = useState<Membership | null>(null);
  const [ticketDialog, setTicketDialog] = useState<{ open: boolean; kind: TicketKind }>({ open: false, kind: "problem" });

  useEffect(() => {
    if (groupId) {
      loadGroupData();
    }
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;

    // Subscribe to real-time membership changes
    const unsubscribe = subscribeToMembershipChanges(groupId, (payload) => {
      console.log("🔄 Membership change:", payload);
      loadGroupData();
    });

    return () => unsubscribe();
  }, [groupId]);

  const loadGroupData = async () => {
    if (!groupId) return;

    try {
      console.log(`📊 Caricamento gruppo ${groupId} da Supabase...`);

      const [foundGroup, groupMembers] = await Promise.all([
        getGroupById(groupId),
        getMembershipsByGroupId(groupId)
      ]);

      if (!foundGroup) {
        console.error("❌ Gruppo non trovato");
        toast.error("Gruppo non trovato");
        navigate('/Dashboard');
        return;
      }

      console.log(`✅ Gruppo: ${foundGroup.service_name}`);
      console.log(`✅ ${groupMembers.length} membri`);

      setGroup(foundGroup);
      setMembers(groupMembers);
      try {
        if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify({ group: foundGroup, members: groupMembers }));
      } catch {
        /* ignore */
      }


    } catch (error) {
      console.error("❌ Errore Supabase:", error);
      toast.error("Errore caricamento gruppo");
    } finally {
      setLoading(false);
    }
  };

  // NOTA: l'uscita autonoma dal gruppo è disabilitata.
  // I membri devono usare "Richiedi rimborso" o contattare l'admin.



  const handleDeleteGroup = async () => {
    if (!groupId || !user?.email) return;
    setShowDeleteModal(false);

    try {
      const { ok, data } = await stripeApi('groups-delete', {
        groupId,
        ownerEmail: user.email,
      });

      if (!ok) {
        if (data.reason === 'active_holds' || data.reason === 'active_members') {
          toast.error(data.error, { duration: 8000 });
        } else {
          toast.error(data.error || "Errore durante l'eliminazione del gruppo");
        }
        return;
      }

      toast.success("Gruppo eliminato");
      navigate('/Dashboard');
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast.error("Errore durante l'eliminazione del gruppo");
    }
  };

  // Rimozione posticipata: il membro resta nel gruppo fino alla fine del periodo
  // che ha già pagato, poi lo slot viene liberato automaticamente.
  const handleScheduleRemoval = async (member: Membership) => {
    setRemovalTarget(null);
    const { data, error } = await (supabase as any).rpc("request_member_removal", {
      _membership_id: member.id,
    });
    if (error) {
      toast.error(error.message || "Errore durante la programmazione della rimozione");
      return;
    }
    const when = data ? new Date(data as string).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }) : null;
    toast.success(when ? `Rimozione programmata: verrà rimosso dal ${when}` : "Rimozione programmata");
    loadGroupData();
  };

  const handleCancelRemoval = async (member: Membership) => {
    const { error } = await (supabase as any).rpc("cancel_member_removal", {
      _membership_id: member.id,
    });
    if (error) {
      toast.error(error.message || "Errore durante l'annullamento");
      return;
    }
    toast.success("Rimozione annullata: il membro resta nel gruppo");
    loadGroupData();
  };

  const formatRemovalDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }) : "";



  const isAdmin = group && user && group.admin_email === user.email;
  const costPerMember = group ? (group.total_cost / group.max_members).toFixed(2) : "0.00";
    const color = group ? (SERVICE_COLORS[group.service_type] || "linear-gradient(135deg, #5B6FBD 0%, #7DD3C0 100%)") : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Gruppo non trovato</h2>
          <Button onClick={() => navigate('/Dashboard')}>
            Torna alla Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-2 sm:p-4 lg:p-10 pb-24 lg:pb-10">
      <div className="max-w-7xl mx-auto">

        {/* Header Card */}
        <Card className="mb-8 overflow-hidden border-2">
          <div 
            className="h-28 lg:h-32 flex items-center justify-center relative bg-cover bg-center"
            style={(group as any).cover_image_url ? { backgroundImage: `url(${(group as any).cover_image_url})` } : { background: color }}
          >

            <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-white/95 shadow-lg flex items-center justify-center p-3">
                <ServiceLogo name={group.service_type} size={48} className="h-10 w-10 lg:h-12 lg:w-12" />
              </div>
            {isAdmin && (
              <Badge className="absolute top-4 right-4 bg-yellow-500 text-white">
                <Crown className="w-3 h-3 mr-1" />
                Admin
              </Badge>
            )}
          </div>

          <div className="p-4 lg:p-6">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">{group.service_name}</h1>
            <p className="text-muted-foreground mb-4">{group.description}</p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4">
              <div className="bg-blue-50 p-3 lg:p-4 rounded-xl">
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-xs lg:text-sm font-medium">Costo/Persona</span>
                </div>
                <p className="text-xl lg:text-2xl font-bold text-blue-900">€{costPerMember}</p>
              </div>

              <div className="bg-green-50 p-3 lg:p-4 rounded-xl">
                <div className="flex items-center gap-2 text-green-600 mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-xs lg:text-sm font-medium">Membri</span>
                </div>
                <p className="text-xl lg:text-2xl font-bold text-green-900">{members.filter(m => m.user_email?.toLowerCase() !== group.admin_email?.toLowerCase()).length}/{group.max_members}</p>
              </div>

              <div className="bg-purple-50 p-3 lg:p-4 rounded-xl">
                <div className="flex items-center gap-2 text-purple-600 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs lg:text-sm font-medium">Fatturazione</span>
                </div>
                <p className="text-xl lg:text-2xl font-bold text-purple-900">Giorno {group.billing_date}</p>
              </div>
            </div>

          </div>
        </Card>

        {(() => {
          const currentUserMembership = members.find(m => m.user_email === user?.email);
          const isPaid = currentUserMembership?.payment_status === 'paid' || isAdmin;

          if (!isPaid) {
            return (
              <Card className="p-8 text-center">
                <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-foreground mb-2">Pagamento richiesto</h3>
                <p className="text-muted-foreground mb-6">
                  Devi completare il pagamento per accedere al gruppo e alla chat.
                </p>
                <Button
                  onClick={() => navigate(`/JoinGroup?id=${groupId}`)}
                  className="gradient-divideit text-white rounded-xl"
                  data-testid="button-pay-to-access"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Paga per accedere
                </Button>
              </Card>
            );
          }

          return (
            <>
            <div className="flex gap-2 mb-4 flex-wrap">
              {isAdmin ? (
                <Button
                  onClick={() => setShowDeleteModal(true)}
                  variant="destructive"
                  className="rounded-xl"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Elimina Gruppo
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => setTicketDialog({ open: true, kind: "problem" })}
                    variant="outline"
                    className="rounded-xl text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Segnala problema
                  </Button>
                  <Button
                    onClick={() => setTicketDialog({ open: true, kind: "refund" })}
                    variant="outline"
                    className="rounded-xl text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Banknote className="w-4 h-4 mr-2" />
                    Richiedi rimborso
                  </Button>
                  <Button
                    onClick={() => setTicketDialog({ open: true, kind: "help" })}
                    variant="outline"
                    className="rounded-xl text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  >
                    <LifeBuoy className="w-4 h-4 mr-2" />
                    Aiuto admin
                  </Button>
                </>
              )}
            </div>
            {!isAdmin && currentUserMembership?.id && (
              <div className="mb-4 lg:mb-6">
                <AutoRenewCard
                  membershipId={currentUserMembership.id}
                  renewsAt={(currentUserMembership as any).current_period_end}
                  costPerMonth={(currentUserMembership as any).cost_per_month}
                />
              </div>
            )}
            <div className="mb-4 lg:mb-6">
              <ServiceCredentialsPanel
                groupId={groupId!}
                userEmail={user!.email!}
                isAdmin={!!isAdmin}
              />
            </div>
            <div className="mb-4 lg:mb-6">
              <RatingsCard
                groupId={group.id}
                adminEmail={group.admin_email}
                viewerEmail={user?.email ?? null}
                viewerUid={user?.uid ?? null}
                isAdmin={!!isAdmin}
              />
            </div>
            <div className="flex flex-col-reverse lg:grid lg:grid-cols-3 gap-4 lg:gap-8">

              <div className="lg:col-span-1 order-2 lg:order-1">
                <Card className="p-3 lg:p-6">
                  <h2 className="text-base lg:text-xl font-bold text-foreground mb-3 lg:mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4 lg:w-5 lg:h-5" />
                    Membri ({members.filter(m => m.payment_status === 'paid').length})
                  </h2>

                  <div className="space-y-2 lg:space-y-3 max-h-[200px] lg:max-h-none overflow-y-auto">
                    {members.filter(m => m.payment_status === 'paid').map(member => (
                      <div 
                        key={member.id}
                        className="flex items-center justify-between p-2 lg:p-3 bg-muted/50 rounded-xl"
                      >
                        <div className="flex items-center gap-2 lg:gap-3 min-w-0">
                          <UserAvatar
                            userEmail={member.user_email}
                            userName={member.user_name || (member.user_email === user?.email ? user?.full_name : "") || member.user_email}
                            avatarUrl={
                              member.user_email === user?.email
                                ? (user?.avatar_url || member.user_avatar_url)
                                : member.user_avatar_url
                            }
                            size="sm"
                            className="w-7 h-7 lg:w-8 lg:h-8 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground text-xs lg:text-sm truncate">{member.user_name}</p>
                            <div className="flex items-center gap-1 flex-wrap">
                              {member.role === "admin" ? (
                                <>
                                  <Badge className="bg-yellow-500 text-white text-[9px] lg:text-xs px-1 lg:px-1.5 py-0">
                                    <Crown className="w-2.5 h-2.5 lg:w-3 lg:h-3 mr-0.5" />
                                    Admin
                                  </Badge>
                                </>
                              ) : (

                                <>
                                  <Badge className="bg-green-500 text-white text-[9px] lg:text-xs px-1 lg:px-1.5 py-0">
                                    Pagato
                                  </Badge>
                                  {member.cred_status === "verified" ? (
                                    <Badge className="bg-emerald-600 text-white text-[9px] lg:text-xs px-1 lg:px-1.5 py-0">
                                      ✓ Accesso verificato
                                    </Badge>
                                  ) : member.cred_status === "issue" ? (
                                    <Badge className="bg-destructive text-white text-[9px] lg:text-xs px-1 lg:px-1.5 py-0 animate-pulse">
                                      ✕ Problema segnalato
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px] lg:text-xs px-1 lg:px-1.5 py-0 text-muted-foreground">
                                      ⏳ In attesa di verifica
                                    </Badge>
                                  )}
                                </>
                              )}
                            </div>
                            {isAdmin && member.cred_status === "issue" && member.cred_issue_note && (
                              <p className="text-[10px] lg:text-xs text-destructive mt-0.5 truncate">
                                "{member.cred_issue_note}"
                              </p>
                            )}

                            {member.removal_effective_at && (
                              <p className="text-[10px] lg:text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                                Verrà rimosso dal {formatRemovalDate(member.removal_effective_at)}
                              </p>
                            )}

                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {member.role === "admin" && (
                            <RatingStarPopover
                              groupId={group.id}
                              adminEmail={group.admin_email}
                              viewerEmail={user?.email ?? null}
                              viewerUid={user?.uid ?? null}
                              isAdmin={!!isAdmin}
                            />
                          )}

                          {isAdmin && member.role !== "admin" && (
                            member.removal_effective_at ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelRemoval(member)}
                                className="h-8 px-2 text-[10px] lg:text-xs text-muted-foreground hover:text-foreground"
                              >
                                Annulla
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Programma rimozione a fine periodo pagato"
                                onClick={() => setRemovalTarget(member)}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )
                          )}
                        </div>

                      </div>

                    ))}
                  </div>
                </Card>
              </div>

              <div className="lg:col-span-2 order-1 lg:order-2">
                {groupId && (
                  <GroupChat groupId={groupId} groupName={group.service_name} />
                )}
              </div>
            </div>
            </>
          );
        })()}

        {/* Delete Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-foreground mb-4">Conferma Eliminazione</h3>
              <p className="text-muted-foreground mb-6">
                Sei sicuro di voler eliminare questo gruppo? Questa azione è irreversibile.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1"
                >
                  Annulla
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteGroup}
                  className="flex-1"
                >
                  Elimina
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Conferma rimozione membro */}
        <AlertDialog open={!!removalTarget} onOpenChange={(o) => !o && setRemovalTarget(null)}>
          <AlertDialogContent className="w-[calc(100vw-32px)] max-w-md rounded-3xl">
            <AlertDialogHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <AlertDialogTitle className="text-center">
                Rimuovere {removalTarget?.user_name || removalTarget?.user_email}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                Non verrà espulso subito: manterrà l&apos;accesso fino alla fine del periodo già
                pagato. Alla scadenza verrà rimosso automaticamente e lo slot tornerà libero.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-2">
              <AlertDialogCancel className="rounded-xl">Annulla</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => removalTarget && handleScheduleRemoval(removalTarget)}
              >
                Programma rimozione
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Group ticket dialog (problem / refund / help) */}
        {group && groupId && (
          <GroupTicketDialog
            open={ticketDialog.open}
            onOpenChange={(o) => setTicketDialog((s) => ({ ...s, open: o }))}
            kind={ticketDialog.kind}
            groupId={groupId}
            groupName={group.service_name}
            groupAdminEmail={group.admin_email}
            membershipId={members.find(m => m.user_email === user?.email)?.id || null}
          />
        )}
      </div>
    </div>
  );
}
