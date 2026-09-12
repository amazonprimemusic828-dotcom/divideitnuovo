// Traduce i codici tecnici dei requisiti Stripe in linguaggio semplice.

const EXACT: Record<string, string> = {
  external_account: "L'IBAN del conto dove vuoi ricevere i soldi",
  "individual.address.city": "La città dove abiti",
  "individual.address.line1": "Il tuo indirizzo (via e numero civico)",
  "individual.address.postal_code": "Il CAP della tua città",
  "individual.address.state": "La provincia (es. MI, RM)",
  "individual.address.country": "Il Paese in cui abiti",
  "individual.first_name": "Il tuo nome",
  "individual.last_name": "Il tuo cognome",
  "individual.dob.day": "La tua data di nascita",
  "individual.dob.month": "La tua data di nascita",
  "individual.dob.year": "La tua data di nascita",
  "individual.email": "La tua email",
  "individual.phone": "Il tuo numero di telefono",
  "individual.id_number": "Il tuo codice fiscale",
  "individual.verification.document": "Una foto del tuo documento d'identità (fronte e retro)",
  "individual.verification.additional_document": "Un secondo documento (es. bolletta o patente)",
  business_profile_url: "Il sito o il profilo della tua attività",
  "business_profile.url": "Il sito o il profilo della tua attività",
  "business_profile.mcc": "Il tipo di attività che svolgi",
  "business_profile.product_description": "Una breve descrizione di cosa vendi",
  "tos_acceptance.date": "L'accettazione delle condizioni di Stripe",
  "tos_acceptance.ip": "L'accettazione delle condizioni di Stripe",
};

export function humanizeStripeRequirement(code: string): string {
  if (EXACT[code]) return EXACT[code];
  if (code.includes("dob")) return "La tua data di nascita";
  if (code.includes("address")) return "Il tuo indirizzo completo";
  if (code.includes("document")) return "Una foto del tuo documento d'identità";
  if (code.includes("external_account")) return "L'IBAN del conto dove ricevere i soldi";
  if (code.includes("id_number")) return "Il tuo codice fiscale";
  if (code.includes("tos_acceptance")) return "L'accettazione delle condizioni di Stripe";
  return "Un dato personale mancante richiesto da Stripe";
}

/** Lista leggibile e senza duplicati. */
export function humanizeStripeRequirements(codes: string[]): string[] {
  const out: string[] = [];
  for (const c of codes) {
    const label = humanizeStripeRequirement(c);
    if (!out.includes(label)) out.push(label);
  }
  return out;
}

/** Traduce il "disabled_reason" di Stripe in un messaggio chiaro per l'utente. */
const DISABLED: Record<string, { title: string; detail: string }> = {
  "requirements.past_due": {
    title: "Mancano alcuni dati obbligatori",
    detail: "Stripe ha bisogno di altre informazioni per verificarti. Completa la verifica: finché non lo fai, i prelievi restano in pausa (i tuoi soldi sono al sicuro).",
  },
  "requirements.pending_verification": {
    title: "Verifica in corso",
    detail: "Stripe sta controllando i tuoi documenti. Di solito bastano poche ore, al massimo 1-2 giorni. Non devi fare nulla.",
  },
  "rejected.fraud": {
    title: "Account rifiutato da Stripe",
    detail: "Stripe ha bloccato l'account per sospetta frode. Contatta il supporto per capire come procedere.",
  },
  "rejected.terms_of_service": {
    title: "Condizioni Stripe non rispettate",
    detail: "L'account è stato chiuso per violazione delle condizioni di Stripe. Scrivi al supporto per assistenza.",
  },
  "rejected.listed": {
    title: "Controllo di sicurezza non superato",
    detail: "Stripe non può abilitare i pagamenti su questo account. Contatta il supporto.",
  },
  "rejected.other": {
    title: "Account rifiutato",
    detail: "Stripe non ha abilitato questo account. Contatta il supporto per maggiori dettagli.",
  },
  "listed": {
    title: "Verifica aggiuntiva necessaria",
    detail: "Stripe sta facendo un controllo extra sul tuo account. Se dura più di qualche giorno, contatta il supporto.",
  },
  "under_review": {
    title: "Account sotto revisione",
    detail: "Stripe sta esaminando il tuo account. I prelievi riprenderanno appena la revisione finisce.",
  },
  "other": {
    title: "Prelievi temporaneamente sospesi",
    detail: "Stripe ha messo in pausa i prelievi. Prova a completare la verifica; se il problema resta, contatta il supporto.",
  },
  "platform_paused": {
    title: "Prelievi in pausa",
    detail: "I prelievi sono stati messi in pausa. Contatta il supporto di DivideIt.",
  },
  "action_required.requested_capabilities": {
    title: "Verifica da completare",
    detail: "Devi finire la configurazione dell'account per ricevere i pagamenti. Bastano pochi minuti.",
  },
};

export function humanizeStripeDisabledReason(reason: string): { title: string; detail: string } {
  if (DISABLED[reason]) return DISABLED[reason];
  if (reason.startsWith("rejected")) return DISABLED["rejected.other"];
  if (reason.includes("past_due")) return DISABLED["requirements.past_due"];
  if (reason.includes("pending")) return DISABLED["requirements.pending_verification"];
  if (reason.includes("review")) return DISABLED["under_review"];
  return DISABLED["other"];
}
