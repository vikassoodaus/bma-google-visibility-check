const COUNTRY_SCOPES = [
  {
    keys: ['uk','u k','united kingdom','great britain','britain','uk wide','nationwide uk'],
    label: 'United Kingdom',
    aliases: ['uk','united kingdom','great britain','britain','british','england','scotland','wales','northern ireland']
  },
  {
    keys: ['australia','au','australia wide','nationwide australia'],
    label: 'Australia',
    aliases: ['australia','australian']
  },
  {
    keys: ['usa','us','u s','united states','united states of america','nationwide usa'],
    label: 'United States',
    aliases: ['usa','united states','united states of america','american']
  },
  {
    keys: ['canada','canada wide','nationwide canada'],
    label: 'Canada',
    aliases: ['canada','canadian']
  },
  {
    keys: ['new zealand','nz','n z','nationwide new zealand'],
    label: 'New Zealand',
    aliases: ['new zealand','new zealander']
  }
];

function clean(value='') {
  return String(value)
    .toLowerCase()
    .replace(/[–—-]/g,' ')
    .replace(/[^a-z0-9\s,]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

export function buildLocationScope(value='') {
  const raw = String(value || '').trim();
  const normalized = clean(raw).replace(/,/g,' ').replace(/\s+/g,' ').trim();

  for (const country of COUNTRY_SCOPES) {
    if (country.keys.includes(normalized)) {
      return {
        raw,
        type:'service-area',
        label:country.label,
        aliases:[...new Set(country.aliases)],
      };
    }
  }

  const aliases = [raw]
    .map((x)=>String(x).trim().toLowerCase())
    .filter(Boolean);

  return {
    raw,
    type:'local',
    label:raw,
    aliases,
  };
}

export function locationPhraseMatch(text='', scopeOrValue='') {
  const scope = typeof scopeOrValue === 'string'
    ? buildLocationScope(scopeOrValue)
    : scopeOrValue;

  const hay = String(text || '').toLowerCase().replace(/\s+/g,' ');

  for (const alias of scope.aliases || []) {
    const term = String(alias || '').trim().toLowerCase();
    if (!term) continue;

    // Preserve short but meaningful country aliases such as "UK".
    if (term.length <= 2) {
      const re = new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^a-z0-9]|$)`,'i');
      if (re.test(hay)) return true;
    } else if (hay.includes(term)) {
      return true;
    }
  }

  return false;
}
