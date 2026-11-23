import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Articoli del "Diario di bordo". Ogni articolo esiste in due file: .it.md e .en.md
// con la stessa "chiave". Li scrive l'automazione settimanale.
const diario = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/diario' }),
  schema: z.object({
    titolo: z.string(),
    data: z.coerce.date(),
    lingua: z.enum(['it', 'en']),
    chiave: z.string(),
    immagine: z.string(),
    estratto: z.string(),
    esempio: z.boolean().optional(),
    immagineAI: z.boolean().optional(),
    // Ultimo giorno dell'evento: dopo questa data l'articolo esce dalla home e la pagina mostra "evento concluso"
    scadenza: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.date().optional()),
    // true = articolo tolto dal sito (nessuna pagina, non in elenco), ma il file resta e si può ripristinare
    nascosto: z.boolean().optional(),
    // Tipo di articolo: offerta (legato a una promo, scade con la promo), evento (con date), idea di viaggio.
    // Se manca: evento se c'è una scadenza, altrimenti idea (vedi categoriaDi in src/lib/site.ts)
    categoria: z.enum(['offerta', 'evento', 'idea']).optional(),
  }),
});

export const collections = { diario };
