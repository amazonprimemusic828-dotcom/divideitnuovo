import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import type { useVault } from "@/hooks/useVault";

type Vault = ReturnType<typeof useVault>;

/**
 * Renders the setup / unlock flow for the user's personal encryption key.
 * Returns null once the vault is ready.
 */
export default function VaultGate({ vault, compact }: { vault: Vault; compact?: boolean }) {
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (vault.status === "ready" || vault.status === "loading") return null;

  if (vault.status === "unsupported") {
    return (
      <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
        <TriangleAlert className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          Questo browser non supporta la crittografia end-to-end. Aggiorna il browser per accedere alle credenziali.
        </p>
      </div>
    );
  }

  // Recovery code shown once, right after setup.
  if (recoveryCode) {
    return (
      <div className="space-y-3 p-4 rounded-2xl border-2 border-primary/30 bg-primary/5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h4 className="font-bold">Codice di recupero</h4>
        </div>
        <p className="text-sm text-muted-foreground">
          Salvalo adesso: serve per accedere alle credenziali da un altro dispositivo. Non possiamo recuperarlo per te,
          nemmeno noi possiamo leggerlo.
        </p>
        <div className="flex items-center gap-2 p-3 rounded-xl bg-card border">
          <code className="flex-1 font-mono text-sm tracking-wider break-all">{recoveryCode}</code>
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg shrink-0"
            onClick={async () => {
              await navigator.clipboard.writeText(recoveryCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1"
          />
          <span>Ho salvato il codice in un posto sicuro</span>
        </label>
        <Button
          disabled={!confirmed}
          className="rounded-xl gradient-divideit text-white"
          onClick={() => setRecoveryCode(null)}
        >
          Continua
        </Button>
      </div>
    );
  }

  if (vault.status === "absent") {
    return (
      <div className={`space-y-3 ${compact ? "" : "p-4 rounded-2xl border-2 border-primary/20 bg-primary/5"}`}>
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          <h4 className="font-bold">Attiva la cassaforte cifrata</h4>
        </div>
        <p className="text-sm text-muted-foreground">
          Creiamo nel tuo browser una coppia di chiavi personale. Le credenziali dei gruppi vengono cifrate con queste
          chiavi: i nostri server salvano solo testo illeggibile.
        </p>
        <div className="space-y-1.5">
          <Label>Password del tuo account DivideIt (facoltativa)</Label>
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ti servirà per sbloccare da un altro dispositivo"
          />
          <p className="text-xs text-muted-foreground">
            Se accedi con Google o con codice OTP lascia vuoto: userai il codice di recupero.
          </p>
        </div>
        <Button
          disabled={vault.busy}
          className="rounded-xl gradient-divideit text-white"
          onClick={async () => {
            try {
              const { recoveryCode: code } = await vault.setup(password.trim() || undefined);
              setPassword("");
              setRecoveryCode(code);
              toast.success("Cassaforte attivata 🔒");
            } catch {
              toast.error("Attivazione non riuscita");
            }
          }}
        >
          {vault.busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
          Attiva
        </Button>
      </div>
    );
  }

  // locked
  return (
    <div className={`space-y-3 ${compact ? "" : "p-4 rounded-2xl border-2 border-primary/20 bg-primary/5"}`}>
      <div className="flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-primary" />
        <h4 className="font-bold">Sblocca la cassaforte</h4>
      </div>
      <p className="text-sm text-muted-foreground">
        Inserisci la password del tuo account oppure il codice di recupero per sbloccare la chiave su questo
        dispositivo.
      </p>
      <Input
        type="password"
        autoComplete="off"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        placeholder="Password o codice di recupero"
      />
      <div className="flex gap-2 flex-wrap">
        <Button
          disabled={vault.busy || !secret.trim()}
          className="rounded-xl gradient-divideit text-white"
          onClick={async () => {
            const ok = await vault.unlock(secret);
            if (ok) {
              setSecret("");
              toast.success("Cassaforte sbloccata");
            } else {
              toast.error("Password o codice non validi");
            }
          }}
        >
          {vault.busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
          Sblocca
        </Button>
        <Button
          variant="ghost"
          className="rounded-xl"
          onClick={async () => {
            if (!confirm("Creare una nuova chiave? Perderai l'accesso alle credenziali già condivise con te.")) return;
            try {
              const { recoveryCode: code } = await vault.reset();
              setRecoveryCode(code);
            } catch {
              toast.error("Operazione non riuscita");
            }
          }}
        >
          Ho perso tutto, crea una nuova chiave
        </Button>
      </div>
    </div>
  );
}
