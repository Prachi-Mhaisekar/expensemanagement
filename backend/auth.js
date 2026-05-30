const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'expense-tracker-secret-key';

function signToken(userId, email) {
  return jwt.sign({ userId: Number(userId), email }, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Login required' });
  }
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { userId: Number(payload.userId), email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { signToken, authMiddleware, JWT_SECRET };
