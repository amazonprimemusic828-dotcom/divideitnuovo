import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ScrollText, Trophy, Shield } from "lucide-react";
import { legalConfig } from "@/lib/legal-config";
import {
  CONTEST_PRIZES,
  formatContestDate,
  getContestSettings,
  type ContestSettings,
} from "@/lib/contest";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-foreground lg:text-xl">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-6">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

export default function ContestRules() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<ContestSettings | null>(null);

  useEffect(() => {
    void getContestSettings().then(setSettings);
  }, []);

  const start = formatContestDate(settings?.starts_at ?? null);
  const end = formatContestDate(settings?.ends_at ?? null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-50 to-purple-50 p-4 lg:p-10">
      <div className="mx-auto max-w-4xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna Indietro
        </Button>

        <Card className="overflow-hidden rounded-3xl bg-card/80 shadow-xl">
          <div className="gradient-divideit p-6 text-white lg:p-8">
            <div className="mb-2 flex items-center gap-3">
              <ScrollText className="h-8 w-8" />
              <h1 className="text-2xl font-bold lg:text-3xl">
                Regolamento Ufficiale — Contest Referral {legalConfig.siteName}
              </h1>
            </div>
            <p className="text-white/80">Versione {settings?.rules_version ?? "v1"} · Periodo: {start} — {end}</p>
          </div>

          <div className="space-y-8 p-6 text-sm leading-relaxed text-muted-foreground lg:p-8 lg:text-base">
            <Section title="Art. 1 — Organizzatore e oggetto">
              <p>
                Il presente contest (di seguito "Contest") è organizzato da {legalConfig.siteName},
                servizio gestito da {legalConfig.companyName} (di seguito "l'Organizzatore"). Il
                Contest premia gli utenti che invitano nuovi utenti attivi sulla piattaforma tramite
                il proprio link o codice referral personale, secondo le regole descritte di seguito.
              </p>
            </Section>

            <Section title="Art. 2 — Durata">
              <p>
                Il Contest si svolge dal {start} al {end} (ora italiana). Le iscrizioni di nuovi
                utenti e le azioni qualificanti avvenute al di fuori di questo periodo non
                concorrono alla classifica.
              </p>
            </Section>

            <Section title="Art. 3 — Requisiti di partecipazione">
              <p>
                3.1. Possono partecipare tutti gli utenti registrati a {legalConfig.siteName},
                maggiorenni, con un account in regola con i Termini di Servizio.
              </p>
              <p>
                3.2. La partecipazione al Contest richiede l'iscrizione esplicita tramite l'apposita
                sezione della piattaforma e l'accettazione del presente regolamento.
              </p>
              <p>3.3. I dipendenti e collaboratori dell'Organizzatore sono esclusi dal Contest.</p>
            </Section>

            <Section title='Art. 4 — Definizione di "Utente Attivo"'>
              <p>
                4.1. Ai fini della classifica, per <strong>Utente Attivo</strong> si intende
                esclusivamente un nuovo utente che:
              </p>
              <List
                items={[
                  "a) si è registrato utilizzando il link o codice referral del partecipante durante il periodo del Contest;",
                  "b) ha inserito un metodo di pagamento valido;",
                  "c) ha completato con successo due rinnovi consecutivi della propria quota (pagamento del Mese 1 e del Mese 2).",
                ]}
              />
              <p>
                4.2. Un utente che ha effettuato un solo pagamento, o i cui pagamenti sono falliti,
                stati rimborsati o contestati, non è considerato Utente Attivo.
              </p>
              <p>
                4.3. Ogni nuovo utente può essere attribuito a un solo partecipante (il primo
                referral registrato).
              </p>
            </Section>

            <Section title="Art. 5 — Classifica e premi">
              <p>
                5.1. La classifica ordina i partecipanti per numero di Utenti Attivi generati durante
                il Contest.
              </p>
              <p>5.2. I premi in palio sono:</p>
              <div className="overflow-hidden rounded-2xl border border-border/60">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/60 text-foreground">
                    <tr>
                      <th className="px-4 py-3 font-bold">Posizione</th>
                      <th className="px-4 py-3 font-bold">Premio</th>
                      <th className="px-4 py-3 font-bold">Soglia minima di Utenti Attivi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {CONTEST_PRIZES.map((p) => (
                      <tr key={p.place}>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {p.place}° classificato
                        </td>
                        <td className="px-4 py-3 font-bold text-primary-strong">{p.prize}</td>
                        <td className="px-4 py-3">{p.threshold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                5.3. Il premio è erogato solo se il partecipante raggiunge la soglia minima della
                propria posizione. Se il primo classificato non raggiunge 500 Utenti Attivi, il
                premio corrispondente non viene assegnato; lo stesso vale per le altre posizioni. I
                premi non assegnati non vengono redistribuiti.
              </p>
              <p>
                5.4. In caso di parità, prevale il partecipante che ha raggiunto per primo il numero
                di Utenti Attivi conteggiato.
              </p>
              <p>
                5.5. La classifica visibile sulla piattaforma durante il Contest è provvisoria e non
                costituisce diritto al premio.
              </p>
            </Section>

            <Section title="Art. 6 — Validazione e pagamento differito">
              <p>
                6.1. I premi vengono validati e pagati al 35° giorno successivo alla chiusura del
                Contest.
              </p>
              <p>
                6.2. Nel periodo tra la chiusura e il 35° giorno, l'Organizzatore effettua un
                controllo del tasso di abbandono (churn): gli Utenti Attivi che nel frattempo hanno
                annullato l'iscrizione, richiesto rimborsi, subito storni (chargeback) o violato i
                Termini di Servizio vengono sottratti dal conteggio del partecipante.
              </p>
              <p>
                6.3. Se, dopo tale verifica, il conteggio validato del partecipante scende sotto la
                soglia minima della sua posizione, il premio non viene erogato oppure viene
                riassegnata la posizione secondo la classifica validata.
              </p>
              <p>
                6.4. Il pagamento avviene tramite bonifico bancario o altro metodo concordato, entro
                15 giorni dalla validazione, previa comunicazione dei dati necessari da parte del
                vincitore.
              </p>
            </Section>

            <Section title="Art. 7 — Condotte vietate">
              <p>
                7.1. Sono vietati e comportano la squalifica immediata, la perdita di ogni premio e
                la possibile sospensione dell'account:
              </p>
              <List
                items={[
                  "auto-inviti, account multipli o account fittizi;",
                  "registrazioni effettuate con dati falsi o email temporanee;",
                  "pagamenti effettuati con carte intestate al partecipante stesso per conto degli invitati;",
                  "acquisto di iscrizioni, incentivi in denaro agli invitati o qualsiasi forma di traffico artificiale;",
                  "spam, pubblicità ingannevole o uso non autorizzato di marchi altrui nella promozione del proprio link.",
                ]}
              />
              <p>
                7.2. L'Organizzatore si riserva il diritto di richiedere verifiche aggiuntive
                sull'identità del partecipante e sulla genuinità degli inviti prima dell'erogazione
                del premio.
              </p>
            </Section>

            <Section title="Art. 8 — Limitazioni di responsabilità e modifiche">
              <p>
                8.1. L'Organizzatore si riserva il diritto di modificare, sospendere o annullare il
                Contest per cause di forza maggiore, frodi diffuse o motivi tecnici, dandone
                comunicazione sulla piattaforma.
              </p>
              <p>
                8.2. L'Organizzatore non è responsabile per malfunzionamenti di rete, ritardi o
                errori di tracciamento non imputabili a propria colpa grave. In caso di controversie
                sul tracciamento, fanno fede i registri del database dell'Organizzatore.
              </p>
              <p>
                8.3. Eventuali imposte o oneri fiscali sui premi sono a carico del vincitore, ove
                previsto dalla normativa vigente.
              </p>
            </Section>

            <Section title="Art. 9 — Privacy">
              <p>
                I dati personali dei partecipanti sono trattati ai sensi del Regolamento (UE)
                2016/679 (GDPR) esclusivamente per la gestione del Contest, secondo quanto descritto
                nell'Informativa Privacy disponibile sulla piattaforma. I nickname visualizzati nella
                classifica pubblica non includono mai l'indirizzo email o altri dati identificativi
                diretti.
              </p>
            </Section>

            <Section title="Art. 9-bis — Premio YouTube Premium (regola dei 12 mesi)">
              <p>
                9-bis.1. Con lo stesso link/codice referral, al raggiungimento di 3 invitati
                qualificati (registrati dal link, effettivamente entrati in un gruppo Premium e con
                almeno un pagamento riuscito) viene assegnato uno slot YouTube Premium, fino a
                esaurimento dei 50 slot mensili disponibili. Il contatore riparte automaticamente da
                50 il 1° giorno di ogni mese.
              </p>
              <p>
                9-bis.2. Se l'utente appartiene già a un gruppo YouTube Premium da meno di 12 mesi,
                deve indicare un indirizzo email Google diverso. L'invito sarà inviato al nuovo
                indirizzo, perché l'email già utilizzata non può essere cambiata prima del
                completamento dei 12 mesi.
              </p>
            </Section>

            <Section title="Art. 10 — Accettazione">
              <p>
                La partecipazione al Contest implica l'accettazione integrale e incondizionata del
                presente regolamento.
              </p>
            </Section>

            <div className="mt-10 rounded-xl bg-primary/10 p-6">
              <div className="flex items-start gap-3">
                <Shield className="mt-1 h-6 w-6 flex-shrink-0 text-primary" />
                <div>
                  <h3 className="mb-2 font-bold text-foreground">Contatti</h3>
                  <p className="text-sm">
                    Per domande sul Contest scrivi a{" "}
                    <a href={`mailto:${legalConfig.contactEmail}`} className="font-medium text-primary">
                      {legalConfig.contactEmail}
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => navigate("/Contest")}
              className="h-12 w-full rounded-2xl gradient-divideit font-bold text-white"
            >
              <Trophy className="mr-2 h-4 w-4" /> Vai alla classifica del Contest
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
