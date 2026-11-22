import it from '../i18n/it.json';
import en from '../i18n/en.json';
import prezziFile from '../data/prezzi.json';
import info from '../data/info.json';
import * as promoFile from '../data/promo.md';

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

/** Percorso di un'immagine della galleria: accetta il percorso (/assets/gallery/x.jpg) o il vecchio numero (7). */
export const fotoGalleria = (v: string | number) => (typeof v === 'number' || /^\d+$/.test(String(v)) ? `/assets/gallery/${v}.jpg` : String(v));

export { prezzi, info };

/** Prezzo minimo al giorno, per il "da €X". */
export const prezzoMinimo = Math.min(...Object.values(prezzi.prezzoGiorno));

/** Data in formato leggibile. */
export function fmtDate(d: string | Date, lang: Lang) {
  const date = typeof d === 'string' ? new Date(d + 'T12:00:00') : d;
  return date.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
