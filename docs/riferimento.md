# Riferimento tecnico (generato automaticamente)

> ⚙️ **Non modificare questo file a mano.** Lo rigenera il workflow *Documentazione* a ogni push, leggendo i file veri del progetto.
> Se qualcosa qui è sbagliato, è sbagliato il file da cui viene: correggi quello.

Ultimo aggiornamento: 2026-11-23 22:22 UTC

## Workflow di GitHub Actions

| Workflow | File | Quando parte | Segreti usati | Scrive nel repository |
| --- | --- | --- | --- | --- |
| **Pubblica sito** | `deploy.yml` | a ogni push su `main` (tranne i file esclusi)<br>ogni giorno alle 3:17 (`17 2 * * *` UTC)<br>a mano: Actions → Run workflow | — | no |
| **Documentazione** | `documentazione.yml` | a ogni push su `main`<br>ogni giorno alle 4:41 (`41 3 * * *` UTC)<br>a mano: Actions → Run workflow | — | sì |
| **Post settimanale** | `post-settimanale.yml` | a mano: Actions → Run workflow | `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | sì |
| **Bot Telegram** | `telegram.yml` | ogni giorno ai minuti 7, 22, 37, 52, dalle 7 alle 22:59 (`7,22,37,52 6-21 * * *` UTC)<br>a mano (Actions → Run workflow) o dalla sveglia esterna | `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | sì |

