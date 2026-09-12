import { Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { AVATAR_STYLE_REFERENCES } from "./config";

interface Props {
  result: { url: string } | null;
  generating: boolean;
  hasSelfie: boolean;
  consent: boolean;
}

export default function AvatarGenerationPreview({ result, generating, hasSelfie, consent }: Props) {
  const steps = [
    { label: "Selfie", complete: hasSelfie },
    { label: "Consenso", complete: consent },
    { label: "Avatar", complete: Boolean(result) && !generating },
  ];
  const currentStep = steps.findIndex((step) => !step.complete);

  return (
    <div className="avatar-ai-preview">
      <figure className="avatar-ai-canvas" aria-busy={generating}>
        <div className="avatar-ai-canvas-heading">
          <Badge variant="secondary">{result ? "Il tuo avatar" : "Stile Studio"}</Badge>
          <span className="text-sm text-muted-foreground">1024 × 1024</span>
        </div>
        {result ? (
          <div className="avatar-ai-result-image">
            <img src={result.url} alt="Avatar 3D generato dal tuo selfie" width={1024} height={1024} />
            {generating && <span className="avatar-ai-working"><Loader2 className="size-8 motion-safe:animate-spin" aria-hidden="true" /><span className="text-sm font-medium">Nuova versione in corso…</span></span>}
          </div>
        ) : (
          <Empty className="avatar-ai-stage">
            <EmptyHeader>
              <EmptyMedia>
                <div className="avatar-ai-style-examples">
                  {AVATAR_STYLE_REFERENCES.map((src, index) => <img key={src} src={src} alt={`Riferimento di stile Studio: ${index === 0 ? "Luca" : "Giulia"}`} width={256} height={256} />)}
                </div>
              </EmptyMedia>
              <EmptyTitle>{generating ? "Il tuo ritratto, in arrivo." : "Il tuo avatar apparirà qui"}</EmptyTitle>
              <EmptyDescription>Lo stile della collezione.<br />La personalità è tutta tua.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        <figcaption className="avatar-ai-canvas-caption">{result ? "Creato dal tuo selfie · disponibile per il download" : "Esempi di stile, non un risultato generato."}</figcaption>
      </figure>
      <ol className="avatar-ai-steps" aria-label="Avanzamento creazione avatar">
        {steps.map((step, index) => (
          <li key={step.label} data-complete={step.complete} aria-current={index === currentStep ? "step" : undefined}>
            <span className="avatar-ai-step-number" aria-hidden="true">{step.complete ? <Check className="size-4" /> : index + 1}</span>
            <span>{step.label}</span>
            {step.complete && <span className="sr-only">completato</span>}
          </li>
        ))}
      </ol>
      <p className="avatar-ai-photo-tip">Per un buon punto di partenza: un solo volto, luce naturale e niente filtri.</p>
    </div>
  );
}
