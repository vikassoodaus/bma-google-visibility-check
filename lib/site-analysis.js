import * as cheerio from 'cheerio';
import { buildLocationScope, locationPhraseMatch, locationMatchStrength } from './location-scope.js';

function clean(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function host(value = '') {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}


function schemaTypes($) {
  const out = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      const visit = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) return obj.forEach(visit);
        const t = obj['@type'];
        if (Array.isArray(t)) out.push(...t.map(String));
        else if (t) out.push(String(t));
        if (obj['@graph']) visit(obj['@graph']);
      };
      visit(parsed);
    } catch {}
  });
  return [...new Set(out)];
}

export function analyseLocalPage(html, pageUrl, location = '') {
  const scope = typeof location === 'string' ? buildLocationScope(location) : location;
  const $ = cheerio.load(html || '');
  const url = new URL(pageUrl);
  const bodyText = clean($('body').text());
  const title = clean($('title').first().text());
  const metaDescription = clean($('meta[name="description"]').attr('content') || '');
  const h1 = clean($('h1').first().text());
  const robots = clean($('meta[name="robots"]').attr('content') || '').toLowerCase();
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const viewport = Boolean($('meta[name="viewport"]').attr('content'));
  const schema = schemaTypes($);

  const links = $('a[href]').toArray().map((el) => {
    const href = $(el).attr('href') || '';
    let absolute = '';
    try { absolute = new URL(href, url).toString(); } catch {}
    return { href, absolute, text: clean($(el).text()) };
  });

  const internalLinks = links.filter((l) => {
    try { return host(l.absolute) === host(url.toString()); } catch { return false; }
  });

  const paths = internalLinks.map((l) => `${new URL(l.absolute).pathname} ${l.text}`.toLowerCase());
  const hasPath = (re) => paths.some((x) => re.test(x));
  const htmlLower = String(html || '').toLowerCase();

  const ga4 = /G-[A-Z0-9]{6,}/i.test(html) || /googletagmanager\.com\/gtag/i.test(html);
  const gtm = /GTM-[A-Z0-9]+/i.test(html);
  const googleAds = /AW-[0-9]+/i.test(html);
  const directContact = links.some((l) => /^(tel:|mailto:)/i.test(l.href)) || /wa\.me|whatsapp|calendly|booking/i.test(html);
  const formPresent = $('form').length > 0 || /widget\/form|hubspot|gravityforms|typeform|jotform|leadconnector|highlevel/i.test(html);
  const cta = /book|call|contact|enquir|quote|schedule|appointment|get started|talk to|buy|shop/i.test(bodyText);

  return {
    url: url.toString(),
    title,
    metaDescription,
    h1,
    robots,
    canonical,
    viewport,
    bodyText,
    internalLinks,
    schemaTypes: schema,
    localBusinessSchema: schema.some((t) => /LocalBusiness|ProfessionalService|Store|Restaurant|Dentist|MedicalBusiness|RealEstateAgent|LegalService|HomeAndConstructionBusiness/i.test(t)),
    organizationSchema: schema.some((t) => /Organization/i.test(t)),
    locationInTitle: locationPhraseMatch(title, scope),
    locationTitleStrength: locationMatchStrength(title, scope),
    locationInMeta: locationPhraseMatch(metaDescription, scope),
    locationMetaStrength: locationMatchStrength(metaDescription, scope),
    locationInH1: locationPhraseMatch(h1, scope),
    locationH1Strength: locationMatchStrength(h1, scope),
    locationInBody: locationPhraseMatch(bodyText, scope),
    locationBodyStrength: locationMatchStrength(bodyText, scope),
    locationScopeType: scope.type,
    locationScopeLabel: scope.label,
    locationBroadLabel: scope.broadLabel || '',
    contactPath: hasPath(/contact|enquir|quote/),
    locationPath: hasPath(/location|areas?-we-serve|service-area|suburb|locations/),
    servicePath: hasPath(/service|solution|program|what-we-do/),
    phoneLink: links.some((l) => /^tel:/i.test(l.href)),
    emailLink: links.some((l) => /^mailto:/i.test(l.href)),
    addressLike: /\b(street|st\.|road|rd\.|avenue|ave\.|drive|dr\.|lane|ln\.|boulevard|blvd|suite|level|vic|victoria|nsw|queensland|australia|california|florida|texas|united states|uk|united kingdom)\b/i.test(bodyText),
    ga4,
    gtm,
    googleAds,
    directContact,
    formPresent,
    cta,
    noindex: /\bnoindex\b/i.test(robots),
  };
}

export function chooseLocalPages(home, limit = 3) {
  const seen = new Set();
  const candidates = [];
  const rules = [
    { re:/contact|enquir|quote/i, score:100, reason:'contact' },
    { re:/location|areas?-we-serve|service-area|suburb|locations/i, score:95, reason:'location / service area' },
    { re:/service|solution|program|what-we-do/i, score:85, reason:'service' },
    { re:/about|team|our-story/i, score:70, reason:'about' },
  ];

  for (const link of home.internalLinks || []) {
    if (!link.absolute || seen.has(link.absolute)) continue;
    let path = '';
    try { path = `${new URL(link.absolute).pathname} ${link.text}`; } catch { continue; }
    for (const rule of rules) {
      if (rule.re.test(path)) {
        candidates.push({ url:link.absolute, score:rule.score, reason:rule.reason });
        seen.add(link.absolute);
        break;
      }
    }
  }

  return candidates.sort((a,b)=>b.score-a.score).slice(0,limit);
}
