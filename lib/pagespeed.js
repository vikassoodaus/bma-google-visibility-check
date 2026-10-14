export async function runPageSpeed(url) {
  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('strategy', 'mobile');
  endpoint.searchParams.set('category', 'performance');
  if (process.env.GOOGLE_PAGESPEED_API_KEY) endpoint.searchParams.set('key', process.env.GOOGLE_PAGESPEED_API_KEY);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    if (!response.ok) {
      const hasKey = Boolean(process.env.GOOGLE_PAGESPEED_API_KEY);
      if (response.status === 429) {
        const message = hasKey
          ? 'PageSpeed quota/rate limit reached (429) for the configured API key.'
          : 'PageSpeed quota/rate limit reached (429). Add GOOGLE_PAGESPEED_API_KEY in Vercel.';
        return { available: false, status: 429, error: message, apiKeyConfigured: hasKey };
      }
      return {
        available: false,
        status: response.status,
        error: `PageSpeed returned ${response.status}`,
        apiKeyConfigured: hasKey,
      };
    }
    const json = await response.json();
    const lighthouse = json.lighthouseResult || {};
    const audits = lighthouse.audits || {};
    const perf = lighthouse.categories?.performance?.score;

    const lcpMs = audits['largest-contentful-paint']?.numericValue;
    const cls = audits['cumulative-layout-shift']?.numericValue;
    const tbtMs = audits['total-blocking-time']?.numericValue;

    const imageAuditIds = ['uses-optimized-images', 'modern-image-formats', 'uses-responsive-images'];
    const imageAudits = imageAuditIds.map((id) => audits[id]).filter(Boolean);
    let imageOptimised = null;
    if (imageAudits.length) imageOptimised = imageAudits.every((a) => typeof a.score !== 'number' || a.score >= 0.9);

    return {
      available: true,
      performanceScore: typeof perf === 'number' ? Math.round(perf * 100) : null,
      lcpMs: typeof lcpMs === 'number' ? lcpMs : null,
      cls: typeof cls === 'number' ? cls : null,
      tbtMs: typeof tbtMs === 'number' ? tbtMs : null,
      imageOptimised,
      rawVersion: lighthouse.lighthouseVersion || null,
      status: 200,
      apiKeyConfigured: Boolean(process.env.GOOGLE_PAGESPEED_API_KEY),
    };
  } catch (error) {
    const timedOut = error?.name === 'AbortError' || /aborted|abort/i.test(error?.message || '');
    return {
      available: false,
      status: 0,
      error: timedOut ? 'PageSpeed timed out after 45 seconds.' : (error?.message || 'PageSpeed unavailable.'),
      apiKeyConfigured: Boolean(process.env.GOOGLE_PAGESPEED_API_KEY),
    };
  } finally {
    clearTimeout(timer);
  }
}
