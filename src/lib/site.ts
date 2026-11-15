import it from '../i18n/it.json';
import en from '../i18n/en.json';
import prezzi from '../data/prezzi.json';
import info from '../data/info.json';
import * as promoFile from '../data/promo.md';

export type Lang = 'it' | 'en';
const dict: Record<Lang, Record<string, string>> = { it, en };

/** Testo tradotto, con segnaposto {nome} sostituiti. */
export function t(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  const s = dict[lang][key] ?? dict.it[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

/** Percorsi delle pagine nelle due lingue. */
export const paths = {
  home: (lang: Lang) => (lang === 'it' ? '/' : '/en/'),
  post: (lang: Lang, chiave: string) => (lang === 'it' ? `/diario/${chiave}/` : `/en/journal/${chiave}/`),
};

const iso = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ''));

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

export { prezzi, info };

/** Prezzo minimo al giorno, per il "da €X". */
export const prezzoMinimo = Math.min(...Object.values(prezzi.prezzoGiorno));

/** Data in formato leggibile. */
export function fmtDate(d: string | Date, lang: Lang) {
  const date = typeof d === 'string' ? new Date(d + 'T12:00:00') : d;
  return date.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
