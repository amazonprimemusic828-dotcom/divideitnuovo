import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "@/components/AppShell";
import LandingNav from "@/components/landing/LandingNav";
import Hero from "@/components/landing/Hero";
import MarketingSections from "@/components/landing/MarketingSections";
import LandingFooter from "@/components/landing/LandingFooter";
import AccessPreview from "@/components/auth/AccessPreview";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import GroupExplorer from "@/components/groups/GroupExplorer";
import GroupDetailPreview from "@/components/groups/GroupDetailPreview";
import CreateGroupPreview from "@/components/groups/CreateGroupPreview";
import Inbox from "@/components/messages/Inbox";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import WalletOverview from "@/components/wallet/WalletOverview";
import ProfileSettings, { type ProfilePresentation } from "@/components/settings/ProfileSettings";
import TermsOfService from "@/pages/TermsOfService";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import LegalCookie from "@/pages/legal/LegalCookie";
import LegalRimborsi from "@/pages/legal/LegalRimborsi";
import LegalNoteLegali from "@/pages/legal/LegalNoteLegali";
import LegalAmlKyc from "@/pages/legal/LegalAmlKyc";
import LegalDsa from "@/pages/legal/LegalDsa";
import LegalRegoleCondivisione from "@/pages/legal/LegalRegoleCondivisione";
import { ReferralPreview, SupportPreview, UnavailablePreview } from "./SupportingPages";
import { previewConversations, previewGroups, previewNotifications, previewProfile, previewTransactions } from "./data";

function ReviewLanding() {
  const navigate = useNavigate();
  return <div className="font-sans"><LandingNav onStart={() => navigate("/BrowseGroups")} /><main><Hero onStart={() => navigate("/BrowseGroups")} /><MarketingSections onStart={() => navigate("/BrowseGroups")} /></main><LandingFooter /><Link className="review-dock" to="/Dashboard"><span className="size-1.5 rounded-full bg-primary" />Anteprima interfaccia<span className="review-dock-divider" />Apri la dashboard<ArrowUpRight className="size-4" /></Link></div>;
}

function RouteEffects() {
  const location = useLocation();
  useEffect(() => {
    const names: Record<string, string> = { "/dashboard": "Il tuo spazio", "/browsegroups": "Esplora gruppi", "/messages": "Messaggi", "/notifications": "Notifiche", "/wallet": "Portafoglio", "/settings": "Impostazioni", "/auth": "Il tuo account", "/creategroup": "Crea un gruppo", "/groupdetail": "Il tuo gruppo", "/support": "Centro assistenza" };
    document.title = `${names[location.pathname.toLowerCase()] || "Le cose belle, condivise."} — DivideIt`;
    if (location.hash) {
      requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start" }));
    } else window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname, location.hash]);
  return null;
}

