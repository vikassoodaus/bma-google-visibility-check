import { assertPublicUrl } from './security.js';

const MAX_HTML_BYTES = 2_000_000;
const MAX_REDIRECTS = 5;

async function fetchOnce(url, { method = 'GET', timeoutMs = 8000 } = {}) {
  await assertPublicUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'user-agent': 'BMAGoogleVisibilityCheck/1.0 (+https://businessmarketingagency.com.au)',
        accept: method === 'HEAD'
          ? '*/*'
          : 'text/html,application/xhtml+xml,application/xml,text/xml,text/plain;q=0.9,*/*;q=0.8',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function safeFetch(
  urlInput,
  { method = 'GET', timeoutMs = 8000, maxBytes = MAX_HTML_BYTES, readBody = true } = {},
) {
  let current = urlInput instanceof URL ? new URL(urlInput) : new URL(urlInput);
  const redirects = [];

  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    const response = await fetchOnce(current, { method, timeoutMs });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        return {
          response,
          finalUrl: current,
          redirects,
          body: '',
          contentType: response.headers.get('content-type') || '',
        };
      }

      const next = new URL(location, current);
      if (!['http:', 'https:'].includes(next.protocol)) {
        throw new Error('Unsafe redirect protocol.');
      }

      redirects.push(next.toString());
      current = next;
      continue;
    }

    const contentType = response.headers.get('content-type') || '';

    if (method === 'HEAD' || !readBody) {
      try {
        await response.body?.cancel();
      } catch {}
      return { response, finalUrl: current, redirects, body: '', contentType };
    }

    if (!/text\/html|application\/xhtml\+xml|application\/xml|text\/xml|text\/plain/i.test(contentType)) {
      try {
        await response.body?.cancel();
      } catch {}
      return { response, finalUrl: current, redirects, body: '', contentType };
    }

    let body = '';
    const reader = response.body?.getReader();

    if (reader) {
      const chunks = [];
      let size = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          throw new Error('Website HTML is too large for the free scan.');
        }

        chunks.push(value);
      }

      const merged = new Uint8Array(size);
      let offset = 0;

      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }

      body = new TextDecoder('utf-8').decode(merged);
    }

    return { response, finalUrl: current, redirects, body, contentType };
  }

  throw new Error('Too many redirects.');
}

export async function safeStatus(urlInput, timeoutMs = 4500) {
  try {
    let result = await safeFetch(urlInput, {
      method: 'HEAD',
      timeoutMs,
      maxBytes: 0,
      readBody: false,
    });

    if ([403, 405, 501].includes(result.response.status)) {
      result = await safeFetch(urlInput, {
        method: 'GET',
        timeoutMs,
        maxBytes: 0,
        readBody: false,
      });
    }

    const status = result.response.status;
    const verifiable = status > 0 && ![401, 403, 429].includes(status);

    return {
      status,
      verifiable,
      finalUrl: result.finalUrl.toString(),
      redirects: result.redirects.length,
    };
  } catch {
    return {
      status: 0,
      verifiable: false,
      finalUrl: String(urlInput),
      redirects: 0,
    };
  }
}
