// Legge i messaggi arrivati al bot Telegram e li esegue:
//   ✅ Pubblica  -> l'articolo va nel Diario del sito (IT + EN) e il bot manda i testi per i social
//   🔄 Rigenera  -> nuova proposta con un altro tema
//   risposta alla bozza -> nuova versione con la correzione richiesta
//   /nuovo  /aiuto  /id
// Lo lancia un job di GitHub Actions ogni 15 minuti: nessun server da tenere acceso.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, AUTO, PROVA, config, leggiStato, salvaStato, oggiISO, slug, telegram, chatId, scrivi } from './lib.mjs';
import { creaBozza } from './genera.mjs';

const AIUTO = [
  'Comandi del bot Mistralia:',
  '✅ Pubblica: mette l\'articolo sul sito e ti manda i testi per i social',
  '🔄 Rigenera: nuova proposta con un altro tema',
  '✍️ Rispondi alla bozza per chiedere una correzione',
  '/nuovo — prepara subito una nuova bozza',
  '/id — mostra l\'identificativo di questa chat',
].join('\n');

// Telegram accetta la risposta a un tap solo per pochi secondi; il bot passa ogni 15 minuti, quindi spesso è scaduta: si ignora.
const rispondiTap = (q, text) => telegram('answerCallbackQuery', { callback_query_id: q.id, text }).catch(() => {});

const leggiBozza = (id) => JSON.parse(fs.readFileSync(path.join(AUTO, 'bozze', id, 'bozza.json'), 'utf8'));
const yaml = (v) => JSON.stringify(v); // una stringa JSON è anche una stringa YAML valida

function scriviArticolo(b) {
  const c = b.contenuto;
  let chiave = slug(c.chiave || c.titolo_it);
  const dir = path.join(ROOT, 'src/content/diario');
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(path.join(dir, `${chiave}.it.md`))) chiave = `${chiave}-${oggiISO()}`;
  const img = `/assets/diario/${chiave}.jpg`;
  fs.mkdirSync(path.join(ROOT, 'public/assets/diario'), { recursive: true });
  fs.copyFileSync(b.immagine, path.join(ROOT, 'public', img));
  for (const l of ['it', 'en']) {
    const fm = [
      '---',
      `titolo: ${yaml(c[`titolo_${l}`])}`,
      `data: ${oggiISO()}`,
      `lingua: ${l}`,
      `chiave: ${yaml(chiave)}`,
      `immagine: ${yaml(img)}`,
      `estratto: ${yaml(c[`estratto_${l}`])}`,
      'immagineAI: true',
      '---',
      '',
      c[`articolo_${l}`].trim(),
      '',
    ].join('\n');
    fs.writeFileSync(path.join(dir, `${chiave}.${l}.md`), fm);
  }
  fs.writeFileSync(path.join(AUTO, '.da-pubblicare'), chiave);
  return chiave;
}

async function pubblica(stato, id, chi) {
  const b = leggiBozza(id);
  const c = b.contenuto;
  const chiave = scriviArticolo(b);
  const url = `${config.sito}/diario/${chiave}/`;
  await telegram('editMessageCaption', {
    chat_id: chatId(), message_id: stato.bozza.messageId,
    caption: `✅ Pubblicato da ${chi}: «${c.titolo_it}»\nSul sito tra circa 2 minuti: ${url}`,
    reply_markup: { inline_keyboard: [] },
  }).catch(() => {});
  const tag = c.hashtag.map((h) => '#' + h).join(' ');
  await scrivi(`📋 Testo per Instagram e Facebook (copia e incolla):\n\n${c.post_it}\n\n🇬🇧 ${c.post_en}\n\n${tag}`);
  await scrivi(`📋 Testo per TikTok:\n\n${c.tiktok}\n\n${tag}\n\nL'immagine è quella della bozza qui sopra: tienila premuta per salvarla.`);
  stato.pubblicati = [...(stato.pubblicati || []), { id, chiave, data: oggiISO(), da: chi }];
  stato.bozza = null;
}

async function main() {
  const stato = leggiStato();
  const updates = await telegram('getUpdates', { offset: stato.offset ?? 0, timeout: 0, allowed_updates: ['message', 'callback_query'] });
  // Senza TELEGRAM_CHAT_ID il bot risponde solo a /id (serve per scoprire l'id del gruppo durante l'attivazione)
  const nostra = process.env.TELEGRAM_CHAT_ID || (PROVA ? String(chatId()) : '');

  for (const u of updates) {
    stato.offset = u.update_id + 1;
    salvaStato(stato); // se un passaggio fallisce, lo stesso messaggio non viene rieseguito all'infinito
    try {
      if (u.callback_query) {
        const q = u.callback_query;
        if (String(q.message?.chat?.id) !== nostra) continue;
        const [azione, codice] = String(q.data).split(':');
        const chi = q.from?.first_name || 'il team';
        if (!stato.bozza || ![stato.bozza.codice, stato.bozza.id].includes(codice)) {
          await rispondiTap(q, 'Questa bozza non è più attiva.');
          continue;
        }
        if (azione === 'pub') {
          await rispondiTap(q, 'Pubblico…');
          await pubblica(stato, stato.bozza.id, chi);
        } else if (azione === 'rig') {
          await rispondiTap(q, 'Preparo un\'altra proposta, qualche minuto…');
          await scrivi(`🔄 ${chi} ha chiesto un'altra proposta: arriva tra qualche minuto.`);
          await creaBozza({ scartata: leggiBozza(stato.bozza.id) });
          Object.assign(stato, leggiStato());
        }
        continue;
      }

      const m = u.message;
      if (!m?.text) continue;
      const testo = m.text.trim();
      if (/^\/id\b/.test(testo)) {
        await telegram('sendMessage', { chat_id: m.chat.id, text: `L'id di questa chat è: ${m.chat.id}` });
        continue;
      }
      if (String(m.chat.id) !== nostra) continue;
      if (/^\/(aiuto|help|start)\b/.test(testo)) { await scrivi(AIUTO); continue; }
      if (/^\/nuovo\b/.test(testo)) {
        await scrivi('Preparo una nuova bozza, qualche minuto…');
        await creaBozza();
        Object.assign(stato, leggiStato());
        continue;
      }
      const risposta = m.reply_to_message?.message_id;
      if (stato.bozza && risposta && [stato.bozza.messageId, stato.bozza.testoId].includes(risposta)) {
        await scrivi('Ricevuto, preparo la versione corretta…', { reply_parameters: { message_id: m.message_id } });
        await creaBozza({ nota: testo, precedente: leggiBozza(stato.bozza.id) });
        Object.assign(stato, leggiStato());
      }
    } catch (e) {
      console.error(e);
      await scrivi(`⚠️ Qualcosa non è andato: ${e.message.slice(0, 300)}`).catch(() => {});
    }
    salvaStato(stato);
  }

  // Promemoria se la bozza aspetta da troppo
  if (nostra && stato.bozza && !stato.bozza.promemoria) {
    const ore = (Date.now() - Date.parse(stato.bozza.creata)) / 3.6e6;
    if (ore >= config.oreProMemoria) {
      await scrivi('⏰ La bozza di questa settimana aspetta ancora: Pubblica, Rigenera o rispondi con una correzione.', { reply_parameters: { message_id: stato.bozza.messageId } }).catch(() => {});
      stato.bozza.promemoria = true;
    }
  }
  salvaStato(stato);
}

main().catch((e) => { console.error(e); process.exit(1); });
