function normaliseHost(value = '') {
  try {
    const raw = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function tokens(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((x) => x.length > 1);
}

function tokenSimilarity(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let overlap = 0;
  for (const t of A) if (B.has(t)) overlap += 1;
  return overlap / Math.max(A.size, B.size);
}

function candidateScore(place, businessName, website, location) {
  let score = 0;

  const submittedHost = normaliseHost(website);
  const placeHost = normaliseHost(place.websiteUri || '');
  const exactWebsite = Boolean(submittedHost && placeHost && submittedHost === placeHost);
  const relatedWebsite = Boolean(
    submittedHost &&
    placeHost &&
    !exactWebsite &&
    (submittedHost.endsWith(`.${placeHost}`) || placeHost.endsWith(`.${submittedHost}`))
  );

  // Website identity is the strongest evidence because business names can be
  // duplicated across cities and countries.
  if (exactWebsite) score += 70;
  else if (relatedWebsite) score += 58;

  const nameSimilarity = tokenSimilarity(businessName, place.displayName?.text || '');
  score += nameSimilarity * 35;

  const locTokens = tokens(location);
  const address = String(place.formattedAddress || '').toLowerCase();
  let locationSimilarity = 0;
  if (locTokens.length) {
    const found = locTokens.filter((t) => address.includes(t)).length;
    locationSimilarity = found / locTokens.length;
    score += locationSimilarity * 25;
  }

  // A service-area business may intentionally hide its street address.
  // An exact website match remains sufficient identity evidence even when
  // the Places response has little or no address detail.

  return {
    score: Math.min(100, Math.round(score)),
    exactWebsite,
    relatedWebsite,
    nameSimilarity,
    locationSimilarity,
  };
}

export async function findGoogleBusiness({ businessName, website, location }) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return {
      available: false,
      error: 'GOOGLE_PLACES_API_KEY is not configured.',
      candidates: [],
      match: null,
    };
  }

  const submittedHost = normaliseHost(website);
  const queries = [
    [businessName, location].filter(Boolean).join(' '),
  ];

  // A domain-focused fallback is only used when needed. This helps distinguish
  // similarly named businesses without paying for multiple Places requests on
  // every scan.
  if (submittedHost) {
    queries.push([businessName, submittedHost].filter(Boolean).join(' '));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 14000);

  async function search(query) {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.websiteUri',
          'places.nationalPhoneNumber',
          'places.regularOpeningHours',
          'places.rating',
          'places.userRatingCount',
          'places.primaryType',
          'places.primaryTypeDisplayName',
          'places.businessStatus',
          'places.googleMapsUri'
        ].join(','),
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: 'en',
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Google Places returned ${response.status}${body ? `: ${body.slice(0, 180)}` : ''}`);
    }

    const json = await response.json();
    return json.places || [];
  }

  try {
    const firstPlaces = await search(queries[0]);

    const scorePlaces = (items) => items.map((place) => {
      const matchData = candidateScore(place, businessName, website, location);
      return {
        ...place,
        _matchScore: matchData.score,
        _exactWebsite: matchData.exactWebsite,
        _relatedWebsite: matchData.relatedWebsite,
        _nameSimilarity: matchData.nameSimilarity,
        _locationSimilarity: matchData.locationSimilarity,
      };
    });

    let candidates = scorePlaces(firstPlaces.slice(0, 8));

    const firstBest = [...candidates].sort((a, b) => b._matchScore - a._matchScore)[0] || null;

    // Only make the second Places call when the first search is not trustworthy.
    if (queries[1] && (!firstBest || firstBest._matchScore < 65)) {
      const fallbackPlaces = await search(queries[1]);
      const seen = new Set(candidates.map((p) => p.id));
      for (const place of scorePlaces(fallbackPlaces.slice(0, 8))) {
        if (!seen.has(place.id)) {
          seen.add(place.id);
          candidates.push(place);
        }
      }
    }

    candidates = candidates.sort((a, b) => b._matchScore - a._matchScore);
    const match = candidates[0] || null;

    let confidence = 'none';
    if (match) {
      if (
        match._exactWebsite ||
        match._matchScore >= 72 ||
        (match._nameSimilarity >= 0.88 && match._locationSimilarity >= 0.75)
      ) confidence = 'high';
      else if (match._matchScore >= 48) confidence = 'medium';
      else confidence = 'low';
    }

    return {
      available: true,
      query: queries[0],
      fallbackQueryUsed: Boolean(queries[1] && (!firstBest || firstBest._matchScore < 65)),
      candidates,
      match,
      confidence,
      trusted: confidence === 'high',
    };
  } catch (error) {
    return {
      available: false,
      status: 0,
      error: error?.name === 'AbortError' ? 'Google Places timed out.' : (error?.message || 'Google Places unavailable.'),
      candidates: [],
      match: null,
    };
  } finally {
    clearTimeout(timer);
  }
}
