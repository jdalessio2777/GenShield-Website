const PLACE_ID = 'ChIJyfhnzhAa_6ERNn_5bspaNfM';
const CACHE_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours — reviews don't change minute to minute
const CDN_FRESH_SECONDS = 8 * 60 * 60;
const CDN_STALE_SECONDS = 24 * 60 * 60;

// Survives across warm invocations of the same function instance (Fluid Compute
// reuses instances), so most requests never hit Google at all. The Cache-Control
// header below is the real backstop across cold starts / multiple instances.
let memoryCache = null; // { data, fetchedAt }

async function fetchFromGoogle() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is not set');

  const res = await fetch(`https://places.googleapis.com/v1/places/${PLACE_ID}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'rating,userRatingCount,reviews',
    },
  });

  if (!res.ok) {
    throw new Error(`Places API responded ${res.status}`);
  }

  const place = await res.json();

  const reviews = (place.reviews || []).slice(0, 5).map((r) => ({
    authorName: r.authorAttribution?.displayName || 'Google User',
    rating: r.rating ?? null,
    text: (r.text?.text || r.originalText?.text || '').trim(),
    relativeTime: r.relativePublishTimeDescription || '',
  }));

  return {
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    reviews,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader(
    'Cache-Control',
    `public, s-maxage=${CDN_FRESH_SECONDS}, stale-while-revalidate=${CDN_STALE_SECONDS}`
  );

  const now = Date.now();
  if (memoryCache && now - memoryCache.fetchedAt < CACHE_TTL_MS) {
    res.status(200).json({ ...memoryCache.data, cached: true });
    return;
  }

  try {
    const data = await fetchFromGoogle();
    memoryCache = { data, fetchedAt: now };
    res.status(200).json({ ...data, cached: false });
  } catch (err) {
    console.error('reviews API error:', err.message);

    if (memoryCache) {
      // Serve the last known-good data rather than nothing while Google is down.
      res.status(200).json({ ...memoryCache.data, cached: true, stale: true });
      return;
    }

    res.status(200).json({ rating: null, userRatingCount: null, reviews: [], error: true });
  }
};
