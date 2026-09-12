import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Bell, ChevronDown, Compass, Gift, HelpCircle, LayoutDashboard, LogOut, Menu, MessageSquare, Plus, Search, Settings2, UserRound, UsersRound, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Brand from "@/components/Brand";
import UserAvatar from "@/components/UserAvatar";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  profile?: { name: string; email: string; avatar?: string | null };
  unreadNotifications?: number;
  unreadMessages?: number;
  preview?: boolean;
  onLogout?: () => void;
}

function AccountMenu({ profile, preview, onLogout }: Pick<AppShellProps, "profile" | "preview" | "onLogout">) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-12 px-2" aria-label="Apri menu account">
          <span aria-hidden="true"><UserAvatar userEmail={profile?.email || ""} userName={profile?.name || "Il tuo profilo"} avatarUrl={profile?.avatar} size="sm" /></span>
          <span className="hidden max-w-36 truncate xl:inline">{profile?.name || "Il tuo profilo"}</span>
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate">{profile?.name || "Il tuo account"}</span>
            <span className="block truncate text-sm font-normal text-muted-foreground">{preview ? "Profilo dimostrativo" : profile?.email || "Gestisci il tuo spazio"}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild><Link to="/Settings?tab=profile" className="flex items-center gap-3"><UserRound className="size-4" aria-hidden="true" />Il tuo profilo</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link to="/Settings" className="flex items-center gap-3"><Settings2 className="size-4" aria-hidden="true" />Impostazioni</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link to="/Support" className="flex items-center gap-3"><HelpCircle className="size-4" aria-hidden="true" />Centro assistenza</Link></DropdownMenuItem>
        </DropdownMenuGroup>
        {onLogout && <><DropdownMenuSeparator /><DropdownMenuGroup><DropdownMenuItem onSelect={onLogout} className="flex items-center gap-3"><LogOut className="size-4" aria-hidden="true" />Esci</DropdownMenuItem></DropdownMenuGroup></>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AppShell({ children, profile, unreadNotifications = 0, unreadMessages = 0, preview = false, onLogout }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navItems = [
    { label: "Panoramica", path: "/Dashboard", icon: LayoutDashboard },
    { label: "Esplora gruppi", path: "/BrowseGroups", icon: Compass },
    { label: "I miei gruppi", path: "/Dashboard?tab=groups", icon: UsersRound },
    { label: "Messaggi", path: "/Messages", icon: MessageSquare, count: unreadMessages },
    { label: "Notifiche", path: "/Notifications", icon: Bell, count: unreadNotifications },
    { label: "Portafoglio", path: "/Wallet", icon: Wallet },
  ];
  const pathname = location.pathname.toLowerCase();
  const groupsTab = pathname === "/dashboard" && new URLSearchParams(location.search).get("tab") === "groups";
  const currentPath = pathname + (groupsTab ? "?tab=groups" : "");
  const active = (path: string) => currentPath === path.toLowerCase();
  const pageLabels: Record<string, string> = { "/settings": "Impostazioni", "/support": "Centro assistenza", "/creategroup": "Crea un gruppo", "/groupdetail": "Dettaglio gruppo", "/joingroup": "Unisciti al gruppo", "/referral": "Invita un amico" };
  const currentLabel = navItems.find((item) => active(item.path))?.label || pageLabels[pathname] || "Il tuo spazio";
  const navigationLinks = (mobile = false) => navItems.map(({ label, path, icon: Icon, count }) => (
    <Link
      key={path}
      to={path}
      onClick={() => setMenuOpen(false)}
      className={cn(mobile ? "sidebar-link" : "app-nav-link", active(path) && "is-active")}
      aria-current={active(path) ? "page" : undefined}
      aria-label={count ? `${label}, ${count} da leggere` : undefined}
    >
      <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
      <span className={mobile ? "flex-1" : undefined}>{label}</span>
      {!!count && <span className="nav-count" aria-hidden="true">{count > 99 ? "99+" : count}</span>}
    </Link>
  ));
  const mobileNavigation = (
    <div className="sidebar-content">
      <div className="sidebar-brand"><Brand to="/Dashboard" /></div>
      <div className="sidebar-workspace"><span className="workspace-icon"><UsersRound className="size-4" aria-hidden="true" /></span><div><span className="block text-sm font-semibold">Il mio spazio</span><span className="block text-sm text-muted-foreground">Condividi, risparmia, vivi.</span></div></div>
      <div className="sidebar-nav-block">
        <p className="sidebar-label">LA TUA QUOTIDIANITÀ</p>
        <nav aria-label="Navigazione mobile" className="flex flex-col gap-1">{navigationLinks(true)}</nav>
      </div>
      <div className="sidebar-invite"><span className="invite-gift"><Gift className="size-5" aria-hidden="true" /></span><p className="font-display font-bold">Insieme conviene.</p><p className="text-sm leading-relaxed text-muted-foreground">Invita chi vuoi. Le cose belle si condividono.</p><Link to="/Referral" onClick={() => setMenuOpen(false)} className="inline-flex items-center gap-2 text-sm font-semibold text-primary">Invita un amico<ArrowUpRight className="size-4" aria-hidden="true" /></Link></div>
      <nav className="sidebar-bottom-nav" aria-label="Account e assistenza"><Link to="/Support" className={cn("sidebar-link", active("/Support") && "is-active")} onClick={() => setMenuOpen(false)}><HelpCircle className="size-5" aria-hidden="true" />Centro assistenza</Link><Link to="/Settings" className={cn("sidebar-link", active("/Settings") && "is-active")} onClick={() => setMenuOpen(false)}><Settings2 className="size-5" aria-hidden="true" />Impostazioni</Link></nav>
      <div className="sidebar-profile"><Link to="/Settings" className="flex min-w-0 flex-1 items-center gap-3" onClick={() => setMenuOpen(false)}><UserAvatar userEmail={profile?.email || ""} userName={profile?.name || "Il tuo profilo"} avatarUrl={profile?.avatar} size="md" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{profile?.name || "Il tuo profilo"}</p><p className="truncate text-sm text-muted-foreground">{preview ? "Profilo dimostrativo" : "Gestisci account"}</p></div></Link>{onLogout ? <Button variant="ghost" size="icon" aria-label="Esci" onClick={onLogout}><LogOut /></Button> : <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />}</div>
    </div>
  );

  return (
    <div className="app-shell font-sans">
      <a href="#main-content" className="skip-link">Vai al contenuto</a>
      <div className="app-workspace">
        <header className="app-header">
          <div className="app-topbar">
            <div className="flex min-w-0 items-center gap-3">
              <div className="hidden lg:block"><Brand to="/Dashboard" /></div>
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Apri navigazione"><Menu /></Button></SheetTrigger>
                <SheetContent side="left" className="w-72 p-0"><SheetHeader className="sr-only"><SheetTitle>Navigazione DivideIt</SheetTitle><SheetDescription>Esplora tutte le schermate del tuo spazio.</SheetDescription></SheetHeader>{mobileNavigation}</SheetContent>
              </Sheet>
              <span className="truncate text-sm font-medium lg:hidden">{currentLabel}</span>
            </div>
            <form
              className="app-search hidden lg:block"
              role="search"
              aria-label="Cerca negli abbonamenti"
              onSubmit={(event) => { event.preventDefault(); navigate(`/BrowseGroups?q=${encodeURIComponent(search.trim())}`); }}
            >
              <InputGroup>
                <InputGroupInput
                  type="search"
                  aria-label="Cerca un abbonamento"
                  placeholder="Cerca un abbonamento..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }}
                />
                <InputGroupAddon align="inline-end"><Button type="submit" size="icon" variant="ghost" aria-label="Cerca gruppi"><Search /></Button></InputGroupAddon>
              </InputGroup>
            </form>
            <div className="flex shrink-0 items-center gap-3">
              {preview && <Badge variant="outline" className="preview-badge"><span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />Anteprima UI</Badge>}
              <Button variant="outline" className="hidden lg:inline-flex" asChild><Link to="/Referral"><Gift data-icon="inline-start" aria-hidden="true" />Invita un amico</Link></Button>
              <div className="hidden lg:block"><AccountMenu profile={profile} preview={preview} onLogout={onLogout} /></div>
              <Button size="icon" variant="ghost" className="lg:hidden" asChild><Link to="/Notifications" aria-label={`Notifiche${unreadNotifications ? `, ${unreadNotifications} non lette` : ""}`}><Bell /></Link></Button>
              <Link to="/Settings" aria-label="Apri il tuo profilo" className="hidden sm:block lg:hidden"><UserAvatar userEmail={profile?.email || ""} userName={profile?.name || "Profilo"} avatarUrl={profile?.avatar} size="sm" /></Link>
            </div>
          </div>
          <nav className="app-desktop-nav" aria-label="Navigazione applicazione">{navigationLinks()}</nav>
        </header>
        <main id="main-content" className="app-main" tabIndex={-1}>
          <AnimatePresence mode="wait" initial={false}><motion.div key={location.pathname} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: 0.18 }}>{children}</motion.div></AnimatePresence>
          {preview && <footer className="preview-footer"><span>Anteprima interattiva · dati dimostrativi, nessuna operazione reale.</span><Link to="/">Scopri la landing page<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link></footer>}
        </main>
      </div>
      <nav className="app-mobile-tabs" aria-label="Accesso rapido mobile">{navItems.filter((item) => ["/Dashboard", "/BrowseGroups", "/Messages", "/Wallet"].includes(item.path)).map(({ path, label, icon: Icon }) => <Link to={path} key={path} aria-label={label} aria-current={active(path) ? "page" : undefined} className={cn(active(path) && "text-primary")}><Icon className="size-5" aria-hidden="true" /><span>{label === "Esplora gruppi" ? "Esplora" : label === "Panoramica" ? "Home" : label}</span></Link>)}<Link to="/CreateGroup" aria-label="Crea gruppo"><Plus className="size-5" aria-hidden="true" /><span>Crea</span></Link></nav>
    </div>
  );
}
