import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { stripeApi } from "@/lib/stripeApi";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  CircleCheck,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  LinkIcon,
  Loader2,
  Mail,
  Save,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";

interface Props {
  groupId: string;
  userEmail: string;
  isAdmin: boolean;
}

type CredType = "email" | "link";
type CredStatus = "pending" | "verified" | "issue";

interface CredentialPayload {
  type?: CredType;
  email?: string;
  password?: string;
  notes?: string;
  link?: string;
}

interface CredCache {
  hasCreds: boolean;
  type: CredType;
  email?: string;
  notes?: string;
  link?: string;
  updated_at?: string | null;
  credStatus?: CredStatus;
}

function cacheKey(groupId: string, userEmail: string) {
  return `divideit:credsmeta:${groupId}:${userEmail.toLowerCase()}`;
}

function readCache(groupId: string, userEmail: string): CredCache | null {
  try {
    const raw = localStorage.getItem(cacheKey(groupId, userEmail));
    return raw ? (JSON.parse(raw) as CredCache) : null;
  } catch {
    return null;
  }
}

export default function ServiceCredentialsPanel({ groupId, userEmail, isAdmin }: Props) {
  // Cache (senza password) per mostrare subito il pannello, senza attesa.
  const cached = readCache(groupId, userEmail);

  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);

  const [loaded, setLoaded] = useState<CredentialPayload | null>(
    cached?.hasCreds ? { type: cached.type, email: cached.email, notes: cached.notes, link: cached.link } : null,
  );
  const [updatedAt, setUpdatedAt] = useState<string | null>(cached?.updated_at ?? null);
  const [hasCreds, setHasCreds] = useState(!!cached?.hasCreds);
  const [revealPassword, setRevealPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [credStatus, setCredStatus] = useState<CredStatus>(cached?.credStatus || "pending");
  const [statusBusy, setStatusBusy] = useState<null | CredStatus>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueNote, setIssueNote] = useState("");

  const [mode, setMode] = useState<CredType>(cached?.type || "email");
  const [serviceEmail, setServiceEmail] = useState(cached?.email || "");
  const [servicePassword, setServicePassword] = useState("");
  const [serviceNotes, setServiceNotes] = useState(cached?.notes || "");
  const [serviceLink, setServiceLink] = useState(cached?.link || "");
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);


  const writeCache = useCallback(
    (patch: Partial<CredCache>) => {
      try {
        const prev = readCache(groupId, userEmail) || ({ hasCreds: false, type: "email" } as CredCache);
        localStorage.setItem(cacheKey(groupId, userEmail), JSON.stringify({ ...prev, ...patch }));
      } catch {
        /* ignore quota errors */
      }
    },
    [groupId, userEmail],
  );

  const applyPayload = useCallback((text: string | null) => {
    if (!text) {
      setHasCreds(false);
      setLoaded(null);
      writeCache({ hasCreds: false, email: undefined, notes: undefined, link: undefined });
      return;
    }
    let parsed: CredentialPayload;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { notes: text };
    }
    setHasCreds(true);
    setLoaded(parsed);
    setMode(parsed.type === "link" ? "link" : "email");
    setServiceEmail(parsed.email || "");
    setServicePassword(parsed.password || "");
    setServiceNotes(parsed.notes || "");
    setServiceLink(parsed.link || "");
    // Non salviamo MAI la password in cache locale.
    writeCache({
      hasCreds: true,
      type: parsed.type === "link" ? "link" : "email",
      email: parsed.email,
      notes: parsed.notes,
      link: parsed.link,
    });
  }, [writeCache]);

  const fetchCredentials = useCallback(async () => {
    const { ok, data } = await stripeApi("credentials-get", { groupId, userEmail });
    if (ok) {
      setError(null);
      applyPayload(data?.credentials ?? null);
      setUpdatedAt(data?.updated_at ?? null);
      writeCache({ updated_at: data?.updated_at ?? null });
    } else {
      setError(data?.message || data?.error || "Impossibile aprire la cassaforte.");
    }
    setLoading(false);
  }, [groupId, userEmail, applyPayload, writeCache]);


  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("get_group_members", { _group_id: groupId });
      if (cancelled || !Array.isArray(data)) return;
      const mine = (data as any[]).find(
        (m) => (m.user_email || "").toLowerCase() === userEmail.toLowerCase(),
      );
      if (mine?.cred_status) {
        setCredStatus(mine.cred_status as CredStatus);
        writeCache({ credStatus: mine.cred_status as CredStatus });
      }

    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, userEmail, writeCache]);


  const copyToClip = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      toast.error("Copia non riuscita");
      return;
    }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
  };

  const sendStatus = async (status: CredStatus, note?: string) => {
    setStatusBusy(status);
    try {
      const { ok, data } = await stripeApi("credential-status", {
        groupId,
        status,
        note: note || null,
      });
      if (!ok) {
        toast.error(data?.error || "Non è stato possibile inviare la conferma");
        return;
      }
      setCredStatus(status);
      writeCache({ credStatus: status });

      setIssueOpen(false);
      setIssueNote("");
      toast.success(
        status === "verified"
          ? "Grazie! L'admin è stato avvisato che tutto funziona 🎉"
          : "Segnalazione inviata all'admin. Ti avviseremo appena cambia la password.",
      );
    } finally {
      setStatusBusy(null);
    }
  };

  const saveCredentials = async () => {
    if (!acceptedDisclaimer) {
      toast.error("Conferma di aver letto l'avviso di sicurezza");
      return;
    }
    const payload: CredentialPayload =
      mode === "link"
        ? { type: "link", link: serviceLink.trim(), notes: serviceNotes.trim() || undefined }
        : {
            type: "email",
            email: serviceEmail.trim(),
            password: servicePassword,
            notes: serviceNotes.trim() || undefined,
          };

    if (mode === "link" && !payload.link) {
      toast.error("Inserisci il link di invito");
      return;
    }
    if (mode === "email" && (!payload.email || !payload.password)) {
      toast.error("Inserisci email e password del servizio");
      return;
    }

    setSaving(true);
    try {
      const { ok, data } = await stripeApi("credentials-set", {
        groupId,
        credentials: JSON.stringify(payload),
      });
      if (!ok) {
        toast.error(data?.error || "Salvataggio non riuscito");
        return;
      }
      toast.success(
        data?.updated
          ? "Credenziali aggiornate — i membri attivi sono stati avvisati"
          : "Credenziali salvate in modo cifrato",
      );
      setEditing(false);
      setAcceptedDisclaimer(false);
      await fetchCredentials();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6 rounded-2xl space-y-4 bg-card/90 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-lg leading-tight">Cassaforte credenziali</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cifrate con AES‑256 sul server. Visibili solo ai membri attivi del gruppo.
          </p>
        </div>
        {loading && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground shrink-0" aria-label="Aggiornamento credenziali">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Aggiorno
          </span>
        )}
      </div>

      {error ? (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <TriangleAlert className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : loading && !cached ? (
        <div className="space-y-3" aria-live="polite">
          <div className="p-3 rounded-xl bg-muted/50 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Email</p>
              <p className="text-sm text-muted-foreground">Apertura accesso cifrato…</p>
            </div>
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
          <div className="p-3 rounded-xl bg-muted/50 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Password</p>
              <p className="text-sm font-mono">••••••••••••</p>
            </div>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
        </div>
      ) : isAdmin && (editing || !hasCreds) ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <TriangleAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              La password inserita sarà accessibile ai membri paganti. Usa una password univoca, dedicata SOLO a questo
              abbonamento.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-muted">
            <button
              type="button"
              onClick={() => setMode("email")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                mode === "email" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              <Mail className="w-4 h-4" /> Email & password
            </button>
            <button
              type="button"
              onClick={() => setMode("link")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                mode === "link" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              <LinkIcon className="w-4 h-4" /> Link di invito
            </button>
          </div>

          {mode === "email" ? (
            <>
              <div className="space-y-1.5">
                <Label>Email account servizio</Label>
                <Input
                  type="email"
                  autoComplete="off"
                  value={serviceEmail}
                  onChange={(e) => setServiceEmail(e.target.value)}
                  placeholder="netflix@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input
                  type="text"
                  autoComplete="off"
                  value={servicePassword}
                  onChange={(e) => setServicePassword(e.target.value)}
                  placeholder="Password univoca del servizio"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label>Link di invito</Label>
              <Input
                type="url"
                autoComplete="off"
                value={serviceLink}
                onChange={(e) => setServiceLink(e.target.value)}
                placeholder="https://netflix.com/invite/..."
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Note (profilo, istruzioni)</Label>
            <Textarea
              value={serviceNotes}
              onChange={(e) => setServiceNotes(e.target.value)}
              rows={2}
              placeholder="Usa il profilo 3 — non modificare gli altri"
            />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <Checkbox
              checked={acceptedDisclaimer}
              onCheckedChange={(v) => setAcceptedDisclaimer(v === true)}
              className="mt-0.5"
            />
            <span className="text-xs text-muted-foreground">
              Ho letto l'avviso: userò una password dedicata a questo abbonamento.
            </span>
          </label>

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={saveCredentials}
              disabled={saving || !acceptedDisclaimer}
              className="gradient-divideit text-white rounded-xl h-11"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              Salva cifrate
            </Button>
            {hasCreds && (
              <Button variant="outline" onClick={() => setEditing(false)} className="rounded-xl h-11">
                Annulla
              </Button>
            )}
          </div>
        </div>
      ) : !hasCreds ? (
        <p className="text-sm text-muted-foreground">L'admin non ha ancora inserito le credenziali.</p>
      ) : (
        <div className="space-y-3">
          {(loaded?.type || mode) !== "link" ? (
            <>
              {(loaded?.email || serviceEmail) && (
                <CredRow
                  label="Email"
                  value={loaded?.email || serviceEmail}
                  copied={copied === "email"}
                  onCopy={() => copyToClip("email", loaded?.email || serviceEmail)}
                />
              )}
              {(hasCreds || loaded?.password) && (
                <CredRow
                  label="Password"
                  value={loaded?.password || "••••••••••••"}
                  masked={!revealPassword || !loaded?.password}
                  onToggle={() => setRevealPassword((v) => !v)}
                  copied={copied === "password"}
                  onCopy={() => loaded?.password && copyToClip("password", loaded.password)}
                  pending={loading && !loaded?.password}
                />
              )}
            </>
          ) : (
            (loaded?.link || serviceLink) && (
              <div className="p-3 rounded-xl bg-muted/50 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Link di invito</p>
                <p className="text-sm break-all">{loaded?.link || serviceLink}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => copyToClip("link", loaded?.link || serviceLink)}>
                    {copied === "link" ? <Check className="w-4 h-4 mr-1.5 text-emerald-600" /> : <Copy className="w-4 h-4 mr-1.5" />}
                    {copied === "link" ? "Copiato!" : "Copia"}
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-lg" asChild>
                    <a href={loaded?.link || serviceLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-1.5" /> Apri
                    </a>
                  </Button>
                </div>
              </div>
            )
          )}

          {loaded?.notes && (
            <div className="p-3 rounded-xl bg-muted/50">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Note</p>
              <p className="text-sm whitespace-pre-wrap">{loaded.notes}</p>
            </div>
          )}

          {updatedAt && (
            <p className="text-xs text-muted-foreground">
              Ultimo aggiornamento: {new Date(updatedAt).toLocaleString("it-IT")}
            </p>
          )}

          {isAdmin ? (
            <Button variant="outline" onClick={() => setEditing(true)} className="rounded-xl">
              <Save className="w-4 h-4 mr-2" /> Aggiorna credenziali
            </Button>
          ) : (
            <div className="pt-1">
              <AnimatePresence mode="wait">
                {credStatus === "verified" ? (
                  <motion.div
                    key="ok"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 320, damping: 22 }}
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25"
                  >
                    <motion.span
                      initial={{ scale: 0, rotate: -30 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 14, delay: 0.05 }}
                      className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center"
                    >
                      <Check className="w-5 h-5 text-white" />
                    </motion.span>
                    <div>
                      <p className="text-sm font-semibold text-emerald-700">Accesso verificato</p>
                      <p className="text-xs text-muted-foreground">Grazie! L'admin ha ricevuto la tua conferma.</p>
                    </div>
                  </motion.div>
                ) : credStatus === "issue" ? (
                  <motion.div
                    key="issue"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }}
                    transition={{ duration: 0.5 }}
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-destructive/10 border border-destructive/25"
                  >
                    <span className="w-9 h-9 rounded-full bg-destructive flex items-center justify-center">
                      <TriangleAlert className="w-5 h-5 text-white" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-destructive">Problema segnalato</p>
                      <p className="text-xs text-muted-foreground">
                        L'admin è stato avvisato. Riceverai un'email appena aggiorna le credenziali.
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="ask"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="p-3.5 rounded-xl border border-border bg-muted/40 space-y-3"
                  >
                    <p className="text-sm font-semibold">Le credenziali funzionano?</p>
                    <p className="text-xs text-muted-foreground -mt-1.5">
                      Fai un test e dicci com'è andata: l'admin riceverà subito la tua risposta.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        onClick={() => sendStatus("verified")}
                        disabled={statusBusy !== null}
                        className="rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {statusBusy === "verified" ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CircleCheck className="w-4 h-4 mr-2" />
                        )}
                        Tutto ok
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIssueOpen((v) => !v)}
                        disabled={statusBusy !== null}
                        className="rounded-xl h-11 border-destructive/40 text-destructive hover:bg-destructive/10"
                      >
                        <X className="w-4 h-4 mr-2" /> Non funzionano
                      </Button>
                    </div>

                    <AnimatePresence>
                      {issueOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden space-y-2"
                        >
                          <Textarea
                            rows={2}
                            value={issueNote}
                            maxLength={500}
                            onChange={(e) => setIssueNote(e.target.value)}
                            placeholder="Cosa succede? Es. 'password errata' o 'profilo già occupato'"
                          />
                          <Button
                            onClick={() => sendStatus("issue", issueNote)}
                            disabled={statusBusy !== null}
                            className="rounded-xl h-10 w-full bg-destructive hover:bg-destructive/90 text-white"
                          >
                            {statusBusy === "issue" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Invia segnalazione all'admin
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function CredRow({
  label,
  value,
  masked,
  onToggle,
  copied,
  onCopy,
  pending = false,
}: {
  label: string;
  value: string;
  masked?: boolean;
  onToggle?: () => void;
  copied: boolean;
  onCopy: () => void;
  pending?: boolean;
}) {
  return (
    <div className="p-3 rounded-xl bg-muted/50 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="text-sm font-mono truncate">{masked ? "••••••••••••" : value}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onToggle && (
          <Button size="icon" variant="ghost" className="rounded-lg" onClick={onToggle} aria-label="Mostra/nascondi">
            {masked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </Button>
        )}
        <Button size="sm" variant="outline" className="rounded-lg min-w-[92px]" onClick={onCopy} disabled={pending}>
          {pending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : copied ? <Check className="w-4 h-4 mr-1.5 text-emerald-600" /> : <Copy className="w-4 h-4 mr-1.5" />}
          {pending ? "Pronta..." : copied ? "Copiato!" : "Copia"}
        </Button>
      </div>
    </div>
  );
}
