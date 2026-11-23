// Funzioni comuni del post settimanale: Claude (testi), Gemini (immagini), Telegram, file di stato.
// Nessuna dipendenza esterna: Node 22 con fetch.
// PROVA=1 simula tutte le chiamate esterne (per provare il flusso senza chiavi).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const AUTO = path.join(ROOT, 'automazione');
export const PROVA = process.env.PROVA === '1';
export const config = JSON.parse(fs.readFileSync(path.join(AUTO, 'config.json'), 'utf8'));

const env = (k, def) => {
  const v = process.env[k];
  if (v) return v;
  if (def !== undefined) return def;
  if (PROVA) return 'prova';
  throw new Error(`Manca la variabile ${k}: aggiungila nei Secrets del repository (vedi automazione/README.md).`);
};

// ---------- stato ----------
const STATO = path.join(AUTO, 'stato.json');
export function leggiStato() {
  try { return JSON.parse(fs.readFileSync(STATO, 'utf8')); } catch { return {}; }
}
export function salvaStato(s) {
  fs.writeFileSync(STATO, JSON.stringify(s, null, 2) + '\n');
}

// ---------- utilità ----------
export const oggiISO = () => new Date().toISOString().slice(0, 10);
export function settimanaISO(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y) / 86400000 + 1) / 7);
}
/** Ora italiana: { data: 'AAAA-MM-GG', giorno: 1 (lunedì) … 7 (domenica), ora: 0–23 }. */
export function oraRoma(d = new Date()) {
  const r = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
  const data = `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, '0')}-${String(r.getDate()).padStart(2, '0')}`;
  return { data, giorno: r.getDay() || 7, ora: r.getHours(), r };
}
/** Oggi per esteso, per i prompt (es. "lunedì 23 novembre 2026"). */
export const oggiEsteso = () => new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' });
/** Data leggibile in italiano da AAAA-MM-GG (es. "12 dicembre"). */
export const dataIt = (iso, anno = false) => new Date(String(iso).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', ...(anno ? { year: 'numeric' } : {}) });
/** Codice corto (10 caratteri) per i pulsanti di Telegram, che accettano al massimo 64 byte. */
export const codiceCorto = (s) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 10);
/** Data AAAA-MM-GG valida? */
export const eData = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) && !isNaN(Date.parse(v));
/** Spende in modo controllato: errore se il budget del mese è finito. */
export function controllaBudget(stato) {
  const budget = config.budgetMensileDollari ?? 15;
  if (spesaDelMese(stato) >= budget) {
    throw new Error(`budget del mese raggiunto ($${spesaDelMese(stato).toFixed(2)} su $${budget}). Si riparte il mese prossimo, oppure alzate "budgetMensileDollari" in automazione/config.json.`);
  }
}
/** Aggiunge allo stato la spesa fatta da `prima` (valore di spesaDelGiro()) a ora. */
export function registraSpesa(stato, prima) {
  const costo = spesaDelGiro() - prima;
  if (costo > 0) stato.spesa = { mese: meseCorrente(), dollari: spesaDelMese(stato) + costo };
  return costo;
}

export const slug = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').slice(0, 60).replace(/^-+|-+$/g, '') || 'post';

/** Temi già pubblicati (dagli articoli del Diario) e già proposti (dallo stato). */
export function temiUsati(stato) {
  const dir = path.join(ROOT, 'src/content/diario');
  const pubblicati = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.it.md')).map((f) => {
        const t = fs.readFileSync(path.join(dir, f), 'utf8').match(/^titolo:\s*"?(.*?)"?\s*$/m);
        return t ? t[1] : f;
      })
    : [];
  const proposti = (stato.storico || []).map((x) => (x.luogo ? `${x.tema} (${x.luogo})` : x.tema));
  return [...new Set([...pubblicati, ...proposti])].slice(-config.temiDaEvitareUltimi);
}

// ---------- Claude ----------
// ---------- Spesa ----------
// Somma quanto costano le chiamate di questo giro (stima dai token restituiti dall'API).
let spesaGiro = 0;
export const spesaDelGiro = () => spesaGiro;
export const aggiungiSpesa = (dollari) => { spesaGiro += dollari; };
export const meseCorrente = () => new Date().toISOString().slice(0, 7);
export const spesaDelMese = (stato) => (stato.spesa?.mese === meseCorrente() ? stato.spesa.dollari : 0);

