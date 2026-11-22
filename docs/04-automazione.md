# Automazione: post settimanale e bot

[← Indice](README.md)

Tutto il codice sta in `automazione/`, è scritto in JavaScript per Node 22 e **non ha dipendenze**: niente `npm install` e niente librerie da aggiornare.

| File | Ruolo |
| --- | --- |
| `genera.mjs` | Prepara una bozza: scrittura, verifica dei fatti, immagine, invio su Telegram |
| `telegram.mjs` | Il bot: legge il gruppo ed esegue Pubblica, Rigenera, correzioni e comandi |
| `lib.mjs` | Funzioni comuni: chiamate a Claude, Gemini e Telegram, stato, spesa, modalità di prova |
| `prompt.md` | **Istruzioni a Claude per scrivere** il post: fatti sul camper, mete, durata, tono, formato |
| `verifica.md` | **Istruzioni al verificatore** dei fatti |
| `config.json` | Impostazioni: modelli, limiti, budget, foto di riferimento |
| `stato.json` | Memoria del bot. **Non modificare a mano** |
| `bozze/` | Una cartella per ogni bozza (`bozza.json` + `immagine.jpg`) |
| `traduzioni.mjs` | Tiene la versione inglese di ogni articolo allineata a quella italiana (traduce, copia, elimina) |
| `documentazione.mjs` | Rigenera `docs/riferimento.md` e controlla il registro delle modifiche |

## Come nasce una bozza

```mermaid
flowchart TD
    S(["Avvio: lunedì dalle 9, /nuovo,<br>🔄 Rigenera o una correzione"]) --> B{"Spesa del mese<br>oltre il budget?"}
    B -->|Sì| STOP["⚠️ messaggio nel gruppo<br>nessuna chiamata"]
    B -->|No| W["Claude SCRIVE<br>(fino a 3 ricerche web)"]
    W --> V["Claude VERIFICA<br>chiamata indipendente<br>(fino a 4 ricerche web)"]
    V --> E{"Esito"}
    E -->|ok| IMG
    E -->|"correggi o scarta"| T{"Tentativi di verifica<br>esauriti?"}
    T -->|"Sì: la bozza resta<br>non verificata"| IMG
    T -->|"No, era «correggi»"| W2["Claude riscrive<br>applicando la correzione"] --> V
    T -->|"No, era «scarta»"| W3["Claude cambia tema<br>(all'ultimo tentativo:<br>niente eventi né date)"] --> V
    IMG["Gemini crea l'immagine<br>dalle foto del Kentucky"] --> TG["Bozza su Telegram<br>📝 se verificata, ⚠️ se no"]
    TG --> ST["Salva bozza, stato e spesa<br>nel repository"]
```

**Gli avvii possibili:**

| Avvio | Da dove | Cosa cambia |
| --- | --- | --- |
| Lunedì dalle 9 (ora italiana) | il **Bot Telegram** stesso, al primo giro dopo l'ora indicata in `config.json` → `postSettimanale` | Una sola volta a settimana. Se questa settimana c'è già una bozza (anche da `/nuovo`) non ne fa un'altra. Se fallisce **non riprova da solo** (per non spendere): scrive l'errore nel gruppo e si usa `/nuovo` |
| Avvio a mano | workflow *Post settimanale* → Run workflow | Solo per emergenze; con la sveglia ogni minuto può essere cancellato da un giro del bot (vedi sotto). Meglio `/nuovo` |
| `/nuovo` | Bot Telegram | Bozza nuova subito |
| 🔄 Rigenera | Bot Telegram | Claude riceve la bozza scartata e deve cambiare **evento e luogo** |
| Risposta alla bozza | Bot Telegram | Stesso tema e luogo, applica la correzione; l'immagine si rifà solo se la correzione la riguarda |

### Le regole che Claude segue (`prompt.md`)

