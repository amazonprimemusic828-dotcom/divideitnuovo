// Catalogo piani per il matchmaking.
// Se un servizio offre più di un piano/servizio (es. Netflix, Discovery+, NOW),
// il matchmaking DEVE chiedere all'utente quale piano vuole prima di iniziare.
// Se offre un solo piano (es. Apple Music), si parte direttamente.

/** Commissione di servizio DivideIt applicata al pagamento su Stripe. */
export const JOIN_FEE_CENTS = 99;

/** Totale addebitato su Stripe (prezzo piano + fee). */
export function totalWithFeeCents(perMemberCents: number): number {
  return Math.max(50, Math.round(perMemberCents + JOIN_FEE_CENTS));
}

export type CatalogPlan = {
  /** Nome piano (plan_type usato dal backend). */
  planType: string;
  /** Prezzo BASE per persona in centesimi (senza fee Stripe). */
  perMemberCents: number;
};

export const SERVICE_PLAN_CATALOG: Record<string, CatalogPlan[]> = {
  Netflix: [
    { planType: "Standard +1 Extra", perMemberCents: 949 },
    { planType: "Premium +1 Extra", perMemberCents: 1249 },
    { planType: "Premium +2 Extras", perMemberCents: 999 },
  ],
  "Disney+": [
    { planType: "Premium (Mensile) + Extra", perMemberCents: 1149 },
    { planType: "Standard (Mensile) + Extra", perMemberCents: 899 },
    { planType: "Standard Pubblicità (Mensile) + Extra", perMemberCents: 649 },
    { planType: "Premium (Annuale) + Extra", perMemberCents: 965 },
    { planType: "Standard (Annuale) + Extra", perMemberCents: 757 },
  ],
  "Prime Video": [
    { planType: "Prime Video", perMemberCents: 166 },
    { planType: "Prime Video No Ads", perMemberCents: 233 },
  ],
  NOW: [
    { planType: "Cinema e Entertainment", perMemberCents: 750 },
    { planType: "Sport + Premium", perMemberCents: 1750 },
    { planType: "Cinema, Entertainment, Sport + Premium", perMemberCents: 2100 },
  ],
  "Paramount+": [
    { planType: "Paramount+", perMemberCents: 400 },
    { planType: "Paramount+ Premium", perMemberCents: 325 },
  ],
  "YouTube Premium": [{ planType: "Famiglia", perMemberCents: 433 }],
  MUBI: [{ planType: "MUBI", perMemberCents: 600 }],
  Crunchyroll: [{ planType: "Premium Mega Fan", perMemberCents: 187 }],
  "Marvel Unlimited": [{ planType: "Marvel Unlimited", perMemberCents: 167 }],
  "Discovery+": [
    { planType: "Intrattenimento", perMemberCents: 275 },
    { planType: "Intrattenimento + Sport", perMemberCents: 400 },
    { planType: "Intrattenimento con pubblicità", perMemberCents: 145 },
  ],
  "HBO Max": [
    { planType: "Base", perMemberCents: 300 },
    { planType: "Standard", perMemberCents: 600 },
    { planType: "Premium", perMemberCents: 425 },
    { planType: "Standard + Sport", perMemberCents: 750 },
    { planType: "Premium + Sport", perMemberCents: 999 },
    { planType: "Base + Sport", perMemberCents: 450 },
  ],
  "Apple Music": [{ planType: "Famiglia", perMemberCents: 283 }],
  "Amazon Music": [{ planType: "Famiglia", perMemberCents: 300 }],
  Tidal: [{ planType: "Famiglia", perMemberCents: 283 }],
  "Microsoft 365": [{ planType: "Family", perMemberCents: 367 }],
  Duolingo: [{ planType: "Super Famiglia", perMemberCents: 172 }],
  Strava: [{ planType: "Piano Famiglia", perMemberCents: 208 }],
  Xbox: [{ planType: "Xbox", perMemberCents: 350 }],
  "Nintendo Switch Online": [
    { planType: "Nintendo Switch Online", perMemberCents: 50 },
    { planType: "Nintendo Switch Online + Pacchetto aggiuntivo", perMemberCents: 73 },
  ],
  Audible: [{ planType: "Audible", perMemberCents: 100 }],
  "Apple One": [
    { planType: "Family", perMemberCents: 433 },
    { planType: "Premier", perMemberCents: 583 },
  ],
};

/** Ritorna i piani del catalogo per un servizio (match case-insensitive). */
export function getCatalogPlans(serviceName: string): CatalogPlan[] {
  const normalized = serviceName.trim().toLocaleLowerCase("it-IT");
  const entry = Object.entries(SERVICE_PLAN_CATALOG).find(
    ([name]) => name.toLocaleLowerCase("it-IT") === normalized
  );
  return entry?.[1] ?? [];
}
