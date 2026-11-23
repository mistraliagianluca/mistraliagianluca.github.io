// Sondaggio del lunedì: il bot propone 3 temi con un sondaggio Telegram, il team vota,
// dopo qualche ora (o quando hanno votato tutti) il bot prepara la bozza sul tema che ha vinto.
// Se nessuno vota sceglie il bot (la prima proposta, quella che Claude consiglia).

import fs from 'node:fs';
import path from 'node:path';
import { AUTO, config, salvaStato, leggiStato, temiUsati, chiediClaude, telegram, chatId, scrivi, oggiEsteso, controllaBudget, spesaDelGiro, registraSpesa } from './lib.mjs';
import { creaBozza } from './genera.mjs';

const cfg = () => ({ attivo: true, ore: 4, ricerche: 3, ...(config.sondaggio || {}) });
export const sondaggioAttivo = () => cfg().attivo !== false;

/** Chiede a Claude 3 proposte e manda il sondaggio nel gruppo. */
export async function avviaSondaggio(stato) {
  controllaBudget(stato);
  const prima = spesaDelGiro();
  const prompt = fs.readFileSync(path.join(AUTO, 'sondaggio.md'), 'utf8')
    .replaceAll('{{OGGI}}', oggiEsteso())
    .replaceAll('{{ORE_MAX}}', String(config.oreMaxDaBari ?? 4))
    .replaceAll('{{TEMI_USATI}}', temiUsati(stato).map((t) => `"${t}"`).join(', ') || 'nessuno');
  let r;
  try {
    r = await chiediClaude(prompt, { ricerche: cfg().ricerche, finta: finte });
  } finally {
    registraSpesa(stato, prima);
    salvaStato(stato);
  }
  const opzioni = (r.opzioni || []).filter((o) => o?.etichetta && o?.titolo).slice(0, 3);
  if (opzioni.length < 2) throw new Error('Claude non ha proposto abbastanza temi per il sondaggio');

  const msg = await telegram('sendPoll', {
    chat_id: chatId(),
    question: '🗳 Su cosa facciamo il post di questa settimana?',
    options: opzioni.map((o) => ({ text: o.etichetta.slice(0, 100) })),
    is_anonymous: false,
  });
  const fine = new Date(Date.now() + cfg().ore * 3.6e6).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
  await scrivi([
    '📋 Le proposte nel dettaglio:',
    ...opzioni.map((o, i) => `\n${i + 1}. ${o.etichetta}\n${o.dettagli}${o.fonte ? `\n🔗 ${o.fonte}` : ''}`),
    '',
    `Votate entro le ${fine}: poi preparo la bozza sul tema che vince (anche prima, se avete votato tutti). Se nessuno vota, scelgo io la prima.`,
  ].join('\n'), { reply_parameters: { message_id: msg.message_id }, link_preview_options: { is_disabled: true } });

  stato.sondaggio = { pollId: msg.poll?.id ?? `prova-${msg.message_id}`, messageId: msg.message_id, opzioni, creato: new Date().toISOString(), votanti: 0, conteggi: opzioni.map(() => 0) };
  salvaStato(stato);
}

/** Aggiornamento del sondaggio ricevuto da Telegram (voti in tempo reale). */
export async function aggiornaSondaggio(stato, poll) {
  const s = stato.sondaggio;
  if (!s || poll.id !== s.pollId) return;
  s.conteggi = poll.options.map((o) => o.voter_count);
  s.votanti = poll.total_voter_count;
  if (!s.membri) {
    // Membri del gruppo meno il bot: quando hanno votato tutti si chiude subito
    const n = Number(await telegram('getChatMemberCount', { chat_id: chatId() }).catch(() => 0));
    if (n > 1) s.membri = n - 1;
  }
}

/** Chiude il sondaggio se è scaduto o se hanno votato tutti, poi prepara la bozza sul tema vincente. */
export async function chiudiSondaggioSeServe(stato) {
  const s = stato.sondaggio;
  if (!s) return false;
  const ore = (Date.now() - Date.parse(s.creato)) / 3.6e6;
  const tutti = s.membri && s.votanti >= s.membri;
  if (ore < cfg().ore && !tutti) return false;

  const poll = await telegram('stopPoll', { chat_id: chatId(), message_id: s.messageId }).catch(() => null);
  const conteggi = poll?.options?.map((o) => o.voter_count) ?? s.conteggi;
  const max = Math.max(...conteggi, 0);
  const vince = max > 0 ? conteggi.indexOf(max) : 0; // pari merito: vince la prima; nessun voto: la prima (consigliata)
  const o = s.opzioni[vince];
  stato.sondaggio = null;
  salvaStato(stato); // chiuso PRIMA di preparare la bozza: se la bozza fallisce non si richiude in loop

  await scrivi(max > 0
    ? `🗳 Ha vinto «${o.etichetta}» (${max} vot${max === 1 ? 'o' : 'i'}). Preparo la bozza, qualche minuto…`
    : `🗳 Nessun voto: scelgo io «${o.etichetta}». Preparo la bozza, qualche minuto…`);
  await creaBozza({ tema: { titolo: o.titolo, luogo: o.luogo, date: o.date, dettagli: o.dettagli, fonte: o.fonte } });
  Object.assign(stato, leggiStato());
  return true;
}

function finte() {
  return {
    opzioni: [
      { etichetta: '🎄 Prova: mercatini a Matera, 6–8 dicembre', titolo: 'Mercatini di Natale', luogo: 'Matera', date: '6–8 dicembre', dettagli: 'Weekend lungo, 1 ora da Bari.', fonte: 'https://example.org/matera' },
      { etichetta: '🌲 Prova: Foresta Umbra d\'inverno', titolo: 'Foresta Umbra', luogo: 'Gargano', date: '', dettagli: 'Tre giorni, 2 ore e mezza da Bari.', fonte: '' },
      { etichetta: '🏛 Prova: Paestum e Cilento in 5 giorni', titolo: 'Itinerario Cilento', luogo: 'Paestum', date: '', dettagli: 'Quattro ore da Bari.', fonte: '' },
    ],
  };
}
