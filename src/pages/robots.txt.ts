import type { APIRoute } from 'astro';

// Боевой домен открыт для поиска; превью на GitHub Pages — закрыто целиком.
export const GET: APIRoute = ({ site }) => {
  const preview = !!site?.host.endsWith('github.io');
  const body = preview
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nDisallow: /api/\nDisallow: /thanks/\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', site).href}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
