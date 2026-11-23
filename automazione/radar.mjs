// Radar eventi: in alcuni giorni della settimana il bot cerca eventi (concerti, arte, festival, teatro, sagre, sport…)
// nelle mete raggiungibili da Bari tra 2 e 8 settimane e li propone nel gruppo, uno per messaggio, con i pulsanti:
//   ✍️ Prepara la bozza   🏷 Post + offerta   ⏭ No
// "Post + offerta" propone uno sconto sul sito e chiede conferma (il camper è libero?) prima di attivarlo.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, AUTO, config, salvaStato, leggiStato, temiUsati, chiediClaude, telegram, chatId, scrivi, oraRoma, oggiEsteso, dataIt, codiceCorto, eData, controllaBudget, spesaDelGiro, registraSpesa } from './lib.mjs';
import { creaBozza } from './genera.mjs';

const cfg = () => ({ attivo: true, giorni: [2, 5], ora: 11, spunti: 3, ricerche: 5, settimaneDa: 2, settimaneA: 8, ...(config.radar || {}) });
const ICONE = { concerto: '🎵', arte: '🎨', festival: '🎪', teatro: '🎭', sagra: '🍝', sport: '🏅', fiera: '🛍', altro: '✨' };
const PROMO = path.join(ROOT, 'src/data/promo.md');
const senzaAnteprima = { link_preview_options: { is_disabled: true } };

/** Il radar va lanciato adesso? (giorno e ora italiani da config.radar, una volta al giorno) */
export function radarDaFare(stato) {
  const c = cfg();
  const r = oraRoma();
  return c.attivo !== false && c.giorni.includes(r.giorno) && r.ora >= c.ora && stato.radar?.ultimo !== r.data;
}

/** Testo leggibile dei periodi di stagione ancora da venire (da src/data/prezzi.json), per decidere se un'offerta ha senso. */
function stagioni() {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/prezzi.json'), 'utf8'));
    const nomi = { B: 'bassa', M: 'media', A: 'alta' };
    const oggi = oraRoma().data;
    const futuri = (p.periodi || []).filter((x) => String(x.al).slice(0, 10) >= oggi).slice(0, 8);
    return futuri.map((x) => `${nomi[x.stagione] ?? x.stagione} dal ${String(x.dal).slice(0, 10)} al ${String(x.al).slice(0, 10)}`).join('; ') + '; i giorni non elencati sono media stagione';
  } catch { return 'non disponibili: proponi offerte solo da novembre a marzo'; }
}

const piuGiorni = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Cerca gli eventi e li manda nel gruppo. */
export async function lanciaRadar(stato) {
  const c = cfg();
  const oggi = oraRoma().data;
  stato.radar = { ultimo: oggi }; // segnato PRIMA: se fallisce non si riprova (e non si spende) a ogni giro
  salvaStato(stato);
  controllaBudget(stato);

  const giaVisti = [...temiUsati(stato), ...(stato.spunti || []).map((s) => `${s.evento} (${s.luogo})`)];
  const prompt = fs.readFileSync(path.join(AUTO, 'radar.md'), 'utf8')
    .replaceAll('{{OGGI}}', oggiEsteso())
    .replaceAll('{{SPUNTI}}', String(c.spunti))
    .replaceAll('{{DAL}}', dataIt(piuGiorni(oggi, c.settimaneDa * 7), true))
    .replaceAll('{{AL}}', dataIt(piuGiorni(oggi, c.settimaneA * 7), true))
    .replaceAll('{{ORE_MAX}}', String(config.oreMaxDaBari ?? 4))
    .replaceAll('{{RICERCHE}}', String(c.ricerche))
    .replaceAll('{{STAGIONI}}', stagioni())
    .replaceAll('{{GIA_VISTI}}', giaVisti.map((t) => `"${t}"`).join(', ') || 'nessuno');

  const prima = spesaDelGiro();
  let r;
  try {
    r = await chiediClaude(prompt, { ricerche: c.ricerche, finta: finti });
  } finally {
    registraSpesa(stato, prima);
    salvaStato(stato);
  }
  const spunti = (r.spunti || []).filter((s) => s?.evento && s?.luogo && eData(s.inizio) && s.inizio >= oggi).slice(0, c.spunti);
  if (!spunti.length) {
    await scrivi('📡 Radar eventi: questa volta non ho trovato eventi confermati che valga la pena proporre.');
    return;
  }

  await scrivi(`📡 Radar eventi: ${spunti.length === 1 ? 'uno spunto' : `${spunti.length} spunti`} per le prossime settimane.\nPer ognuno decidete con i pulsanti, oppure rispondete allo spunto con delle indicazioni (es. "sì, ma punta sul mercatino") e preparo la bozza.`);
  for (const [i, s] of spunti.entries()) {
    const codice = codiceCorto(`${oggi}-${s.evento}-${s.luogo}-${i}`);
    const offerta = pulisciOfferta(s.offerta);
    const testo = [
      `${ICONE[s.tipo] ?? '✨'} Spunto ${i + 1}/${spunti.length}`,
      `«${s.evento}» · ${s.luogo}`,
      `🗓 ${s.date}${s.distanza ? ` · 🚐 ${s.distanza}` : ''}`,
      s.perche,
      s.fonte ? `🔗 ${s.fonte}` : '',
      offerta ? `🏷 Idea offerta: −${offerta.sconto}% sui noleggi dal ${dataIt(offerta.noleggi_dal)} al ${dataIt(offerta.noleggi_al)}` : '',
      '',
      'Facciamo un post?',
    ].filter((x, j, a) => x !== '' || a[j - 1] !== '').join('\n');
    const pulsanti = [[{ text: '✍️ Prepara la bozza', callback_data: `spu:${codice}` }]];
    if (offerta) pulsanti[0].push({ text: '🏷 Post + offerta', callback_data: `spo:${codice}` });
    pulsanti.push([{ text: '⏭ No, grazie', callback_data: `spn:${codice}` }]);
    const msg = await telegram('sendMessage', { chat_id: chatId(), text: testo, reply_markup: { inline_keyboard: pulsanti }, ...senzaAnteprima });
    stato.spunti = [...(stato.spunti || []), { codice, ...s, offerta, testo, messageId: msg.message_id, data: oggi, esito: null }].slice(-30);
    salvaStato(stato);
  }
}

