import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/components/AuthContext";
import { useNotifications } from "@/hooks/useGroupsData";

import { Home, Search, Wallet, Settings, LogOut, HeadphonesIcon, Bell, Plus, Globe, MessageCircle, MoreHorizontal, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import FloatingAIChat from "@/components/FloatingAIChat";
import UserAvatar from "@/components/UserAvatar";
import UserPresenceTracker from "@/components/UserPresenceTracker";
import ReferralWelcome from "@/components/ReferralWelcome";
import { EuroCoin } from "@/components/euro-coin";

const divideitLogo = "/divideit-logo.png";


interface LayoutProps {
  children: React.ReactNode;
  currentPageName: string;
}

function LayoutContent({ children, currentPageName }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, language, setLanguage, availableLanguages } = useTranslation();
  const { user: authUser, logout, loading: authLoading, isAuthenticated } = useAuth();

  
  const isLandingPage = currentPageName === "Landing";
  const isTermsPage = currentPageName === "TermsOfService";
  const isPrivacyPage = currentPageName === "PrivacyPolicy";

  // Build user object for display
  const user = authUser ? {
    email: authUser.email || "",
    full_name: authUser.full_name || "Utente",
    avatar_url: authUser.avatar_url || "",
    id: authUser.uid
  } : null;

  // Notifiche via React Query: il badge si aggiorna subito quando la pagina
  // Notifiche invalida la cache (es. "segna tutte come lette").
  const { data: notifications = [] } = useNotifications(authUser?.email);
  const unreadNotifications = notifications.filter((n) => !n.read).length;
  const unreadMessages = 0;



  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  if (isLandingPage || isTermsPage || isPrivacyPage) {
    return <div>{children}</div>;
  }

  const languageFlags: Record<string, string> = { it: "🇮🇹", en: "🇬🇧", es: "🇪🇸", fr: "🇫🇷" };

  const navItems = [
    { name: t('explore'), path: "/BrowseGroups", icon: Search },
    { name: t('myGroups'), path: "/Dashboard", icon: Home },
    { name: t('messages'), path: "/Messages", icon: MessageCircle, badge: unreadMessages > 0 ? unreadMessages : undefined },
    { name: t('notifications'), path: "/Notifications", icon: Bell, badge: unreadNotifications > 0 ? unreadNotifications : undefined },
    { name: t('wallet'), path: "/Wallet", icon: Wallet },
    { name: t('support'), path: "/Support", icon: HeadphonesIcon },
    { name: t('settings'), path: "/Settings", icon: Settings }
  ];

  // Mobile tab bar items (5 voci con FAB centrale)
  const mobileTabs: Array<{ name: string; path: string; icon: typeof Home; isFab?: boolean }> = [
    { name: t('myGroups'), path: "/Dashboard", icon: Home },
    { name: t('explore'), path: "/BrowseGroups", icon: Search },
    { name: "", path: "/CreateGroup", icon: Plus, isFab: true },
    { name: t('wallet'), path: "/Wallet", icon: Wallet },
    { name: t('settings'), path: "/Settings", icon: User },
  ];

  return (
    <div className="relative min-h-screen bg-background">
      <UserPresenceTracker />

      {/* Desktop Navbar */}
      <nav className="fixed left-0 right-0 top-0 z-50 hidden border-b border-border/70 bg-background/90 backdrop-blur-2xl lg:block">
        <div className="mx-auto flex h-[4.5rem] max-w-[1440px] items-center justify-between gap-8 px-8">
          <Link to="/Dashboard" className="flex shrink-0 items-center gap-3">
            <img
              src={divideitLogo}
              alt="DivideIt logo"
              className="h-10 w-10 rounded-xl object-cover ring-1 ring-border"
            />
            <div>
              <span className="block font-display text-[17px] font-extrabold tracking-[-0.03em] text-foreground">DIVIDEIT</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">condividi meglio</span>
            </div>
          </Link>

          <div className="flex items-center gap-1 rounded-2xl border border-border/70 bg-surface-muted/45 p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.name} to={item.path}
                  className={`relative flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition-all ${
                    isActive ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                  }`}>
                  <Icon className="h-4 w-4" strokeWidth={isActive ? 2.4 : 2} />
                  <span>{item.name}</span>
                  {item.badge && item.badge > 0 && (
                    <Badge className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs">{item.badge}</Badge>
                  )}
                </Link>
              );
            })}
          </div>

