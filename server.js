const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;

const INDEX = path.join(
  ROOT,
  'TECH_SOURCE_RRB_Result_Analyzer_FINAL.html'
);

const MAX_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 20000;
const MAX_REDIRECTS = 5;

const ALLOWED_HOST = (hostname) => {
  const h = String(hostname || '').toLowerCase();

  return (
    h === 'digialm.com' ||
    h.endsWith('.digialm.com')
  );
};

// --------------------------------------------------
// Simple per-IP rate limiter
// --------------------------------------------------

const hits = new Map();

function rateLimit(ip) {
  const now = Date.now();

  const arr = (hits.get(ip) || [])
    .filter((time) => now - time < 60000);

  if (arr.length >= 30) {
    hits.set(ip, arr);
    return false;
  }

  arr.push(now);
  hits.set(ip, arr);

  return true;
}

// --------------------------------------------------
// Response helper
// --------------------------------------------------

function send(res, status, type, body, extra = {}) {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extra
  });

  res.end(body);
}

// --------------------------------------------------
// Validate Digialm URL
// --------------------------------------------------

function validateTarget(target) {
  let u;

  try {
    u = new URL(target);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!['http:', 'https:'].includes(u.protocol)) {
    throw new Error('Only HTTP/HTTPS URLs are allowed');
  }

  if (!ALLOWED_HOST(u.hostname)) {
    throw new Error('Only Digialm domains are allowed');
  }

  return u;
}

// --------------------------------------------------
// Fetch Digialm response sheet
// --------------------------------------------------

async function fetchDigialm(target, depth = 0) {
  if (depth > MAX_REDIRECTS) {
    throw new Error('Too many redirects');
  }

  const u = validateTarget(target);

  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);

  try {
    /*
     * Use browser-like request headers.
     * Some Digialm servers reject very minimal Node fetch
     * requests with HTTP 400.
     */
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/131.0.0.0 Safari/537.36',

      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,' +
        'image/avif,image/webp,image/apng,*/*;q=0.8',

      'Accept-Language':
        'en-US,en;q=0.9,hi;q=0.8',

      'Cache-Control':
        'no-cache',

      'Pragma':
        'no-cache',

      'Upgrade-Insecure-Requests':
        '1'
    };

    /*
     * Referer is kept within the allowed Digialm domain.
     * This can help when the server expects a browser-like
     * navigation request.
     */
    if (depth === 0) {
      headers['Referer'] = 'https://rrb.digialm.com/';
    } else {
      headers['Referer'] = u.origin + '/';
    }

    const response = await fetch(u.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers
    });

    // ------------------------------------------------
    // Handle redirects manually
    // ------------------------------------------------

    if (
      [301, 302, 303, 307, 308].includes(response.status)
    ) {
      const location = response.headers.get('location');

      if (!location) {
        throw new Error('Redirect without location');
      }

      const nextUrl = new URL(location, u).toString();

      // validate redirect target before following it
      validateTarget(nextUrl);

      return fetchDigialm(nextUrl, depth + 1);
    }

    // ------------------------------------------------
    // Handle source errors
    // ------------------------------------------------

    if (!response.ok) {
      let errorBody = '';

      try {
        errorBody = await response.text();
      } catch {
        errorBody = '';
      }

      /*
       * Do not expose the complete remote response to the
       * frontend. Keep the useful status for debugging.
       */
      const shortBody = errorBody
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180);

      if (shortBody) {
        throw new Error(
          `Source HTTP ${response.status}: ${shortBody}`
        );
      }

      throw new Error(
        `Source HTTP ${response.status}`
      );
    }

    // ------------------------------------------------
    // Size protection
    // ------------------------------------------------

    const contentLength = Number(
      response.headers.get('content-length') || 0
    );

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_BYTES
    ) {
      throw new Error(
        'Response sheet is too large'
      );
    }

    // ------------------------------------------------
    // Read response
    // ------------------------------------------------

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    if (buffer.length > MAX_BYTES) {
      throw new Error(
        'Response sheet is too large'
      );
    }

    if (buffer.length < 200) {
      throw new Error(
        'Empty/invalid response sheet'
      );
    }

    /*
     * Digialm response sheets are normally HTML.
     * UTF-8 decoding is sufficient for the analyzer.
     */
    const text = buffer.toString('utf8');

    if (text.length < 200) {
      throw new Error(
        'Empty/invalid response sheet'
      );
    }

    return text;

  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error(
        'Digialm request timed out'
      );
    }

    throw error;

  } finally {
    clearTimeout(timer);
  }
}