/** Offerta proposta da Claude, controllata: date valide e in ordine, sconto ragionevole. null se non è utilizzabile. */
function pulisciOfferta(o) {
  if (!o || typeof o !== 'object') return null;
  const oggi = oraRoma().data;
  const sconto = Math.round(Number(o.sconto));
  if (!(sconto >= 1 && sconto <= 50)) return null;
  if (![o.noleggi_dal, o.noleggi_al, o.mostra_al].every(eData)) return null;
  const mostra_dal = eData(o.mostra_dal) && o.mostra_dal > oggi ? o.mostra_dal : oggi;
  if (o.noleggi_al < o.noleggi_dal || o.mostra_al < mostra_dal) return null;
  return {
    motivo: String(o.motivo ?? ''), sconto, noleggi_dal: o.noleggi_dal, noleggi_al: o.noleggi_al, mostra_dal, mostra_al: o.mostra_al,
    nome: String(o.nome || 'Offerta evento').slice(0, 60), titolo_it: String(o.titolo_it ?? '').slice(0, 90), titolo_en: String(o.titolo_en ?? '').slice(0, 90),
  };
}

/** Legge i valori attuali della promo sul sito (src/data/promo.md). */
export function promoAttuale() {
  try {
    const fm = fs.readFileSync(PROMO, 'utf8').split(/^---\s*$/m)[1] ?? '';
    const v = (k) => (fm.match(new RegExp(`^${k}:\\s*"?([^"#\\n]*?)"?\\s*(#.*)?$`, 'm'))?.[1] ?? '').trim();
    return { attiva: /^(true|sì|si)$/.test(v('attiva')), nome: v('nome'), mostra_al: v('mostra_al').slice(0, 10) };
  } catch { return { attiva: false }; }
}

