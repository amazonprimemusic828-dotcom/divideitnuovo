# Vault E2EE: credenziali cifrate lato client

Obiettivo: le credenziali del gruppo non devono mai essere leggibili dal server. Il backend diventa solo un "postino" che salva stringhe cifrate.

## Modello crittografico

- Coppia di chiavi per utente: **ECDH P-256** (Web Crypto nativo, equivalente moderno a Curve25519, senza librerie esterne).
- Chiave del vault per gruppo: **AES-256-GCM** casuale (VaultKey).
- Le credenziali del gruppo sono cifrate con la VaultKey.
- La VaultKey viene "wrappata" (ECDH + AES-KW) una volta per ogni membro, con la sua chiave pubblica.
- Chiave privata: cifrata nel browser con una chiave derivata via **PBKDF2 (310k iterazioni, SHA-256)** e salvata cifrata sul server. Il server non può decifrarla.

## Sblocco della chiave privata (punto da decidere)

L'app usa Google OAuth e OTP via email, quindi molti utenti **non hanno una password**. Soluzione proposta:

- Alla prima attivazione del vault, l'app genera un **codice di recupero** (24 caratteri) mostrato una sola volta. La chiave privata viene cifrata con quel codice.
- Dopo lo sblocco, la chiave privata resta in **IndexedDB come CryptoKey non estraibile**, quindi non serve reinserire nulla ad ogni accesso (nessun PIN nell'uso quotidiano).
- Chi ha una password DivideIt può in più cifrare la chiave privata anche con la password (doppio wrap), così l'accesso da un nuovo dispositivo funziona con la sola password.
- Nuovo dispositivo o cache pulita = si sblocca con password o codice di recupero. Se entrambi sono persi, le credenziali sono irrecuperabili (è il prezzo dello zero-knowledge) e l'admin le reinserisce.

## Modifiche al database (richiedono la tua approvazione)

1. `user_public_keys` — `user_id`, `public_key_jwk` (pubblica, leggibile da tutti gli autenticati), `wrapped_private_key`, `kdf_salt`, `kdf_iterations`, `created_at`. Solo il proprietario legge/scrive la parte privata.
2. `group_vault_keys` — `group_id`, `recipient_user_id`, `wrapped_vault_key`, `ephemeral_public_jwk`, `granted_by`. Ogni utente legge solo le proprie righe; l'admin del gruppo può inserire righe per i membri.
3. `groups`: nuove colonne `vault_ciphertext`, `vault_iv`, `vault_version` per il payload cifrato client-side. Le colonne `credentials_*` esistenti restano intatte per retrocompatibilità.

Tutte le tabelle con GRANT espliciti + RLS.

## Frontend

- `src/lib/vaultCrypto.ts`: generazione chiavi, PBKDF2, wrap/unwrap, cifratura/decifratura AES-GCM, storage IndexedDB.
- `src/hooks/useVault.ts`: stato chiavi utente, bootstrap alla prima apertura, sblocco.
- `ServiceCredentialsPanel.tsx` riscritto: l'admin cifra localmente prima di salvare; i membri decifrano localmente e vedono i valori mascherati con pulsante Copia.
- Dialog di setup vault (mostra il codice di recupero) e dialog di sblocco.
- Quando entra un nuovo membro, l'admin che apre il gruppo distribuisce automaticamente la VaultKey ai membri paganti che ne sono privi (banner "N membri in attesa di accesso" con azione automatica).

## Backend

- Nuova action `vault-*` non serve: si usa direttamente Supabase con RLS, il server non elabora nulla.
- Le action `credentials-set` / `credentials-get` restano solo per i gruppi legacy non ancora migrati.

## Note tecniche

- Web Crypto API nativa, nessuna dipendenza aggiunta.
- La distribuzione della VaultKey richiede che l'admin sia online almeno una volta dopo l'ingresso del membro: è intrinseco allo zero-knowledge.
- I membri non vedono mai i valori in chiaro a schermo: restano mascherati, si copiano negli appunti.
