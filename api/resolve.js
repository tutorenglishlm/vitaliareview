// Key-free smart resolver: turns a Google Maps URL (including short
// maps.app.goo.gl / goo.gl/maps links) into a direct Google review link.
// Runs server-side so it can follow the redirects the browser can't (CORS).
//
// POST { url: "<any google maps url>" }  ->  { link, ref } | { error }

function extractRef(s) {
  s = (s || '').trim();
  if (!s) return null;
  let m = s.match(/writereview\?placeid=([^&\s]+)/i);
  if (m) return { type: 'placeid', val: decodeURIComponent(m[1]) };
  if (/g\.page\/.+\/review/i.test(s)) return { type: 'full', val: s };
  m = s.match(/[?&]cid=(\d+)/i);
  if (m) return { type: 'placeid', val: m[1] };
  m = s.match(/ludocid[:=](\d+)/i);
  if (m) return { type: 'placeid', val: m[1] };
  m = s.match(/(ChI[0-9A-Za-z_-]{20,})/);
  if (m) return { type: 'placeid', val: m[1] };
  // hex feature id 0x..:0x<cid>  -> decimal CID (BigInt keeps 64-bit exact)
  m = s.match(/0x[0-9a-f]+:0x([0-9a-f]+)/i);
  if (m) {
    try { return { type: 'placeid', val: BigInt('0x' + m[1]).toString() }; } catch (e) {}
  }
  return null;
}

function buildLink(ref) {
  return ref.type === 'full'
    ? ref.val
    : 'https://search.google.com/local/writereview?placeid=' + ref.val;
}

// Follow up to `max` redirects manually so we can read every intermediate URL.
async function resolveUrl(url, max = 6) {
  let current = url;
  for (let i = 0; i < max; i++) {
    let res;
    try {
      res = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          // a real UA — Google serves the redirect + place data to browsers
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
        },
      });
    } catch (e) {
      break;
    }
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      // an intermediate hop can already contain the place id
      const early = extractRef(loc);
      if (early) return { finalUrl: loc, ref: early };
      current = new URL(loc, current).toString();
      const inUrl = extractRef(current);
      if (inUrl) return { finalUrl: current, ref: inUrl };
      continue;
    }
    // no more redirects: inspect the final URL and, if needed, the HTML body
    const fromUrl = extractRef(current);
    if (fromUrl) return { finalUrl: current, ref: fromUrl };
    let body = '';
    try { body = await res.text(); } catch (e) {}
    const fromBody = extractRef(body);
    if (fromBody) return { finalUrl: current, ref: fromBody };
    return { finalUrl: current, ref: null };
  }
  return { finalUrl: current, ref: extractRef(current) };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Usa POST.' }); return; }

  let url = '';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    url = (body.url || '').trim();
  } catch (e) {}
  if (!url) { res.status(400).json({ error: 'Falta la URL.' }); return; }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  // fast path: the pasted URL already contains the id
  const direct = extractRef(url);
  if (direct) { res.status(200).json({ link: buildLink(direct), ref: direct.val }); return; }

  try {
    const out = await resolveUrl(url);
    if (out.ref) { res.status(200).json({ link: buildLink(out.ref), ref: out.ref.val }); return; }
    res.status(422).json({
      error: 'No se encontró el negocio en ese enlace. Abre el negocio en Google Maps y copia la URL de /maps/place/…',
      finalUrl: out.finalUrl,
    });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo resolver el enlace: ' + (e && e.message ? e.message : e) });
  }
};