/** Scrive l'offerta in src/data/promo.md mantenendo commenti e campi che non conosce. */
export function scriviPromo(o) {
  let s = fs.readFileSync(PROMO, 'utf8');
  const valori = { attiva: true, nome: o.nome, sconto: o.sconto, mostra_dal: o.mostra_dal, mostra_al: o.mostra_al, noleggi_dal: o.noleggi_dal, noleggi_al: o.noleggi_al, titolo_it: o.titolo_it, titolo_en: o.titolo_en };
  for (const [k, v] of Object.entries(valori)) {
    const riga = `${k}: ${typeof v === 'string' ? JSON.stringify(v) : v}`;
    const re = new RegExp(`^${k}:[^\\n]*$`, 'm');
    if (re.test(s)) {
      s = s.replace(re, (vecchia) => riga + (vecchia.match(/\s+#[^"]*$/)?.[0] ?? ''));
    } else {
      // Campo mancante: va prima della riga "---" che chiude l'intestazione
      const fine = s.indexOf('\n---', 3);
      s = s.slice(0, fine) + `\n${riga}` + s.slice(fine);
    }
  }
  fs.writeFileSync(PROMO, s);
  fs.writeFileSync(path.join(AUTO, '.da-pubblicare'), 'promo');
}

const testoOfferta = (sp, o) => {
  const ora = promoAttuale();
  const oggi = oraRoma().data;
  return [
    `🏷 Proposta di offerta per «${sp.evento}»`,
    `−${o.sconto}% sui noleggi che iniziano dal ${dataIt(o.noleggi_dal)} al ${dataIt(o.noleggi_al, true)}`,
    `Banner sul sito dal ${dataIt(o.mostra_dal)} al ${dataIt(o.mostra_al)}: «${o.titolo_it}»`,
    o.motivo ? `Perché: ${o.motivo}` : '',
    ora.attiva && ora.mostra_al >= oggi ? `\n⚠️ C'è già una promo attiva («${ora.nome}», banner fino al ${dataIt(ora.mostra_al)}): attivando questa la sostituite.` : '',
    '',
    '❓ Il camper è libero in quei giorni? Controllate il calendario prima di confermare.',
    'Per cambiare sconto, date o testo rispondete a questo messaggio (es. "15% e noleggi dal 6 al 10").',
  ].filter(Boolean).join('\n');
};
const pulsantiOfferta = (codice) => ({ inline_keyboard: [
  [{ text: '✅ È libero: attiva l\'offerta', callback_data: `ofs:${codice}` }],
  [{ text: '📝 Solo il post', callback_data: `ofp:${codice}` }, { text: '❌ Annulla', callback_data: `ofn:${codice}` }],
] });

const chiudi = (sp, aggiunta) => telegram('editMessageText', { chat_id: chatId(), message_id: sp.messageId, text: `${sp.testo}\n\n${aggiunta}`, reply_markup: { inline_keyboard: [] }, ...senzaAnteprima }).catch(() => {});
const temaDa = (sp) => ({ titolo: sp.evento, luogo: sp.luogo, date: sp.date, dettagli: [sp.perche, sp.distanza].filter(Boolean).join(' '), fonte: sp.fonte });

/**
 * Pulsanti degli spunti e delle offerte. Restituisce false se il tap non è del radar.
 * @param {(text: string) => Promise<void>} rispondiTap conferma del tap (Telegram la accetta solo per pochi secondi)
 */
export async function tapRadar(stato, azione, codice, chi, rispondiTap) {
  if (!['spu', 'spo', 'spn', 'ofs', 'ofp', 'ofn'].includes(azione)) return false;
  const sp = (stato.spunti || []).find((s) => s.codice === codice);
  if (!sp || (azione.startsWith('sp') && sp.esito) || (azione.startsWith('of') && stato.offerta?.codice !== codice)) {
    await rispondiTap('Questo spunto è già stato gestito.');
    return true;
  }
  if (azione === 'spn') {
    sp.esito = 'no';
    await rispondiTap('Ok, lo salto.');
    await chiudi(sp, `⏭ Saltato da ${chi}.`);
  } else if (azione === 'spu') {
    sp.esito = 'bozza';
    salvaStato(stato);
    await rispondiTap('Preparo la bozza…');
    await chiudi(sp, `✍️ ${chi}: sì. Bozza in arrivo tra qualche minuto.`);
    await creaBozza({ tema: temaDa(sp) });
    Object.assign(stato, leggiStato());
  } else if (azione === 'spo') {
    sp.esito = 'offerta';
    await rispondiTap('Ecco la proposta di offerta.');
    await chiudi(sp, `🏷 ${chi}: sì, con offerta. Proposta qui sotto.`);
    const msg = await telegram('sendMessage', { chat_id: chatId(), text: testoOfferta(sp, sp.offerta), reply_markup: pulsantiOfferta(codice), reply_parameters: { message_id: sp.messageId } });
    stato.offerta = { codice, messageId: msg.message_id, proposta: sp.offerta };
  } else {
    const { proposta, messageId } = stato.offerta;
    const prima = testoOfferta(sp, proposta); // calcolato prima di scrivere la promo (altrimenti avviserebbe di sé stessa)
    const chiudiOfferta = (t) => telegram('editMessageText', { chat_id: chatId(), message_id: messageId, text: `${prima}\n\n${t}`, reply_markup: { inline_keyboard: [] } }).catch(() => {});
    stato.offerta = null;
    salvaStato(stato);
    if (azione === 'ofn') {
      await rispondiTap('Annullato.');
      await chiudiOfferta(`❌ Annullato da ${chi}: niente post e niente offerta.`);
    } else if (azione === 'ofp') {
      await rispondiTap('Preparo solo il post…');
      await chiudiOfferta(`📝 ${chi}: solo il post, senza offerta. Bozza in arrivo tra qualche minuto.`);
      await creaBozza({ tema: temaDa(sp) });
      Object.assign(stato, leggiStato());
    } else {
      await rispondiTap('Attivo l\'offerta…');
      scriviPromo(proposta);
      await chiudiOfferta(`✅ Offerta attivata da ${chi}: sul sito tra circa 3 minuti (la trovate anche nel pannello → Promozione). Bozza del post in arrivo.`);
      salvaStato(stato);
      await creaBozza({ tema: temaDa(sp), offerta: proposta });
      Object.assign(stato, leggiStato());
    }
  }
  return true;
}

/** Risposte agli spunti (indicazioni → bozza) e alla proposta di offerta (ritocco). false se non riguarda il radar. */
export async function rispostaRadar(stato, m, testo) {
  const id = m.reply_to_message?.message_id;
  if (!id) return false;

  if (stato.offerta && id === stato.offerta.messageId) {
    const sp = stato.spunti.find((s) => s.codice === stato.offerta.codice);
    controllaBudget(stato);
    const prima = spesaDelGiro();
    let nuova;
    try {
      nuova = await chiediClaude(`Oggi è ${oggiEsteso()}. Questa è una proposta di offerta per il noleggio di un camper, legata all'evento «${sp.evento}» (${sp.date}):\n\`\`\`json\n${JSON.stringify(stato.offerta.proposta, null, 2)}\n\`\`\`\nIl team chiede questa modifica: "${testo}".\nApplica la modifica e rispondi SOLO con il blocco \`\`\`json aggiornato, con gli stessi campi. Date in formato AAAA-MM-GG. Aggiorna anche titolo_it e titolo_en se citano lo sconto o le date. Se la richiesta cambia le date dei noleggi, il banner deve finire entro il giorno prima dell'inizio dei noleggi scontati, salvo diversa richiesta.`,
        { ricerche: 0, finta: () => ({ ...stato.offerta.proposta, sconto: 12 }) });
    } finally { registraSpesa(stato, prima); salvaStato(stato); }
    const pulita = pulisciOfferta(nuova);
    if (!pulita) {
      await scrivi('Non sono riuscito ad applicare la modifica (date o sconto non validi): riprovate con un\'indicazione più precisa.', { reply_parameters: { message_id: m.message_id } });
      return true;
    }
    await telegram('editMessageReplyMarkup', { chat_id: chatId(), message_id: stato.offerta.messageId, reply_markup: { inline_keyboard: [] } }).catch(() => {});
    const msg = await telegram('sendMessage', { chat_id: chatId(), text: `✏️ Proposta aggiornata\n\n${testoOfferta(sp, pulita)}`, reply_markup: pulsantiOfferta(sp.codice), reply_parameters: { message_id: m.message_id } });
    stato.offerta = { codice: sp.codice, messageId: msg.message_id, proposta: pulita };
    return true;
  }

  const sp = (stato.spunti || []).find((s) => s.messageId === id);
  if (!sp) return false;
  if (sp.esito) {
    await scrivi('Questo spunto è già stato gestito: per una bozza nuova scrivete /nuovo seguito dalle indicazioni.', { reply_parameters: { message_id: m.message_id } });
    return true;
  }
  sp.esito = 'bozza';
  salvaStato(stato);
  await chiudi(sp, `✍️ Indicazioni ricevute: bozza in arrivo tra qualche minuto.`);
  await creaBozza({ tema: temaDa(sp), indicazioni: testo });
  Object.assign(stato, leggiStato());
  return true;
}

function finti() {
  const d = (n) => piuGiorni(oraRoma().data, n);
  return {
    spunti: [
      { evento: 'Prova: Festival jazz', tipo: 'concerto', luogo: 'Matera', date: 'tra 3 settimane', inizio: d(21), fine: d(23), distanza: 'circa 1 ora di auto', perche: 'Tre sere di concerti nei Sassi.', fonte: 'https://example.org/jazz', offerta: { motivo: 'bassa stagione', sconto: 10, noleggi_dal: d(19), noleggi_al: d(23), mostra_dal: d(0), mostra_al: d(18), nome: 'Prova jazz', titolo_it: 'Jazz a Matera: −10% sul camper', titolo_en: 'Jazz in Matera: 10% off' } },
      { evento: 'Prova: Mostra d\'arte', tipo: 'arte', luogo: 'Lecce', date: 'tra 4 settimane', inizio: d(28), fine: d(60), distanza: 'circa 2 ore di auto', perche: 'Una grande mostra nel barocco.', fonte: 'https://example.org/mostra', offerta: null },
    ],
  };
}
