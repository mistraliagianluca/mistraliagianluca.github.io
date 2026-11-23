// Legge i messaggi arrivati al bot Telegram e li esegue:
//   ✅ Pubblica  -> l'articolo va nel Diario del sito (IT + EN) e il bot manda i testi per i social
//   🔄 Rigenera  -> nuova proposta con un altro tema
//   risposta alla bozza o al messaggio 💬 -> nuova versione con la correzione richiesta
//   pulsanti e risposte del radar eventi (radar.mjs), voti del sondaggio del lunedì (sondaggio.mjs)
//   /nuovo [indicazioni]  /sondaggio  /radar  /aiuto  /id
// Poi fa i lavori a orario: sondaggio del lunedì, radar eventi, traduzioni, promemoria.
// Lo lancia GitHub Actions, svegliato ogni minuto da cron-job.org: nessun server da tenere acceso.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, AUTO, PROVA, config, leggiStato, salvaStato, oggiISO, slug, telegram, chatId, scrivi, spesaDelGiro, registraSpesa, oraRoma } from './lib.mjs';
import { creaBozza } from './genera.mjs';
import { radarDaFare, lanciaRadar, tapRadar, rispostaRadar } from './radar.mjs';
import { sondaggioAttivo, avviaSondaggio, aggiornaSondaggio, chiudiSondaggioSeServe } from './sondaggio.mjs';
import { allineaTraduzioni, impronta, leggiArticolo } from './traduzioni.mjs';

const AIUTO = [
  'Comandi del bot Mistralia:',
  '✅ Pubblica: mette l\'articolo sul sito e ti manda i testi per i social',
  '🔄 Rigenera: nuova proposta con un altro tema',
  '💬 Rispondi al messaggio "Che ne pensate?" (o alla bozza) per chiedere una correzione',
  '📡 Spunti del radar: ✍️ bozza, 🏷 post + offerta, ⏭ no; oppure rispondi allo spunto con indicazioni',
  '🗳 Il lunedì: sondaggio sul tema della settimana, poi la bozza sul più votato',
  '',
  '/nuovo — prepara subito una nuova bozza',
  '/nuovo un weekend a Matera per l\'Immacolata — bozza con le tue indicazioni',
  '/sondaggio — fa subito il sondaggio con 3 proposte',
  '/radar — cerca subito eventi per i prossimi post',
  '/id — mostra l\'identificativo di questa chat',
].join('\n');

// Telegram accetta la risposta a un tap solo per pochi secondi; il bot passa ogni 15 minuti, quindi spesso è scaduta: si ignora.
const rispondiTap = (q, text) => telegram('answerCallbackQuery', { callback_query_id: q.id, text }).catch(() => {});

const leggiBozza = (id) => JSON.parse(fs.readFileSync(path.join(AUTO, 'bozze', id, 'bozza.json'), 'utf8'));
const yaml = (v) => JSON.stringify(v); // una stringa JSON è anche una stringa YAML valida

function scriviArticolo(b) {
  const c = b.contenuto;
  const CATEGORIE = ['offerta', 'evento', 'idea'];
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
      ...(CATEGORIE.includes(c.categoria) ? [`categoria: ${c.categoria}`] : []),
      ...(/^\d{4}-\d{2}-\d{2}$/.test(String(c.scadenza ?? '')) ? [`scadenza: ${c.scadenza}`] : []),
      '---',
      '',
      c[`articolo_${l}`].trim(),
      '',
    ].join('\n');
    fs.writeFileSync(path.join(dir, `${chiave}.${l}.md`), fm);
  }
  // La versione inglese ricorda da quale testo italiano viene: così il bot non la ritraduce (vedi traduzioni.mjs)
  const it = leggiArticolo(path.join(dir, `${chiave}.it.md`));
  const fileEn = path.join(dir, `${chiave}.en.md`);
  fs.writeFileSync(fileEn, fs.readFileSync(fileEn, 'utf8').replace(/\n---\n/, `\norigine: "${impronta(it.fm, it.corpo)}"\n---\n`));
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
  // Nota fissa sull'immagine: solo l'ambientazione è creata con l'AI, il camper è quello vero
  const notaAI = "📸 Ambientazione creata con l'AI, il camper è quello vero.";
  const notaAIen = '📸 AI-generated setting, real campervan.';
  await scrivi(`📋 Testo per Instagram e Facebook (copia e incolla):\n\n${c.post_it}\n\n🇬🇧 ${c.post_en}\n\n${notaAI}\n${notaAIen}\n\n${tag}`);
  await scrivi(`📋 Testo per TikTok:\n\n${c.tiktok}\n${notaAI}\n\n${tag}\n\nL'immagine è quella della bozza qui sopra: tienila premuta per salvarla.`);
  stato.pubblicati = [...(stato.pubblicati || []), { id, chiave, data: oggiISO(), da: chi }];
  stato.bozza = null;
}

