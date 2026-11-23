// Versione inglese degli articoli del Diario sempre allineata a quella italiana.
//
// L'articolo si modifica solo in italiano (pannello /admin, editor web o Mac). A ogni giro il bot confronta ogni
// <chiave>.it.md con il suo <chiave>.en.md:
//   - titolo, anteprima o testo italiano cambiati  → Claude traduce e riscrive il file inglese
//   - data, scadenza, nascosto, immagine cambiati   → copiati nel file inglese, senza Claude
//   - file italiano eliminato                       → eliminato anche quello inglese
// In più tiene aggiornati nel file italiano `stato` e `ordine`, che il pannello /admin usa per mostrare in cima gli
// articoli in vetrina e sotto quelli conclusi o archiviati, ognuno dal più recente.
// Il file inglese conserva in `origine` l'impronta del testo italiano da cui è stato tradotto: se non cambia, niente
// chiamate (e niente costi). Se una traduzione fallisce non si riprova finché l'italiano non cambia di nuovo.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, AUTO, chiediClaude, scrivi } from './lib.mjs';

const DIR = path.join(ROOT, 'src/content/diario');
const CONDIVISI = ['data', 'scadenza', 'nascosto', 'immagine', 'immagineAI', 'categoria'];
const oggiRoma = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }); // AAAA-MM-GG

/** Stato dell'articolo per il pannello e chiave di ordinamento (decrescente: prima i "1-" più recenti, poi i "0-"). */
export function statoArticolo(fm) {
  const scad = fm.scadenza ? data(fm.scadenza) : '';
  const stato = fm.nascosto === true ? '⚫ archiviato' : scad && scad < oggiRoma() ? '⚪ evento concluso' : '🟢 in vetrina';
  return { stato, ordine: `${stato.startsWith('🟢') ? 1 : 0}-${data(fm.data) || '0000-00-00'}` };
}

// ---------- front matter: lettura minima del YAML scritto dal bot e dal pannello ----------
function valore(grezzo) {
  const v = grezzo.trim();
  if (v === '' || v === '~' || v === 'null') return null;
  if (v === 'true' || v === 'false') return v === 'true';
  if (v.startsWith('"')) { try { return JSON.parse(v); } catch { return v.slice(1, -1); } }
  if (v.startsWith("'")) return v.slice(1, -1).replaceAll("''", "'");
  return v;
}

export function leggiArticolo(file) {
  const t = fs.readFileSync(file, 'utf8');
  const m = t.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, corpo: t };
  const fm = {};
  const righe = m[1].split(/\r?\n/);
  for (let i = 0; i < righe.length; i++) {
    const r = righe[i].match(/^([A-Za-z_][\w-]*):\s?(.*)$/);
    if (!r) continue;
    const [, k, v] = r;
    if (/^[|>][+-]?\s*$/.test(v.trim())) {
      // blocco su più righe (| oppure >): righe successive rientrate
      const blocco = [];
      while (i + 1 < righe.length && (/^\s+\S/.test(righe[i + 1]) || righe[i + 1].trim() === '')) blocco.push(righe[++i].replace(/^\s{2}/, ''));
      while (blocco.length && blocco[blocco.length - 1].trim() === '') blocco.pop();
      fm[k] = v.trim().startsWith('>') ? blocco.join(' ').replace(/\s+/g, ' ').trim() : blocco.join('\n');
    } else if (v.trim() === '' && i + 1 < righe.length && /^\s+\S/.test(righe[i + 1])) {
      // stringa "plain" spezzata su più righe
      const parti = [];
      while (i + 1 < righe.length && /^\s+\S/.test(righe[i + 1])) parti.push(righe[++i].trim());
      fm[k] = parti.join(' ');
    } else {
      fm[k] = valore(v);
    }
  }
  return { fm, corpo: m[2] };
}

const q = (v) => JSON.stringify(v); // una stringa JSON è anche una stringa YAML valida
const data = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 10));

export function scriviArticoloFile(file, fm, corpo) {
  const righe = ['---'];
  for (const [k, v] of Object.entries(fm)) {
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'boolean') righe.push(`${k}: ${v}`);
    else if (k === 'data' || k === 'scadenza') righe.push(`${k}: ${data(v)}`);
    else if (k === 'lingua') righe.push(`${k}: ${v}`);
    else righe.push(`${k}: ${q(String(v))}`);
  }
  righe.push('---', '', corpo.trim(), '');
  fs.writeFileSync(file, righe.join('\n'));
}

export const impronta = (fm, corpo) =>
  crypto.createHash('sha1').update(JSON.stringify([fm.titolo ?? '', fm.estratto ?? '', corpo.trim()])).digest('hex').slice(0, 12);

