import express from 'express';
import crypto from 'crypto';
import { signAppToken, setAuthCookie, clearAuthCookie, requireAuth } from '../auth.js';

const router = express.Router();

const STATE_COOKIE = 'oauth_state';

router.get('/github', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');

  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: `${process.env.APP_BASE_URL}/auth/github/callback`,
    scope: 'read:user',
    state,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

router.get('/github/callback', async (req, res) => {
  const { code, state } = req.query;
  const expectedState = req.cookies?.[STATE_COOKIE];

  res.clearCookie(STATE_COOKIE, { path: '/' });

  if (!code || !state || state !== expectedState) {
    return res.status(400).send('OAuth state mismatch. Start again from /login.');
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.APP_BASE_URL}/auth/github/callback`,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      return res.status(401).send('GitHub token exchange failed.');
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ai-capsule',
      },
    });

    const ghUser = await userRes.json();

    if (!ghUser.id) {
      console.error('Profile fetch failed:', ghUser);
      return res.status(401).send('Could not read GitHub profile.');
    }

    const appToken = signAppToken({
      id: ghUser.id,
      username: ghUser.login,
      avatar: ghUser.avatar_url,
    });

    setAuthCookie(res, appToken);

    const target = process.env.CLIENT_URL || process.env.APP_BASE_URL;
    return res.redirect(`${target}/dashboard`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    return res.status(500).send('Login failed.');
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
