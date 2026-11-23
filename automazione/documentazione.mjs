// Documentazione sempre allineata al codice.
//
//   node automazione/documentazione.mjs                      rigenera docs/riferimento.md dai file veri
//   node automazione/documentazione.mjs --controlla A B      controlla che, se tra i commit A e B è cambiato
//                                                            codice o configurazione, sia stato aggiornato
//                                                            anche docs/registro-modifiche.md
//
// Lo lancia il workflow "Documentazione" a ogni push su main. Nessuna dipendenza esterna.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rel = (...p) => path.join(ROOT, ...p);
const leggi = (p) => fs.readFileSync(rel(p), 'utf8');

// File che, se cambiano, richiedono una riga nel registro delle modifiche.
// Esclusi i contenuti che il team modifica di routine (prezzi, promo, testi, foto, articoli) e lo stato del bot.
const RICHIEDONO_REGISTRO = [
  /^\.github\/workflows\//,
  /^automazione\/[^/]+\.(mjs|md|json)$/,
  /^src\/(components|layouts|lib|pages|styles)\//,
  /^src\/content\.config\.ts$/,
  /^astro\.config\.mjs$/,
  /^public\/admin\//,
  /^package\.json$/,
  /^\.gitignore$/,
];
const ESCLUSI = [/^automazione\/stato\.json$/, /^automazione\/README\.md$/];
const REGISTRO = 'docs/registro-modifiche.md';

function controlla(prima, dopo) {
  const vuoto = /^0+$/.test(prima || '');
  const cmd = vuoto ? `git show --name-only --pretty=format: ${dopo}` : `git diff --name-only ${prima} ${dopo}`;
  let cambiati;
  try {
    cambiati = execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    console.log('Non riesco a leggere i file cambiati: controllo saltato.');
    return 0;
  }
  const codice = cambiati.filter((f) => RICHIEDONO_REGISTRO.some((r) => r.test(f)) && !ESCLUSI.some((r) => r.test(f)));
  const riepilogo = process.env.GITHUB_STEP_SUMMARY;
  if (codice.length && !cambiati.includes(REGISTRO)) {
    const msg = [
      '## ❌ Documentazione non aggiornata',
      '',
      'Questo push cambia codice o configurazione ma non aggiunge una riga in `docs/registro-modifiche.md`.',
      'Aggiorna il registro (e le pagine di `docs/` che descrivono quello che hai cambiato), poi fai un nuovo push.',
      '',
      'File cambiati che lo richiedono:',
      ...codice.map((f) => `- \`${f}\``),
    ].join('\n');
    console.log(msg);
    if (riepilogo) fs.appendFileSync(riepilogo, msg + '\n');
    for (const f of codice) console.log(`::error file=${f}::Modifica non registrata in ${REGISTRO}`);
    return 1;
  }
  const ok = codice.length ? '## ✅ Documentazione aggiornata insieme al codice' : '## ✅ Nessuna modifica al codice da documentare';
  console.log(ok);
  if (riepilogo) fs.appendFileSync(riepilogo, ok + '\n');
  return 0;
}

// ---------- Generazione di docs/riferimento.md ----------

const ora = (cron) => {
  // Traduce le espressioni cron usate nel progetto in italiano (ore UTC → ora italiana d'inverno, +1)
  const [min, h, , , dow] = cron.split(/\s+/);
  const giorni = { '*': 'ogni giorno', '1': 'ogni lunedì', '1-5': 'dal lunedì al venerdì' }[dow] ?? `giorni ${dow}`;
  const piu1 = (x) => String((Number(x) + 1) % 24);
  let quando;
  if (/^\d+$/.test(h)) quando = `alle ${piu1(h)}:${min.padStart(2, '0')}`;
  else if (/^\d+-\d+$/.test(h)) {
    const [a, b] = h.split('-');
    const minuti = min.startsWith('*/') ? `ogni ${min.slice(2)} minuti` : `ai minuti ${min.replaceAll(',', ', ')}`;
    quando = `${minuti}, dalle ${piu1(a)} alle ${piu1(b)}:59`;
  } else quando = `cron ${cron}`;
  return `${giorni} ${quando}`;
};

