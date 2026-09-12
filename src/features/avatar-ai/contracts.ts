export const MAX_SELFIE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_GENERATED_BYTES = 12 * 1024 * 1024;
export const SELFIE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export interface GeneratedAvatar {
  file: File;
}

export interface AvatarGenerationOptions {
  accessToken?: string;
  consent: boolean;
}

export type AvatarConfirmCallback = (file: File) => void | Promise<void>;

export function isAvatarTokenValid(value: string): boolean {
  return /^hf_[A-Za-z0-9]{20,509}$/.test(value.trim());
}

export const avatarErrorMessages: Record<string, string> = {
  INTEGRATION_PENDING: "La generazione ZeroGPU non è ancora collegata. Il sottopiano 2.1 prepara soltanto l’anteprima locale: nessuna foto viene inviata.",
  CONSENT_REQUIRED: "Conferma di voler inviare il tuo selfie a Hugging Face prima di avviare la generazione.",
  INVALID_TOKEN: "Il formato del token non è riconosciuto. Incolla solo il token Hugging Face che inizia con hf_, senza spazi interni, oppure lascia il campo vuoto. Questo controllo è solo locale e non verifica i permessi del token.",
  SINGLE_IMAGE_REQUIRED: "Scegli una sola foto alla volta: il volto di riferimento deve essere il tuo.",
  INVALID_IMAGE: "Questa immagine non è leggibile. Scegli un singolo selfie JPG, PNG o WebP, nitido e di almeno 256 × 256 pixel.",
  IMAGE_TOO_LARGE: "Il file è troppo grande. Scegli un’immagine di massimo 5 MB.",
  REQUEST_TOO_LARGE: "L’immagine preparata è troppo grande. Scegli un altro selfie.",
  STYLE_REFERENCE_UNAVAILABLE: "Non riesco a leggere gli avatar Studio di riferimento. Nessuna foto è stata inviata. Ricarica la pagina e riprova.",
  QUOTA_EXCEEDED: "La quota ZeroGPU è esaurita o sono state inviate troppe richieste. Attendi il ripristino della quota prima di riprovare. Nessun tentativo automatico verrà effettuato.",
  TOKEN_REJECTED: "Hugging Face richiede un accesso valido o ha rifiutato il token. Controlla il token dedicato e i suoi permessi, oppure rimuovilo per provare con la quota anonima.",
  SPACE_UNAVAILABLE: "Lo Space ZeroGPU non è raggiungibile, è occupato o la coda è piena. Riprova più tardi; il selfie resta disponibile nel pannello.",
  GENERATION_TIMEOUT: "L’attesa di Hugging Face ha superato 3 minuti. La coda potrebbe essere occupata. L’elaborazione remota potrebbe continuare; riprova più tardi per non consumare altra quota.",
  GENERATION_FAILED: "Il servizio AI non ha restituito un avatar utilizzabile. Nessuna immagine predefinita è stata sostituita al risultato.",
  PROFILE_UPDATE_FAILED: "Non è stato possibile impostare la foto profilo per questa sessione. L’avatar resta disponibile: riprova oppure scaricalo.",
};

export class AvatarAIError extends Error {
  constructor(public readonly code: string) {
    super(avatarErrorMessages[code] || avatarErrorMessages.GENERATION_FAILED);
    this.name = "AvatarAIError";
  }
}
