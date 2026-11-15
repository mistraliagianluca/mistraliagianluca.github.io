# Sito Mistralia (MVP)

Sito di una pagina, bilingue (`/` italiano, `/en/` inglese), fatto con [Astro](https://astro.build) e pubblicato gratis su GitHub Pages.

## Messa online (una volta sola)

1. **Copia questi file nel repository del sito attuale** (meglio in un ramo nuovo, per esempio `sito-nuovo`).
2. **Foto e logo sono già inclusi**: le 20 foto sono in `public/assets/gallery/` (`1.jpg … 20.jpg`) e il logo in `public/assets/brand/`. La vecchia cartella `assets/` del sito attuale non serve più.
3. **Togli il vecchio `index.html`** dalla radice, perché ora la pagina la genera Astro.
4. Su GitHub apri **Settings → Pages → Source** e scegli **GitHub Actions**.
5. Unisci il ramo in `main`: il workflow `.github/workflows/deploy.yml` compila e pubblica il sito in circa 2 minuti.
6. Il dominio è nel file `public/CNAME` (`www.mistralia.co`). Se oggi su GitHub usi un altro nome, correggilo qui.

Per provarlo sul tuo computer: `npm install`, poi `npm run dev`, poi apri http://localhost:4321.

## Cosa si modifica e dove

| Cosa | File | Note |
| --- | --- | --- |
| Promo (es. Black Friday) | `src/data/promo.md` | Il banner compare e sparisce da solo nelle date indicate; lo sconto vale solo per i noleggi nel periodo scelto. Per spegnerla: `attiva: false` |
| Prezzi, piani, cauzioni, km, quota obbligatoria di pulizia e preparazione (€200), extra, stagioni | `src/data/prezzi.json` | Le stagioni sono una lettera per giorno (B/M/A). Sono caricati novembre–dicembre 2026 e tutto il 2027, copiati dal calendario Yescapa. Se manca un anno, il sito usa l'ultimo presente |
| Contatti, indirizzo di ritiro (Modugno), orari, kit incluso, regole, FAQ, foto, calendario | `src/data/info.json` | `galleria` = numeri delle foto in ordine; `fotoApertura` = foto grande in alto: un numero della galleria oppure il nome di un file copiato in `public/assets/gallery/` (ora `SER.JPG`; finché il file non c'è, il sito usa la foto n. 2) |
| Testi del sito | `src/i18n/it.json` e `src/i18n/en.json` | Stesse chiavi nei due file |
| Articoli del Diario | `src/content/diario/*.it.md` e `*.en.md` | Li scriverà l'automazione settimanale. Gli articoli `esempio-*` vanno cancellati quando arrivano quelli veri |

Tutti i file si possono modificare anche dal sito o dall'app di GitHub (icona della matita): al salvataggio il sito si ricompila da solo.

## Calendario delle date occupate

1. Su Google Calendar crea il calendario **"Mistralia – occupato"** e segna come eventi i giorni già venduti, anche quelli presi da Yescapa o Indie.
2. In *Impostazioni del calendario → Autorizzazioni di accesso* attiva **Rendi disponibile pubblicamente** e scegli *Mostra solo disponibilità (nascondi dettagli)*.
3. In *Integra calendario* copia l'**URL dell'incorporamento** e incollalo in `calendarioEmbedUrl` dentro `src/data/info.json`.

## Da completare (cerca `DA_CONFERMARE` nei file)

- supplemento al giorno dei piani Plus e Premium e la loro cauzione, km inclusi al giorno, importo della quota obbligatoria (€200 su Yescapa, €150 nel testo dell'annuncio) (`prezzi.json`)
- età minima e anni di patente, condizioni di cancellazione per le prenotazioni dirette (FAQ in `info.json`)
- una foto "da copertina" del Kentucky in Puglia, da usare come `fotoApertura`
- facoltativo: chiedere al grafico il logo in SVG o PNG trasparente ad alta risoluzione; quelli inclusi sono ritagliati dall'immagine JPG

## Come funziona il calcolatore

Per ogni notte tra ritiro e riconsegna applica il prezzo della sua stagione e aggiunge il supplemento del piano; l'eventuale sconto promo vale solo su questa parte. Poi aggiunge la quota obbligatoria di pulizia finale, preparazione e check-in (€200) e gli extra scelti (lenzuola, asciugamani, barbecue, transfer). Il noleggio minimo è di 2 o 3 giorni secondo il periodo del ritiro. Il pulsante apre WhatsApp con un messaggio già scritto (date, piano, persone, prezzo stimato, nome e note) nella lingua del cliente.
