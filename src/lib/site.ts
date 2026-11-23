import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import it from '../i18n/it.json';
import en from '../i18n/en.json';
import * as promoFile from '../data/promo.md';

/**
 * Dati del sito, divisi in più file per avere nel pannello /admin una sezione per argomento:
 *   prezzi.json (prezzi, stagioni, minimi, km) + coperture.json (piani, quota, extra) → `prezzi`
 *   info.json (contatti, ritiro, calendario, azienda) + foto.json + bordo.json (kit, preparazione, riconsegna, regole)
 *   + faq.json → `info`
 * Un file mancante vale come vuoto: così il sito funziona anche con i dati di prima della divisione (tutto in info.json e prezzi.json).
 */
const dati = import.meta.glob('../data/*.json', { eager: true, import: 'default' }) as Record<string, any>;
const file = (nome: string): any => dati[`../data/${nome}.json`] ?? {};
// FAQ: nel pannello ogni domanda ha 4 campi (domanda, risposta, question, answer); il sito le usa come { it: [d, r], en: [d, r] }
type Faq = { it: [string, string]; en: [string, string] };
const faq: Faq[] = (file('faq').faq ?? file('info').faq ?? []).map((f: any) =>
  f.it ? f : { it: [f.domanda ?? '', f.risposta ?? ''], en: [f.question ?? '', f.answer ?? ''] });
const info: any = { ...file('info'), ...file('foto'), ...file('bordo'), faq };
const prezziFile: any = { ...file('prezzi'), ...file('coperture') };

export type Lang = 'it' | 'en';
const dict: Record<Lang, Record<string, string>> = { it, en };

