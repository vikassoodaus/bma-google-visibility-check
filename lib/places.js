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
  if (submittedHost && placeHost && submittedHost === placeHost) score += 55;
  else if (submittedHost && placeHost && (submittedHost.endsWith(placeHost) || placeHost.endsWith(submittedHost))) score += 42;

  score += tokenSimilarity(businessName, place.displayName?.text || '') * 30;

  const locTokens = tokens(location);
  const address = String(place.formattedAddress || '').toLowerCase();
  if (locTokens.length) {
    const found = locTokens.filter((t) => address.includes(t)).length;
    score += (found / locTokens.length) * 15;
  }

  return score;
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

  const query = [businessName, location].filter(Boolean).join(' ');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
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
      return {
        available: false,
        status: response.status,
        error: `Google Places returned ${response.status}${body ? `: ${body.slice(0, 180)}` : ''}`,
        candidates: [],
        match: null,
      };
    }

    const json = await response.json();
    const candidates = (json.places || []).slice(0, 8).map((place) => ({
      ...place,
      _matchScore: Math.round(candidateScore(place, businessName, website, location)),
    })).sort((a, b) => b._matchScore - a._matchScore);

    const match = candidates[0] || null;
    const confidence = !match ? 'none' : match._matchScore >= 65 ? 'high' : match._matchScore >= 40 ? 'medium' : 'low';

    return {
      available: true,
      query,
      candidates,
      match,
      confidence,
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
