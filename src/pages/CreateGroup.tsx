import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthContext";
import { 
  createGroup, 
  createMembership, 
  createNotification,
  generateInviteCode,
  supabase
} from "@/lib/supabaseClient";
import { SERVICE_COLORS } from "@/lib/serviceConstants";
import ServiceLogo from "@/components/ServiceLogo";
import { getCoverPresets } from "@/lib/coverPresets";
import { useRateLimit } from "@/hooks/useRateLimit";
import { stripeApi } from "@/lib/stripeApi";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle, Tv, Music, Gamepad2, Briefcase, BookOpen, Package, Lock, Loader2, Mail, Link as LinkIcon, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { usePhoneVerification } from "@/hooks/usePhoneVerification";
import PhoneVerificationDialog from "@/components/PhoneVerificationDialog";

interface ServicePlan {
  name: string;
  /** Prezzo BASE per persona al mese (senza fee Stripe). La fee viene aggiunta al momento del pagamento. */
  pricePerPerson: number;
  /** Numero di slot joiner di default (o massimo per piani flessibili). */
  members: number;
  /** Se presente, l'admin può scegliere quanti slot tra queste opzioni. */
  membersOptions?: number[];
  yearly?: boolean;
}

interface Service {
  name: string;

  plans: ServicePlan[];
}

interface Category {
  title: string;
  icon: React.ElementType;
  color: string;
  services: Service[];
}