async function traduci(fm, corpo) {
  const prompt = [
    'Traduci in inglese questo articolo del blog di Mistralia, noleggio del camper "Kentucky" da Bari.',
    'Inglese naturale e scorrevole per turisti internazionali, stesso tono fresco e un po\' autoironico.',
    'Mantieni esattamente la struttura Markdown (titoli ##, elenchi, link) e i nomi propri (Kentucky, Mistralia, nomi di luoghi ed eventi).',
    'Non aggiungere e non togliere informazioni. Le date e i prezzi restano uguali.',
    '',
    'Rispondi SOLO con un blocco ```json con i campi "titolo", "estratto", "articolo".',
    '',
    '```json',
    JSON.stringify({ titolo: fm.titolo, estratto: fm.estratto, articolo: corpo.trim() }, null, 2),
    '```',
  ].join('\n');
  const r = await chiediClaude(prompt, {
    ricerche: 0,
    finta: () => ({ titolo: `[EN] ${fm.titolo}`, estratto: `[EN] ${fm.estratto}`, articolo: `[EN]\n\n${corpo.trim()}` }),
  });
  if (!r?.titolo || !r?.articolo) throw new Error('traduzione incompleta');
  return r;
}

/** Allinea tutte le versioni inglesi. Ritorna true se ha cambiato qualcosa (serve ripubblicare il sito). */
export async function allineaTraduzioni(stato) {
  if (!fs.existsSync(DIR)) return false;
  const file = fs.readdirSync(DIR);
  const chiavi = new Set(file.filter((f) => /\.(it|en)\.md$/.test(f)).map((f) => f.replace(/\.(it|en)\.md$/, '')));
  stato.traduzioniFallite ??= {};
  let cambiato = false;

  for (const chiave of chiavi) {
    if (chiave.startsWith('esempio')) continue;
    const fileIt = path.join(DIR, `${chiave}.it.md`);
    const fileEn = path.join(DIR, `${chiave}.en.md`);

    // Italiano eliminato → elimina anche l'inglese
    if (!fs.existsSync(fileIt)) {
      fs.rmSync(fileEn, { force: true });
      console.log(`Traduzioni: eliminato ${chiave}.en.md (non c'è più la versione italiana)`);
      cambiato = true;
      continue;
    }

    const it = leggiArticolo(fileIt);

    // Stato e ordine per il pannello (solo nel file italiano; non cambiano la traduzione)
    const so = statoArticolo(it.fm);
    if (it.fm.stato !== so.stato || it.fm.ordine !== so.ordine) {
      scriviArticoloFile(fileIt, { ...it.fm, stato: so.stato, ordine: so.ordine }, it.corpo);
      it.fm.stato = so.stato; it.fm.ordine = so.ordine;
      console.log(`Articoli: ${chiave} → ${so.stato}`);
    }

    const en = fs.existsSync(fileEn) ? leggiArticolo(fileEn) : { fm: {}, corpo: '' };
    const imp = impronta(it.fm, it.corpo);

    let fmEn = { ...en.fm };
    let corpoEn = en.corpo;
    let tocca = false;
    const esisteEn = fs.existsSync(fileEn);

    if (esisteEn && !en.fm.origine) {
      // Pubblicato prima di questo meccanismo: lo si considera già allineato e si salva solo l'impronta
      tocca = true;
    } else if (!esisteEn || en.fm.origine !== imp) {
      if (stato.traduzioniFallite[chiave] === imp) continue; // già fallita con questo testo: aspetta una nuova modifica
      try {
        const tr = await traduci(it.fm, it.corpo);
        fmEn = { ...fmEn, titolo: tr.titolo, estratto: tr.estratto };
        corpoEn = tr.articolo;
        delete stato.traduzioniFallite[chiave];
        await scrivi(`🌍 Versione inglese aggiornata: «${it.fm.titolo}»`).catch(() => {});
      } catch (e) {
        console.error(e);
        stato.traduzioniFallite[chiave] = imp;
        await scrivi(`⚠️ Non sono riuscito ad aggiornare la versione inglese di «${it.fm.titolo}»: ${String(e.message).slice(0, 200)}\nRiprovo alla prossima modifica dell'italiano.`).catch(() => {});
        continue;
      }
      tocca = true;
    }

    // Campi condivisi copiati dall'italiano
    for (const k of CONDIVISI) {
      const a = it.fm[k] ?? null, b = fmEn[k] ?? null;
      const norm = (v) => (k === 'data' || k === 'scadenza' ? (v ? data(v) : null) : v);
      if (norm(a) !== norm(b)) { fmEn[k] = a; tocca = true; }
    }

    if (tocca) {
      const ordinato = {
        titolo: fmEn.titolo ?? it.fm.titolo,
        data: fmEn.data ?? it.fm.data,
        lingua: 'en',
        chiave,
        immagine: fmEn.immagine ?? it.fm.immagine,
        estratto: fmEn.estratto ?? it.fm.estratto,
        immagineAI: fmEn.immagineAI ?? it.fm.immagineAI,
        scadenza: fmEn.scadenza ?? null,
        nascosto: fmEn.nascosto ?? null,
        origine: imp,
      };
      scriviArticoloFile(fileEn, ordinato, corpoEn);
      console.log(`Traduzioni: aggiornato ${chiave}.en.md`);
      cambiato = true;
    }
  }
  if (cambiato) fs.writeFileSync(path.join(AUTO, '.da-pubblicare'), 'traduzioni');
  return cambiato;
}
