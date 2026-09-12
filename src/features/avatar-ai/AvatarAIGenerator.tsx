import { useId, useRef, useState } from "react";
import { ArrowRight, Check, Clock3, Download, ImagePlus, Info, Loader2, ShieldCheck, Sparkles, Upload, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { SELFIE_TYPES, type AvatarConfirmCallback } from "./contracts";
import AvatarGenerationPreview from "./AvatarGenerationPreview";
import { AvatarGenerationDetails, AvatarGenerationOptions } from "./AvatarGenerationOptions";
import { useAvatarGenerator } from "./useAvatarGenerator";

interface Props {
  // Confirmation is explicit and receives only the generated file, never the selfie.
  onConfirm?: AvatarConfirmCallback;
  onConfirmed?: () => void;
  onBusyChange?: (busy: boolean, confirming: boolean) => void;
  disabled?: boolean;
}

export default function AvatarAIGenerator({ disabled = false, onConfirm, onConfirmed, onBusyChange }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const generator = useAvatarGenerator({ disabled, onConfirm, onConfirmed, onBusyChange });
  const { selfie, result, phase, busy, confirming, confirmed, error } = generator;
  const photoError = Boolean(error && ["INVALID_IMAGE", "IMAGE_TOO_LARGE", "REQUEST_TOO_LARGE", "SINGLE_IMAGE_REQUIRED"].includes(error.code));
  const tokenError = error?.code === "INVALID_TOKEN" || error?.code === "TOKEN_REJECTED";
  const quotaError = error?.code === "QUOTA_EXCEEDED";
  const uploadHelp = photoError ? `${id}-upload-help ${id}-error` : `${id}-upload-help`;
  const tokenHelp = tokenError ? `${id}-token-help ${id}-error` : `${id}-token-help`;
  const generationLabel = phase === "generating" ? "Generazione in corso…" : quotaError ? "Riprova manualmente" : result ? "Rigenera avatar" : "Genera il mio avatar";

  const feedback = error && (
    <Alert variant={quotaError ? "default" : "destructive"} className="avatar-ai-feedback" data-quota={quotaError || undefined}>
      {quotaError ? <Clock3 aria-hidden="true" /> : <Info aria-hidden="true" />}
      <AlertTitle>{photoError ? "Controlla la foto" : tokenError ? "Controlla il token" : quotaError ? "La quota ZeroGPU è esaurita" : "Operazione non disponibile"}</AlertTitle>
      <AlertDescription>
        <div className="flex flex-col gap-3">
          <p id={`${id}-error`}>{error.message}</p>
          {quotaError && (
            <>
              <p>Il limite è di Hugging Face, non di DivideIt. La quota inclusa si rinnova 24 ore dopo il primo utilizzo GPU. Un nuovo token dello stesso account non la azzera.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setOptionsOpen(true)} className="self-start">Gestisci account e quota<ArrowRight data-icon="inline-end" /></Button>
            </>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );

  return (
    <section className="avatar-ai-panel font-sans" aria-labelledby={`${id}-title`}>
      <div className="avatar-ai-workspace">
        <div className="avatar-ai-controls">
          <header className="flex flex-col gap-2">
            <p className="avatar-ai-kicker"><Sparkles className="size-4" aria-hidden="true" />Il tuo volto, in 3D</p>
            <h3 id={`${id}-title`} className="avatar-ai-title text-balance font-display">Nessuno è come te.</h3>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">Parti da un selfie. Crea il tuo ritratto Studio e scegli se usarlo come foto profilo, solo per questa sessione.</p>
          </header>

          <FieldGroup className="gap-5">
            <Field data-invalid={photoError} data-disabled={busy || disabled}>
              <FieldLabel htmlFor={`${id}-file`} className="sr-only">Carica un selfie per creare il tuo avatar AI</FieldLabel>
              <input
                ref={input} id={`${id}-file`} type="file" className="sr-only max-w-px" accept={SELFIE_TYPES.join(",")} tabIndex={-1}
                disabled={busy || disabled} aria-invalid={photoError} aria-describedby={uploadHelp}
                onChange={(event) => { generator.chooseFiles(event.target.files); event.target.value = ""; }}
              />
              {selfie ? (
                <div className="avatar-ai-selected-photo">
                  <img src={selfie.url} alt="Il tuo selfie di riferimento" width={80} height={80} />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <p className="truncate text-sm font-medium" title={selfie.name}>{selfie.name}</p>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy || disabled} aria-describedby={uploadHelp}><ImagePlus data-icon="inline-start" />Cambia selfie</Button>
                      <Button type="button" variant="ghost" size="icon" onClick={generator.reset} disabled={busy || disabled} aria-label="Rimuovi"><X /></Button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button" className={cn("avatar-ai-dropzone", dragging && "is-dragging")}
                  disabled={busy || disabled} onClick={() => input.current?.click()} aria-describedby={uploadHelp}
                  onDragOver={(event) => { event.preventDefault(); if (!busy && !disabled) { event.dataTransfer.dropEffect = "copy"; setDragging(true); } }}
                  onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
                  onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy && !disabled) generator.chooseFiles(event.dataTransfer.files); }}
                >
                  <span className="avatar-ai-upload-icon">{busy ? <Loader2 className="size-5 motion-safe:animate-spin" aria-hidden="true" /> : <Upload className="size-5" aria-hidden="true" />}</span>
                  <span className="flex flex-col gap-1">
                    <span className="font-semibold">{busy ? "Preparo il tuo selfie…" : dragging ? "Lascia qui il tuo selfie" : "Carica il tuo selfie"}</span>
                    <span className="text-sm text-muted-foreground">oppure trascinalo qui</span>
                  </span>
                </button>
              )}
              <FieldDescription id={`${id}-upload-help`}>JPG, PNG o WebP · max 5 MB · min 256 × 256 px.</FieldDescription>
              {photoError && feedback}
            </Field>
            <Field orientation="horizontal" className="avatar-ai-consent" data-disabled={busy || disabled || !selfie}>
              <Checkbox id={`${id}-consent`} className="no-touch-min" checked={generator.consent} onCheckedChange={(checked) => generator.updateConsent(checked === true)} disabled={busy || disabled || !selfie} aria-describedby={`${id}-consent-help`} />
              <FieldContent>
                <FieldLabel htmlFor={`${id}-consent`}>Acconsento all’invio del selfie a Hugging Face.</FieldLabel>
                <FieldDescription id={`${id}-consent-help`}>La foto viene inviata solo quando premi Genera.</FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>

          <AvatarGenerationOptions
            id={id} open={optionsOpen || tokenError} onOpenChange={setOptionsOpen}
            token={generator.accessToken} onTokenChange={generator.updateAccessToken} onTokenBlur={generator.validateAccessToken}
            disabled={busy || disabled} tokenError={tokenError} tokenHelp={tokenHelp}
          />
          {!photoError && feedback}

          {busy && !confirming && (
            <div className="avatar-ai-progress" role="status" aria-live="polite">
              <div className="flex items-center gap-2"><Loader2 className="size-4 shrink-0 motion-safe:animate-spin" aria-hidden="true" /><p className="font-medium">{phase === "generating" ? "Il tuo ritratto sta prendendo forma." : "Preparo il tuo selfie sul dispositivo."}</p></div>
              <p className="text-sm leading-relaxed text-muted-foreground">{phase === "generating" ? "In attesa di Hugging Face. La coda può richiedere qualche minuto; non invieremo altre richieste." : "Ottimizzazione e rimozione dei metadati. Nessun invio online."}</p>
              <div className="avatar-ai-progress-track" aria-hidden="true"><span /></div>
            </div>
          )}
          <AvatarGenerationDetails />
        </div>
        <AvatarGenerationPreview result={result} generating={phase === "generating"} hasSelfie={Boolean(selfie)} consent={generator.consent} />
      </div>

      <footer className="avatar-ai-actions" data-has-result={Boolean(result) || undefined}>
        <div className="avatar-ai-action-note" role="status" aria-live="polite">
          {quotaError ? <Clock3 className="size-5 shrink-0" aria-hidden="true" /> : result ? <Check className="size-5 shrink-0" aria-hidden="true" /> : <ShieldCheck className="size-5 shrink-0" aria-hidden="true" />}
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{confirming ? "Imposto la foto profilo…" : confirmed ? "Foto profilo aggiornata per questa sessione." : quotaError ? "Riprendi quando la quota si rinnova." : result ? "Il tuo avatar è pronto." : "Una richiesta, solo quando lo decidi tu."}</p>
            <p id={`${id}-generation-help`} className="text-sm leading-relaxed text-muted-foreground">
              {confirming || confirmed ? "Nessun salvataggio online. Ricaricando la pagina verrà ripristinata la foto precedente." : busy ? "Interrompere l’attesa non garantisce l’annullamento del lavoro remoto." : result ? "Il profilo cambia solo se lo scegli, fino al ricaricamento. Scarica l’avatar per conservarlo." : "Servono un selfie e il consenso. Nessun tentativo automatico."}
            </p>
          </div>
        </div>
        <div className="avatar-ai-action-buttons">
          {busy && !confirming && <Button type="button" variant="outline" onClick={generator.cancel}>{phase === "generating" ? "Interrompi attesa" : "Annulla preparazione"}</Button>}
          {result && !busy && <Button variant="outline" asChild><a href={result.url} download={result.file.name}><Download data-icon="inline-start" />Scarica avatar</a></Button>}
          <Button type="button" size="lg" variant={result ? "outline" : "default"} disabled={!generator.canGenerate} onClick={() => void generator.generate()} aria-describedby={`${id}-generation-help`}>
            {phase === "generating" ? <Loader2 className="motion-safe:animate-spin" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
            {generationLabel}
          </Button>
          {result && onConfirm && (!busy || confirming) && (
            <Button type="button" size="lg" className="avatar-ai-profile-button" disabled={!generator.canConfirm} onClick={() => void generator.confirm()} aria-describedby={`${id}-generation-help`}>
              {confirming ? <Loader2 className="motion-safe:animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}
              {confirming ? "Imposto la foto…" : confirmed ? "Foto profilo impostata" : "Imposta come foto profilo"}
            </Button>
          )}
        </div>
      </footer>
    </section>
  );
}