// --------------------------------------------------
// HTTP server
// --------------------------------------------------

const server = http.createServer(
  async (req, res) => {
    try {
      const requestUrl = new URL(
        req.url,
        `http://${req.headers.host || 'localhost'}`
      );

      // ----------------------------------------------
      // Health check
      // ----------------------------------------------

      if (
        req.method === 'GET' &&
        requestUrl.pathname === '/api/health'
      ) {
        return send(
          res,
          200,
          'application/json; charset=utf-8',
          JSON.stringify({
            ok: true,
            service: 'TECH SOURCE RRB URL backend'
          })
        );
      }

      // ----------------------------------------------
      // Digialm fetch API
      // ----------------------------------------------

      if (
        req.method === 'GET' &&
        requestUrl.pathname === '/api/fetch'
      ) {
        const forwardedFor =
          req.headers['x-forwarded-for'] || '';

        const ip = (
          forwardedFor ||
          req.socket.remoteAddress ||
          'unknown'
        )
          .split(',')[0]
          .trim();

        if (!rateLimit(ip)) {
          return send(
            res,
            429,
            'application/json; charset=utf-8',
            JSON.stringify({
              error: 'Rate limit exceeded'
            }),
            {
              'Access-Control-Allow-Origin': '*'
            }
          );
        }

        const target =
          requestUrl.searchParams.get('url');

        if (!target) {
          return send(
            res,
            400,
            'application/json; charset=utf-8',
            JSON.stringify({
              error: 'Missing url parameter'
            }),
            {
              'Access-Control-Allow-Origin': '*'
            }
          );
        }

        try {
          const text = await fetchDigialm(target);

          return send(
            res,
            200,
            'text/plain; charset=utf-8',
            text,
            {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type'
            }
          );

        } catch (error) {
          console.error(
            'Digialm fetch failed:',
            error.message
          );

          return send(
            res,
            502,
            'application/json; charset=utf-8',
            JSON.stringify({
              error:
                error.message ||
                'Digialm fetch failed'
            }),
            {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type'
            }
          );
        }
      }

      // ----------------------------------------------
      // CORS preflight
      // ----------------------------------------------

      if (
        req.method === 'OPTIONS' &&
        req.url.startsWith('/api/')
      ) {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods':
            'GET, OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type',
          'Cache-Control': 'no-store'
        });

        return res.end();
      }

      // ----------------------------------------------
      // Optional HTML serving
      // ----------------------------------------------

      if (
        req.method === 'GET' &&
        (
          requestUrl.pathname === '/' ||
          requestUrl.pathname === '/index.html'
        )
      ) {
        if (!fs.existsSync(INDEX)) {
          return send(
            res,
            404,
            'text/plain; charset=utf-8',
            'HTML file not found'
          );
        }

        return send(
          res,
          200,
          'text/html; charset=utf-8',
          fs.readFileSync(INDEX)
        );
      }

      // ----------------------------------------------
      // 404
      // ----------------------------------------------

      return send(
        res,
        404,
        'text/plain; charset=utf-8',
        'Not found'
      );

    } catch (error) {
      console.error(
        'Server error:',
        error.message
      );

      return send(
        res,
        500,
        'text/plain; charset=utf-8',
        'Server error'
      );
    }
  }
);

// --------------------------------------------------
// Render / production server
// --------------------------------------------------

server.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `TECH SOURCE RRB Analyzer backend running on port ${PORT}`
    );
  }
);
