import { useCallback, useId, useRef, useState } from "react";
import { Camera, Check, ImagePlus, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import AvatarAIGenerator from "@/features/avatar-ai/AvatarAIGenerator";
import type { AvatarConfirmCallback } from "@/features/avatar-ai/contracts";
import { cn } from "@/lib/utils";
import { premiumAvatars } from "./premium-avatars";

interface AvatarSelectorProps {
  currentAvatar?: string | null;
  onAvatarSelect: (avatarUrl: string | null) => void | Promise<void>;
  onFileUpload: (file: File) => Promise<string | null>;
  isUploading?: boolean;
  onGeneratedAvatar?: AvatarConfirmCallback;
}

export default function AvatarSelector({ currentAvatar, onAvatarSelect, onFileUpload, isUploading = false, onGeneratedAvatar }: AvatarSelectorProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(currentAvatar || premiumAvatars[0].url);
  const [tab, setTab] = useState("ai");
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiConfirming, setAiConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveLock = useRef(false);
  const locked = saving || isUploading || aiBusy;
  const onAIBusyChange = useCallback((busy: boolean, committing: boolean) => { setAiBusy(busy); setAiConfirming(committing); }, []);

  const confirm = async (url: string | null) => {
    if (saveLock.current || aiBusy || isUploading) return;
    saveLock.current = true;
    setSaving(true);
    try { await onAvatarSelect(url); setOpen(false); }
    catch { toast.error("Non è stato possibile aggiornare l’avatar. Riprova."); }
    finally { saveLock.current = false; setSaving(false); }
  };
  const upload = async (file?: File) => {
    if (!file || saveLock.current || aiBusy || isUploading) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024 || !file.size) {
      toast.error("Scegli un’immagine JPG, PNG o WebP di massimo 5 MB."); return;
    }
    saveLock.current = true;
    setSaving(true);
    try {
      const url = await onFileUpload(file);
      if (!url) throw new Error("Upload failed");
      await onAvatarSelect(url);
      setOpen(false);
    } catch { toast.error("Caricamento non riuscito. Prova un’altra immagine."); }
    finally { saveLock.current = false; setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value && (saving || aiConfirming || isUploading)) return;
      setOpen(value);
      if (value) { setDraft(currentAvatar || premiumAvatars[0].url); setTab("ai"); }
    }}>
      <DialogTrigger asChild><Button variant="outline"><Camera data-icon="inline-start" />Cambia avatar</Button></DialogTrigger>
      <DialogContent className="avatar-studio-dialog" onEscapeKeyDown={(event) => { if (saving || aiConfirming || isUploading) event.preventDefault(); }} onInteractOutside={(event) => { if (saving || aiConfirming || isUploading) event.preventDefault(); }}>
        <DialogHeader className="avatar-studio-header">
          <p className="avatar-studio-eyebrow">Avatar Studio</p>
          <DialogTitle className="avatar-studio-title">Un piccolo ritratto. Tutto tuo.</DialogTitle>
          <DialogDescription>Crea con l’AI, scegli dalla collezione o usa una tua foto.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab} className="avatar-studio-modes">
          <div className="avatar-studio-navigation">
            <TabsList className="studio-tabs avatar-studio-tabs" aria-label="Come vuoi creare il tuo avatar?">
              <TabsTrigger value="ai" disabled={locked}><Sparkles className="size-4" aria-hidden="true" />Crea con AI</TabsTrigger>
              <TabsTrigger value="studio" disabled={locked} aria-label="Collezione Studio"><ImagePlus className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Collezione Studio</span><span className="sm:hidden" aria-hidden="true">Studio</span></TabsTrigger>
              <TabsTrigger value="upload" disabled={locked}><Upload className="size-4" aria-hidden="true" />La tua foto</TabsTrigger>
            </TabsList>
          </div>
          <div className="avatar-studio-scroll">
            <TabsContent value="ai" forceMount hidden={tab !== "ai"} className="avatar-studio-tab data-[state=inactive]:hidden">
              <AvatarAIGenerator onConfirm={onGeneratedAvatar} onConfirmed={() => setOpen(false)} onBusyChange={onAIBusyChange} disabled={saving || isUploading} />
            </TabsContent>
            <TabsContent value="studio" className="avatar-studio-tab">
              <div className="avatar-studio-collection">
                <div className="flex flex-col gap-2">
                  <h3 className="text-balance font-display text-2xl font-bold">Trova il tuo carattere.</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">Sei personalità, pronte da usare. Nessuna generazione e nessun consumo di quota.</p>
                </div>
                <RadioGroup value={draft} onValueChange={setDraft} disabled={locked} className="grid grid-cols-3 gap-3 sm:grid-cols-6" aria-label="Scegli il tuo avatar premium">
                  {premiumAvatars.map((avatar) => (
                    <Label key={avatar.id} htmlFor={`${id}-${avatar.id}`} className={cn("avatar-choice", draft === avatar.url && "selected", locked && "pointer-events-none opacity-60")}>
                      <RadioGroupItem id={`${id}-${avatar.id}`} value={avatar.url} className="sr-only" />
                      <span className="relative block overflow-hidden rounded-2xl"><img src={avatar.url} alt={`Avatar illustrato ${avatar.name}`} width={256} height={256} className="aspect-square w-full object-cover" loading="lazy" />{draft === avatar.url && <span className="avatar-choice-check"><Check className="size-4" aria-hidden="true" /></span>}</span>
                      <span className="block pt-2 text-center text-sm font-medium">{avatar.name}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            </TabsContent>
            <TabsContent value="upload" className="avatar-studio-tab">
              <div className="avatar-studio-collection">
                <div className="flex flex-col gap-2">
                  <h3 className="text-balance font-display text-2xl font-bold">Semplicemente, la tua foto.</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">Usala così com’è. Nessuna elaborazione AI.</p>
                </div>
                <Field>
                  <FieldLabel htmlFor={`${id}-avatar-file`} className="sr-only">Carica la tua foto</FieldLabel>
                  <input id={`${id}-avatar-file`} ref={fileRef} type="file" className="sr-only max-w-px" accept="image/jpeg,image/png,image/webp" disabled={locked} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} />
                  <button type="button" className="avatar-upload" onClick={() => fileRef.current?.click()} disabled={locked}>{locked ? <Loader2 className="size-8 motion-safe:animate-spin" aria-hidden="true" /> : <ImagePlus className="size-8 text-primary" aria-hidden="true" />}<span className="font-semibold">{locked ? "Caricamento in corso…" : "Scegli una foto dal tuo dispositivo"}</span><span className="text-sm text-muted-foreground">JPG, PNG o WebP · massimo 5 MB</span></button>
                  <FieldDescription>La foto scelta viene impostata direttamente sul profilo.</FieldDescription>
                </Field>
              </div>
            </TabsContent>
          </div>
          {tab !== "ai" && (
            <DialogFooter className="avatar-studio-footer">
              <Button type="button" variant="ghost" onClick={() => void confirm(null)} disabled={locked || !currentAvatar}><Trash2 data-icon="inline-start" />Rimuovi foto attuale</Button>
              {tab === "studio" && <Button type="button" onClick={() => void confirm(draft)} disabled={locked}>{saving ? <Loader2 className="motion-safe:animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}Usa questo avatar</Button>}
            </DialogFooter>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