const subscriptionCategories: Record<string, Category> = {
  streaming: {
    title: "Streaming",
    icon: Tv,
    color: "from-red-500 to-pink-600",
    services: [
      {
        name: "Netflix",
        plans: [
          { name: "Standard +1 Extra", pricePerPerson: 9.49, members: 1 },
          { name: "Premium +1 Extra", pricePerPerson: 12.49, members: 1 },
          { name: "Premium +2 Extras", pricePerPerson: 9.99, members: 2, membersOptions: [1, 2] },
        ],
      },
      {
        name: "Disney+",
        plans: [
          { name: "Premium (Mensile) + Extra", pricePerPerson: 11.49, members: 1 },
          { name: "Standard (Mensile) + Extra", pricePerPerson: 8.99, members: 1 },
          { name: "Standard Pubblicità (Mensile) + Extra", pricePerPerson: 6.49, members: 1 },
          { name: "Premium (Annuale) + Extra", pricePerPerson: 9.65, members: 1, yearly: true },
          { name: "Standard (Annuale) + Extra", pricePerPerson: 7.57, members: 1, yearly: true },
        ],
      },
      {
        name: "Prime Video",
        plans: [
          { name: "Prime Video", pricePerPerson: 1.66, members: 2, membersOptions: [1, 2] },
          { name: "Prime Video No Ads", pricePerPerson: 2.33, members: 2, membersOptions: [1, 2] },
        ],
      },
      {
        name: "NOW",
        plans: [
          { name: "Cinema e Entertainment", pricePerPerson: 7.50, members: 1 },
          { name: "Sport + Premium", pricePerPerson: 17.50, members: 1 },
          { name: "Cinema, Entertainment, Sport + Premium", pricePerPerson: 21.00, members: 1 },
        ],
      },
      {
        name: "Paramount+",
        plans: [
          { name: "Paramount+", pricePerPerson: 4.00, members: 1 },
          { name: "Paramount+ Premium", pricePerPerson: 3.25, members: 3, membersOptions: [1, 2, 3] },
        ],
      },
      {
        name: "YouTube Premium",
        plans: [{ name: "Famiglia", pricePerPerson: 4.33, members: 5 }],
      },
      {
        name: "MUBI",
        plans: [{ name: "MUBI", pricePerPerson: 6.00, members: 1 }],
      },
      {
        name: "Crunchyroll",
        plans: [{ name: "Premium Mega Fan", pricePerPerson: 1.87, members: 3, membersOptions: [1, 2, 3] }],
      },
      {
        name: "Marvel Unlimited",
        plans: [{ name: "Marvel Unlimited", pricePerPerson: 1.67, members: 5, membersOptions: [1, 2, 3, 4, 5] }],
      },
      {
        name: "Discovery+",
        plans: [
          { name: "Intrattenimento", pricePerPerson: 2.75, members: 1 },
          { name: "Intrattenimento + Sport", pricePerPerson: 4.00, members: 1 },
          { name: "Intrattenimento con pubblicità", pricePerPerson: 1.45, members: 1 },
        ],
      },
      {
        name: "HBO Max",
        plans: [
          { name: "Base", pricePerPerson: 3.00, members: 1 },
          { name: "Standard", pricePerPerson: 6.00, members: 1 },
          { name: "Premium", pricePerPerson: 4.25, members: 3, membersOptions: [1, 2, 3] },
          { name: "Standard + Sport", pricePerPerson: 7.50, members: 1 },
          { name: "Premium + Sport", pricePerPerson: 9.99, members: 1 },
          { name: "Base + Sport", pricePerPerson: 4.50, members: 1 },
        ],
      },
    ],
  },
  music: {
    title: "Musica",
    icon: Music,
    color: "from-green-500 to-emerald-600",
    services: [
      {
        name: "Apple Music",
        plans: [{ name: "Famiglia", pricePerPerson: 2.83, members: 5 }],
      },
      {
        name: "Amazon Music",
        plans: [{ name: "Famiglia", pricePerPerson: 3.00, members: 5 }],
      },
      {
        name: "Tidal",
        plans: [{ name: "Famiglia", pricePerPerson: 2.83, members: 5, membersOptions: [1, 2, 3, 4, 5] }],
      },
    ],
  },
  productivity: {
    title: "Produttività",
    icon: Briefcase,
    color: "from-orange-500 to-amber-600",
    services: [
      {
        name: "Microsoft 365",
        plans: [{ name: "Family", pricePerPerson: 3.67, members: 5 }],
      },
      {
        name: "Duolingo",
        plans: [{ name: "Super Famiglia", pricePerPerson: 1.72, members: 5, membersOptions: [1, 2, 3, 4, 5] }],
      },
      {
        name: "Strava",
        plans: [{ name: "Piano Famiglia", pricePerPerson: 2.08, members: 3, membersOptions: [1, 2, 3] }],
      },
    ],
  },
  gaming: {
    title: "Gaming",
    icon: Gamepad2,
    color: "from-indigo-500 to-purple-600",
    services: [
      {
        name: "Xbox",
        plans: [{ name: "Xbox", pricePerPerson: 3.50, members: 1 }],
      },
      {
        name: "Nintendo Switch Online",
        plans: [
          { name: "Nintendo Switch Online", pricePerPerson: 0.50, members: 7, membersOptions: [1, 2, 3, 4, 5, 6, 7] },
          { name: "Nintendo Switch Online + Pacchetto aggiuntivo", pricePerPerson: 0.73, members: 7, membersOptions: [1, 2, 3, 4, 5, 6, 7] },
        ],
      },
    ],
  },
  lettura: {
    title: "Lettura",
    icon: BookOpen,
    color: "from-yellow-500 to-orange-500",
    services: [
      {
        name: "Audible",
        plans: [{ name: "Audible", pricePerPerson: 1.00, members: 9, membersOptions: [1, 2, 3, 4, 5, 6, 7, 8, 9] }],
      },
    ],
  },
  pacchetto: {
    title: "Pacchetto",
    icon: Package,
    color: "from-slate-500 to-gray-700",
    services: [
      {
        name: "Apple One",
        plans: [
          { name: "Family", pricePerPerson: 4.33, members: 5, membersOptions: [1, 2, 3, 4, 5] },
          { name: "Premier", pricePerPerson: 5.83, members: 5, membersOptions: [1, 2, 3, 4, 5] },
        ],
      },
    ],
  },
};

