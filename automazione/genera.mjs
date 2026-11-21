// Prepara la bozza del post e la manda al gruppo Telegram con i pulsanti Pubblica / Rigenera.
// Uso: node automazione/genera.mjs            (lo lancia il job del lunedì o il comando /nuovo)

import fs from 'node:fs';
import path from 'node:path';
import { AUTO, config, leggiStato, salvaStato, oggiISO, settimanaISO, slug, temiUsati, chiediClaude, creaImmagine, telegram, chatId } from './lib.mjs';

const BOZZE = path.join(AUTO, 'bozze');

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

  let notaPrompt = '';
  if (precedente && nota) {
    notaPrompt = `\n## Correzione richiesta dal team\nRiscrivi questa bozza tenendo lo stesso tema e luogo, applicando la correzione: "${nota}".\nSe la correzione non riguarda l'immagine, metti "rifai_immagine": false e lascia invariato "prompt_immagine".\nBozza attuale:\n\`\`\`json\n${JSON.stringify(precedente.contenuto, null, 2)}\n\`\`\`\n`;
  }

  const prompt = fs.readFileSync(path.join(AUTO, 'prompt.md'), 'utf8')
    .replaceAll('{{OGGI}}', new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
    .replaceAll('{{PREZZO_DA}}', String(config.prezzoDa))
    .replaceAll('{{LINK}}', link)
    .replaceAll('{{TEMI_USATI}}', temiUsati(stato).map((t) => `"${t}"`).join(', ') || 'nessuno')
    .replaceAll('{{TIPO}}', tipo)
    .replaceAll('{{NOTA}}', notaPrompt);

  const c = await chiediClaude(prompt);
  const id = `${oggiISO()}-${slug(c.chiave || c.titolo_it)}`;
  const dir = path.join(BOZZE, id);
  fs.mkdirSync(dir, { recursive: true });

  const immagine = path.join(dir, 'immagine.jpg');
  if (precedente && c.rifai_immagine === false && fs.existsSync(precedente.immagine)) {
    fs.copyFileSync(precedente.immagine, immagine);
  } else {
    await creaImmagine(c.prompt_immagine, immagine);
  }

  const bozza = { id, tipo, creata: new Date().toISOString(), contenuto: c, immagine };
  fs.writeFileSync(path.join(dir, 'bozza.json'), JSON.stringify(bozza, null, 2));

  // Anteprima su Telegram. La didascalia di una foto ha un limite di 1024 caratteri:
  // se il testo è più lungo, la foto porta titolo e istruzioni e il testo completo arriva subito sotto.
  const testo = [c.post_it, '', c.hashtag.map((h) => '#' + h).join(' ')].join('\n');
  const testa = `📝 Bozza della settimana${tipo === 'improbabile' ? ' (immagine improbabile)' : ''}\n«${c.titolo_it}»`;
  const coda = 'Per correggere: rispondi a questo messaggio scrivendo cosa cambiare.';
  const intera = [testa, '', testo, '', coda].join('\n');
  const staInFoto = intera.length <= 1024;
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
