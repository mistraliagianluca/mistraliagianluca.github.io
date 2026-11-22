# Registro delle modifiche

[← Indice](README.md)

**Come si scrive:** a ogni push che cambia codice o configurazione, aggiungi **in cima** una voce con la data, cosa è cambiato, perché e cosa deve fare chi usa il sistema. Se manca, il workflow *Documentazione* segna una ❌ (vedi [Sviluppo](06-sviluppo.md#regola-documentazione)). Prezzi, promo, testi, foto e articoli non vanno registrati qui.

```
## AAAA-MM-GG · Titolo breve
- Cosa: …
- Perché: …
- Da fare per chi usa il sistema: … (oppure "niente")
```

---

## 2026-11-22 · Date della promo salvate dal pannello
- Cosa: `src/lib/site.ts` legge le date della promo sempre come AAAA-MM-GG. Il pannello le salva senza virgolette e il sito le riceveva come `2026-11-22T00:00:00.000Z`: il banner restava nascosto il primo giorno e la data "fino al" poteva risultare non valida.
- Perché: la promo Black Friday attivata dal pannello con inizio 22/11 non compariva.
- Da fare: niente; dopo il push il banner compare subito.

## 2026-11-22 · Pannello www.mistralia.co/admin
- Cosa: pannello Sveltia CMS (`public/admin/`) per modificare dai moduli prezzi, stagioni, minimi, piani, quota, extra, promo, contatti, ritiro, kit, regole, FAQ e foto; ogni Salva fa un commit e ripubblica il sito. Le stagioni in `prezzi.json` sono ora **periodi** (`periodi`: dal, al, stagione) al posto delle lettere giorno per giorno: il sito li converte da solo e il risultato è identico. Galleria e foto di apertura in `info.json` sono percorsi d'immagine (il vecchio formato a numeri resta accettato). Il "da €X" dei post segue il prezzo più basso di `prezzi.json`.
- Perché: cambiare i parametri senza toccare file JSON, anche dal telefono.
- Da fare: creare il token `pannello-admin` e fare il login ([istruzioni](03-sito.md#il-pannello-wwwmistraliacoadmin)); annotare la scadenza in [Sicurezza](05-sicurezza.md#inventario-dei-segreti); per un anno nuovo, aggiungere i suoi periodi.

## 2026-11-22 · Sveglia cron-job.org e post del lunedì fatto dal bot
- Cosa: sveglia esterna cron-job.org ogni minuto per *Bot Telegram* (il timer di GitHub resta come riserva); la bozza del lunedì la prepara il bot stesso dal lunedì alle 9, una volta a settimana (`postSettimanale` in `config.json`, `settimanale` in `stato.json`); se fallisce non riprova da solo; il workflow *Post settimanale* non ha più un orario e si usa solo a mano.
- Perché: il timer di GitHub ritardava di ore; con una sveglia ogni minuto un workflow separato per il lunedì poteva essere cancellato da un giro del bot.
- Da fare: su cron-job.org tenere **solo** il timer del Bot Telegram; segnare la scadenza del token `cron-job` in [Sicurezza](05-sicurezza.md#inventario-dei-segreti).

## 2026-11-22 · Documentazione integrata nel progetto
- Cosa: nuova cartella `docs/` con architettura, uso quotidiano, sito, automazione, sicurezza, sviluppo, problemi; `docs/riferimento.md` generato in automatico; workflow *Documentazione* che lo rigenera e controlla questo registro a ogni push; `CLAUDE.md` con le regole per gli assistenti AI. *Pubblica sito* non parte più per modifiche a `docs/`, `README.md` e `CLAUDE.md`.
- Perché: chiunque deve poter capire e gestire il sistema; la documentazione deve restare allineata al codice.
- Da fare: leggere [Uso quotidiano](02-uso-quotidiano.md).

## 2026-11-22 · Protezioni per più sveglie
- Cosa: i workflow del bot e del post scaricano sempre l'ultima versione di `main`; il post del lunedì non parte se oggi c'è già una bozza (`UNA_AL_GIORNO`); timer di GitHub del bot spostato ai minuti :07, :22, :37, :52.
- Perché: il timer di GitHub ha avuto ritardi di ore; con due sveglie attive non devono nascere bozze doppie né messaggi letti due volte.
- Da fare: niente (superato dalla voce successiva).

## 2026-11-21 · Costi sotto controllo
- Cosa: modello predefinito Claude Sonnet 5.5 (prima Opus 5.5); ricerche limitate a 3 (scrittura) e 4 (verifica); 2 tentativi di verifica; costo di ogni bozza e spesa del mese mostrati su Telegram; tetto interno `budgetMensileDollari` = $8, che conta anche i tentativi falliti.
- Perché: in tre giorni di prove con Opus e molte ricerche la spesa era arrivata a circa $20.
- Da fare: impostare il limite mensile su console.anthropic.com e il budget su Google Cloud; cancellare l'eventuale Variable `ANTHROPIC_MODEL=claude-opus-5-5`.

## 2026-11-21 · Mete, traghetti e durata dei viaggi
- Cosa: le proposte non sono più solo in Puglia ma su mete entro ~4 ore da Bari o con traghetto diretto da Bari (solo se la linea imbarca camper, verificato due volte); durata del viaggio adatta a distanza e stagione; durata mostrata nella bozza.
- Perché: richiesta del team, i clienti possono andare dove vogliono.
- Da fare: niente.

## 2026-11-21 · Bot più robusto
- Cosa: Rigenera passa a Claude la bozza scartata e chiede un altro evento e un altro luogo; conferme scadute dei tap ignorate, con un messaggio nel gruppo al posto della conferma; pulsanti con codice corto (limite di 64 byte di Telegram); slug senza trattino finale.
- Perché: errori *BUTTON_DATA_INVALID* e *query is too old*; Rigenera riproponeva lo stesso tema.
- Da fare: niente.

## 2026-11-21 · Verifica indipendente dei fatti
- Cosa: una seconda chiamata a Claude verifica sul web ogni fatto (edizione di quest'anno, date, luogo, ingresso) e fa correggere o cambiare tema; bozze non verificate arrivano con ⚠️; testo lungo in un messaggio separato; età del camper mai citata.
- Perché: il team non può controllare a mano ogni evento proposto.
- Da fare: non pubblicare bozze con ⚠️.

## 2026-11-21 · Avvio dell'automazione
- Cosa: post settimanale (Claude + Gemini) e bot Telegram con Pubblica, Rigenera, correzioni, `/nuovo`, `/aiuto`, `/id`; `.gitignore` completo; `node_modules/` e `.astro/` tolti dal repository.
- Perché: blocchi 6–8 del piano MVP.
- Da fare: niente.

## 2026-11 · Sito MVP online
- Cosa: sito bilingue Astro su GitHub Pages con prezzi stagionali, calcolatore, richiesta su WhatsApp, galleria, Diario, FAQ, promo modificabile a mano.
- Perché: prenotazioni dirette senza commissioni delle piattaforme.
- Da fare: completare le voci `DA_CONFERMARE` (vedi [Il sito](03-sito.md#cose-ancora-da-completare)).