async function main() {
  const stato = leggiStato();
  const updates = await telegram('getUpdates', { offset: stato.offset ?? 0, timeout: 0, allowed_updates: ['message', 'callback_query', 'poll'] });
  // Senza TELEGRAM_CHAT_ID il bot risponde solo a /id (serve per scoprire l'id del gruppo durante l'attivazione)
  const nostra = process.env.TELEGRAM_CHAT_ID || (PROVA ? String(chatId()) : '');

  for (const u of updates) {
    stato.offset = u.update_id + 1;
    salvaStato(stato); // se un passaggio fallisce, lo stesso messaggio non viene rieseguito all'infinito
    try {
      if (u.poll) { await aggiornaSondaggio(stato, u.poll); continue; }
      if (u.callback_query) {
        const q = u.callback_query;
        if (String(q.message?.chat?.id) !== nostra) continue;
        const [azione, codice] = String(q.data).split(':');
        const chi = q.from?.first_name || 'il team';
        if (await tapRadar(stato, azione, codice, chi, (t) => rispondiTap(q, t))) continue;
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
        const indicazioni = testo.replace(/^\/nuovo(@\w+)?\s*/, '').trim();
        await scrivi(indicazioni ? 'Preparo una bozza con le tue indicazioni, qualche minuto…' : 'Preparo una nuova bozza, qualche minuto…');
        await creaBozza(indicazioni ? { indicazioni } : {});
        Object.assign(stato, leggiStato());
        continue;
      }
      if (/^\/sondaggio\b/.test(testo)) {
        if (stato.sondaggio) { await scrivi('C\'è già un sondaggio aperto: votate lì.', { reply_parameters: { message_id: stato.sondaggio.messageId } }); continue; }
        await scrivi('Preparo il sondaggio con 3 proposte, qualche minuto…');
        await avviaSondaggio(stato);
        continue;
      }
      if (/^\/radar\b/.test(testo)) {
        await scrivi('📡 Cerco eventi per le prossime settimane, qualche minuto…');
        await lanciaRadar(stato);
        continue;
      }
      const risposta = m.reply_to_message?.message_id;
      if (stato.bozza && risposta && [stato.bozza.messageId, stato.bozza.testoId, stato.bozza.domandaId].includes(risposta)) {
        await scrivi('Ricevuto, preparo la versione corretta…', { reply_parameters: { message_id: m.message_id } });
        await creaBozza({ nota: testo, precedente: leggiBozza(stato.bozza.id) });
        Object.assign(stato, leggiStato());
        continue;
      }
      await rispostaRadar(stato, m, testo);
    } catch (e) {
      console.error(e);
      stato.spesa = leggiStato().spesa;
      await scrivi(`⚠️ Qualcosa non è andato: ${e.message.slice(0, 300)}`).catch(() => {});
    }
    salvaStato(stato);
  }

  // Lavori a orario (ora italiana). Ognuno segna nello stato che è stato fatto PRIMA di provare:
  // se fallisce non si riprova a ogni giro (e non si spende); il bot scrive l'errore nel gruppo.
  const aOrario = async (nome, lavoro) => {
    try { await lavoro(); } catch (e) {
      console.error(e);
      stato.spesa = leggiStato().spesa; // la spesa dei tentativi falliti è già stata salvata nel file
      await scrivi(`⚠️ ${nome}: ${e.message.slice(0, 300)}`).catch(() => {});
    }
    salvaStato(stato);
  };

  // Sondaggio del lunedì chiuso (scaduto o votato da tutti) → bozza sul tema vincente
  if (nostra) await aOrario('Non sono riuscito a preparare la bozza dal sondaggio. Per riprovare scrivi /nuovo', () => chiudiSondaggioSeServe(stato));

  // Post della settimana: dal giorno e dall'ora in config, una sola volta a settimana.
  // Con il sondaggio attivo (config.sondaggio) prima si vota il tema, poi arriva la bozza.
  const ps = config.postSettimanale ?? { giorno: 1, ora: 9 };
  const ora = oraRoma();
  const lunedi = new Date(ora.r); lunedi.setDate(ora.r.getDate() - (ora.giorno - 1));
  const settimana = `${lunedi.getFullYear()}-${String(lunedi.getMonth() + 1).padStart(2, '0')}-${String(lunedi.getDate()).padStart(2, '0')}`;
  const eOra = ora.giorno > ps.giorno || (ora.giorno === ps.giorno && ora.ora >= ps.ora);
  if (nostra && eOra && stato.settimanale !== settimana) {
    stato.settimanale = settimana;
    salvaStato(stato);
    const giaFatta = (stato.storico || []).some((x) => x.data >= settimana) || stato.sondaggio;
    if (!giaFatta) {
      await aOrario(sondaggioAttivo() ? 'Non sono riuscito a preparare il sondaggio della settimana. Per una bozza scrivi /nuovo' : 'Non sono riuscito a preparare il post della settimana. Per riprovare scrivi /nuovo', async () => {
        if (sondaggioAttivo()) await avviaSondaggio(stato);
        else { await creaBozza(); Object.assign(stato, leggiStato()); }
      });
    }
  }

  // Radar eventi nei giorni e all'ora di config.radar
  if (nostra && radarDaFare(stato)) await aOrario('Radar eventi non riuscito', () => lanciaRadar(stato));

  // Versioni inglesi degli articoli allineate a quelle italiane (modificate dal pannello o a mano)
  if (nostra) {
    const prima = spesaDelGiro();
    try { await allineaTraduzioni(stato); } catch (e) { console.error(e); }
    registraSpesa(stato, prima);
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
