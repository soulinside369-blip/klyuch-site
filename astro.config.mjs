import { defineConfig } from 'astro/config';

// Боевой домен — айтиключ.рф (куплен владельцем 26.10.2026). В URL — punycode, на экране — кириллица (brand.domain).
// GitHub Pages собирается со своими SITE_URL/BASE_PATH (.github/workflows/pages.yml) и закрыт от индексации.
export default defineConfig({
  site: process.env.SITE_URL || 'https://xn--80aqcff3bzb5c.xn--p1ai',
  base: process.env.BASE_PATH || '/',
  // Стили встраиваются в HTML: на мобильном это минус один блокирующий запрос (~0,7 с на 3G по Lighthouse).
  build: { inlineStylesheets: 'always' },
  compressHTML: true,
});