export async function chiediClaude(prompt, { ricerche = 3, finta = finto } = {}) {
  if (PROVA) {
    // PROVA_PROMPT=file: salva i prompt che verrebbero mandati a Claude, per controllarli
    if (process.env.PROVA_PROMPT) fs.appendFileSync(process.env.PROVA_PROMPT, `\n\n======== PROMPT (${ricerche} ricerche)\n${prompt}`);
    aggiungiSpesa(0.1);
    return finta();
  }
  const modello = env('ANTHROPIC_MODEL', config.modelloTesti);
  const messaggi = [{ role: 'user', content: prompt }];
  const tools = ricerche > 0 ? [{ type: 'web_search_20250305', name: 'web_search', max_uses: ricerche }] : undefined;

  // Una chiamata all'API, con 2 nuovi tentativi se il servizio è sovraccarico o risponde in modo illeggibile
  async function chiama() {
    for (let tentativo = 1; ; tentativo++) {
      const res = await fetch(`${process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'}/v1/messages`, {
        method: 'POST',
        headers: { 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: modello, max_tokens: 16000, ...(tools ? { tools } : {}), messages: messaggi }),
      });
      const grezzo = await res.text();
      let data = null;
      try { data = JSON.parse(grezzo); } catch { /* risposta vuota o non JSON: gestita sotto */ }
      const riprovabile = !data || [429, 500, 502, 503, 529].includes(res.status);
      if (res.ok && data) return data;
      if (riprovabile && tentativo < 3) {
        const attesa = tentativo * Number(process.env.ATTESA_MS || 20000);
        console.log(`Claude: risposta ${res.status} ${data ? '' : '(vuota o illeggibile)'}, nuovo tentativo tra ${Math.round(attesa / 1000)}s`);
        await new Promise((r) => setTimeout(r, attesa));
        continue;
      }
      throw new Error(`Claude: ${res.status} ${data ? JSON.stringify(data.error ?? data).slice(0, 300) : 'risposta vuota o non leggibile'}`);
    }
  }
  const conta = (data) => {
    const u = data.usage || {};
    const [pin, pout] = config.prezzi?.[modello] || [4, 20];
    const tokIn = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1;
    const nRicerche = u.server_tool_use?.web_search_requests || 0;
    const costo = (tokIn * pin + (u.output_tokens || 0) * pout) / 1e6 + nRicerche * (config.prezzi?.ricercaWeb ?? 0.01);
    aggiungiSpesa(costo);
    console.log(`Claude ${modello}: ${u.input_tokens} token in, ${u.output_tokens} out, ${nRicerche} ricerche, stop ${data.stop_reason} ≈ $${costo.toFixed(3)}`);
  };
  const estrai = (testo) => {
    const m = [...testo.matchAll(/```json\s*([\s\S]*?)```/g)].pop();
    const json = m ? m[1] : testo.includes('{') ? testo.slice(testo.indexOf('{'), testo.lastIndexOf('}') + 1) : '';
    try { return json ? JSON.parse(json) : null; } catch { return null; }
  };

  let testo = '';
  for (let giro = 1; giro <= 4; giro++) {
    const data = await chiama();
    conta(data);
    messaggi.push({ role: 'assistant', content: data.content });
    testo += data.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    // Con la ricerca web l'API può fermarsi a metà ("pause_turn"): si rimanda la conversazione così com'è per farla finire
    if (data.stop_reason === 'pause_turn') continue;
    const risultato = estrai(testo);
    if (risultato) return risultato;
    // Niente JSON valido (risposta troncata o solo testo): si chiede di ripetere soltanto il blocco JSON, senza nuove ricerche
    messaggi.push({ role: 'user', content: 'La risposta non contiene un blocco ```json completo e valido. Rispondi ora SOLO con il blocco ```json richiesto, completo, senza altro testo e senza nuove ricerche.' });
    testo = '';
  }
  throw new Error('Claude non ha restituito un JSON valido dopo 4 tentativi');
}

