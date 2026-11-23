# Istruzioni per Claude (e qualunque assistente AI) su questo progetto

Progetto: sito www.mistralia.co (Astro su GitHub Pages) + post settimanale automatico (Claude, Gemini) + bot Telegram di approvazione. Documentazione completa in `docs/` (inizia da `docs/README.md`).

## Regole obbligatorie
1. **Documentazione a ogni modifica.** Ogni cambiamento a codice o configurazione (`.github/workflows/`, `automazione/*.mjs|*.md|config.json`, `src/components|layouts|lib|pages|styles/`, `src/content.config.ts`, `astro.config.mjs`, `package.json`, `.gitignore`, `public/admin/`) deve aggiornare nello stesso commit:
   - le pagine di `docs/` che descrivono quella parte;
   - `docs/registro-modifiche.md`, con una voce in cima (data · cosa · perché · cosa deve fare chi usa il sistema).
   Il workflow *Documentazione* fallisce se il registro manca. `docs/riferimento.md` è generato: non scriverlo a mano.
2. **Mai chiavi nei file o in chat.** Le chiavi stanno solo nei GitHub Secrets. Il repository è pubblico.
3. **Mai toccare `automazione/stato.json` a mano** e mai proporre comandi che sostituiscono o cancellano in blocco la cartella `automazione/` (es. `rsync --delete`): contiene lo stato e le bozze del bot.
4. **Aggiornamenti come file singoli.** Consegna solo i file cambiati, nella struttura del repository, con i comandi `git pull` → copia → `git status` → commit → push e l'elenco esatto dei file attesi in `git status`.
5. **Prova prima di consegnare:** `npm run build` per il sito; `PROVA=1 TELEGRAM_CHAT_ID=1 node automazione/genera.mjs` e i finti aggiornamenti per il bot (vedi `docs/06-sviluppo.md`).
6. **Costi:** ogni modifica che aumenta chiamate, ricerche o tentativi va stimata e scritta nel registro. Tetto interno: `budgetMensileDollari` in `automazione/config.json`.
7. **Non modificare il sito** (struttura, testi, dati) se non è richiesto esplicitamente.
8. Tono dei contenuti: niente età del camper, niente prezzi diversi da "da €X al giorno", eventi solo se verificati. Il camper è "completo di tutto per partire"; lenzuola e asciugamani **non** sono inclusi: mai "tutto incluso" né "tutto incluso tranne le lenzuola". Mai suggerire dove dormire o sostare. Regole complete in `automazione/prompt.md` (radar e sondaggio: `radar.md`, `sondaggio.md`).
9. I dati in `src/data/` li modifica Gianluca dal pannello `/admin` (Sveltia CMS, `public/admin/config.yml`): **un file per voce del pannello** (prezzi, coperture, promo, bordo, faq, foto, info), riuniti in `src/lib/site.ts`. Se cambi la struttura di un file, aggiorna anche `config.yml` e verifica che il pannello lo carichi senza avvisi. Non consegnare mai i file di `src/data/` sovrascrivendo i dati veri: per cambiarne la struttura serve uno script una tantum che li modifica al loro posto. Anche il bot scrive `src/data/promo.md`, solo dopo la conferma nel gruppo (radar → Post + offerta).
10. Gli articoli del Diario si modificano solo in italiano: i file `*.en.md` li genera `automazione/traduzioni.mjs`. Non scriverli a mano.
11. Nei documenti condivisi del team si nominano solo Gianluca e Andrea; gli altri membri sono "Persona A/B".
