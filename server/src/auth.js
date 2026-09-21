import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'token';
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export function signAppToken(user) {
  return jwt.sign(
    { sub: String(user.id), username: user.username, avatar: user.avatar },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, username: payload.username };
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