// ---------- Gemini ----------
export async function creaImmagine(istruzione, destinazione) {
  // Le prime due foto di riferimento che esistono: le copie delle foto vere (automazione/riferimento/), altrimenti la galleria
  const riferimenti = config.fotoRiferimento.map((p) => path.join(ROOT, p)).filter((p) => fs.existsSync(p)).slice(0, 2);
  if (PROVA) {
    fs.copyFileSync(riferimenti[0], destinazione);
    return destinazione;
  }
  const model = env('GEMINI_IMAGE_MODEL', config.modelloImmagini);
  const parts = [
    ...riferimenti.map((p) => ({ inline_data: { mime_type: 'image/jpeg', data: fs.readFileSync(p).toString('base64') } })),
    { text: `These photos show our rental campervan "Kentucky". ${istruzione} Keep the campervan exactly as in the photos. Landscape 3:2 image, photographic quality, no added text, no logos, no watermarks.` },
  ];
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': env('GEMINI_API_KEY'), 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini: ${res.status} ${JSON.stringify(data.error ?? data).slice(0, 400)}`);
  const img = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data);
  if (!img) throw new Error('Gemini non ha restituito un\'immagine: ' + JSON.stringify(data).slice(0, 300));
  const d = img.inlineData ?? img.inline_data;
  fs.writeFileSync(destinazione, Buffer.from(d.data, 'base64'));
  aggiungiSpesa(config.prezzi?.immagine ?? 0.07);
  return destinazione;
}

// ---------- Telegram ----------
const PROVA_LOG = path.join(AUTO, 'prova-telegram.log');
export async function telegram(metodo, campi = {}, file) {
  if (PROVA) {
    fs.appendFileSync(PROVA_LOG, `${metodo} ${JSON.stringify(campi)}${file ? ' +' + path.basename(file) : ''}\n`);
    if (metodo === 'getUpdates') {
      const f = path.join(AUTO, 'prova-updates.json');
      const u = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
      fs.rmSync(f, { force: true });
      return u;
    }
    return { message_id: Math.floor(Math.random() * 1e6) };
  }
  const url = `https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/${metodo}`;
  let res;
  if (file) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(campi)) fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    fd.append('photo', new Blob([fs.readFileSync(file)]), path.basename(file));
    res = await fetch(url, { method: 'POST', body: fd });
  } else {
    res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(campi) });
  }
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${metodo}: ${data.description}`);
  return data.result;
}
export const chatId = () => env('TELEGRAM_CHAT_ID');
export const scrivi = (text, extra = {}) => telegram('sendMessage', { chat_id: chatId(), text, ...extra });

// ---------- contenuto finto per PROVA=1 ----------
function finto() {
  const n = Date.now() % 1000;
  return {
    tema: `Prova ${n}: tramonto a Polignano`,
    luogo: 'Polignano a Mare',
    chiave: `prova-polignano-${n}`,
    titolo_it: 'Polignano a Mare in camper: il tramonto dalla scogliera',
    titolo_en: 'Polignano a Mare by campervan: sunset from the cliffs',
    estratto_it: 'Un weekend lento tra grotte e borgo bianco, a mezz\'ora da Bari.',
    estratto_en: 'A slow weekend of sea caves and a white town, half an hour from Bari.',
    articolo_it: '## Perché andarci\n\nTesto di prova.\n\n## Dove sostare\n\nArea sosta fuori dal centro.\n\nPrenota il Kentucky e parti.',
    articolo_en: '## Why go\n\nSample text.\n\n## Where to park\n\nCampervan area outside the centre.\n\nBook the Kentucky and go.',
    post_it: 'Il tramonto più bello della costa è a mezz\'ora da Bari. Il Kentucky ti aspetta con il pieno fatto. Prenota dal link in bio.',
    post_en: 'The best sunset on the coast is half an hour from Bari. Book the Kentucky from the link in bio.',
    tiktok: 'Tramonto a Polignano, a mezz\'ora da Bari 🚐',
    hashtag: ['puglia', 'camper', 'polignanoamare', 'vanlife', 'mistralia'],
    fonti: [],
    prompt_immagine: 'Place the campervan on a cliff road at sunset above the sea at Polignano a Mare.',
    rifai_immagine: true,
  };
}
