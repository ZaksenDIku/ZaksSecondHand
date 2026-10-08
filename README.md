# ZaksSecondHand

Et lokalt værktøj til at finde gode køb på brugte iPhones og MacBooks.

Hver annonce vurderes ud fra **observerede markedsdata** — priser fra annoncer, du selv har importeret eller indhentet. Der er ingen indbyggede "rigtige" priser, og intet sendes til en tredjepart, medmindre du selv konfigurerer det.

---

## Kom hurtigt i gang

```bash
npm install
npm run db:generate   # kun nødvendigt, hvis du har ændret skemaet
npm run dev
```

Åbn **http://localhost:3000**. Første gang bliver du sendt til `/setup`, hvor du vælger købsprofil og om du vil have DEMO-data ind.

Produktionskørsel:

```bash
npm run build
npm start
```

---

## Hvad appen gør

| Side | Indhold |
| --- | --- |
| 🔥 **Deal Center** (`/`) | Kort over markedet: de stærkeste fund lige nu, opsummering og dine aktive regler |
| **Live Deals** (`/live`) | Alle vurderede annoncer, sorterbare på score, pris, alder og fart |
| **iPhones / MacBooks** | Pr. model med median, spredning og købsgrænse |
| **Watchlist** (`/watchlist`) | Regler, gemte fund og 🔥 TARGET HIT / ⏳ WAIT |
| **Market Intel** (`/heatmap`) | Varme køb, bedste margin, hurtigste salg, stigende/faldende marked |
| **Flips** (`/flips`) | Din købs- og videresalgsdagbog med estimeret afkast |
| **Alerts** (`/alerts`) | Urgent, prisfald, hidden gems, risikofund og mål-træffere |
| **Sources** (`/sources`) | Hvilke kilder der faktisk er aktive — og hvorfor |
| **Analytics** (`/analytics`) | Hvor dine penge faktisk bliver tjent |
| **Import** (`/import`) | URL, tekst, CSV, JSON og e-mail-alerts |
| **Settings** (`/settings`) | Vægtning, købsprofil, omkostninger, notifikationer, DEMO |

### Vurderingen

- **DealScore (0–100)** — hvor godt en annonce er *for dig*, baseret på pris mod observeret markedsværdi, friskhed, tillid og din købsprofil.
- **Opportunity-tier** — `NORMAL` · `GOOD` · `GREAT` · `HOT` · `URGENT`.
- **Risikoscore (0–100)** — *uafhængig* af DealScore. En billig annonce med høj risiko er ikke et godt køb, og siger appen.
- **Deal Velocity** — hvor hurtigt lignende varer har solgt, med et konfidensniveau.
- **Hidden Gems** — rodet annonceformulering, der alligevel peger på en stærk vare.
- **🟣 AI PARSED** — modellen er udledt automatisk. Bekræft specifikationerne, før du køber.

### Oprindelse er altid synlig

`REAL` · `IMPORTED` · `DEMO` · `STALE` står på hver annonce. `DEMO` bruges aldrig til at opfinde et "bedste køb" og bliver aldrig blandet ind i en markedsvurdering.

---

## Datakilder

| Kilde | Status | Sådan virker det |
| --- | --- | --- |
| **DBA / Gul & Gratis** | Manuel | Du indsender én URL ad gangen og indsender de felter, du selv kan læse |
| **Facebook Marketplace** | Manuel | Facebook tilbyder intet API til private salg |
| **Vinted** | Kun med Pro-nøgler | Kræver en officiel, allow-listet Vinted Pro-konto |
| **E-mail-alert** | Manuel | Videresend en søgning-mail; HTML og kviktræk filtreres fra |
| **CSV / JSON / tekst** | Manuel | Alt med samme pipeline som alt andet |
| **DEMO** | Til at lære appen | Lokale fixtures, tydeligt mærket |

Uden kredentials henter appen **intet automatisk**. Det er en bevidst begrænsning, ikke en fejl.

---

## Import

Alle veje gennem den samme pipeline, så vurderingen altid er ens:

- **URL** — én annonce ad gangen, kun metadata du selv kan hente.
- **Tekst** — sæt en annonce ind, du finder den.
- **CSV** — forventede kolonner: `title`, `price`. Resten er valgfri (`url`, `description`, `marketplace`, `storage`, `ram`, `chip`, `condition`, `battery`, `location`, `posted`, `image`, `seller`, `id`).
- **JSON** — en liste, eller `{ "listings": [...] }`.
- **E-mail** — rå mail eller HTML.

**Markedsplads-attribution:** for imports uden link kan du vælge markedsplads i formularen, eller have en `marketplace`-kolonne i CSV'en. Rækkefølgen er: det, importen selv angiver → hvad linket beviser → hvilken kanal importen kom ind ad. Der opfindes aldrig en markedsplads, dataene ikke understøtter.

---

## Miljøvariabler

Alle er **valgfri**. Uden dem virker appen med manuel import og DEMO-data.

```bash
DATABASE_URL=zaks.sqlite        # absolut sti, eller "file:/tmp/test.sqlite"
VINTED_ACCESS_KEY=              # kun med en officiel Pro-konto
VINTED_SIGNING_KEY=
RESEND_API_KEY=                 # uden denne gemmes notifikationer lokalt
ALERT_FROM_EMAIL=
```

Se `.env.example`. `.env*` og `data/` er git-ignoreret; `.env.example` er ikke.

---

## Privatliv og begrænsninger

- Alt ligger lokalt i SQLite (`data/zaks.sqlite`).
- Ingen analytics, ingen telemetry, ingen konto.
- Notifikationer sendes kun, hvis du selv sætter Resend-nøgler.
- Vinted-endpointet og signaturen skal verificeres mod
  [pro-docs.svc.vinted.com](https://pro-docs.svc.vinted.com/) for en allow-listet konto, før automatisk sync kan regnes som fungerende.
- Vurderinger er **vejledende**, ikke en garanti. Tjek altid selv enheden, kvittering og Find My-status før køb.

Appen omgår aldrig CAPTCHA, godkendelse, rate limits eller anden anti-bot beskyttelse.

---

## Udvikling

```bash
npm run dev         # udviklingsserver
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run test        # vitest
npm run test:watch
npm run build
npm run verify      # lint + typecheck + test + build
```

### Teste

```bash
npm run test
```

Suiterne dækker produktparsing, markedsestimat, DealScore, risiko, duplikater, flipeconomics, velocity, insights, forhandlingsbud og **en fuldende-til-slut-pipeline** (`tests/pipeline.test.ts`) mod en midlertidig SQLite-fil. Din rigtige database røres aldrig.

### Skemaændringer

```bash
npm run db:generate
```

---

## Fejlfinding

| Symptom | Løsning |
| --- | --- |
| Redirect til `/setup` | Setup er ikke fuldført. Kør den igennem, eller sæt `setupComplete` i Settings |
| "Ingen data endnu" | Import noget, eller slå DEMO til i Settings |
| Estimat mangler | Der er endnu ikke nok sammenlignelige observationer. Import flere af samme model |
| Port 3000 er optaget | `npm run dev -- -p 3001` |
| Database-låst | Luk alle kørende instanser; SQLite er single-writer |
| Vinted uden data | Mangler Pro-nøgler, eller er kontoen ikke allow-listet |
