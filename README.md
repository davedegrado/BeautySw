# Aurea · Gestionale premium per centri estetici

Applicazione web completa (PWA installabile su smartphone, tablet e computer) per gestire
clienti, dipendenti, trattamenti, appuntamenti, promozioni, eventi e programma fedeltà
**Luxury Rewards**. Identità visiva nero profondo, avorio e oro champagne con mandala geometrici.

Tre aree con permessi distinti, verificati sul server a ogni richiesta:

| Ruolo | Area | Sezioni |
|---|---|---|
| Cliente | `/app` | Home, Prenota, I miei appuntamenti, Promozioni, Eventi, I miei punti, Profilo, Notifiche |
| Amministratore | `/admin` | Dashboard, Calendario, Clienti, Dipendenti, Trattamenti, Promozioni, Eventi, Programma fedeltà, Notifiche, Impostazioni |
| Dipendente | `/staff` | Home, Il mio calendario (con **Nuovo appuntamento**), I miei appuntamenti, I miei trattamenti, **+ Nuovo trattamento**, Promozioni sui propri trattamenti, Eventi, Il mio profilo |

## Avvio rapido

Requisiti: Node.js 20+ e un database PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # imposta DATABASE_URL
docker compose up -d          # (facoltativo) Postgres locale già configurato
npm run db:setup              # crea le tabelle + centro dimostrativo
npm run dev                   # http://localhost:3000
```

Account dimostrativi (password `Aurea2026!`):

- Amministratore: `admin@aurea.demo`
- Dipendenti: `giulia@aurea.demo`, `sofia@aurea.demo`, `martina@aurea.demo`
- Clienti: `elena@aurea.demo`, `chiara@aurea.demo`, `francesca@aurea.demo`, …

**Per partire con il tuo centro (senza dati demo):** esegui solo `npm run db:migrate`,
apri l'app e verrai portato su `/setup`, dove crei il centro e l'account amministratore.

## Demo online (GitHub Pages)

Una versione dimostrativa completa, **senza server né database da configurare**, viene pubblicata
automaticamente su GitHub Pages: `https://<utente>.github.io/<repository>/`.

