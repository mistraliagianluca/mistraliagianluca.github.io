import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.mistralia.co',
  build: { assets: 'app' }, // niente cartelle che iniziano con "_": GitHub Pages le ignorerebbe
  i18n: {
    defaultLocale: 'it',
    locales: ['it', 'en'],
    routing: { prefixDefaultLocale: false },
  },
});
