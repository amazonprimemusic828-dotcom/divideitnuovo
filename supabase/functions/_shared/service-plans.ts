const PLAN_PRICES_CENTS: Record<string, Record<string, number>> = {
  netflix: { "standard +1 extra": 949, "premium +1 extra": 1249, "premium +2 extras": 999 },
  "disney+": { "premium (mensile) + extra": 1149, "standard (mensile) + extra": 899, "standard pubblicità (mensile) + extra": 649, "premium (annuale) + extra": 965, "standard (annuale) + extra": 757 },
  "prime video": { "prime video": 166, "prime video no ads": 233 },
  now: { "cinema e entertainment": 750, "sport + premium": 1750, "cinema, entertainment, sport + premium": 2100 },
  "paramount+": { "paramount+": 400, "paramount+ premium": 325 },
  "youtube premium": { famiglia: 433 },
  mubi: { mubi: 600 },
  crunchyroll: { "premium mega fan": 187 },
  "marvel unlimited": { "marvel unlimited": 167 },
  "discovery+": { intrattenimento: 275, "intrattenimento + sport": 400, "intrattenimento con pubblicità": 145 },
  "hbo max": { base: 300, standard: 600, premium: 425, "standard + sport": 750, "premium + sport": 999, "base + sport": 450 },
  "apple music": { famiglia: 283 },
  "amazon music": { famiglia: 300 },
  tidal: { famiglia: 283 },
  "microsoft 365": { family: 367 },
  duolingo: { "super famiglia": 172 },
  strava: { "piano famiglia": 208 },
  xbox: { xbox: 350 },
  "nintendo switch online": { "nintendo switch online": 50, "nintendo switch online + pacchetto aggiuntivo": 73 },
  audible: { audible: 100 },
  "apple one": { family: 433, premier: 583 },
};

export function getPlanPriceCents(serviceName: string, planType?: string | null): number | null {
  const plans = PLAN_PRICES_CENTS[serviceName.trim().toLocaleLowerCase("it-IT")];
  if (!plans) return null;
  if (planType) return plans[planType.trim().toLocaleLowerCase("it-IT")] ?? null;
  const prices = Object.values(plans);
  return prices.length === 1 ? prices[0] : null;
}