/** Testo tradotto, con segnaposto {nome} sostituiti. */
export function t(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  const s = dict[lang][key] ?? dict.it[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

/** Prefisso del sito: '' in produzione, '/new' per l'anteprima in sottocartella. */
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
/** Aggiunge il prefisso a un percorso interno che inizia con '/'. */
export const u = (path: string) => (path.startsWith('/') ? BASE + path : path);

/** Percorsi delle pagine nelle due lingue. */
export const paths = {
  home: (lang: Lang) => u(lang === 'it' ? '/' : '/en/'),
  post: (lang: Lang, chiave: string) => u(lang === 'it' ? `/diario/${chiave}/` : `/en/journal/${chiave}/`),
  diario: (lang: Lang) => u(lang === 'it' ? '/diario/' : '/en/journal/'),
};

// Data come AAAA-MM-GG. Il pannello /admin salva le date senza virgolette e il sito le riceve come
// "2026-11-22T00:00:00.000Z": senza il taglio a 10 caratteri il banner resterebbe nascosto il primo giorno.
const iso = (v: unknown) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = String(v ?? '').match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : '';
};

/** Promo letta da src/data/promo.md, con date normalizzate (AAAA-MM-GG). */
export function getPromo() {
  const f = (promoFile as any).frontmatter ?? {};
  return {
    attiva: f.attiva === true || f.attiva === 'sì' || f.attiva === 'si',
    nome: String(f.nome ?? ''),
    sconto: Number(f.sconto ?? 0),
    mostraDal: iso(f.mostra_dal),
    mostraAl: iso(f.mostra_al),
    noleggiDal: iso(f.noleggi_dal),
    noleggiAl: iso(f.noleggi_al),
    titolo: { it: String(f.titolo_it ?? ''), en: String(f.titolo_en ?? '') },
  };
}

/**
 * Le stagioni si scrivono come periodi (dal, al, stagione) in prezzi.json, comodi da modificare nel pannello /admin.
 * Il sito lavora con una lettera per giorno, divisa per anno e mese ({ "2027": { "03": "BBB…AAA" } }):
 * qui i periodi vengono trasformati in quel formato. I giorni non coperti valgono "M".
 */
function stagioniDaPeriodi(periodi: { dal: string; al: string; stagione: string }[] = []) {
  const out: Record<string, Record<string, string[]>> = {};
  for (const p of periodi) {
    const fine = new Date(String(p.al).slice(0, 10) + 'T12:00:00Z');
    for (let d = new Date(String(p.dal).slice(0, 10) + 'T12:00:00Z'); d <= fine; d.setUTCDate(d.getUTCDate() + 1)) {
      const y = String(d.getUTCFullYear()), m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const giorni = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      out[y] ??= {};
      out[y][m] ??= Array(giorni).fill('M');
      out[y][m][d.getUTCDate() - 1] = p.stagione;
    }
  }
  return Object.fromEntries(Object.entries(out).map(([y, mesi]) => [y, Object.fromEntries(Object.entries(mesi).map(([m, g]) => [m, g.join('')]))]));
}

const prezzi = { ...prezziFile, stagioni: stagioniDaPeriodi((prezziFile as any).periodi) };

/** Data AAAA-MM-GG (o stringa vuota) per gli attributi letti dal browser. */
export const isoData = (v: unknown) => (v ? iso(v) : '');

/**
 * Aggiunge all'indirizzo di un'immagine una "versione" calcolata dal contenuto del file (es. 7.jpg?v=3fa2c1d0).
 * Se la foto viene sostituita con lo stesso nome, la versione cambia e browser e GitHub Pages scaricano quella nuova
 * invece di mostrare la copia vecchia che hanno in memoria.
 */
export function versionata(src: string) {
  if (!src.startsWith('/')) return src;
  const file = path.join(process.cwd(), 'public', decodeURIComponent(src.split('?')[0]));
  try {
    const v = createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
    return `${src}?v=${v}`;
  } catch {
    return src;
  }
}

/** Percorso di un'immagine della galleria: accetta il percorso (/assets/gallery/x.jpg) o il vecchio numero (7). */
export const fotoGalleria = (v: string | number) => (typeof v === 'number' || /^\d+$/.test(String(v)) ? `/assets/gallery/${v}.jpg` : String(v));

export { prezzi, info };

/** Prezzo minimo al giorno, per il "da €X". */
export const prezzoMinimo = Math.min(...(Object.values(prezzi.prezzoGiorno) as number[]));

/** Data in formato leggibile. */
export function fmtDate(d: string | Date, lang: Lang) {
  const date = typeof d === 'string' ? new Date(d + 'T12:00:00') : d;
  return date.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export type Categoria = 'offerta' | 'evento' | 'idea';
export const CATEGORIE: Categoria[] = ['offerta', 'evento', 'idea'];
export const ICONE_CATEGORIA: Record<Categoria, string> = { offerta: '🏷', evento: '📅', idea: '🧭' };
/** Categoria di un articolo del Diario: quella scritta nel file, altrimenti evento (se ha una scadenza) o idea. */
export const categoriaDi = (d: { categoria?: string; scadenza?: unknown }): Categoria =>
  CATEGORIE.includes(d.categoria as Categoria) ? (d.categoria as Categoria) : d.scadenza ? 'evento' : 'idea';

/**
 * Articolo collegato alla promo del momento: un articolo "offerta" che scade con il banner (scadenza = mostra_al),
 * altrimenti l'articolo "offerta" più recente ancora valido all'inizio della promo. undefined se non c'è.
 */
export function articoloPromo<T extends { data: { categoria?: string; scadenza?: Date; data: Date } }>(posts: T[]) {
  const p = getPromo();
  if (!p.attiva) return undefined;
  const offerte = posts.filter((x) => categoriaDi(x.data) === 'offerta').sort((a, b) => b.data.data.getTime() - a.data.data.getTime());
  return offerte.find((x) => iso(x.data.scadenza) === p.mostraAl) ?? offerte.find((x) => x.data.scadenza && iso(x.data.scadenza) >= (p.mostraDal || '0'));
}
