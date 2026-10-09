// Simple dependency-free fixed-window in-memory rate limiter.
// Suitable for single-process deployments; swap for a shared store
// (Redis/upstash) when scaling horizontally.
const rateLimit = (options = {}) => {
  const windowMs = options.windowMs || 60000;
  const max = options.max || 100;
  const store = new Map();

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.resetAt > windowMs) store.delete(key);
    }
  }, windowMs);
  if (timer.unref) timer.unref();

  return (req, res, next) => {
    const keyBase = req.ip || req.socket?.remoteAddress || 'unknown';
    const extra = options.keyGenerator ? options.keyGenerator(req) : '';
    const key = keyBase + (extra || '');
    const now = Date.now();
    const entry = store.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    entry.count += 1;
    store.set(key, entry);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    if (entry.count > max) {
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }
    next();
  };
};

module.exports = rateLimit;