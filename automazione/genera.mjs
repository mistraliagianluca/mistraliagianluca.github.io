// Prepara la bozza del post e la manda al gruppo Telegram con i pulsanti Pubblica / Rigenera.
// Uso: node automazione/genera.mjs            (lo lancia il job del lunedì o il comando /nuovo)

import fs from 'node:fs';
import path from 'node:path';
import { AUTO, config, leggiStato, salvaStato, oggiISO, settimanaISO, slug, temiUsati, chiediClaude, creaImmagine, telegram, chatId } from './lib.mjs';

const BOZZE = path.join(AUTO, 'bozze');
const oggi = () => new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Seconda chiamata a Claude, indipendente: cerca sul web ogni fatto su eventi e luoghi. */
async function verifica(contenuto) {
  const { verifica: _, prompt_immagine, rifai_immagine, ...daVerificare } = contenuto;
  const testo = fs.readFileSync(path.join(AUTO, 'verifica.md'), 'utf8')
    .replaceAll('{{OGGI}}', oggi())
    .replaceAll('{{BOZZA}}', JSON.stringify(daVerificare, null, 2));
  const v = await chiediClaude(testo, { ricerche: 8, finta: () => ({ esito: 'ok', problemi: [], correzione: '', fonti: ['https://example.org/prova'] }) });
  if (!['ok', 'correggi', 'scarta'].includes(v.esito)) v.esito = 'scarta';
  return v;
}

/**
 * Crea una bozza e la invia su Telegram.
 * @param {object} opz
 * @param {string} [opz.nota]       correzione scritta dal team (rigenera la stessa bozza tenendone conto)
 * @param {object} [opz.precedente] bozza da correggere
 */
