import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ServiceLogo from "@/components/ServiceLogo";
import { getServiceCategory, SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS, SERVICE_COLORS, STRIPE_FEE_PER_PERSON, type ServiceCategory } from "@/lib/serviceConstants";

afterEach(cleanup);

const services: [string, ServiceCategory][] = [
  ["Netflix", "video"], ["Disney+", "video"], ["Prime Video", "video"], ["Amazon Prime", "video"],
  ["NOW", "video"], ["Paramount+", "video"], ["YouTube Premium", "video"], ["MUBI", "video"],
  ["Crunchyroll", "video"], ["Discovery+", "video"], ["HBO Max", "video"], ["Apple TV+", "video"], ["Apple TV", "video"],
  ["Spotify", "music"], ["Apple Music", "music"], ["Amazon Music", "music"], ["Tidal", "music"],
  ["Xbox", "gaming"], ["Xbox Game Pass", "gaming"], ["Nintendo Switch Online", "gaming"], ["PlayStation Plus", "gaming"],
  ["Microsoft 365", "productivity"], ["Audible", "reading"], ["Marvel Unlimited", "reading"],
  ["Duolingo", "learning"], ["Strava", "sport"], ["Dropbox", "cloud"], ["Apple One", "bundle"],
];

describe("ServiceLogo", () => {
  it.each(services)("renders %s with the %s category", (name, category) => {
    render(<ServiceLogo name={name} />);
    const symbol = screen.getByRole("img", { name: SERVICE_CATEGORY_LABELS[category] });
    expect(symbol.tagName.toLowerCase()).toBe("svg");
    expect(symbol).toHaveAttribute("data-service-category", category);
    expect(symbol).toHaveAttribute("viewBox", "0 0 48 48");
    expect(symbol).toHaveAttribute("focusable", "false");
  });

  it.each([
    ["  nEtFlIx  ", "video"], ["DISNEY PLUS", "video"], ["disney-plus", "video"], [" disney  + ", "video"],
    ["APPLE\tTV +", "video"], ["AMAZON   PRIME", "video"], ["Amazon Prime Video", "video"], ["now tv", "video"],
    ["paramount_plus", "video"], ["discovery-plus", "video"], ["youtube-premium", "video"],
    ["apple-music", "music"], ["Amazon Music Unlimited", "music"], ["OFFICE 365", "productivity"],
    ["MICROSOFT\u00a0365", "productivity"], ["Microsoft Office 365", "productivity"],
    ["xbox-game-pass", "gaming"], ["PS Plus", "gaming"], ["PlayStation +", "gaming"],
    ["nintendo-switch-online", "gaming"], ["super duolingo", "learning"], ["apple-one", "bundle"],
  ])("normalizes alias %s", (name, category) => {
    expect(getServiceCategory(name)).toBe(category);
  });

  it.each([undefined, null, "", "   ", "Servizio sconosciuto", "__proto__", "constructor"])("uses a stable generic symbol for %s", (name) => {
    const { container } = render(<ServiceLogo name={name} />);
    expect(screen.getByRole("img", { name: "Servizio digitale" })).toHaveAttribute("data-service-category", "generic");
    expect(container.querySelector(".lucide-layers-3")).not.toBeNull();
    expect(container.querySelector("text")).toBeNull();
  });

  it("preserves size and className, with a 48px default", () => {
    const { rerender } = render(<ServiceLogo name="Netflix" />);
    expect(screen.getByRole("img")).toHaveAttribute("width", "48");
    rerender(<ServiceLogo name="Netflix" size={24} className="h-full w-full custom-container" />);
    const symbol = screen.getByRole("img");
    expect(symbol).toHaveAttribute("width", "24");
    expect(symbol).toHaveAttribute("height", "24");
    expect(symbol).toHaveClass("service-symbol", "h-full", "w-full", "custom-container");
  });

  it("keeps decorative symbols silent beside the written service name", () => {
    render(<div><ServiceLogo name="Netflix" decorative /><span>Netflix</span></div>);
    expect(screen.getAllByText("Netflix")).toHaveLength(1);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("labels the category rather than repeating the service name", () => {
    render(<div><ServiceLogo name="Netflix" /><span>Netflix</span></div>);
    expect(screen.getByRole("img")).toHaveAccessibleName("Video e cinema");
    expect(screen.getAllByText("Netflix")).toHaveLength(1);
  });

  it("never renders legacy images, external references, provider glyphs or duplicate SVG ids", () => {
    const { container } = render(<>{services.map(([name]) => <ServiceLogo key={name} name={name} />)}<ServiceLogo name="" /></>);
    expect(container.querySelectorAll("img, image, use, text, defs, [id]")).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/logos-gen|wikimedia|linearGradient|radialGradient/);
    expect(container.querySelectorAll(".service-symbol")).toHaveLength(services.length + 1);
  });

  it("preserves the operational catalog keys, category data and fee", () => {
    expect(Object.keys(SERVICE_COLORS)).toEqual([
      "Netflix", "Spotify", "Disney+", "Amazon Prime", "YouTube Premium", "PlayStation Plus", "Xbox Game Pass",
      "Microsoft 365", "Apple Music", "HBO Max", "Nintendo Switch Online", "Dropbox",
    ]);
    expect(SERVICE_CATEGORIES).toEqual({
      streaming: ["Netflix", "Disney+", "Amazon Prime", "YouTube Premium", "HBO Max"],
      music: ["Spotify", "Apple Music"],
      gaming: ["PlayStation Plus", "Xbox Game Pass", "Nintendo Switch Online"],
      productivity: ["Microsoft 365", "Dropbox"],
    });
    expect(STRIPE_FEE_PER_PERSON).toBe(0.99);
    Object.values(SERVICE_COLORS).forEach((color) => expect(color).toMatch(/^hsl\(var\(--service-cover-/));
  });
});
