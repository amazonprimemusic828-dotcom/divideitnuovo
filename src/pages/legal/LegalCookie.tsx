import { LegalLayout } from "@/components/legal/LegalLayout";

export default function LegalCookie() {
  return (
    <LegalLayout title="Cookie Policy" updated="Agosto 2026" current="/legal/cookie">
      <section><h2>1. Cosa sono i cookie</h2><p>I cookie sono piccoli file memorizzati sul dispositivo dell&apos;utente. Tecnologie simili possono essere utilizzate per mantenere la sessione, ricordare preferenze e comprendere l&apos;uso del servizio.</p></section>
          <section><h2>2. Cookie necessari</h2><p>Utilizziamo cookie tecnici strettamente necessari per autenticazione, sicurezza, gestione della sessione, prevenzione degli abusi e funzionamento della Piattaforma. Non richiedono consenso quando sono indispensabili al servizio.</p></section>
          <section><h2>3. Analisi e preferenze</h2><p>Eventuali cookie analitici o di personalizzazione non necessari vengono attivati solo dopo il consenso, quando richiesto dalla legge. Puoi modificare o revocare le preferenze in qualsiasi momento dal pannello cookie.</p></section>
          <section><h2>4. Gestione</h2><p>Puoi controllare i cookie dalle impostazioni del browser. La disattivazione dei cookie necessari può impedire l&apos;accesso o compromettere alcune funzioni.</p></section>
          <section><h2>5. Terze parti</h2><p>Alcuni fornitori, inclusi servizi di pagamento, sicurezza, hosting e analytics, possono impostare tecnologie proprie. Per dettagli e periodi di conservazione consulta la relativa informativa privacy.</p></section>
          <section><h2>6. Contatti</h2><p>Per domande scrivi a support@divideit.com.</p></section>
    </LegalLayout>
  );
}