Gli orari "ora italiana" sono quelli invernali; con l'ora legale tutto parte un'ora più tardi. GitHub può ritardare o saltare i giri programmati: vedi [Sveglia del bot](04-automazione.md#la-sveglia-del-bot).

## Segreti e variabili che il codice si aspetta

Si impostano in GitHub → Settings → Secrets and variables → Actions. Dettagli in [Sicurezza](05-sicurezza.md).

| Nome | Tipo |
| --- | --- |
| `ANTHROPIC_API_KEY` | Secret (riservato) |
| `GEMINI_API_KEY` | Secret (riservato) |
| `TELEGRAM_BOT_TOKEN` | Secret (riservato) |
| `TELEGRAM_CHAT_ID` | Secret (riservato) |
| `ANTHROPIC_MODEL` | Variable (facoltativa, sovrascrive `config.json`) |
| `GEMINI_IMAGE_MODEL` | Variable (facoltativa, sovrascrive `config.json`) |

## Impostazioni dell'automazione (`automazione/config.json`)

| Voce | Valore attuale |
| --- | --- |
| `modelloTesti` | `"claude-sonnet-5-5"` |
| `modelloImmagini` | `"gemini-3.1-flash-image"` |
| `fotoRiferimento` | `["automazione/riferimento/kentucky-2.jpg","automazione/riferimento/kentucky-1.jpg","public/assets/gallery/2.jpg","public/assets/gallery/1.jpg"]` |
| `ogniQuanteSettimaneImprobabile` | `4` |
| `temiDaEvitareUltimi` | `12` |
| `oreProMemoria` | `48` |
| `postSettimanale` | `{"giorno":1,"ora":9}` |
| `sondaggio` | `{"attivo":true,"ore":4,"ricerche":3}` |
| `radar` | `{"attivo":true,"giorni":[2,5],"ora":11,"spunti":3,"ricerche":5,"settimaneDa":2,"settimaneA":8}` |
| `tentativiVerifica` | `2` |
| `ricercheScrittura` | `3` |
| `ricercheVerifica` | `4` |
| `budgetMensileDollari` | `15` |
| `oreMaxDaBari` | `4` |
| `sito` | `"https://www.mistralia.co"` |
| `prezzoDa` | `77` |
| `prezzi` | `{"claude-sonnet-5-5":[2,10],"claude-opus-5-5":[4,20],"claude-fable-5-2":[8,40],"ricercaWeb":0.01,"immagine":0.07}` |

## Prezzi in vigore (`src/data/prezzi.json` e `coperture.json`)

- Prezzo al giorno: bassa €78 · media €105 · alta €150
- Noleggio minimo: bassa 2 giorni · media 3 · alta 3 · eccezioni: 2026-11-01→2026-12-31: 3 giorni; 2027-09-12→2027-10-01: 2 giorni
- Quota obbligatoria: €200 (Pulizia finale, preparazione e check-in)
- Extra: Lenzuola €40 a letto · Asciugamani €15 a persona · Barbecue €25 · Transfer aeroporto €100 a tratta
- Piani: basic +€0/giorno, cauzione €2000 · plus +€15/giorno, cauzione €1500 · premium +€25/giorno, cauzione €1000

| Dal | Al | Stagione |
| --- | --- | --- |
| 2026-11-01 | 2026-11-02 | media |
| 2026-11-03 | 2027-03-24 | bassa |
| 2027-03-25 | 2027-03-30 | alta |
| 2027-03-31 | 2027-05-28 | media |
| 2027-05-29 | 2027-09-05 | alta |
| 2027-09-06 | 2027-10-04 | media |
| 2027-10-05 | 2027-10-28 | bassa |
| 2027-10-29 | 2027-11-01 | media |
| 2027-11-02 | 2027-12-31 | bassa |

## Promo (`src/data/promo.md`)

- Attiva: **true** · Black Friday −15% · banner dal 2026-11-22 al 2026-12-01 · noleggi dal 2027-03-01 al 2027-05-31

## Articoli pubblicati nel Diario

| Articolo | Tipo | Pubblicato | Fine evento/offerta | Stato |
| --- | --- | --- | --- | --- |
| `lecce-black-friday-camper-primavera-pupi` | idea | 2026-11-22 | — | in vetrina |
| `matera-natale-sassi-presepe-vivente-camper` | evento | 2026-11-21 | 2026-12-21 | in vetrina |
| `napoli-san-gregorio-armeno-presepi-camper` | evento | 2026-11-23 | 2027-01-10 | in vetrina |
| `ndocciata-agnone-camper-dicembre-2026` | idea | 2026-11-21 | — | in vetrina |

## Struttura del repository

```
├── .github/
│   └── workflows/
│       ├── deploy.yml
│       ├── documentazione.yml
│       ├── post-settimanale.yml
│       └── telegram.yml
├── automazione/
│   ├── bozze/ …
│   ├── riferimento/
│   │   ├── kentucky-1.jpg
│   │   └── kentucky-2.jpg
│   ├── config.json
│   ├── documentazione.mjs
│   ├── foto-galleria.mjs
│   ├── genera.mjs
│   ├── lib.mjs
│   ├── prompt.md
│   ├── radar.md
│   ├── radar.mjs
│   ├── README.md
│   ├── sondaggio.md
│   ├── sondaggio.mjs
│   ├── stato.json
│   ├── telegram.mjs
│   ├── traduzioni.mjs
│   └── verifica.md
├── docs/
│   ├── 01-architettura.md
│   ├── 02-uso-quotidiano.md
│   ├── 03-sito.md
│   ├── 04-automazione.md
│   ├── 05-sicurezza.md
│   ├── 06-sviluppo.md
│   ├── 07-problemi.md
│   ├── README.md
│   ├── registro-modifiche.md
│   └── riferimento.md
├── public/
│   ├── admin/
│   │   ├── config.yml
│   │   └── index.html
│   ├── assets/
│   │   ├── brand/
│   │   │   ├── favicon.png
│   │   │   ├── logo-badge.png
│   │   │   ├── logo.png
│   │   │   └── wordmark.png
│   │   ├── diario/ …
│   │   └── gallery/ …
│   └── CNAME
├── src/
│   ├── components/
│   │   ├── DiarioIndice.astro
│   │   ├── Home.astro
│   │   ├── Post.astro
│   │   └── PostCard.astro
│   ├── content/
│   │   └── diario/ …
│   ├── data/
│   │   ├── bordo.json
│   │   ├── coperture.json
│   │   ├── faq.json
│   │   ├── foto.json
│   │   ├── info.json
│   │   ├── prezzi.json
│   │   └── promo.md
│   ├── i18n/
│   │   ├── en.json
│   │   └── it.json
│   ├── layouts/
│   │   └── Base.astro
│   ├── lib/
│   │   └── site.ts
│   ├── pages/
│   │   ├── diario/
│   │   │   ├── [chiave].astro
│   │   │   └── index.astro
│   │   ├── en/
│   │   │   ├── journal/
│   │   │   │   ├── [chiave].astro
│   │   │   │   └── index.astro
│   │   │   └── index.astro
│   │   ├── 404.astro
│   │   └── index.astro
│   ├── styles/
│   │   └── global.css
│   └── content.config.ts
├── .gitignore
├── astro.config.mjs
├── CLAUDE.md
├── package.json
└── README.md
```
