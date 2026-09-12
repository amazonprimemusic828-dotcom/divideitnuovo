// Service categories and presentation colors for DIVIDEIT.

// Stripe per-person fee added on top of the base per-person price.
export const STRIPE_FEE_PER_PERSON = 0.99;

export const SERVICE_CATEGORY_LABELS = {
  video: "Video e cinema",
  music: "Musica",
  gaming: "Gaming",
  productivity: "Produttività",
  reading: "Lettura e audiolibri",
  learning: "Apprendimento",
  sport: "Sport",
  cloud: "Cloud e archiviazione",
  bundle: "Pacchetti di servizi",
  generic: "Servizio digitale",
} as const;

export type ServiceCategory = keyof typeof SERVICE_CATEGORY_LABELS;

const categoryServices: Record<Exclude<ServiceCategory, "generic">, readonly string[]> = {
  video: [
    "Netflix", "Disney+", "Prime Video", "Amazon Prime", "Amazon Prime Video",
    "NOW", "NOW TV", "Paramount+", "YouTube Premium", "MUBI", "Crunchyroll",
    "Discovery+", "HBO Max", "Max", "Apple TV+", "Apple TV",
  ],
  music: ["Spotify", "Apple Music", "Amazon Music", "Amazon Music Unlimited", "Tidal"],
  gaming: ["Xbox", "Xbox Game Pass", "Game Pass", "Nintendo Switch Online", "PlayStation Plus", "PS Plus"],
  productivity: ["Microsoft 365", "Office 365", "Microsoft Office 365"],
  reading: ["Audible", "Marvel Unlimited"],
  learning: ["Duolingo", "Super Duolingo"],
  sport: ["Strava"],
  cloud: ["Dropbox"],
  bundle: ["Apple One"],
};

export function normalizeServiceName(name?: string | null): string {
  return (name ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/[\s_-]+/g, "");
}

const categoryByService = new Map<string, ServiceCategory>(
  Object.entries(categoryServices).flatMap(([category, services]) =>
    services.map((name): [string, ServiceCategory] => [normalizeServiceName(name), category as ServiceCategory]),
  ),
);

export function getServiceCategory(name?: string | null): ServiceCategory {
  return categoryByService.get(normalizeServiceName(name)) ?? "generic";
}

// Keep these keys unchanged: the operational app also enumerates them as a catalog.
export const SERVICE_COLORS: Record<string, string> = {
  Netflix: "hsl(var(--service-cover-blue))",
  Spotify: "hsl(var(--service-cover-mint))",
  "Disney+": "hsl(var(--service-cover-blue))",
  "Amazon Prime": "hsl(var(--service-cover-blue))",
  "YouTube Premium": "hsl(var(--service-cover-blue))",
  "PlayStation Plus": "hsl(var(--service-cover-blue))",
  "Xbox Game Pass": "hsl(var(--service-cover-blue))",
  "Microsoft 365": "hsl(var(--service-cover-ink))",
  "Apple Music": "hsl(var(--service-cover-mint))",
  "HBO Max": "hsl(var(--service-cover-blue))",
  "Nintendo Switch Online": "hsl(var(--service-cover-blue))",
  Dropbox: "hsl(var(--service-cover-ink))",
};

export const SERVICE_CATEGORIES = {
  streaming: ["Netflix", "Disney+", "Amazon Prime", "YouTube Premium", "HBO Max"],
  music: ["Spotify", "Apple Music"],
  gaming: ["PlayStation Plus", "Xbox Game Pass", "Nintendo Switch Online"],
  productivity: ["Microsoft 365", "Dropbox"],
};
