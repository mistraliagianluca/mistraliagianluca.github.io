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
  }),
});

export const collections = { diario };
