import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Medal, Users, Check, ScrollText, Loader2, Share2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/components/AuthContext";
import { getMyReferralCode } from "@/lib/referral";
import {
  CONTEST_PRIZES,
  formatContestDate,
  getContestLeaderboard,
  getContestSettings,
  getMyContestEntry,
  joinContest,
  type ContestEntry,
  type ContestSettings,
  type LeaderboardRow,
} from "@/lib/contest";

const medalColor = (pos: number) =>
  pos === 1
    ? "bg-amber-100 text-amber-700"
    : pos === 2
    ? "bg-slate-200 text-slate-700"
    : pos === 3
    ? "bg-orange-100 text-orange-700"
    : "bg-muted text-muted-foreground";

export default function Contest() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ContestSettings | null>(null);
  const [entry, setEntry] = useState<ContestEntry | null>(null);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [nickname, setNickname] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, e, l, c] = await Promise.all([
      getContestSettings(),
      user?.uid ? getMyContestEntry() : Promise.resolve(null),
      getContestLeaderboard(50),
      user?.uid ? getMyReferralCode() : Promise.resolve(null),
    ]);
    setSettings(s);
    setEntry(e);
    setRows(l);
    setCode(c);
    if (e?.nickname) setNickname(e.nickname);
    setLoading(false);
  }, [user?.uid]);

  useEffect(() => {
    void load();
  }, [load]);

  const link = code ? `${window.location.origin}/Auth?ref=${code}` : "";

  const myRow = useMemo(() => rows.find((r) => r.is_me), [rows]);

  const submit = async () => {
    if (!accepted) {
      toast({ title: "Devi accettare il regolamento", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await joinContest(nickname.trim(), true);
      toast({ title: "Iscrizione confermata", description: "Sei in gara. Buona fortuna!" });
      await load();
    } catch (err: any) {
      toast({ title: "Iscrizione non riuscita", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!link) {
      toast({ title: "Codice non ancora pronto", description: "Riprova tra un istante." });
      void load();
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Link copiato" });
    } catch {
      toast({ title: "Impossibile copiare", variant: "destructive" });
    }
  };


  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "DIVIDEIT", text: "Unisciti a DIVIDEIT con il mio link:", url: link });
        return;
      } catch {
        /* annullato */
      }
    }
    void copyLink();
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
      {/* HERO */}
      <div className="flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Trophy className="h-3.5 w-3.5 text-primary-strong" /> Contest referral
        </span>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
          Invita, scala la classifica, <span className="text-gradient-divideit">vinci fino a 500 €</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Periodo del contest: {formatContestDate(settings?.starts_at ?? null)} —{" "}
          {formatContestDate(settings?.ends_at ?? null)}. Conta solo chi paga due mensilità
          consecutive.
        </p>
        <Link
          to="/RegolamentoContest"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline"
        >
          <ScrollText className="h-4 w-4" /> Leggi il regolamento ufficiale
        </Link>
      </div>

      {/* PREMI */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CONTEST_PRIZES.map((p) => (
          <div key={p.place} className="rounded-3xl border border-border/60 bg-card/90 p-6 text-center shadow-sm">
            <div className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${medalColor(p.place)}`}>
              <Medal className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black">{p.prize}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {p.place}° classificato
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Soglia minima: {p.threshold} utenti attivi
            </p>
          </div>
        ))}
      </div>

      {/* ISCRIZIONE / STATO */}
      <div className="mt-8 rounded-3xl border border-border/60 bg-card/95 p-6 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
          </div>
        ) : entry ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary-strong">
                <Check className="h-3.5 w-3.5" /> Iscritto al contest
              </span>
              <p className="text-sm text-muted-foreground">
                Nickname: <span className="font-bold text-foreground">{entry.nickname}</span> ·
                regolamento {entry.rules_version} accettato il{" "}
                {formatContestDate(entry.rules_accepted_at)}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-muted/50 p-5 text-center">
                <p className="text-3xl font-black">{entry.active_users}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Utenti attivi validati
                </p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-5 text-center">
                <p className="text-3xl font-black text-primary-strong">
                  {myRow ? `#${myRow.rank_position}` : "—"}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Posizione provvisoria
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={share} className="h-12 flex-1 rounded-2xl gradient-divideit font-bold text-white">
                <Share2 className="mr-2 h-4 w-4" /> Condividi il tuo link
              </Button>
              <Button onClick={copyLink} variant="secondary" className="h-12 w-full rounded-2xl font-semibold sm:w-auto">
                <Copy className="mr-2 h-4 w-4" /> Copia link
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Iscriviti al contest</h2>
            <div>
              <label className="mb-1.5 block text-sm font-semibold" htmlFor="contest-nickname">
                Nickname pubblico (3–20 caratteri)
              </label>
              <Input
                id="contest-nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                placeholder="es. MarcoRisparmia"
                className="h-12 rounded-xl"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                In classifica mostriamo solo il nickname: mai email o altri dati personali.
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/60 bg-muted/40 p-4">
              <Checkbox
                checked={accepted}
                onCheckedChange={(v) => setAccepted(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm">
                Ho letto e accetto il{" "}
                <Link to="/RegolamentoContest" className="font-semibold text-primary underline">
                  Regolamento del Contest
                </Link>
                . Confermo di essere maggiorenne e che il mio account è in regola con i Termini di
                Servizio.
              </span>
            </label>

            <Button
              onClick={submit}
              disabled={saving || !accepted || nickname.trim().length < 3}
              className="h-12 w-full rounded-2xl gradient-divideit font-bold text-white"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trophy className="mr-2 h-4 w-4" />}
              Partecipa al contest
            </Button>
          </div>
        )}
      </div>

      {/* CLASSIFICA */}
      <div className="mt-8 overflow-hidden rounded-3xl border border-border/60 bg-card/95 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <h2 className="font-bold">Classifica provvisoria</h2>
          <Link to="/RegolamentoContest" className="text-xs font-semibold text-primary underline">
            Regolamento
          </Link>
        </div>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-semibold">Nessun partecipante in classifica</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Iscriviti e inizia a invitare: sarai il primo a comparire qui.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((r) => (
              <li
                key={`${r.rank_position}-${r.nickname}`}
                className={`flex items-center gap-3 px-5 py-4 ${r.is_me ? "bg-primary-soft/40" : ""}`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black ${medalColor(
                    r.rank_position,
                  )}`}
                >
                  {r.rank_position}
                </div>
                <p className="min-w-0 flex-1 truncate text-sm font-bold">
                  {r.nickname} {r.is_me && <span className="text-xs font-semibold text-primary-strong">(tu)</span>}
                </p>
                <span className="shrink-0 text-sm font-black">{r.active_users}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-border/60 px-5 py-4 text-xs text-muted-foreground">
          La classifica è provvisoria e non costituisce diritto al premio: i conteggi vengono
          validati al 35° giorno dalla chiusura del contest, sottraendo abbandoni, rimborsi e
          storni (art. 6 del regolamento).
        </p>
      </div>
    </div>
  );
}
