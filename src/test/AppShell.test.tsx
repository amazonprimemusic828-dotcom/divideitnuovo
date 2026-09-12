import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppShell from "@/components/AppShell";

afterEach(cleanup);

function LocationState() {
  const location = useLocation();
  return <output data-testid="route">{location.pathname}{location.search}</output>;
}

function renderShell(path = "/Dashboard", props: Partial<ComponentProps<typeof AppShell>> = {}) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <MotionConfig reducedMotion="always">
        <AppShell profile={{ name: "Luca Rossi", email: "luca@example.com" }} preview unreadMessages={5} unreadNotifications={3} {...props}>
          <h1>Contenuto pagina</h1>
          <LocationState />
        </AppShell>
      </MotionConfig>
    </MemoryRouter>,
  );
}

const desktopNav = () => screen.getByRole("navigation", { name: "Navigazione applicazione" });

async function openAccountMenu() {
  const trigger = screen.getByRole("button", { name: "Apri menu account" });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  return screen.findByRole("menu");
}

describe("AppShell", () => {
  it.each([
    ["/Dashboard", "Panoramica"],
    ["/Dashboard?sort=recent", "Panoramica"],
    ["/Dashboard?tab=groups", "I miei gruppi"],
    ["/Dashboard?sort=recent&tab=groups", "I miei gruppi"],
    ["/Dashboard?tab=groups&sort=recent", "I miei gruppi"],
    ["/dAsHbOaRd?tab=groups", "I miei gruppi"],
    ["/Dashboard?context=tab%3Dgroups", "Panoramica"],
    ["/Dashboard?tab=groups-archive", "Panoramica"],
    ["/BrowseGroups?q=Netflix", "Esplora gruppi"],
    ["/Messages?tab=groups&group=example", "Messaggi"],
    ["/Notifications?filter=unread", "Notifiche"],
    ["/Wallet?view=transactions", "Portafoglio"],
  ])("marks only %s's matching destination active", (path, expected) => {
    renderShell(path);
    const links = within(desktopNav()).getAllByRole("link");
    const activeLinks = links.filter((link) => link.getAttribute("aria-current") === "page");
    expect(activeLinks).toHaveLength(1);
    expect(activeLinks[0]).toHaveTextContent(expected);
  });

  it("does not select a primary destination on secondary routes", () => {
    renderShell("/Settings?tab=profile");
    expect(desktopNav().querySelector('[aria-current="page"]')).toBeNull();
  });

  it("replaces the desktop sidebar with all six horizontal destinations", () => {
    const { container } = renderShell();
    expect(container.querySelector(".app-sidebar")).toBeNull();
    expect(container.querySelector("header.app-header")).toContainElement(desktopNav());
    expect(within(desktopNav()).getAllByRole("link")).toHaveLength(6);
    expect(screen.getByRole("link", { name: "DivideIt, pagina iniziale" })).toHaveAttribute("href", "/Dashboard");
  });

  it("keeps visible and accessible unread counts", () => {
    renderShell();
    expect(within(desktopNav()).getByRole("link", { name: "Messaggi, 5 da leggere" })).toHaveTextContent("5");
    expect(within(desktopNav()).getByRole("link", { name: "Notifiche, 3 da leggere" })).toHaveTextContent("3");
  });

  it("caps only the visual count without losing the accessible total", () => {
    renderShell("/Dashboard", { unreadMessages: 120, unreadNotifications: 0 });
    expect(within(desktopNav()).getByRole("link", { name: "Messaggi, 120 da leggere" })).toHaveTextContent("99+");
    expect(within(desktopNav()).getByRole("link", { name: "Notifiche" }).querySelector(".nav-count")).toBeNull();
  });

  it("submits a trimmed, encoded search to the group browser", async () => {
    renderShell();
    fireEvent.change(screen.getByRole("searchbox", { name: "Cerca un abbonamento" }), { target: { value: "  Microsoft 365  " } });
    fireEvent.submit(screen.getByRole("search", { name: "Cerca negli abbonamenti" }));
    await waitFor(() => expect(screen.getByTestId("route")).toHaveTextContent("/BrowseGroups?q=Microsoft%20365"));
    expect(within(desktopNav()).getByRole("link", { name: "Esplora gruppi" })).toHaveAttribute("aria-current", "page");
  });

  it("does not submit Enter while a CJK composition is being confirmed", () => {
    renderShell();
    const input = screen.getByRole("searchbox", { name: "Cerca un abbonamento" });
    expect(fireEvent.keyDown(input, { key: "Enter", isComposing: true })).toBe(false);
    expect(fireEvent.keyDown(input, { key: "Enter", keyCode: 229 })).toBe(false);
    expect(screen.getByTestId("route")).toHaveTextContent("/Dashboard");
  });

  it("opens the existing invitation route", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("link", { name: "Invita un amico" }));
    await waitFor(() => expect(screen.getByTestId("route")).toHaveTextContent("/Referral"));
  });

  it("offers profile, settings and support through a keyboard-accessible account menu", async () => {
    renderShell();
    const menu = await openAccountMenu();
    expect(within(menu).getByText("Profilo dimostrativo")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Il tuo profilo" })).toHaveAttribute("href", "/Settings?tab=profile");
    expect(within(menu).getByRole("menuitem", { name: "Impostazioni" })).toHaveAttribute("href", "/Settings");
    const support = within(menu).getByRole("menuitem", { name: "Centro assistenza" });
    expect(support).toHaveAttribute("href", "/Support");
    expect(within(menu).queryByRole("menuitem", { name: "Esci" })).not.toBeInTheDocument();
    fireEvent.click(support);
    await waitFor(() => expect(screen.getByTestId("route")).toHaveTextContent("/Support"));
  });

  it("uses only the supplied logout callback", async () => {
    const onLogout = vi.fn();
    renderShell("/Dashboard", { preview: false, onLogout });
    const menu = await openAccountMenu();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Esci" }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("preserves the mobile Sheet, bottom navigation and closing on route selection", async () => {
    renderShell("/Dashboard?sort=recent&tab=groups");
    expect(screen.getByRole("navigation", { name: "Accesso rapido mobile" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apri navigazione" }));
    const dialog = await screen.findByRole("dialog", { name: "Navigazione DivideIt" });
    const mobileNav = within(dialog).getByRole("navigation", { name: "Navigazione mobile" });
    expect(within(mobileNav).getByRole("link", { name: "I miei gruppi" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(mobileNav).getByRole("link", { name: "Esplora gruppi" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("route")).toHaveTextContent("/BrowseGroups");
  });

  it("keeps the preview notice and a focusable skip-link target", () => {
    renderShell();
    expect(screen.getByRole("link", { name: "Vai al contenuto" })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("Anteprima UI")).toBeInTheDocument();
    expect(screen.getByText(/dati dimostrativi, nessuna operazione reale/)).toBeInTheDocument();
  });
});