// This is a separate presentation root: no AuthProvider, database client, payment SDK,
// presence tracker or live query hooks are mounted while reviewing the frontend.
function ReviewRoutes() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfilePresentation>(previewProfile);
  const [groups, setGroups] = useState(previewGroups);
  const [joinedIds, setJoinedIds] = useState(previewGroups.slice(0, 4).map((group) => group.id));
  const [notifications, setNotifications] = useState(previewNotifications);
  const [conversations, setConversations] = useState(previewConversations);
  const [theme, setTheme] = useState("light");
  const [reduceMotion, setReduceMotion] = useState(false);
  const avatarPreviewUrl = useRef<string | null>(null);
  useEffect(() => { document.documentElement.classList.toggle("dark", theme === "dark"); }, [theme]);
  useEffect(() => { document.documentElement.dataset.reduceMotion = String(reduceMotion); }, [reduceMotion]);
  useEffect(() => () => {
    if (avatarPreviewUrl.current) URL.revokeObjectURL(avatarPreviewUrl.current);
  }, []);
  const previewAvatarFile = (file: File) => {
    const url = URL.createObjectURL(file);
    if (avatarPreviewUrl.current) URL.revokeObjectURL(avatarPreviewUrl.current);
    avatarPreviewUrl.current = url;
    return url;
  };
  const selectPreviewAvatar = (avatar: string | null) => {
    if (avatarPreviewUrl.current && avatarPreviewUrl.current !== avatar) {
      URL.revokeObjectURL(avatarPreviewUrl.current);
      avatarPreviewUrl.current = null;
    }
    setProfile((current) => ({ ...current, avatar }));
    toast.success(avatar ? "Foto profilo aggiornata per questa sessione." : "Foto rimossa dall’anteprima.", {
      description: "Nessun salvataggio online. Ricaricando la pagina verrà ripristinata la foto iniziale.",
    });
  };
  const readNotification = (id: string) => setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item));
  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
      <RouteEffects />
      <Toaster theme={theme as "light" | "dark"} closeButton position="bottom-right" />
      <Routes>
        <Route path="/" element={<ReviewLanding />} />
        <Route path="/Auth" element={<AccessPreview />} />
        <Route path="/forgot-password" element={<AccessPreview />} />
        <Route path="/reset-password" element={<AccessPreview />} />
        <Route path="/ComeFunziona" element={<Navigate to="/#come-funziona" replace />} />
        <Route path="/Calcolatore" element={<Navigate to="/#risparmio" replace />} />
        <Route path="/TermsOfService" element={<TermsOfService />} />
        <Route path="/PrivacyPolicy" element={<PrivacyPolicy />} />
        <Route path="/legal/cookie" element={<LegalCookie />} />
        <Route path="/legal/rimborsi" element={<LegalRimborsi />} />
        <Route path="/legal/note-legali" element={<LegalNoteLegali />} />
        <Route path="/legal/aml-kyc" element={<LegalAmlKyc />} />
        <Route path="/legal/dsa" element={<LegalDsa />} />
        <Route path="/legal/regole-condivisione" element={<LegalRegoleCondivisione />} />
        <Route element={<AppShell profile={profile} preview unreadNotifications={notifications.filter((item) => !item.read).length} unreadMessages={conversations.reduce((sum, item) => sum + item.unread, 0)}><Outlet /></AppShell>}>
          <Route path="/Dashboard" element={<DashboardOverview name={profile.name} groups={groups.filter((group) => joinedIds.includes(group.id))} balance={128.4} preview />} />
          <Route path="/BrowseGroups" element={<GroupExplorer groups={groups} />} />
          <Route path="/GroupDetail" element={<GroupDetailPreview groups={groups} joinedIds={joinedIds} onJoin={(id) => { setJoinedIds((ids) => [...new Set([...ids, id])]); toast.info("Gruppo aggiunto solo all’anteprima. Nessun abbonamento è stato attivato."); }} />} />
          <Route path="/JoinGroup" element={<GroupDetailPreview groups={groups} joinedIds={joinedIds} onJoin={(id) => { setJoinedIds((ids) => [...new Set([...ids, id])]); toast.info("Partecipazione simulata, nessuna operazione reale."); }} />} />
          <Route path="/CreateGroup" element={<CreateGroupPreview services={previewGroups} onCreate={(group) => { setGroups((items) => [...items, group]); setJoinedIds((ids) => [...ids, group.id]); toast.info("Gruppo creato solo nell’anteprima. Nessun dato inviato al server."); }} />} />
          <Route path="/Messages" element={<Inbox conversations={conversations} profile={profile} preview onRead={(id) => setConversations((items) => items.map((item) => item.id === id ? { ...item, unread: 0 } : item))} />} />
          <Route path="/Notifications" element={<NotificationCenter notifications={notifications} onRead={readNotification} onReadAll={() => { setNotifications((items) => items.map((item) => ({ ...item, read: true }))); toast.success("Tutte lette nell’anteprima. Sei al passo con tutto."); }} onOpen={(notification) => { readNotification(notification.id); if (notification.link) navigate(notification.link); }} />} />
          <Route path="/Wallet" element={<WalletOverview balance={128.4} pending={13.5} withdrawn={240} transactions={previewTransactions} preview />} />
          <Route path="/Settings" element={<ProfileSettings profile={profile} preview theme={theme} onThemeChange={setTheme} reduceMotion={reduceMotion} onReduceMotionChange={setReduceMotion} onSave={(values) => { setProfile((current) => ({ ...current, ...values })); toast.success("Profilo aggiornato nell’anteprima. Nessun dato inviato al server."); }} onAvatarSelect={selectPreviewAvatar} onFileUpload={async (file) => previewAvatarFile(file)} onGeneratedAvatar={(file) => selectPreviewAvatar(previewAvatarFile(file))} />} />
          <Route path="/Support" element={<SupportPreview />} />
          <Route path="/Referral" element={<ReferralPreview />} />
          <Route path="*" element={<UnavailablePreview />} />
        </Route>
      </Routes>
    </MotionConfig>
  );
}

export default function ReviewApp() {
  return <TooltipProvider><BrowserRouter><ReviewRoutes /></BrowserRouter></TooltipProvider>;
}
