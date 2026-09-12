// Prezzi ufficiali del PIANO SINGOLO/INDIVIDUALE in Italia (€/mese, IVA inclusa).
// Fonte: report "Prezzi degli Abbonamenti Digitali in Italia" (aggiornato 2026).
export const SOLO_PLAN_PRICES: Record<string, { price: number; plan: string }> = {
  netflix: { price: 6.99, plan: "Standard con pubblicità" },
  "disney+": { price: 5.99, plan: "Standard con pubblicità" },
  disney: { price: 5.99, plan: "Standard con pubblicità" },
  spotify: { price: 11.99, plan: "Premium Individual" },
  "apple music": { price: 11.99, plan: "Individuale" },
  "youtube premium": { price: 13.99, plan: "Individuale" },
  "amazon prime": { price: 4.99, plan: "Con pubblicità limitata" },
  "prime video": { price: 4.99, plan: "Con pubblicità limitata" },
  "amazon music": { price: 12.99, plan: "Unlimited Individuale" },
  now: { price: 7.99, plan: "Cinema & Entertainment" },
  "paramount+": { price: 7.99, plan: "Standard" },
  mubi: { price: 11.99, plan: "Mensile" },
  crunchyroll: { price: 5.99, plan: "Fan" },
  "discovery+": { price: 1.99, plan: "Intrattenimento con pubblicità" },
  "hbo max": { price: 5.99, plan: "Base con pubblicità" },
  max: { price: 5.99, plan: "Base con pubblicità" },
  tidal: { price: 11.0, plan: "Individuale" },
  audible: { price: 9.99, plan: "Audible Plus" },
  duolingo: { price: 14.99, plan: "Super Duolingo" },
  strava: { price: 10.99, plan: "Individuale" },
  "playstation plus": { price: 8.99, plan: "Essential" },
  "nintendo switch online": { price: 3.99, plan: "Individuale" },
  "microsoft 365": { price: 10.0, plan: "Personal" },
  "apple one": { price: 19.95, plan: "Individuale" },
  dropbox: { price: 11.99, plan: "Plus" },
  "marvel unlimited": { price: 9.2, plan: "Mensile" },
  "xbox game pass": { price: 8.99, plan: "Core / PC" },
  xbox: { price: 8.99, plan: "Core / PC" },
  "canva pro": { price: 11.99, plan: "Pro" },
  canva: { price: 11.99, plan: "Pro" },
};


// Nome "pulito" del servizio da mostrare all'utente (mai piani famiglia/varianti).
export const BRAND_LABELS: Record<string, string> = {
  netflix: "Netflix",
  "disney+": "Disney+",
  disney: "Disney+",
  spotify: "Spotify",
  "apple music": "Apple Music",
  "youtube premium": "YouTube Premium",
  "amazon prime": "Amazon Prime",
  "prime video": "Prime Video",
  "amazon music": "Amazon Music",
  now: "NOW",
  "paramount+": "Paramount+",
  mubi: "MUBI",
  crunchyroll: "Crunchyroll",
  "discovery+": "Discovery+",
  "hbo max": "HBO Max",
  max: "Max",

  tidal: "Tidal",
  audible: "Audible",
  duolingo: "Duolingo",
  strava: "Strava",
  "playstation plus": "PlayStation Plus",
  "nintendo switch online": "Nintendo Switch Online",
  "microsoft 365": "Microsoft 365",
  "apple one": "Apple One",
  dropbox: "Dropbox",
  "marvel unlimited": "Marvel Unlimited",
  "xbox game pass": "Xbox Game Pass",
  xbox: "Xbox",
  "canva pro": "Canva",
  canva: "Canva",
};

// Chiavi ordinate dalla più lunga alla più corta: così "apple music" vince su "apple one" ecc.
const SORTED_KEYS = Object.keys(SOLO_PLAN_PRICES).sort((a, b) => b.length - a.length);

/** Trova il servizio "base" partendo da nomi tipo "Apple One Family" o "Xbox Xbox". */
export function resolveService(...names: (string | undefined | null)[]) {
  const haystack = names.filter(Boolean).join(" ").toLowerCase();
  if (!haystack) return null;
  const key = SORTED_KEYS.find((k) => haystack.includes(k));
  if (!key) return null;
  const { price, plan } = SOLO_PLAN_PRICES[key];
  return { key, label: BRAND_LABELS[key] ?? key, price, plan };
}

export function getSoloPlan(...names: (string | undefined | null)[]) {
  const hit = resolveService(...names);
  return hit ? { price: hit.price, plan: hit.plan } : null;
}
