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

const AU_REGIONS = [
  { codes:['vic','victoria'], label:'Victoria', aliases:['vic','victoria'], country:['australia','australian'] },
  { codes:['nsw','new south wales'], label:'New South Wales', aliases:['nsw','new south wales'], country:['australia','australian'] },
  { codes:['qld','queensland'], label:'Queensland', aliases:['qld','queensland'], country:['australia','australian'] },
  { codes:['sa','south australia'], label:'South Australia', aliases:['sa','south australia'], country:['australia','australian'] },
  { codes:['wa','western australia'], label:'Western Australia', aliases:['wa','western australia'], country:['australia','australian'] },
  { codes:['tas','tasmania'], label:'Tasmania', aliases:['tas','tasmania'], country:['australia','australian'] },
  { codes:['act','australian capital territory'], label:'Australian Capital Territory', aliases:['act','australian capital territory'], country:['australia','australian'] },
  { codes:['nt','northern territory'], label:'Northern Territory', aliases:['nt','northern territory'], country:['australia','australian'] },
];

const US_REGIONS = [
  { codes:['ca','california'], label:'California', aliases:['ca','california'], country:['usa','united states','united states of america'] },
  { codes:['ny','new york'], label:'New York', aliases:['ny','new york'], country:['usa','united states','united states of america'] },
  { codes:['tx','texas'], label:'Texas', aliases:['tx','texas'], country:['usa','united states','united states of america'] },
  { codes:['fl','florida'], label:'Florida', aliases:['fl','florida'], country:['usa','united states','united states of america'] },
];

function clean(value='') {
  return String(value)
    .toLowerCase()
    .replace(/[–—-]/g,' ')
    .replace(/[^a-z0-9\s,]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function unique(values=[]) {
  return [...new Set(values.map((v)=>String(v||'').trim().toLowerCase()).filter(Boolean))];
}

function shortBoundaryMatch(hay, term) {
  const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`,'i');
  return re.test(hay);
}

function aliasMatch(text='', aliases=[]) {
  const hay=String(text||'').toLowerCase().replace(/\s+/g,' ');
  for (const alias of aliases) {
    const term=String(alias||'').trim().toLowerCase();
    if (!term) continue;
    if (term.length<=3) {
      if (shortBoundaryMatch(hay,term)) return true;
    } else if (hay.includes(term)) {
      return true;
    }
  }
  return false;
}

export function buildLocationScope(value='') {
  const raw=String(value||'').trim();
  const normalized=clean(raw).replace(/,/g,' ').replace(/\s+/g,' ').trim();

  for (const country of COUNTRY_SCOPES) {
    if (country.keys.includes(normalized)) {
      return {
        raw,
        type:'service-area',
        label:country.label,
        aliases:unique(country.aliases),
        exactAliases:unique(country.aliases),
        broadAliases:[],
        broadLabel:'',
      };
    }
  }

  // Split a local input such as "Casey City, VIC" into the specific place
  // and broader region. The specific place earns full relevance credit;
  // state/country signals can earn partial credit only.
  const parts=raw.split(',').map((x)=>clean(x)).filter(Boolean);
  const primary=parts[0] || normalized;
  const regionText=parts.slice(1).join(' ');

  const exactAliases=[primary];
  if (/\bcity\b/.test(primary)) {
    const withoutCity=primary.replace(/\bcity\b/g,' ').replace(/\s+/g,' ').trim();
    if (withoutCity) {
      exactAliases.push(withoutCity,`city of ${withoutCity}`);
    }
  }

  let broadAliases=[];
  let broadLabel='';

  const regionSets=[...AU_REGIONS,...US_REGIONS];
  const region=regionSets.find((r)=>
    r.codes.some((code)=>{
      const c=clean(code);
      return regionText===c || normalized.endsWith(` ${c}`) || normalized.includes(` ${c} `);
    })
  );

  if (region) {
    broadAliases=unique([...region.aliases,...region.country]);
    broadLabel=region.label;
  }

  return {
    raw,
    type:'local',
    label:raw,
    aliases:unique([...exactAliases,...broadAliases]),
    exactAliases:unique(exactAliases),
    broadAliases,
    broadLabel,
  };
}

export function locationMatchStrength(text='', scopeOrValue='') {
  const scope=typeof scopeOrValue==='string'
    ? buildLocationScope(scopeOrValue)
    : scopeOrValue;

  if (aliasMatch(text,scope.exactAliases || scope.aliases || [])) return 'exact';
  if (aliasMatch(text,scope.broadAliases || [])) return 'broad';
  return 'none';
}

export function locationPhraseMatch(text='', scopeOrValue='') {
  return locationMatchStrength(text,scopeOrValue)!=='none';
}
