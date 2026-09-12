import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildCorsHeaders,
  requireUser,
  getServiceClient,
  checkRateLimit,
  unauthorized,
  tooManyRequests,
  badRequest,
  z,
} from "../_shared/security.ts";

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
  ticketId: z.string().uuid().optional().nullable(),
});

// Knowledge base completa di DIVIDEIT
const DIVIDEIT_KNOWLEDGE = `
Sei l'assistente AI ufficiale di DIVIDEIT, un'app italiana per la condivisione di abbonamenti digitali.

## 🎯 COS'È DIVIDEIT
DIVIDEIT permette agli utenti di condividere abbonamenti a servizi come Netflix, Spotify, Disney+, Amazon Prime, PlayStation Plus, Xbox Game Pass, Microsoft 365, YouTube Premium e altri. Gli utenti risparmiano unendosi a gruppi esistenti o creando i propri.

## 💰 COME FUNZIONANO I RISPARMI
- Un abbonamento family/premium viene diviso tra i membri del gruppo
- Ogni membro paga solo la sua quota mensile
- Esempio: Netflix Premium (€17.99/mese) diviso tra 4 persone = €4.50/mese a testa
- Risparmio medio: 50-75% rispetto all'abbonamento individuale

## 🔒 SICUREZZA E PAGAMENTI
- I pagamenti sono sicuri e gestiti tramite il wallet integrato
- Non condividiamo mai password o dati sensibili
- Ogni utente ha un proprio profilo separato nel servizio condiviso
- Sistema di Trust Score per valutare l'affidabilità dei membri

## 📋 COME UNIRSI A UN GRUPPO
1. Vai su "Esplora" per vedere i gruppi disponibili
2. Filtra per servizio che ti interessa
3. Clicca su "Unisciti" nel gruppo scelto
4. Aggiungi fondi al wallet se necessario
5. Conferma l'iscrizione

## ➕ COME CREARE UN GRUPPO
1. Vai su "Dashboard" → "Crea Gruppo"
2. Seleziona il servizio (Netflix, Spotify, ecc.)
3. Scegli il piano (Family, Premium, ecc.)
4. Imposta il prezzo per membro
5. Condividi il link invito con amici

## 💳 WALLET E PAGAMENTI
- Ricarica il wallet con carta di credito/debito
- I pagamenti mensili sono automatici
- Cronologia completa delle transazioni
- Rimborsi disponibili entro 14 giorni

## ❓ PROBLEMI COMUNI

### Non riesco a pagare
- Verifica che il wallet abbia fondi sufficienti
- Controlla che la carta sia valida
- Prova a ricaricare la pagina
- Contatta supporto se persiste

### La chat non funziona
- Verifica la connessione internet
- Aggiorna la pagina del browser
- Prova a uscire e rientrare dal gruppo
- Svuota la cache del browser

### Non vedo i miei gruppi
- Vai su "Dashboard" → "I Miei Gruppi"
- Verifica di essere loggato correttamente
- Controlla di aver completato l'iscrizione

### Come uscire da un gruppo
- Vai nei dettagli del gruppo
- Clicca su "Esci dal gruppo"
- La cancellazione è immediata
- I fondi rimanenti restano nel wallet

### Problemi con l'abbonamento condiviso
- Contatta l'admin del gruppo tramite la chat
- Verifica che il gruppo sia attivo
- Controlla le credenziali di accesso fornite

## 📧 CONTATTI
- Email: support@divideit.com
- Chat live: disponibile 9-18 (lun-ven)
- Tempo di risposta medio: < 4 ore

## 🔄 POLITICHE
- Rimborso: entro 14 giorni dalla prima iscrizione
- Cancellazione: immediata, senza penali
- Privacy: i tuoi dati sono al sicuro e non vengono condivisi

IMPORTANTE: Se non riesci a risolvere il problema dell'utente, suggerisci di parlare con un operatore umano.
`;

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth: only logged-in users may use the AI assistant ---
    const user = await requireUser(req);
    if (!user) return unauthorized(corsHeaders);

    // --- Rate limit: 20 requests/min per user ---
    const supabase = getServiceClient();
    const allowed = await checkRateLimit(supabase, user.uid, "ai-support", 20, 60);
    if (!allowed) return tooManyRequests(corsHeaders);

    // --- Input validation ---
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest(corsHeaders, parsed.error.flatten());
    const { messages, ticketId } = parsed.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`🤖 AI Support: Processing ${messages.length} messages${ticketId ? ` for ticket ${ticketId}` : ''}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: `${DIVIDEIT_KNOWLEDGE}

REGOLE DI RISPOSTA:
1. Rispondi SEMPRE in italiano
2. Sii amichevole, empatico e professionale
3. Usa emoji per rendere le risposte più calde 😊
4. Se il problema è chiaro, dai una soluzione step-by-step
5. Se non puoi risolvere il problema, suggerisci di parlare con un operatore
6. Mantieni risposte concise ma complete (max 150 parole)
7. Non inventare funzionalità che non esistono
8. Per problemi di pagamento urgenti, sempre suggerire contatto operatore`
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: "Troppi messaggi inviati. Riprova tra qualche secondo." 
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: "Servizio temporaneamente non disponibile. Parla con un operatore." 
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Errore AI gateway" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("AI support error:", e);
    return new Response(JSON.stringify({ 
      error: "Errore interno. Riprova." 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
