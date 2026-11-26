function createRateLimiter(options) {
  const opts = options || {};
  const windowMs = opts.windowMs || 60 * 1000;
  const max = opts.max || 60;
  const message = opts.message || 'Слишком много запросов. Попробуйте позже.';
  const keyOf = typeof opts.key === 'function' ? opts.key : (req) => req.ip;

  const hits = new Map();

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.reset <= now) hits.delete(key);
    }
  }, windowMs);
  if (timer.unref) timer.unref();

  function middleware(req, res, next) {
    const key = keyOf(req);
    if (!key) return next();

    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.reset <= now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ message });
    }

    next();
  }

  middleware.reset = (key) => hits.delete(key);
  return middleware;
}

module.exports = { createRateLimiter };