function workflows() {
  const dir = rel('.github/workflows');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.yml')).sort().map((f) => {
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    const nome = (t.match(/^name:\s*(.+)$/m) || [, f])[1].trim();
    const descr = (t.match(/^#\s*(.+)$/m) || [, ''])[1].trim();
    const cron = [...t.matchAll(/cron:\s*'([^']+)'/g)].map((m) => m[1]);
    const avvii = [];
    if (/^\s{2}push:/m.test(t)) avvii.push('a ogni push su `main`' + (/paths-ignore/.test(t) ? ' (tranne i file esclusi)' : ''));
    for (const c of cron) avvii.push(`${ora(c)} (\`${c}\` UTC)`);
    if (/workflow_dispatch/.test(t)) avvii.push(cron.length && /secrets\.TELEGRAM/.test(t) ? 'a mano (Actions → Run workflow) o dalla sveglia esterna' : 'a mano: Actions → Run workflow');
    const secrets = [...new Set([...t.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]))];
    const vars = [...new Set([...t.matchAll(/vars\.([A-Z_]+)/g)].map((m) => m[1]))];
    const scrive = /contents:\s*write/.test(t);
    return { f, nome, descr, avvii, secrets, vars, scrive };
  });
}

function genera() {
  const wf = workflows();
  const config = JSON.parse(leggi('automazione/config.json'));
  // prezzi.json + coperture.json (piani, quota, extra), come li unisce il sito in src/lib/site.ts
  const prezzi = { ...JSON.parse(leggi('src/data/prezzi.json')), ...(fs.existsSync(rel('src/data/coperture.json')) ? JSON.parse(leggi('src/data/coperture.json')) : {}) };
  const promo = leggi('src/data/promo.md');
  const val = (k) => (promo.match(new RegExp(`^${k}:\\s*(.+?)\\s*(#.*)?$`, 'm')) || [, '—'])[1].replace(/^"|"$/g, '');
  const tuttiSecrets = [...new Set(wf.flatMap((w) => w.secrets))].sort();
  const tutteVars = [...new Set(wf.flatMap((w) => w.vars))].sort();
  const diario = fs.existsSync(rel('src/content/diario'))
    ? fs.readdirSync(rel('src/content/diario')).filter((f) => f.endsWith('.it.md') && !f.startsWith('esempio')).sort()
    : [];

  const righe = [
    '# Riferimento tecnico (generato automaticamente)',
    '',
    '> ⚙️ **Non modificare questo file a mano.** Lo rigenera il workflow *Documentazione* a ogni push, leggendo i file veri del progetto.',
    '> Se qualcosa qui è sbagliato, è sbagliato il file da cui viene: correggi quello.',
    '',
    `Ultimo aggiornamento: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    '',
    '## Workflow di GitHub Actions',
    '',
    '| Workflow | File | Quando parte | Segreti usati | Scrive nel repository |',
    '| --- | --- | --- | --- | --- |',
    ...wf.map((w) => `| **${w.nome}** | \`${w.f}\` | ${w.avvii.join('<br>')} | ${w.secrets.map((s) => `\`${s}\``).join(', ') || '—'} | ${w.scrive ? 'sì' : 'no'} |`),
    '',
    'Gli orari "ora italiana" sono quelli invernali; con l\'ora legale tutto parte un\'ora più tardi. GitHub può ritardare o saltare i giri programmati: vedi [Sveglia del bot](04-automazione.md#la-sveglia-del-bot).',
    '',
    '## Segreti e variabili che il codice si aspetta',
    '',
    'Si impostano in GitHub → Settings → Secrets and variables → Actions. Dettagli in [Sicurezza](05-sicurezza.md).',
    '',
    '| Nome | Tipo |',
    '| --- | --- |',
    ...tuttiSecrets.map((s) => `| \`${s}\` | Secret (riservato) |`),
    ...tutteVars.map((v) => `| \`${v}\` | Variable (facoltativa, sovrascrive \`config.json\`) |`),
    '',
    '## Impostazioni dell\'automazione (`automazione/config.json`)',
    '',
    '| Voce | Valore attuale |',
    '| --- | --- |',
    ...Object.entries(config).filter(([k]) => !k.startsWith('_')).map(([k, v]) => `| \`${k}\` | \`${JSON.stringify(v)}\` |`),
    '',
    '## Prezzi in vigore (`src/data/prezzi.json` e `coperture.json`)',
    '',
    `- Prezzo al giorno: bassa €${prezzi.prezzoGiorno.B} · media €${prezzi.prezzoGiorno.M} · alta €${prezzi.prezzoGiorno.A}`,
    `- Noleggio minimo: bassa ${prezzi.minimoGiorni.B} giorni · media ${prezzi.minimoGiorni.M} · alta ${prezzi.minimoGiorni.A}` +
      (prezzi.minimoEccezioni?.length ? ` · eccezioni: ${prezzi.minimoEccezioni.map((e) => `${e.dal}→${e.al}: ${e.giorni} giorni`).join('; ')}` : ''),
    `- Quota obbligatoria: €${prezzi.servizio.importo} (${prezzi.servizio.it})`,
    `- Extra: ${prezzi.extra.map((e) => `${e.it} €${e.importo}${e.unita && e.unita !== 'noleggio' ? ' a ' + e.unita : ''}`).join(' · ')}`,
    `- Piani: ${prezzi.piani.map((p) => `${p.id} +€${p.supplementoGiorno}/giorno, cauzione €${p.cauzione}`).join(' · ')}`,
    '',
    '| Dal | Al | Stagione |',
    '| --- | --- | --- |',
    ...(prezzi.periodi || []).map((x) => `| ${x.dal} | ${x.al} | ${{ B: 'bassa', M: 'media', A: 'alta' }[x.stagione] ?? x.stagione} |`),
    '',
    '## Promo (`src/data/promo.md`)',
    '',
    `- Attiva: **${val('attiva')}** · ${val('nome')} −${val('sconto')}% · banner dal ${val('mostra_dal')} al ${val('mostra_al')} · noleggi dal ${val('noleggi_dal')} al ${val('noleggi_al')}`,
    '',
    '## Articoli pubblicati nel Diario',
    '',
    ...(diario.length
      ? ['| Articolo | Tipo | Pubblicato | Fine evento/offerta | Stato |', '| --- | --- | --- | --- | --- |', ...diario.map((f) => {
          const t = fs.readFileSync(rel('src/content/diario', f), 'utf8');
          const v = (k) => (t.match(new RegExp(`^${k}:\\s*"?([^"\\n]*)"?`, 'm')) || [, ''])[1].trim();
          const oggi = new Date().toISOString().slice(0, 10);
          const stato = v('nascosto') === 'true' ? 'archiviato' : v('scadenza') && v('scadenza') < oggi ? 'evento concluso' : 'in vetrina';
          const tipo = v('categoria') || (v('scadenza') ? 'evento' : 'idea');
          return `| \`${f.replace('.it.md', '')}\` | ${tipo} | ${v('data') || '—'} | ${v('scadenza') || '—'} | ${stato} |`;
        })]
      : ['Nessuno.']),
    '',
    '## Struttura del repository',
    '',
    '```',
    ...albero(),
    '```',
    '',
  ];
  fs.mkdirSync(rel('docs'), { recursive: true });
  fs.writeFileSync(rel('docs/riferimento.md'), righe.join('\n'));
  console.log('docs/riferimento.md aggiornato.');
}

