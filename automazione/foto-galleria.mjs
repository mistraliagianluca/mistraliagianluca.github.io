// Rifà le foto della galleria con Gemini: esterni ambientati in Puglia, interni solo con luce e colori migliori.
// Da lanciare UNA volta sul Mac (non da GitHub), con la chiave Gemini solo nella sessione del Terminale:
//
//   read -s GEMINI_API_KEY && export GEMINI_API_KEY      (incolla la chiave e premi invio: non si vede e non resta salvata)
//   node automazione/foto-galleria.mjs                    tutte le foto della galleria
//   node automazione/foto-galleria.mjs 3 7 12             solo alcune (per rifare quelle venute male)
//
// Le foto vengono SOVRASCRITTE (stesso nome, quindi la galleria non cambia) e ridotte per il web con `sips` del Mac:
// lato lungo 1600 px, JPG qualità 80. Prima di tutto salva una copia di 1.jpg e 2.jpg in automazione/riferimento/:
// sono le foto vere del camper che Gemini usa come riferimento per le immagini dei post.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { ROOT, config } from './lib.mjs';

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('Manca la chiave: lancia prima  read -s GEMINI_API_KEY && export GEMINI_API_KEY'); process.exit(1); }
const MODELLO = process.env.GEMINI_IMAGE_MODEL || config.modelloImmagini;
const GALLERIA = path.join(ROOT, 'public/assets/gallery');

// Ambientazioni pugliesi a rotazione, così le foto non sono tutte uguali
const AMBIENTI = [
  'an ancient olive grove with dry-stone walls (muretti a secco) in warm late-afternoon light, Puglia',
  'the Adriatic coast of Puglia near Polignano a Mare: limestone cliffs and turquoise sea, clear sky',
  'the Itria Valley with white trulli of Alberobello among vineyards and olive trees, golden hour',
  'a whitewashed Apulian masseria with prickly pears and a stone courtyard, bright Mediterranean light',
  'a Salento beach with pale sand, low Mediterranean scrub and crystal-clear water, morning light',
  'a quiet country road between olive trees and red earth fields in Puglia, soft sunset',
  'a viewpoint below the white hill town of Ostuni, blue sky with a few clouds',
  'a pine forest by the sea with dunes, Gargano coast, Puglia, warm natural light',
];

const istruzioni = (ambiente) => `This is a real photo of our rental campervan "Kentucky" (or of its interior).
If the photo shows the OUTSIDE of the campervan:
- keep the campervan EXACTLY as it is: same shape, colours, decals, writing, wheels, windows, wear and details, same angle, size and position in the frame;
- replace only the surroundings and the sky with ${ambiente};
- everything visible THROUGH the windows, windscreen or an open door must show the same new surroundings, coherent in perspective and light (no leftover parking lots, buildings or old backgrounds, no smeared or distorted areas); reflections on the bodywork and glass must match the new scene;
- consistent light and realistic shadows under the vehicle; it must look like a real photograph, not a rendering.
If the photo shows the INSIDE of the campervan:
- do not add, remove or move anything inside; only improve exposure, white balance and colour so it looks bright and inviting;
- REMOVE whatever is visible through the windows, the windscreen and the skylights (parked vehicles, buildings, car parks): replace it with bright, overexposed, soft white daylight, exactly like a professional interior photo exposed for the inside. No landscape, no objects, no shapes outside: just clean bright light gently spilling into the room;
- keep curtains, window frames, mirrors and everything inside exactly as they are.
In both cases: vibrant but natural colours, sharp, no text, no logos, no watermarks, landscape orientation.`;

async function rifai(file, i) {
  const src = path.join(GALLERIA, file);
  const tipo = file.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELLO}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: tipo, data: fs.readFileSync(src).toString('base64') } }, { text: istruzioni(AMBIENTI[i % AMBIENTI.length]) }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${JSON.stringify(data.error ?? data).slice(0, 300)}`);
  const img = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data);
  if (!img) throw new Error('Gemini non ha restituito un\'immagine');
  const d = img.inlineData ?? img.inline_data;
  const tmp = path.join(os.tmpdir(), `mistralia-${Date.now()}.${(d.mimeType ?? d.mime_type ?? '').includes('png') ? 'png' : 'jpg'}`);
  fs.writeFileSync(tmp, Buffer.from(d.data, 'base64'));
  try {
    // Mac: ridimensiona e comprime in un colpo solo
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', '-Z', '1600', tmp, '--out', src], { stdio: 'ignore' });
  } catch {
    fs.copyFileSync(tmp, src); // senza sips (non Mac) la foto resta alla dimensione data da Gemini
  }
  fs.rmSync(tmp, { force: true });
  return Math.round(fs.statSync(src).size / 1024);
}

// Copia di sicurezza delle foto di riferimento per i post (una volta sola)
const RIF = path.join(ROOT, 'automazione/riferimento');
fs.mkdirSync(RIF, { recursive: true });
for (const n of [1, 2]) {
  const dest = path.join(RIF, `kentucky-${n}.jpg`);
  if (!fs.existsSync(dest) && fs.existsSync(path.join(GALLERIA, `${n}.jpg`))) fs.copyFileSync(path.join(GALLERIA, `${n}.jpg`), dest);
}

const info = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/info.json'), 'utf8'));
const tutte = info.galleria.map((v) => String(v).split('/').pop()).map((f) => (/^\d+$/.test(f) ? `${f}.jpg` : f));
const scelte = process.argv.slice(2);
const daFare = scelte.length ? tutte.filter((f) => scelte.includes(f.replace(/\.\w+$/, ''))) : tutte;

console.log(`Modello ${MODELLO} · ${daFare.length} foto · circa $${(daFare.length * 0.07).toFixed(2)}`);
const fallite = [];
for (const [i, f] of daFare.entries()) {
  process.stdout.write(`${i + 1}/${daFare.length}  ${f} … `);
  try { console.log(`ok (${await rifai(f, tutte.indexOf(f))} KB)`); }
  catch (e) { console.log(`ERRORE: ${e.message}`); fallite.push(f.replace(/\.\w+$/, '')); }
}
console.log(fallite.length ? `\nDa rifare: node automazione/foto-galleria.mjs ${fallite.join(' ')}` : '\nFatto. Guarda le foto in public/assets/gallery/ prima del commit.');
