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

## 2026-11-22 · Nuovo layout della home, prima per il telefono
- Cosa: `src/components/Home.astro` riscritta con layout compatto:
  - niente più scorrimento laterale (`overflow-x: clip`; tabella dei piani sostituita da tre colonne);
  - Diario spostato subito dopo "Perché", con card basse su telefono;
  - kit con icone, scelte per gruppo con il campo `icona` in `info.json` e nel pannello;
  - prezzi in molto meno spazio, con la quota fissa indicata una sola volta e gli extra in una riga;
  - calcolatore con le date affiancate senza sovrapposizioni e la riconsegna che parte dal ritiro, proposta con il noleggio minimo; riquadro promo con angoli più piccoli; calendario delle disponibilità dentro il calcolatore;
  - galleria con 2–3 anteprime e un visore a tutto schermo per tutte le foto;
  - un solo pulsante WhatsApp fisso, ora anche su computer (tolti quelli in apertura, disponibilità, contatti e 404);
  - banner della promo dentro l'intestazione fissa, quindi sempre visibile.

  Testo "20 anni e non sentirli" sostituito da "Affidabile e controllato", per la regola di non citare l'età del camper. Altezza su telefono da circa 11.900 a 6.900 px.
- Perché: richieste di Gianluca sull'esperienza da telefono (scorrimento laterale, pagina troppo lunga, Diario non raggiunto, quota da €200 ripetuta, date sovrapposte).
- Da fare: controllare il sito dal telefono. Le icone del kit si cambiano dal pannello.

## 2026-11-22 · Sottotitolo del Diario
- Cosa: sottotitolo della sezione Diario di bordo da "Idee per il tuo viaggio in Puglia, ogni settimana" a "Idee per partire in camper da Bari, ogni settimana" (in inglese "Ideas for a campervan trip from Bari, every week"), in `src/i18n/`.
- Perché: i post propongono anche altre regioni e mete raggiungibili in traghetto.
- Da fare: niente.

## 2026-11-22 · Articoli archiviati raggiungibili e pagina 404 di Mistralia
- Cosa: un articolo con `nascosto: true` (interruttore *Archivia* nel pannello) esce dalla home ma la sua pagina resta raggiungibile dal link, con l'avviso "in archivio" e `noindex`; prima la pagina spariva. Nuova pagina `src/pages/404.astro` ("Questa pagina non c'è più", con Diario, calcolatore e WhatsApp, in italiano o inglese secondo il link) per articoli eliminati e link sbagliati. Nel pannello lo stato si chiama "⚫ archiviato". `Base.astro` accetta `noindex`.
- Perché: nessun link condiviso sui social deve finire su una pagina d'errore.
- Da fare: per un articolo sbagliato usare *Delete*, per uno non più adatto *Archivia*.

## 2026-11-22 · Ordine degli articoli nel pannello
- Cosa: nel pannello *Diario di bordo* prima gli articoli in vetrina, poi quelli conclusi o nascosti, ognuno dal più recente. Il bot (`traduzioni.mjs`) tiene aggiornati `stato` e `ordine` nei file italiani; il pannello ordina per `ordine` decrescente e mostra lo stato nell'elenco. Provato il pannello in modalità cartella locale: elenco, ordine e salvataggio dei prezzi funzionano.
- Perché: vedere subito cosa è online.
- Da fare: niente. Se l'elenco appare in un altro ordine, *Sort* → *Ordine* decrescente.

## 2026-11-22 · Tolto l'articolo di esempio
- Cosa: eliminati `src/content/diario/esempio-polignano.it.md` ed `.en.md`, l'articolo dimostrativo dell'MVP (non pubblicato, con una foto della galleria al posto dell'immagine generata). Il sito continua a ignorare eventuali articoli con `esempio: true`.
- Perché: compariva nel pannello `/admin` come un articolo vero ma non era sul sito.
- Da fare: niente.

## 2026-11-22 · Articoli solo in italiano, inglese automatico
- Cosa: il pannello mostra solo la versione italiana degli articoli; nuovo `automazione/traduzioni.mjs`, chiamato dal bot a ogni giro, che ritraduce con Claude l'inglese quando cambiano titolo, anteprima o testo italiani, copia data, scadenza, nascosto e immagine, ed elimina l'inglese se l'italiano viene eliminato. Impronta del testo sorgente nel campo `origine` dei file inglesi. Il pannello non scrive più i campi facoltativi vuoti (`omit_empty_optional_fields`) e la scadenza vuota è accettata.
- Perché: modificare una volta sola, nella lingua del team.
- Da fare: niente. Costo stimato ~$0,02–0,05 per articolo modificato, nessun costo se non si modifica niente.

## 2026-11-22 · Articoli con scadenza, nascosti e Diario nel pannello
- Cosa: nuovo campo `scadenza` negli articoli (ultimo giorno dell'evento), scritto dal bot e controllato dal verificatore; dal giorno dopo l'articolo esce dalla home e la sua pagina mostra "evento concluso" (deciso dal browser, senza ricostruire il sito). Nuovo campo `nascosto` per togliere un articolo dal sito senza cancellarlo. La home prepara fino a 9 articoli e ne mostra i 3 più recenti non scaduti. Nuova sezione *Diario di bordo* nel pannello `/admin` per correggere, impostare la scadenza, nascondere o eliminare gli articoli. Il riferimento tecnico mostra lo stato di ogni articolo.
- Perché: non lasciare in vetrina eventi passati, senza rompere i link già condivisi sui social.
- Da fare: nel pannello impostare la **Fine dell'evento** dei due articoli già pubblicati (Matera, 'Ndocciata di Agnone), su tutti e due i file it ed en.

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