export async function creaBozza({ nota, precedente } = {}) {
  const stato = leggiStato();
  const improbabile = settimanaISO() % config.ogniQuanteSettimaneImprobabile === 0;
  const tipo = precedente?.tipo ?? (improbabile ? 'improbabile' : 'reale');
  const link = `${config.sito}/?utm_source=instagram&utm_medium=social`;

  const prompt = (notaPrompt) => fs.readFileSync(path.join(AUTO, 'prompt.md'), 'utf8')
    .replaceAll('{{OGGI}}', oggi())
    .replaceAll('{{PREZZO_DA}}', String(config.prezzoDa))
    .replaceAll('{{LINK}}', link)
    .replaceAll('{{TEMI_USATI}}', [...temiUsati(stato), ...scartati].map((t) => `"${t}"`).join(', ') || 'nessuno')
    .replaceAll('{{TIPO}}', tipo)
    .replaceAll('{{NOTA}}', notaPrompt);
  const correggi = (contenuto, testo) => `\n## Correzione richiesta\nRiscrivi questa bozza tenendo lo stesso tema e luogo, applicando la correzione: "${testo}".\nSe la correzione non riguarda l'immagine, metti "rifai_immagine": false e lascia invariato "prompt_immagine".\nBozza attuale:\n\`\`\`json\n${JSON.stringify(contenuto, null, 2)}\n\`\`\`\n`;
  const SENZA_EVENTI = '\n## Attenzione\nQuesta settimana **non citare eventi né date**: scegli un luogo, un borgo o un itinerario e parla della stagione. Ogni fatto deve essere vero e verificabile.\n';

  // Scrittura + verifica indipendente dei fatti. Se la verifica non conferma, si corregge o si cambia tema.
  const scartati = [];
  let cambiatoTema = false;
  let c = await chiediClaude(prompt(precedente && nota ? correggi(precedente.contenuto, nota) : ''));
  let v;
  for (let giro = 1; ; giro++) {
    v = await verifica(c);
    console.log(`Verifica ${giro}: ${v.esito}`, v.problemi);
    if (v.esito === 'ok' || giro >= config.tentativiVerifica) break;
    if (v.esito === 'correggi') {
      const prec = c;
      c = await chiediClaude(prompt(correggi(c, v.correzione)));
      if (c.rifai_immagine === false) c.prompt_immagine = prec.prompt_immagine;
    } else {
      scartati.push(c.tema);
      cambiatoTema = true;
      c = await chiediClaude(prompt(giro + 1 >= config.tentativiVerifica ? SENZA_EVENTI : ''));
    }
  }
  c.verifica = v;

  const id = `${oggiISO()}-${slug(c.chiave || c.titolo_it)}`;
  const dir = path.join(BOZZE, id);
  fs.mkdirSync(dir, { recursive: true });

  const immagine = path.join(dir, 'immagine.jpg');
  if (precedente && !cambiatoTema && c.rifai_immagine === false && fs.existsSync(precedente.immagine)) {
    fs.copyFileSync(precedente.immagine, immagine);
  } else {
    await creaImmagine(c.prompt_immagine, immagine);
  }

  const bozza = { id, tipo, creata: new Date().toISOString(), contenuto: c, immagine };
  fs.writeFileSync(path.join(dir, 'bozza.json'), JSON.stringify(bozza, null, 2));

  // Anteprima su Telegram. La didascalia di una foto ha un limite di 1024 caratteri:
  // se il testo è più lungo, la foto porta titolo e istruzioni e il testo completo arriva subito sotto.
  const fonti = (c.verifica.fonti || []).slice(0, 3);
  const dominio = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
  const esitoVerifica = c.verifica.esito === 'ok'
    ? `🔎 Fatti verificati su: ${fonti.map(dominio).join(', ') || 'fonti web'}`
    : `⚠️ VERIFICA NON SUPERATA, non pubblicare senza controllare:\n${(c.verifica.problemi || []).map((p) => '• ' + p).join('\n')}`;
  const testo = [c.post_it, '', c.hashtag.map((h) => '#' + h).join(' '), '', esitoVerifica, ...fonti].join('\n');
  const testa = `${c.verifica.esito === 'ok' ? '📝' : '⚠️'} Bozza della settimana${tipo === 'improbabile' ? ' (immagine improbabile)' : ''}\n«${c.titolo_it}»`;
  const coda = 'Per correggere: rispondi a questo messaggio scrivendo cosa cambiare.';
  const intera = [testa, '', testo, '', coda].join('\n');
  const staInFoto = intera.length <= 1024 && c.verifica.esito === 'ok';
  const msg = await telegram('sendPhoto', {
    chat_id: chatId(),
    caption: staInFoto ? intera : [testa, '', 'Testo completo nel messaggio qui sotto.', '', coda].join('\n'),
    reply_markup: { inline_keyboard: [[{ text: '✅ Pubblica', callback_data: `pub:${id}` }, { text: '🔄 Rigenera', callback_data: `rig:${id}` }]] },
  }, immagine);
  let testoId = null;
  if (!staInFoto) {
    const t = await telegram('sendMessage', { chat_id: chatId(), text: testo.slice(0, 4096), reply_parameters: { message_id: msg.message_id } });
    testoId = t.message_id;
  }

  // Chiude i pulsanti della bozza precedente, se c'era
  if (stato.bozza?.messageId && stato.bozza.id !== id) {
    await telegram('editMessageReplyMarkup', { chat_id: chatId(), message_id: stato.bozza.messageId, reply_markup: { inline_keyboard: [] } }).catch(() => {});
  }

  stato.bozza = { id, messageId: msg.message_id, testoId, creata: bozza.creata, promemoria: false };
  stato.storico = [...(stato.storico || []), { id, tema: c.tema, data: oggiISO() }].slice(-30);
  salvaStato(stato);
  console.log(`Bozza ${id} inviata su Telegram.`);
  return bozza;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  creaBozza().catch(async (e) => {
    console.error(e);
    await telegram('sendMessage', { chat_id: chatId(), text: `⚠️ Non sono riuscito a preparare il post: ${e.message.slice(0, 300)}` }).catch(() => {});
    process.exit(1);
  });
}
