import { safeFetch } from './fetch-site.js';

export async function inspectSearchFiles(homeUrl) {
  const base = new URL(homeUrl);
  let robotsVerified = false;
  let robotsText = '';
  let sitemapFound = false;
  let sitemapUrl = '';

  try {
    const r = await safeFetch(new URL('/robots.txt', base), { timeoutMs:5000, maxBytes:200000 });
    if (r.response.status && ![401,403,429].includes(r.response.status)) robotsVerified = true;
    if (r.response.ok) robotsText = r.body || '';
  } catch {}

  const declared = [...robotsText.matchAll(/^\s*Sitemap:\s*(\S+)/gim)].map((m)=>m[1]);
  const candidates = [...new Set([
    ...declared,
    new URL('/sitemap.xml', base).toString(),
    new URL('/sitemap_index.xml', base).toString(),
  ])].slice(0,5);

  for (const candidate of candidates) {
    try {
      const r = await safeFetch(candidate, { timeoutMs:5000, maxBytes:500000 });
      if (r.response.ok && /<urlset\b|<sitemapindex\b/i.test(r.body || '')) {
        sitemapFound = true;
        sitemapUrl = r.finalUrl.toString();
        break;
      }
    } catch {}
  }

  return { robotsVerified, robotsText, sitemapFound, sitemapUrl };
}