- **Mete:** raggiungibili in circa 4 ore di guida da Bari (Puglia, Basilicata, Campania, Calabria, Molise, Abruzzo) o con un **traghetto diretto da Bari** (Grecia, Albania, Montenegro, Croazia). Deve alternare le regioni e indicare il tempo di viaggio. Il limite di ore è `oreMaxDaBari` in `config.json`.
- **Traghetti:** solo se ha verificato che nel periodo c'è una linea da Bari che **imbarca camper**. Cita la compagnia e la durata della traversata, senza prezzi.
- **Durata del viaggio:** entro 2 ore → weekend lungo; 3–4 ore → 4–7 giorni; traghetto ed estero → 7–10 giorni, d'estate due settimane. Da giugno a settembre privilegia viaggi lunghi in periodi poco affollati (giugno, inizio luglio, settembre); nel resto dell'anno weekend lunghi e ponti. Niente gite di un giorno.
- **Fatti sul camper:** solo quelli scritti nel prompt. **Mai citare età o anno del camper**, mai prezzi diversi da "da €X al giorno", dove X è il prezzo più basso in `src/data/prezzi.json`: se cambi i prezzi dal pannello, i post si aggiornano da soli.
- **Date di eventi:** solo se verificate in una fonte trovata al momento.
- **Scadenza:** se il post parla di un evento con date, Claude scrive anche il campo `scadenza` (ultimo giorno dell'evento). Con Pubblica finisce nell'articolo: dal giorno dopo l'articolo esce dalla home e la pagina dice "evento concluso" ([Il sito → Articoli scaduti](03-sito.md#articoli-scaduti-e-nascosti)).
- **Temi già usati:** riceve gli ultimi 12 temi, con il luogo, e non deve ripeterli.
- **Immagine:** "reale" (il Kentucky nel luogo) oppure, una settimana su 4, "improbabile" (il Kentucky in un posto impossibile e simpatico).
- **Tono:** fresco, frasi corte, massimo 3 emoji, niente finta urgenza e niente recensioni inventate.

Per cambiare tono o regole si modifica `prompt.md`: è testo normale. Se cambiano le condizioni di noleggio, aggiorna la sezione *Chi siamo* del prompt.

### La verifica dei fatti (`verifica.md`)

Una **seconda chiamata a Claude**, separata dalla prima, rilegge la bozza e cerca da sola sul web ogni fatto su eventi e luoghi: nome, **edizione di quest'anno**, date, luogo, ingresso, traghetti (linea, periodo, imbarco camper), tempi di viaggio e la **scadenza** dell'evento. Non si fida delle fonti della prima chiamata, e una pagina dell'anno precedente non vale come conferma.

| Esito | Cosa succede |
| --- | --- |
| `ok` | La bozza parte con *🔎 Fatti verificati su: …* e i link |
| `correggi` | L'evento esiste ma un dettaglio è sbagliato: Claude riscrive e si verifica di nuovo |
| `scarta` | Evento non confermato o traghetto non verificato: Claude cambia tema |
| Tentativi esauriti | La bozza arriva con ⚠️ e l'elenco dei problemi: **non va pubblicata** |

Il numero di tentativi è `tentativiVerifica` in `config.json`, oggi 2. Il rischio di un errore non è zero, ma per proporre un evento falso dovrebbero sbagliare due chiamate indipendenti con ricerche separate.

## Cosa fa il bot a ogni giro

```mermaid
flowchart TD
    A["Avvio del workflow<br>Bot Telegram"] --> B["Scarica l'ultima versione<br>del repository (ref: main)"]
    B --> C["getUpdates: messaggi e tap<br>arrivati dall'ultimo giro"]
    C --> D{"Per ogni messaggio"}
    D -->|"/id"| E["Risponde con l'id della chat<br>(in qualsiasi chat)"]
    D -->|"da un'altra chat"| X["Ignora"]
    D -->|"✅ Pubblica"| F["Scrive l'articolo IT+EN<br>e l'immagine nel sito,<br>manda i testi social"]
    D -->|"🔄 Rigenera"| G["Nuova bozza:<br>altro tema e luogo"]
    D -->|"risposta alla bozza"| H["Bozza corretta"]
    D -->|"/nuovo · /aiuto"| I["Bozza nuova · elenco comandi"]
    D -->|"altro testo"| X
    F & G & H & I --> T["Allinea le versioni inglesi<br>degli articoli (traduzioni.mjs)"]
    T --> J["Promemoria se la bozza<br>aspetta da 48 ore"]
    J --> K["Commit di stato,<br>bozze e articoli"]
    K --> L{"C'è un articolo<br>da pubblicare?"}
    L -->|Sì| M["Avvia Pubblica sito"]
```

- Dopo ogni messaggio il bot salva subito il punto in cui è arrivato (`offset`): se un passaggio fallisce, lo stesso messaggio **non** viene rieseguito all'infinito.
- La conferma del tap (*answerCallbackQuery*) Telegram la accetta solo per pochi secondi. Il bot passa più di rado, quindi la conferma di solito è scaduta: il bot la ignora e scrive invece un messaggio nel gruppo.
- I pulsanti contengono un codice corto di 10 caratteri e non l'identificativo della bozza, perché Telegram accetta al massimo 64 byte.
- Due giri non lavorano mai insieme: i workflow del bot e del post sono nello stesso gruppo di *concurrency* `automazione` e partono uno dopo l'altro, ognuno con l'ultima versione del repository.

## Versione inglese degli articoli

Gli articoli si modificano **solo in italiano**: dal pannello, dall'editor web o dal Mac. A ogni giro il bot confronta ogni `<chiave>.it.md` con il suo `<chiave>.en.md`:

| Nell'italiano è cambiato… | Il bot… | Costo |
| --- | --- | --- |
| titolo, anteprima o testo | fa tradurre a Claude e riscrive l'inglese (senza ricerche web), poi scrive *"🌍 Versione inglese aggiornata"* nel gruppo | ~$0,02–0,05 |
| data, fine dell'evento, nascosto, immagine | copia il valore nell'inglese | gratis |
| file eliminato | elimina anche l'inglese | gratis |
| niente | niente | gratis |

- Il file inglese conserva in `origine` l'**impronta** del testo italiano da cui è stato tradotto. Finché l'italiano non cambia, nessuna chiamata a Claude.
- Se la traduzione fallisce, il bot lo scrive nel gruppo e **non riprova ogni minuto**: riprova alla prossima modifica dell'italiano. Le fallite sono in `stato.json` → `traduzioniFallite`.
- Gli articoli pubblicati con ✅ Pubblica nascono già allineati: l'inglese lo scrive Claude insieme all'italiano, con l'impronta.
- Dopo un aggiornamento il bot ripubblica il sito. Per circa 2 minuti la pagina inglese può mostrare la versione precedente.
- La spesa delle traduzioni entra nel totale del mese e nel tetto `budgetMensileDollari`.

## La sveglia del bot

Il bot **non è un programma sempre acceso**. GitHub lo avvia, il bot controlla Telegram per qualche secondo e si spegne. Qualcuno deve dirgli quando avviarsi: è la *sveglia*.

| Sveglia | Come funziona | Affidabilità |
| --- | --- | --- |
| **cron-job.org** (✅ attiva dal 22/11/2026) | Un servizio gratuito chiama GitHub **ogni minuto** e avvia *Bot Telegram* | Puntuale al minuto: risposte in 1–2 minuti |
| **Timer di GitHub** (riserva) | `cron` dentro `telegram.yml`, dalle 7 alle 22 | ⚠️ Scarsa: GitHub avvisa che i giri programmati possono essere ritardati o saltati. Il 22/11/2026 ha registrato ritardi di 3 e 7 ore |
| **A mano** | GitHub → Actions → *Bot Telegram* → **Run workflow** | Immediata, utile per test e urgenze |

**Stato attuale:** sveglia principale cron-job.org ogni minuto, timer di GitHub come riserva. Account cron-job.org e token: Gianluca.

### Giri "cancelled" in Actions: è normale

GitHub tiene **un solo giro in esecuzione e uno in attesa** per il gruppo `automazione`. Un giro dura 30–60 secondi, quindi con una chiamata al minuto capita spesso che arrivi una nuova chiamata mentre un'altra è già in attesa. GitHub allora cancella quella in attesa e tiene la più recente, con il messaggio *"Canceling since a higher priority waiting request for automazione exists"*. **Non si perde niente:** ogni giro legge tutti i messaggi arrivati da quello precedente.

Per questo la bozza del lunedì la prepara il bot e non un workflow separato: un workflow diverso nello stesso gruppo potrebbe essere cancellato da un giro del bot. Se le righe grigie in Actions danno fastidio, si può portare la sveglia a ogni 2 minuti.

### Attivare cron-job.org

1. **Token GitHub con un solo permesso:** su github.com → foto profilo → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Name `cron-job`; Expiration 1 anno
   - Repository access: **Only select repositories** → `mistraliagianluca.github.io`
   - Permissions: **Actions → Read and write**, nient'altro
   - Salvalo **solo nel password manager** e segna la scadenza in [Sicurezza](05-sicurezza.md#inventario-dei-segreti).
2. Su **cron-job.org** (registrazione gratuita) → **Create cronjob**:
   - URL: `https://api.github.com/repos/mistraliagianluca/mistraliagianluca.github.io/actions/workflows/telegram.yml/dispatches`
   - Schedule: ogni minuto (o ogni 2 minuti); Time zone `Europe/Rome`
   - Advanced → Method **POST**; Headers `Authorization: Bearer <token>` e `Accept: application/vnd.github+json`; Body `{"ref":"main"}`
3. **Test run** → la risposta deve essere **204**, e in Actions compare un giro di *Bot Telegram*.
4. **Non** serve un timer per `post-settimanale.yml`: la bozza del lunedì la prepara il bot.

Il timer di GitHub resta attivo come riserva: se partono entrambi, il gruppo di concurrency e il checkout di `main` evitano messaggi letti due volte, e il controllo settimanale (`settimanale` in `stato.json`) evita bozze doppie.

## Lo stato del bot (`stato.json`)

```jsonc
{
  "offset": 123456789,            // ultimo messaggio Telegram già letto
  "bozza": {                      // la bozza attiva (null se non ce n'è)
    "id": "2026-11-23-matera-…",  // cartella in automazione/bozze/
    "codice": "3f02d70d8b",       // codice corto dei pulsanti
    "messageId": 42,              // messaggio della foto su Telegram
    "testoId": 43,                // messaggio con il testo completo (se separato)
    "creata": "2026-11-23T08:07:00Z",
    "promemoria": false
  },
  "storico": [ { "id": "…", "tema": "…", "luogo": "…", "data": "2026-11-23" } ],
  "pubblicati": [ { "id": "…", "chiave": "…", "data": "…", "da": "Gianluca" } ],
  "spesa": { "mese": "2026-11", "dollari": 3.42 },
  "settimanale": "2026-11-23"     // lunedì della settimana in cui il bot ha già provato il post automatico
}
```

Lo scrivono solo i programmi. Se lo modifichi a mano, il bot può rileggere vecchi messaggi o perdere la bozza attiva.

## Costi e tetto di spesa

| Voce | Costo indicativo |
| --- | --- |
| Claude Sonnet 5.5 | $2 per milione di token letti, $10 per milione scritti |
| Ricerca web di Claude | $0,01 a ricerca, **più** il testo delle pagine trovate, che si paga come token letti: è la voce principale |
| Immagine Gemini | ~$0,07 |
| GitHub, Telegram, sito | gratis |

- Ogni bozza mostra su Telegram *💰 Costo di questa bozza* e la spesa del mese. È una stima fatta dai token restituiti dalle API: il dato esatto è su **console.anthropic.com → Usage** e su Google Cloud → Billing.
- **Tetto interno:** `budgetMensileDollari` in `config.json`, oggi $8. Superato il tetto, il bot non prepara più bozze fino al mese dopo e lo scrive nel gruppo. Conta anche i tentativi falliti.
- **Tetti esterni, da impostare comunque:** limite mensile su console.anthropic.com → *Settings → Limits*; budget con avviso su Google Cloud → *Billing → Budgets & alerts*.
- Per spendere meno si possono ridurre `ricercheScrittura`, `ricercheVerifica` e `tentativiVerifica`. **Lezione appresa:** con Opus e fino a 6 + 8 ricerche, tre giorni di prove sono costati circa $20.

## Modelli

- Testi: `modelloTesti` in `config.json` (oggi `claude-sonnet-5-5`). Immagini: `modelloImmagini` (oggi `gemini-3.1-flash-image`).
- Si possono sovrascrivere senza toccare il codice con le **Variables** di GitHub (non i Secrets!) `ANTHROPIC_MODEL` e `GEMINI_IMAGE_MODEL`. Una variabile, se esiste, vince su `config.json`.
- Se compare *"model not found"*, il modello è stato dismesso: prendi il nome attuale dalla documentazione di Anthropic o Google e aggiorna `config.json`. Se esiste una Variable, aggiorna o cancella anche quella.

## Provare senza spendere (modalità PROVA)

```bash
PROVA=1 TELEGRAM_CHAT_ID=1 node automazione/genera.mjs
cat automazione/prova-telegram.log
```

Con `PROVA=1` nessuna chiamata esce davvero. Claude e la verifica restituiscono contenuti finti, l'immagine è una foto della galleria, e i messaggi che il bot manderebbe finiscono in `automazione/prova-telegram.log`. Per simulare tap e risposte si crea `automazione/prova-updates.json` con gli aggiornamenti finti e si lancia `telegram.mjs`. Esempi in [Sviluppo](06-sviluppo.md#test-in-modalità-prova). Il log e il file dei finti aggiornamenti sono esclusi da git.
