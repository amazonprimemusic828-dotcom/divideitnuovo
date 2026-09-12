import { ChevronDown, ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AVATAR_GENERATION_SETTINGS, AVATAR_IMAGE_MODEL, AVATAR_IMAGE_SIZE, AVATAR_PROMPT, AVATAR_PROVIDER_CONFIG } from "./config";

interface Props {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  onTokenChange: (value: string) => void;
  onTokenBlur: () => void;
  disabled: boolean;
  tokenError: boolean;
  tokenHelp: string;
}

export function AvatarGenerationOptions({ id, open, onOpenChange, token, onTokenChange, onTokenBlur, disabled, tokenError, tokenHelp }: Props) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="avatar-ai-options">
      <CollapsibleTrigger className="avatar-ai-options-trigger" aria-label="Account e quota" disabled={disabled}>
        <span className="flex items-center gap-2"><KeyRound className="size-4" aria-hidden="true" /><span>Account e quota</span></span>
        <span className="flex items-center gap-2"><span className="avatar-ai-account-label">{tokenError ? "Da controllare" : token.trim() ? "Token inserito" : "Accesso anonimo"}</span><ChevronDown className="size-4 shrink-0" aria-hidden="true" /></span>
      </CollapsibleTrigger>
      <CollapsibleContent className="avatar-ai-options-content">
        <div className="flex flex-col gap-4">
          <Field data-invalid={tokenError} data-disabled={disabled}>
            <FieldLabel htmlFor={`${id}-token`}>Token Hugging Face (facoltativo)</FieldLabel>
            <Input
              id={`${id}-token`} type="password" value={token} maxLength={512} placeholder="hf_…"
              autoComplete="off" autoCapitalize="none" spellCheck={false}
              disabled={disabled} aria-invalid={tokenError} aria-describedby={tokenHelp}
              onChange={(event) => onTokenChange(event.target.value)} onBlur={onTokenBlur}
            />
            <FieldDescription id={`${id}-token-help`}>Usa un token dedicato del tuo account, con permessi minimi. Resta solo in memoria nel browser e viene inviato esclusivamente a Hugging Face alla generazione. Non incollarlo in chat.</FieldDescription>
            {token && <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onTokenChange("")} className="self-start">Cancella token</Button>}
          </Field>
          <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
            <p>Senza token usi la quota anonima. Inserire un token non verifica l’account e non avvia richieste.</p>
            <p>La quota inclusa si rinnova 24 ore dopo il primo utilizzo GPU. Cambiare token sullo stesso account non la ripristina. Non ci sono limiti al numero di avatar imposti da DivideIt.</p>
            <p>Per una quota maggiore, Hugging Face offre piani PRO e crediti a pagamento. L’app non attiva piani o acquisti.</p>
            <div className="flex flex-wrap gap-4">
              <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" className="avatar-ai-text-link">I tuoi token<ExternalLink className="size-3.5" aria-hidden="true" /></a>
              <a href="https://huggingface.co/docs/hub/spaces-zerogpu#usage-tiers" target="_blank" rel="noopener noreferrer" className="avatar-ai-text-link">Quote ufficiali<ExternalLink className="size-3.5" aria-hidden="true" /></a>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AvatarGenerationDetails() {
  return (
    <details className="avatar-ai-details">
      <summary><span className="flex items-center gap-2"><ShieldCheck className="size-4" aria-hidden="true" />Privacy e dettagli tecnici</span><ChevronDown className="size-4" aria-hidden="true" /></summary>
      <div className="avatar-ai-details-content">
        <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>L’app non archivia selfie, token o risultati: restano solo in memoria nel browser. Chiudendo il pannello, selfie e token vengono eliminati dalla sua memoria. Se scegli “Imposta come foto profilo”, una copia dell’avatar resta nello stato frontend per la sessione corrente, anche cambiando pagina. Ricaricando o chiudendo la pagina viene eliminata. Nessun database o salvataggio online: scarica il risultato per conservarlo.</p>
          <p>Solo premendo Genera vengono inviati a Hugging Face il selfie e il prompt di stile, senza i volti della collezione. Lo Space può creare file temporanei sui propri server, secondo le proprie regole.</p>
          <p><strong className="font-medium text-foreground">ZeroGPU · generazione reale</strong><br />Una sola richiesta per clic. Nessun tentativo automatico e nessun servizio alternativo.</p>
          <details>
            <summary className="avatar-ai-model-summary">Configurazione ZeroGPU utilizzata</summary>
            <div className="pt-3">
              <div className="flex flex-col gap-3">
                <p className="break-words"><strong className="font-medium text-foreground">{AVATAR_IMAGE_MODEL}</strong> · {AVATAR_IMAGE_SIZE} · 1 immagine.</p>
                <p>{AVATAR_GENERATION_SETTINGS.mode_choice} · guidance {AVATAR_GENERATION_SETTINGS.guidance_scale} (ignorata dal modello Distilled) · seed casuale. Questo endpoint non espone controlli di denoising o peso immagine. Riscrittura automatica del prompt disattivata.</p>
                <p>Il selfie è l’unico riferimento visivo; Luca e Giulia restano esempi nell’interfaccia e non vengono inviati al modello. Il prompt definisce lo stile 3D e chiede di conservare età, tratti e accessori della foto; la somiglianza perfetta non è garantita.</p>
                <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed" tabIndex={0} aria-label="Prompt di stile del generatore">{AVATAR_PROMPT}</pre>
              </div>
            </div>
          </details>
          <p>Con account PRO e crediti, Hugging Face può addebitare l’uso oltre la quota inclusa secondo le proprie condizioni.</p>
          <a href={`https://huggingface.co/spaces/${AVATAR_PROVIDER_CONFIG.spaceId}`} target="_blank" rel="noopener noreferrer" className="avatar-ai-text-link self-start">Space ufficiale<ExternalLink className="size-3.5" aria-hidden="true" /></a>
        </div>
      </div>
    </details>
  );
}
