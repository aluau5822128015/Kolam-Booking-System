// Small in-memory rate limiter (per IP, single server process; resets on restart).
const rateLimit = ({ windowMs, max, message }) => {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const entry = hits.get(req.ip);

    if (!entry || now - entry.start > windowMs) {
      hits.set(req.ip, { start: now, count: 1 });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ message });
    }
    next();
  };
};

module.exports = rateLimit;
