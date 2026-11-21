# Post settimanale automatico

Ogni lunedì mattina il sistema prepara un post su una meta raggiungibile in camper da Bari (entro circa 4 ore di guida o con traghetto dal porto di Bari) e lo manda al gruppo Telegram "Mistralia":

1. Claude cerca sul web un evento o un luogo delle settimane successive, alternando Puglia, regioni vicine ed estero e scrive articolo, didascalia e testo TikTok in italiano e inglese.
2. Una seconda chiamata a Claude, indipendente, **verifica sul web ogni fatto** su eventi e luoghi (edizione di quest'anno, date, luogo, ingresso). Se un dettaglio è sbagliato lo fa correggere; se l'evento non è confermato cambia tema. Dopo 3 tentativi ripiega su un luogo senza eventi né date. Se nemmeno così la verifica passa, la bozza arriva con ⚠️ e l'elenco dei problemi.
3. Gemini crea l'immagine partendo dalle foto vere del Kentucky (una settimana su quattro in versione "improbabile").
4. Nel gruppo arriva l'anteprima con i pulsanti **✅ Pubblica** e **🔄 Rigenera**. Per una correzione basta **rispondere al messaggio** scrivendo cosa cambiare.
5. Con **Pubblica** l'articolo entra nel Diario di bordo del sito (IT + EN) e il bot manda i testi pronti da incollare su Instagram, Facebook e TikTok.

Il bot controlla il gruppo **ogni 15 minuti, dalle 7 alle 22**: dopo un tap la risposta può arrivare fino a 15 minuti dopo. Se nessuno risponde entro 48 ore, il bot manda un promemoria.

Instagram e Facebook per ora si pubblicano a mano con i testi del bot: la pubblicazione automatica arriva quando gli account esistono.

## Attivazione (una volta sola, circa 30 minuti)

### 1. Crea il bot Telegram
1. In Telegram cerca **@BotFather**, scrivi `/newbot`.
2. Nome: `Mistralia`; username: per esempio `mistralia_post_bot` (deve finire con `bot`).
3. BotFather risponde con un **token** (tipo `123456:ABC...`): copialo, serve al punto 4.

### 2. Crea il gruppo
1. Nuovo gruppo Telegram "Mistralia", aggiungi il bot (cerca il suo username).
2. Per ora puoi esserci solo tu; gli altri si aggiungono quando entrano nel progetto.

### 3. Prendi le chiavi API
- **Claude**: su https://console.anthropic.com crea un account (separato da Claude Enterprise), aggiungi credito (bastano €10), poi *API Keys → Create Key*. Imposta un limite di spesa mensile.
- **Gemini**: su https://aistudio.google.com clicca *Get API key*. Per generare immagini potrebbe servire attivare la fatturazione sul progetto Google Cloud collegato: costa pochi centesimi a immagine.

### 4. Inserisci i segreti su GitHub
Nel repository del sito: **Settings → Secrets and variables → Actions → New repository secret**, uno per riga:

| Nome | Valore |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | il token di BotFather |
| `ANTHROPIC_API_KEY` | la chiave Claude |
| `GEMINI_API_KEY` | la chiave Gemini |
| `TELEGRAM_CHAT_ID` | l'id del gruppo (vedi punto 5) |

### 5. Scopri l'id del gruppo
1. Dopo aver caricato i file sul repository (punto 6), scrivi `/id` nel gruppo.
2. Nella scheda **Actions** di GitHub apri "Bot Telegram" e premi *Run workflow* (o aspetta il giro dei 15 minuti).
3. Il bot risponde con un numero che inizia con `-100…`: è il `TELEGRAM_CHAT_ID` da inserire al punto 4.

### 6. Carica i file e prova
1. Copia nel repository: la cartella `automazione/`, i file in `.github/workflows/`, `src/` e `.gitignore`, poi `git add -A && git commit -m "Post settimanale" && git push`.
2. In **Actions → Post settimanale → Run workflow**: dopo 2–3 minuti la bozza arriva nel gruppo.
3. Premi **Pubblica**, poi in **Actions → Bot Telegram → Run workflow** (per non aspettare 15 minuti): l'articolo compare sul sito dopo circa 2 minuti.

## Personalizzare
- **Tono e regole dei testi**: `automazione/prompt.md` (contiene i fatti sul camper: aggiornali se cambiano le condizioni).
- **Foto di partenza per le immagini, frequenza delle immagini improbabili, ore per il promemoria**: `automazione/config.json`.
- **Modelli**: se Claude o Gemini rispondono "model not found", crea in *Settings → Secrets and variables → Actions → Variables* la variabile `ANTHROPIC_MODEL` o `GEMINI_IMAGE_MODEL` con il nome del modello attuale (lo trovi nella documentazione di Anthropic o di Google).
- **Giorno e ora**: riga `cron` in `.github/workflows/post-settimanale.yml` (l'orario è UTC).

## Costi
Circa €0,30–0,60 per bozza (testi e verifica con ricerca web + 1 immagine; fino a circa €1,50 se servono più tentativi); ogni Rigenera o correzione costa come una bozza. GitHub Actions è gratis se il repository è pubblico; se è privato, il bot usa circa 1.000 dei 2.000 minuti gratuiti al mese.

## Comandi nel gruppo
- `/nuovo` prepara subito una nuova bozza
- `/aiuto` mostra i comandi
- `/id` mostra l'id della chat

## Se qualcosa non va
Il bot scrive nel gruppo un messaggio "⚠️" con l'errore. I dettagli sono in **Actions**, nell'ultimo giro del workflow con la crocetta rossa.

## Provarlo senza chiavi
`PROVA=1 TELEGRAM_CHAT_ID=1 node automazione/genera.mjs` simula tutto: i messaggi che il bot manderebbe finiscono in `automazione/prova-telegram.log`.