function albero() {
  const nascondi = new Set(['node_modules', 'dist', '.astro', '.git']);
  const riassumi = new Set(['public/assets/gallery', 'public/assets/diario', 'automazione/bozze', 'src/content/diario']);
  const out = [];
  const giro = (dir, pref) => {
    const voci = fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => !d.name.startsWith('.') || ['.github', '.gitignore'].includes(d.name))
      .filter((d) => !nascondi.has(d.name))
      .filter((d) => !['.DS_Store', '.gitkeep', 'package-lock.json', 'prova-telegram.log', 'prova-updates.json'].includes(d.name))
      .sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name));
    voci.forEach((d, i) => {
      const ultimo = i === voci.length - 1;
      const p = path.join(dir, d.name);
      const r = path.relative(ROOT, p);
      const nota = d.isDirectory() && riassumi.has(r) ? '/ …' : d.isDirectory() ? '/' : '';
      out.push(`${pref}${ultimo ? '└── ' : '├── '}${d.name}${nota}`);
      if (d.isDirectory() && !riassumi.has(r)) giro(p, pref + (ultimo ? '    ' : '│   '));
    });
  };
  giro(ROOT, '');
  return out;
}

const [, , cmd, a, b] = process.argv;
if (cmd === '--controlla') process.exit(controlla(a, b));
genera();