- Gira interamente nel browser: lo stesso codice dell'app usa PostgreSQL compilato in WebAssembly
  ([PGlite](https://pglite.dev)), salvato nel browser (IndexedDB). Al primo avvio crea il centro demo.
- Il pulsante **Demo** in basso a destra permette di entrare come amministratore, dipendente o
  cliente con un clic e di **ripristinare i dati**. Funziona anche il login con gli account demo.
- I dati sono **per dispositivo**: una prenotazione fatta dal telefono non compare sul computer.
  Ogni 3 giorni i dati demo vengono ricreati, così gli appuntamenti restano attuali.
- Non attivi nella demo: notifiche push (restano quelle in-app) e job pianificati.

Prima pubblicazione: *Settings → Pages → Build and deployment → Source: **GitHub Actions***.
Il workflow `.github/workflows/demo-pages.yml` compila la demo a ogni push e la pubblica dal branch
principale (o manualmente da *Actions → Demo su GitHub Pages → Run workflow*).

```bash
npm run demo:dev       # demo in locale con ricaricamento automatico
npm run demo:build     # build statica in demo/dist
npm run demo:preview   # anteprima della build
```

Il codice della demo è in `demo/`: adattatori per le parti di Next.js (`next/link`,
`next/navigation`, cookie, cache), router che esegue nel browser le pagine di `src/app` e
database PGlite. L'app vera non viene modificata.

## Cosa configurare

| Variabile | Obbligatoria | A cosa serve |
|---|---|---|
| `DATABASE_URL` | sì | Connessione PostgreSQL. Con Supabase: *Project Settings → Database → Connection string (URI)* e `DATABASE_SSL=true` |
| `AUTH_SECRET` | consigliata | Firma delle sessioni (≥ 32 caratteri). Se manca viene generata e salvata nel database |
| `APP_URL` | consigliata | URL pubblico dell'app (mostrato nel link di registrazione) |
| `CRON_SECRET` | solo serverless | Protegge `GET /api/cron` (promemoria e compleanni) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | no | Chiavi push. Se mancano vengono generate e salvate nel database |
| `SETUP_KEY` | no | Abilita `/setup` per creare ulteriori centri |

Servizi esterni da predisporre:

1. **Database** – qualsiasi PostgreSQL gestito (Supabase, Neon, Railway…). Serve l'estensione
   `btree_gist` (inclusa in tutti i provider citati; la migrazione la attiva da sola).
2. **Hosting** – `npm run build && npm start` su un server Node/VPS, oppure Vercel e simili.
   Le notifiche push richiedono **HTTPS**.
3. **Job pianificati** – su un server Node sempre acceso non serve nulla: un timer interno invia
   promemoria e auguri ogni 10 minuti. Su piattaforme serverless pianifica una chiamata a
   `/api/cron?secret=CRON_SECRET` (ogni 10–15 minuti).
4. **Email** – non è integrato un servizio email: il recupero password avviene tramite
   l'amministratore (scheda cliente/dipendente → *Reimposta password*).

## Funzionalità principali

- **Prenotazione** in 4 passaggi (trattamento → professionista o "nessuna preferenza" → data e
  ora → conferma). Gli orari tengono conto di durata, turni, pause, ferie/indisponibilità,
  disponibilità straordinarie, appuntamenti esistenti e tempo di preparazione.
- **Niente doppie prenotazioni**: controllo in transazione con lock per operatore + vincolo di
  esclusione nel database (`appointments_no_overlap`).
- **Disdetta** con termine configurabile (centro e, se serve, singolo trattamento); il cliente
  vede sempre entro quando può disdire. L'amministratore può sempre annullare/spostare.
- **Luxury Rewards**: punti per euro di listino e/o per trattamento, accreditati quando lo staff
  segna il trattamento come completato; premi, barra di avanzamento, riscatto con codice `LUX-XXXX-XXXX`, storico,
  rettifiche manuali, classifica clienti.
- **Promozioni ed eventi** con immagini, categorie, validità, posti disponibili e iscrizioni.
- **Notifiche** in-app + push (Web Push): conferma, promemoria, modifica/annullamento, nuove
  promozioni ed eventi, premio sbloccato, compleanno con regalo, comunicazioni a tutti o a gruppi.
- **Dashboard** con indicatori, grafici e filtri per periodo.
- **Trattamenti proposti dallo staff**: restano "in attesa" finché l'amministratore non li
  approva e sceglie quali dipendenti li eseguono.

### Notifiche push su iPhone/iPad
Apple consente le push web solo alle app aggiunte alla schermata Home: *Condividi → Aggiungi a
Home*, poi aprire l'app da lì e attivare le notifiche dal profilo. Su Android e desktop basta il browser.

## Architettura

- **Next.js (App Router) + React + TypeScript + Tailwind CSS**; mutazioni tramite Server Action.
- **PostgreSQL + Drizzle ORM** (`src/db/schema.ts`, migrazioni in `drizzle/`).
- **Multi-centro**: ogni tabella porta `center_id` e ogni query è filtrata sul centro della
  sessione; i dati di un centro non sono mai visibili agli altri.
- **Sicurezza**: password con bcrypt, sessione in cookie `httpOnly` firmato (JWT) e riverificata
  sul database a ogni richiesta, limite ai tentativi di accesso, controlli di ruolo in ogni
  pagina e in ogni action, header di sicurezza.
- **Immagini** salvate nel database (tabella `images`): nessuno storage esterno da configurare
  e incluse nei backup.

```
src/lib/availability.ts   calcolo orari liberi
src/lib/booking.ts        prenotazione, disdetta, spostamento, completamento
src/lib/loyalty.ts        punti e premi
src/lib/jobs.ts           promemoria e compleanni
src/lib/notify.ts         notifiche in-app + push
src/actions/*             server action per ruolo
src/app/{app,admin,staff} le tre aree
```

## Backup e manutenzione

- **Dall'app**: *Impostazioni → Scarica backup* (JSON completo del centro, immagini incluse).
- **Da riga di comando**: `npm run db:backup` (tutti i centri, in `backups/`). Per un ripristino
  completo usa anche i backup automatici del provider del database o `pg_dump`.
- Gli errori vengono gestiti con messaggi chiari all'utente e registrati nei log del server.

## Verifica

```bash
npm run test:flows   # 51 controlli su prenotazione, doppie prenotazioni, disdetta, punti, premi, eventi, isolamento tra centri
npm run typecheck
```

Limiti noti: il limite ai tentativi di login è in memoria (per istanza); l'app non gestisce
pagamenti né fatturato (i prezzi sono solo informativi) e non invia email; lo spostamento degli appuntamenti avviene dalla finestra di
modifica (non con trascinamento).
