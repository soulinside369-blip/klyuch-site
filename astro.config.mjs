import { defineConfig } from 'astro/config';

// SITE_URL и BASE_PATH задаются при сборке для GitHub Pages (см. .github/workflows/pages.yml).
// Для своего домена: SITE_URL=https://домен.ru, BASE_PATH не задавать.
export default defineConfig({
  site: process.env.SITE_URL || 'https://klyuch.example',
  base: process.env.BASE_PATH || '/',
  build: { inlineStylesheets: 'auto' },
  compressHTML: true,
});
