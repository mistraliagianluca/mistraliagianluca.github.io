import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.mistralia.co',
  i18n: {
    defaultLocale: 'it',
    locales: ['it', 'en'],
    routing: { prefixDefaultLocale: false },
  },
});
