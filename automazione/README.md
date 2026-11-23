# Automazione del post settimanale e del bot Telegram

La documentazione completa è in [`docs/04-automazione.md`](../docs/04-automazione.md); l'uso quotidiano del bot è in [`docs/02-uso-quotidiano.md`](../docs/02-uso-quotidiano.md).

| File | Ruolo |
| --- | --- |
| `genera.mjs` | prepara una bozza (scrittura, verifica dei fatti, immagine, invio su Telegram) |
| `telegram.mjs` | il bot: Pubblica, Rigenera, correzioni, voti, comandi e lavori a orario |
| `sondaggio.mjs` / `sondaggio.md` | sondaggio del lunedì sul tema della settimana |
| `radar.mjs` / `radar.md` | radar eventi: spunti con pulsanti e offerta da attivare sul sito |
| `lib.mjs` | funzioni comuni (Claude, Gemini, Telegram, stato, spesa, modalità PROVA) |
| `prompt.md` / `verifica.md` | istruzioni a Claude per scrivere e per verificare |
| `config.json` | impostazioni: modelli, limiti, budget, orari di sondaggio e radar |
| `stato.json` | memoria del bot: **non modificare a mano** |
| `traduzioni.mjs` | versione inglese degli articoli allineata all'italiano |
| `documentazione.mjs` | rigenera `docs/riferimento.md` e controlla il registro delle modifiche |

Prova senza spendere: `PROVA=1 TELEGRAM_CHAT_ID=1 node automazione/genera.mjs`