export default function CreateGroup() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  
  const { executeWithRateLimit, isLocked: rateLimited } = useRateLimit(5000, "Attendi prima di creare un altro gruppo.");
  
  const [selectedCategory, setSelectedCategory] = useState("streaming");
  const [expandedService, setExpandedService] = useState<Service | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ServicePlan | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<number>(1);
  const [billingDate, setBillingDate] = useState("15");
  const [isPublic, setIsPublic] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [credDialog, setCredDialog] = useState<{ open: boolean; groupId: string | null }>({ open: false, groupId: null });
  const [credMode, setCredMode] = useState<"email" | "link">("email");
  const [credEmail, setCredEmail] = useState("");
  const [credPassword, setCredPassword] = useState("");
  const [credLink, setCredLink] = useState("");
  const [credNotes, setCredNotes] = useState("");
  const [credSaving, setCredSaving] = useState(false);
  const { status: phoneStatus, loading: phoneLoading } = usePhoneVerification();
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const coverInputRef = React.useRef<HTMLInputElement>(null);

  const handleCoverSelect = (file?: File | null) => {
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png|webp|gif|avif)$/i.test(file.type)) {
      toast.error("Formato non supportato. Usa JPG, PNG, WEBP, GIF o AVIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Immagine troppo grande (max 5MB).");
      return;
    }
    setCoverFile(file);
    setSelectedPreset(null);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSelectPreset = (url: string) => {
    setSelectedPreset(url);
    setCoverFile(null);
    setCoverPreview(null);
  };

  const uploadCover = async (uid: string): Promise<string | null> => {
    if (!coverFile) return selectedPreset;
    try {
      const ext = (coverFile.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${uid}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("group-covers").upload(path, coverFile, {
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw error;
      const { data } = await supabase.storage
        .from("group-covers")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      return data?.signedUrl ?? null;
    } catch (e) {
      console.warn("cover upload failed", e);
      toast.warning("Copertina non caricata, useremo lo sfondo predefinito.");
      return null;
    }
  };


  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/');
    }
  }, [authLoading, isAuthenticated, navigate]);

  const handleSelectPlan = (service: Service, plan: ServicePlan) => {
    setSelectedService(service);
    setSelectedPlan(plan);
    setSelectedMembers(plan.membersOptions?.[plan.membersOptions.length - 1] ?? plan.members);
  };

  // Prezzo BASE per persona (senza fee Stripe — la fee viene aggiunta al pagamento).
  const perPersonBase = (plan: ServicePlan) => plan.pricePerPerson;
  // Numero di posti effettivi (slot del gruppo).
  const planMaxMembers = (plan: ServicePlan) =>
    plan.membersOptions ? plan.membersOptions[plan.membersOptions.length - 1] : plan.members;
  const effectiveMembers = selectedPlan
    ? (selectedPlan.membersOptions ? selectedMembers : selectedPlan.members)
    : 0;
  // Totale gruppo BASE (senza fee Stripe).
  const groupTotalBase = selectedPlan ? perPersonBase(selectedPlan) * effectiveMembers : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedService || !selectedPlan) {
      toast.error("Seleziona un servizio e un piano");
      return;
    }

    if (!agreedToTerms) {
      toast.error("Accetta i termini di servizio");
      return;
    }

    if (!phoneStatus?.verified) {
      toast.error("Verifica il tuo numero di telefono prima di creare un gruppo");
      setPhoneOpen(true);
      return;
    }

    if (!user?.email) {
      toast.error("Errore autenticazione");
      return;
    }

    await executeWithRateLimit(async () => {
      setLoading(true);

      try {
        const inviteCode = generateInviteCode();
        const coverUrl = user.uid ? await uploadCover(user.uid) : null;

        const group = await createGroup({
          service_name: `${selectedService!.name} ${selectedPlan!.name}`,
          service_type: selectedService!.name,
          plan_type: selectedPlan!.name,
          total_cost: Number(groupTotalBase.toFixed(2)),
          currency: "EUR",
          max_members: effectiveMembers,
          billing_date: parseInt(billingDate),
          description: `Gruppo ${selectedService!.name} creato da ${user.full_name}`,
          invite_code: inviteCode,
          status: "active",
          is_public: isPublic,
          admin_email: user.email,
          stripe_account_id: null,
          cover_image_url: coverUrl
        });

        const stripeAccountRes = await stripeApi("ensure-account", {
          ownerEmail: user.email,
          ownerUid: user.uid,
          ownerName: user.full_name,
          groupId: group.id,
        });

        if (!stripeAccountRes.ok) {
          toast.warning("Gruppo creato, ma configurazione Stripe non completata. Apri Portafoglio per riprovare.");
        }

        await createMembership({
          group_id: group.id,
          user_email: user.email,
          user_name: user.full_name || '',
          user_avatar_url: user.avatar_url || null,
          role: "admin",
          payment_status: "paid",
          joined_date: new Date().toISOString().split("T")[0]
        });

        try {
          await createNotification({
            user_email: user.email,
            type: "group_update",
            title: "Gruppo Creato",
            content: `Hai creato con successo il gruppo ${selectedService!.name} ${selectedPlan!.name}!`,
            link: `/GroupDetail?id=${group.id}`,
            group_id: group.id
          });
        } catch (notifError) {
          console.warn("⚠️ Notifica non creata (non bloccante):", notifError);
        }

        // Trigger waitlist processing: if any user is waiting for this service,
        // automatically capture their pre-auth and assign them to the new group.
        const waitlistResult = await stripeApi("waitlist-process", { groupId: group.id });
        if (!waitlistResult.ok) {
          console.error("Auto-assegnazione coda non riuscita:", waitlistResult.data);
          toast.warning("Gruppo creato. L'assegnazione automatica della coda verrà ritentata.");
        } else if (Number(waitlistResult.data?.processed || 0) > 0) {
          toast.success(`${waitlistResult.data.processed} partecipante dalla coda aggiunto automaticamente.`);
        }

        toast.success("Gruppo creato con successo! 🎉");
        setCredDialog({ open: true, groupId: group.id });
      } catch (error: any) {
        console.error("❌ Errore Supabase:", error);
        if (error?.code === '23505' || error?.status === 409) {
          toast.error("Hai già creato un gruppo per questo servizio. Non puoi crearne un altro uguale.");
        } else {
          toast.error("Errore creazione gruppo");
        }
      } finally {
        setLoading(false);
      }

      return null;
    });
  };

  const currentCategory = subscriptionCategories[selectedCategory];
  const CategoryIcon = currentCategory.icon;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen pb-24 lg:pb-10">
      
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-8 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-4"></div>
            <p className="text-xl font-semibold">Creazione in corso...</p>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-xl border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 lg:px-10 py-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/Dashboard')}
            className="hover:bg-muted/50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Torna Indietro
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-10 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-2">Crea un Nuovo Gruppo</h1>
          <p className="text-muted-foreground text-lg">Seleziona categoria e scegli abbonamento</p>
        </div>

        {!phoneStatus?.verified ? (

          <div className="mb-6 rounded-2xl border-2 border-orange-400/40 bg-orange-50 dark:bg-orange-950/20 p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-foreground text-sm sm:text-base">Verifica il numero per creare un gruppo</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Per la sicurezza di tutti i membri ti chiediamo di verificare il tuo numero di telefono via SMS. Bastano 30 secondi.
              </p>
              <Button type="button" onClick={() => setPhoneOpen(true)} className="mt-3 w-full sm:w-auto gradient-divideit text-white">
                Verifica ora
              </Button>
            </div>
          </div>
        ) : null}





        <form onSubmit={handleSubmit}>
          
          <div className="mb-8 overflow-x-auto">
            <div className="flex gap-3 min-w-max pb-2">
              {Object.entries(subscriptionCategories).map(([key, category]) => {
                const Icon = category.icon;
                const isActive = selectedCategory === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(key);
                      setExpandedService(null);
                      setSelectedService(null);
                      setSelectedPlan(null);
                    }}
                    className={`flex items-center gap-3 px-6 py-3 rounded-xl font-semibold transition-all ${
                      isActive
                        ? `bg-gradient-to-r ${category.color} text-white shadow-lg scale-105`
                        : "bg-card text-foreground hover:bg-muted border-2"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {category.title}
                  </button>
                );
              })}
            </div>
          </div>

          <Card className="mb-6 bg-card/80 backdrop-blur-sm rounded-3xl shadow-xl overflow-hidden">
            <CardHeader className={`bg-gradient-to-r ${currentCategory.color} text-white p-4 sm:p-6`}>
              <CardTitle className="text-xl sm:text-2xl flex items-center gap-3">
                <CategoryIcon className="w-6 h-6 sm:w-7 sm:h-7" />
                {currentCategory.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              {!expandedService ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {currentCategory.services.map((service) => (
                    <button
                      key={service.name}
                      type="button"
                      onClick={() => setExpandedService(service)}
                      className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 p-3 sm:p-5 min-h-[100px] sm:min-h-0 bg-muted/50 hover:bg-muted rounded-2xl border-2 border-transparent hover:border-primary/40 transition-all hover:shadow-md overflow-hidden"
                    >
                      <div className="flex items-center justify-center h-10 w-full sm:w-12 sm:h-8 shrink-0">
                          <ServiceLogo name={service.name} size={32} className="max-h-full max-w-full" />
                        </div>
                      <span className="font-bold text-foreground text-xs sm:text-base text-center sm:text-left leading-tight break-words w-full min-w-0">{service.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => { setExpandedService(null); setSelectedService(null); setSelectedPlan(null); }}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Torna ai servizi
                    </button>
                    <div className="flex items-center gap-3">
                      <ServiceLogo name={expandedService.name} size={28} className="h-7 w-auto" />
                      <span className="font-bold text-foreground">{expandedService.name}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {expandedService.plans.map((plan) => {
                      const isSelected = selectedService?.name === expandedService.name && selectedPlan?.name === plan.name;
                      const maxM = planMaxMembers(plan);
                      const cardTotal = perPersonBase(plan) * maxM;
                      return (
                        <button
                          key={plan.name}
                          type="button"
                          onClick={() => handleSelectPlan(expandedService, plan)}
                          className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                            isSelected
                              ? "border-primary bg-primary/10 shadow-lg"
                              : "border-border hover:border-muted-foreground bg-card"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-foreground">{plan.name}</span>
                            {isSelected && <CheckCircle className="w-5 h-5 text-primary" />}
                          </div>
                          <div className="mb-1">
                            <div className="text-xs text-muted-foreground">Totale gruppo</div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-bold text-foreground">€{cardTotal.toFixed(2)}</span>
                              <span className="text-sm text-muted-foreground">/{plan.yearly ? 'anno' : 'mese'}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              €{perPersonBase(plan).toFixed(2)} a persona
                            </div>
                          </div>
                          <div className="pt-2 border-t border-border">
                            <span className="text-sm font-semibold text-green-600">
                              {plan.membersOptions
                                ? `Posti: fino a ${maxM} (decidi tu)`
                                : `Fino a ${plan.members} ${plan.members === 1 ? 'persona' : 'persone'}`}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedService && selectedPlan && (
            <div className="fixed bottom-0 left-0 right-0 max-h-[78vh] overflow-y-auto overscroll-contain bg-card/95 backdrop-blur-xl border-t shadow-2xl z-20 lg:max-h-none lg:overflow-visible lg:bottom-0 pb-20 lg:pb-0">
              <div className="max-w-7xl mx-auto px-4 lg:px-10 py-4 lg:py-6">
                <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start lg:items-center">
                  <div className="flex-1 w-full">
                    <button
                      type="button"
                      onClick={() => { setSelectedPlan(null); setSelectedService(null); }}
                      className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground lg:hidden"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Indietro
                    </button>
                    <div className="flex items-center gap-4 mb-3">
                      <ServiceLogo name={selectedService.name} size={40} className="h-8 lg:h-10" />

                      <div>
                        <h3 className="text-lg lg:text-xl font-bold text-foreground">
                          {selectedService.name} {selectedPlan.name}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          €{perPersonBase(selectedPlan).toFixed(2)}/{selectedPlan.yearly ? 'anno' : 'mese'} a persona • {effectiveMembers} {effectiveMembers === 1 ? 'posto' : 'posti'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3 mb-4">
                      <div className="bg-blue-50 rounded-lg p-2">
                        <p className="text-xs text-muted-foreground">Totale gruppo</p>
                        <p className="text-base lg:text-lg font-bold">€{groupTotalBase.toFixed(2)}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2">
                        <p className="text-xs text-muted-foreground">A persona</p>
                        <p className="text-base lg:text-lg font-bold text-green-600">€{perPersonBase(selectedPlan).toFixed(2)}</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-2">
                        <Label className="text-xs text-muted-foreground">Fatturazione</Label>
                        <select
                          value={billingDate}
                          onChange={(e) => setBillingDate(e.target.value)}
                          className="w-full text-sm font-bold bg-transparent"
                        >
                          {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                            <option key={day} value={day}>Giorno {day}</option>
                          ))}
                        </select>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-2 flex items-center gap-2">
                        <Switch
                          checked={isPublic}
                          onCheckedChange={setIsPublic}
                        />
                        <Label className="text-xs">Pubblico</Label>
                      </div>
                    </div>

                    {selectedPlan.membersOptions && (
                      <div className="mb-4 flex items-center gap-3 flex-wrap">
                        <Label className="text-sm font-semibold">Numero di posti:</Label>
                        {selectedPlan.membersOptions.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setSelectedMembers(opt)}
                            className={`px-4 py-1.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                              selectedMembers === opt
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-card text-foreground hover:border-muted-foreground"
                            }`}
                          >
                            {opt} {opt === 1 ? 'posto' : 'posti'}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Copertina del gruppo */}
                    <div className="mb-4">
                      <Label className="text-sm font-semibold">Copertina del gruppo</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Scegli uno sfondo predefinito oppure carica un'immagine dalla tua galleria.
                      </p>

                      {/* Preview selezionata */}
                      {selectedPreset || coverPreview ? (
                        <div
                          className="w-full h-32 rounded-xl overflow-hidden border-2 border-border bg-cover bg-center mb-3 relative"
                          style={{
                            backgroundImage: `url(${coverPreview || selectedPreset!})`,
                          }}
                        >
                          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">
                            Copertina scelta ✓
                          </div>
                        </div>
                      ) : (
                        <div
                          className="w-full h-32 rounded-xl overflow-hidden border-2 border-border bg-cover bg-center mb-3 flex items-center justify-center"
                          style={{
                            background:
                              SERVICE_COLORS[selectedService.name] ||
                              "linear-gradient(135deg, #5B6FBD 0%, #7DD3C0 100%)",
                          }}
                        >
                          <span className="text-white/90 text-xs font-semibold bg-black/30 px-3 py-1 rounded-lg">
                            Sfondo predefinito
                          </span>
                        </div>
                      )}

                      {/* Copertine predefinite */}
                      <Label className="text-xs text-muted-foreground block mb-1.5">Scegli uno sfondo:</Label>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {getCoverPresets(selectedService.name).map((url) => {
                          const active = selectedPreset === url;
                          return (
                            <button
                              key={url}
                              type="button"
                              onClick={() => handleSelectPreset(url)}
                              className={`relative h-16 rounded-xl overflow-hidden bg-cover bg-center transition-all min-h-[44px] ${
                                active
                                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                                  : "hover:opacity-90"
                              }`}
                              style={{ backgroundImage: `url(${url})` }}
                              aria-label="Scegli copertina predefinita"
                            >
                              {active && (
                                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                  <CheckCircle className="w-5 h-5 text-white drop-shadow" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Carica dalla galleria */}
                      <div className="flex flex-wrap gap-2">
                        <input
                          ref={coverInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                          className="hidden"
                          onChange={(e) => handleCoverSelect(e.target.files?.[0])}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-[44px] rounded-xl"
                          onClick={() => coverInputRef.current?.click()}
                        >
                          {coverPreview ? "Cambia immagine" : "Carica dalla galleria"}
                        </Button>
                        {(selectedPreset || coverPreview) && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="min-h-[44px] rounded-xl"
                            onClick={() => {
                              setCoverFile(null);
                              setCoverPreview(null);
                              setSelectedPreset(null);
                            }}
                          >
                            Usa predefinito
                          </Button>
                        )}
                      </div>
                    </div>


                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={agreedToTerms}
                        onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                      />
                      <Label className="text-xs lg:text-sm text-muted-foreground">
                        Accetto i <a href="/TermsOfService" target="_blank" className="text-primary hover:underline">Termini</a> e la <a href="/PrivacyPolicy" target="_blank" className="text-primary hover:underline">Privacy Policy</a>
                      </Label>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !agreedToTerms || rateLimited || !phoneStatus?.verified}
                    className="w-full lg:w-auto h-12 lg:h-14 gradient-divideit text-white text-base lg:text-lg font-semibold rounded-xl"
                  >
                    {loading ? "Creazione..." : !phoneStatus?.verified ? "Verifica numero per continuare" : rateLimited ? "Attendi..." : "Crea Gruppo"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      <Dialog
        open={credDialog.open}
        onOpenChange={(open) => {
          if (!open && credDialog.groupId) {
            const id = credDialog.groupId;
            setCredDialog({ open: false, groupId: null });
            navigate(`/GroupDetail?id=${id}`);
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle>Credenziali del servizio (opzionale)</DialogTitle>
            <DialogDescription>
              Solo tu (admin) puoi inserirle. Saranno cifrate AES‑256‑GCM e visibili soltanto ai membri con pagamento attivo. Potrai modificarle in qualsiasi momento nella pagina del gruppo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Tabs like Together Price: Email vs Link */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-muted">
              <button
                type="button"
                onClick={() => setCredMode("email")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  credMode === "email" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                }`}
              >
                <Mail className="w-4 h-4" /> Email & password
              </button>
              <button
                type="button"
                onClick={() => setCredMode("link")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  credMode === "link" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                }`}
              >
                <LinkIcon className="w-4 h-4" /> Link di invito
              </button>
            </div>

            {credMode === "email" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="cred-email">Email account</Label>
                  <Input
                    id="cred-email"
                    type="email"
                    autoComplete="off"
                    placeholder="netflix@example.com"
                    value={credEmail}
                    onChange={(e) => setCredEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cred-password">Password</Label>
                  <Input
                    id="cred-password"
                    type="text"
                    autoComplete="off"
                    placeholder="••••••••"
                    value={credPassword}
                    onChange={(e) => setCredPassword(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="cred-link">Link di invito</Label>
                <Input
                  id="cred-link"
                  type="url"
                  autoComplete="off"
                  placeholder="https://netflix.com/invite/..."
                  value={credLink}
                  onChange={(e) => setCredLink(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Il link che i membri devono aprire per accedere al servizio.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cred-notes">Note (PIN, profilo, istruzioni)</Label>
              <Textarea
                id="cred-notes"
                rows={2}
                placeholder="Profilo: Cal — PIN: 1234"
                value={credNotes}
                onChange={(e) => setCredNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={credSaving}
              onClick={() => {
                const id = credDialog.groupId!;
                setCredDialog({ open: false, groupId: null });
                setCredEmail(""); setCredPassword(""); setCredNotes(""); setCredLink("");
                navigate(`/GroupDetail?id=${id}`);
              }}
            >
              Salta per ora
            </Button>
            <Button
              className="gradient-divideit text-white rounded-xl"
              disabled={
                credSaving ||
                (credMode === "email" && !credEmail && !credPassword && !credNotes) ||
                (credMode === "link" && !credLink.trim())
              }
              onClick={async () => {
                if (!credDialog.groupId || !user?.email) return;
                if (credMode === "link") {
                  try { new URL(credLink.trim()); }
                  catch { toast.error("Link non valido"); return; }
                }
                setCredSaving(true);
                try {
                  const payload = credMode === "email"
                    ? { type: "email", email: credEmail.trim(), password: credPassword, notes: credNotes.trim() }
                    : { type: "link", link: credLink.trim(), notes: credNotes.trim() };
                  const { ok, data } = await stripeApi("credentials-set", {
                    groupId: credDialog.groupId,
                    ownerEmail: user.email,
                    credentials: JSON.stringify(payload),
                  });
                  if (!ok) {
                    toast.error(data?.error || "Errore salvataggio credenziali");
                    return;
                  }
                  toast.success("Credenziali salvate in modo cifrato 🔒");
                  const id = credDialog.groupId;
                  setCredDialog({ open: false, groupId: null });
                  setCredEmail(""); setCredPassword(""); setCredNotes(""); setCredLink("");
                  navigate(`/GroupDetail?id=${id}`);
                } catch (err: any) {
                  toast.error(err?.message || "Errore di rete");
                } finally {
                  setCredSaving(false);
                }
              }}
            >
              {credSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
              Salva cifrate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PhoneVerificationDialog open={phoneOpen} onOpenChange={setPhoneOpen} />
    </div>
  );
}