<EuroCoin size={38} showShadow={false} className="ml-3 -my-2" />

          <div className="flex items-center gap-3 absolute right-8">



            <Link to="/CreateGroup" className="btn-lift flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_12px_26px_-18px_hsl(var(--primary)/0.8)]">
              <Plus className="w-4 h-4" />
              <span className="text-sm">{t('createGroup')}</span>
            </Link>

            {!authLoading && user && (
              <div
                className="flex cursor-pointer items-center gap-3 rounded-full border border-border bg-surface-elevated px-3 py-2 transition-colors hover:border-primary/40"
                onClick={() => navigate('/Settings')}
              >
                <UserAvatar userEmail={user.email} userName={user.full_name} avatarUrl={user.avatar_url} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{user.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleLogout(); }}
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title="Esci"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Top App Bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-surface-elevated/85 backdrop-blur-xl border-b border-border/60 safe-top">
        <div className="flex items-center justify-between h-16 px-4">
          <Link to="/Dashboard" className="flex items-center gap-2 min-w-0">
            <img
              src={divideitLogo}
              alt="DivideIt logo"
              className="h-9 w-9 rounded-xl object-cover ring-1 ring-border"
            />
            <span className="text-lg font-black text-gradient-divideit tracking-tight">DIVIDEIT</span>
          </Link>

          <div className="flex items-center gap-1">
            <EuroCoin size={44} showShadow={false} className="mr-1 -my-2" />
            <Link

              to="/Messages"
              className="relative w-12 h-12 flex items-center justify-center rounded-2xl text-foreground active:bg-muted transition-colors"
              aria-label={t('messages')}
            >
              <MessageCircle className="w-6 h-6" strokeWidth={2.2} />
              {unreadMessages > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-surface-elevated">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </Link>
            <Link
              to="/Notifications"
              className="relative w-12 h-12 flex items-center justify-center rounded-2xl text-foreground active:bg-muted transition-colors"
              aria-label={t('notifications')}
            >
              <Bell className="w-6 h-6" strokeWidth={2.2} />
              {unreadNotifications > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-surface-elevated">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </Link>
            <Sheet>
              <SheetTrigger asChild>
                <button
                  className="w-12 h-12 flex items-center justify-center rounded-2xl text-foreground active:bg-muted transition-colors"
                  aria-label="Menu"
                >
                  <MoreHorizontal className="w-6 h-6" strokeWidth={2.2} />
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-3xl pb-10 px-5 max-h-[80vh] border-t-0">
                <SheetHeader>
                  <SheetTitle className="text-left">Menu</SheetTitle>
                </SheetHeader>
                <div className="space-y-3 mt-5">
                  <Link to="/Support" className="flex items-center gap-4 p-5 rounded-2xl bg-muted/60 active:bg-muted min-h-[64px]">
                    <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center">
                      <HeadphonesIcon className="w-5 h-5 text-primary-strong" />
                    </div>
                    <span className="font-semibold text-foreground">{t('support')}</span>
                  </Link>
                  <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/60 min-h-[64px]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center">
                        <Globe className="w-5 h-5 text-primary-strong" />
                      </div>
                      <span className="font-semibold text-foreground">Lingua</span>
                    </div>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="w-[90px] h-9 rounded-xl">
                        <span>{languageFlags[language]} {language.toUpperCase()}</span>
                      </SelectTrigger>
                      <SelectContent align="end">
                        {availableLanguages.map((lang) => (
                          <SelectItem key={lang} value={lang}>{languageFlags[lang]} {lang.toUpperCase()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {user && (
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-4 p-5 rounded-2xl bg-destructive/10 active:bg-destructive/20 text-destructive min-h-[64px]"
                    >
                      <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center">
                        <LogOut className="w-5 h-5" />
                      </div>
                      <span className="font-semibold">Esci</span>
                    </button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar with center FAB */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-elevated/95 backdrop-blur-xl border-t border-border/60 safe-bottom"
      >
        <div className="relative grid grid-cols-5 max-w-md mx-auto px-2 pt-2 pb-1">
          {mobileTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.path;

            if (tab.isFab) {
              return (
                <div key="fab" className="flex justify-center">
                  <Link
                    to={tab.path}
                    aria-label={t('createGroup')}
                    className="-mt-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_16px_28px_-14px_hsl(var(--primary)/0.8)] transition-transform active:scale-95"
                  >
                    <Plus className="w-8 h-8" strokeWidth={2.5} />
                  </Link>
                </div>
              );
            }

            return (
              <Link
                key={tab.path}
                to={tab.path}
                className="flex flex-col items-center justify-center gap-1 py-2 min-h-[60px] transition-colors"
              >
                <div className={`flex items-center justify-center w-12 h-8 rounded-full transition-all ${
                  isActive ? "bg-primary-soft" : ""
                }`}>
                  <Icon
                    className={`w-6 h-6 ${isActive ? "text-primary-strong" : "text-muted-foreground"}`}
                    strokeWidth={isActive ? 2.4 : 2}
                  />
                </div>
                <span className={`text-[11.5px] font-bold tracking-tight ${
                  isActive ? "text-primary-strong" : "text-muted-foreground"
                }`}>
                  {tab.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="relative z-10 pt-[4.5rem] pb-32 lg:pb-0">
        <div className="min-h-[calc(100vh-4.5rem)] px-1 sm:px-0">{children}</div>
      </main>

      <FloatingAIChat />
    </div>
  );
}

export default function Layout({ children, currentPageName }: LayoutProps) {
  return (
    <LayoutContent currentPageName={currentPageName}>
      <ReferralWelcome />
      {children}
    </LayoutContent>
  );
}
