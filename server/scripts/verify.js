// Automated check of the behaviour the assignment marks.
// Starts its own copy of the server on a spare port with a throwaway
// database and a test-only secret, so it never touches your real data.
//
// Run from the server folder:   npm run verify

import { spawn } from 'child_process';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(here, '..');
const PORT = 5055;
const BASE = `http://localhost:${PORT}`;
const SECRET = 'verify-only-secret-not-used-anywhere-else';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'capsule-verify-'));

const server = spawn(process.execPath, ['src/index.js'], {
  cwd: serverDir,
  env: {
    ...process.env,
    PORT: String(PORT),
    JWT_SECRET: SECRET,
    DB_PATH: path.join(tmp, 'verify.db'),
    NODE_ENV: 'test',
    GITHUB_CLIENT_ID: 'verify',
    GITHUB_CLIENT_SECRET: 'verify',
    APP_BASE_URL: BASE,
    CLIENT_URL: BASE,
  },
  stdio: 'ignore',
});

const token = (sub, username, secret = SECRET, opts = { expiresIn: '1h' }) =>
  jwt.sign({ sub, username }, secret, opts);

const alice = token('1001', 'alice');
const bob = token('2002', 'bob');
const expired = token('1001', 'alice', SECRET, { expiresIn: '-1s' });
const wrongSecret = token('1001', 'alice', 'attacker-secret');
const unsigned = jwt.sign({ sub: '1001' }, '', { algorithm: 'none' });

async function call(method, url, { cookie, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie !== undefined) headers.Cookie = `token=${cookie}`;
  const res = await fetch(BASE + url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

const sample = {
  project_name: 'SmartFarm Irrigation',
  prompt_title: 'Debug cloud deployment',
  prompt_version: 'v1',
  prompt_text: 'Why does my Node server fail?',
  response_summary: 'Check start command',
  category: 'Coding',
  usefulness: 'Good',
  reviewed: true,
  improved: false,
  notes: 'Tested and worked',
};

let passed = 0;
let failed = 0;
function check(label, ok, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}${detail ? '  (' + detail + ')' : ''}`); }
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Server did not start on port ' + PORT);
}

async function run() {
  await waitForServer();

  console.log('\nPublic health check');
  const h = await call('GET', '/api/health');
  check('GET /api/health returns 200 {"status":"ok"}', h.status === 200 && h.data?.status === 'ok');

  console.log('\nRequired cURL tests (Section D)');
  check('GET /api/capsules with no cookie returns 401', (await call('GET', '/api/capsules')).status === 401);
  check('GET /api/capsules with token=fake-token-123 returns 401',
    (await call('GET', '/api/capsules', { cookie: 'fake-token-123' })).status === 401);

  console.log('\nJWT is really verified, not just checked for presence');
  check('Expired token returns 401', (await call('GET', '/api/capsules', { cookie: expired })).status === 401);
  check('Token signed with a different secret returns 401',
    (await call('GET', '/api/capsules', { cookie: wrongSecret })).status === 401);
  check('Unsigned alg:none token returns 401', (await call('GET', '/api/capsules', { cookie: unsigned })).status === 401);

  console.log('\nEvery CRUD route is protected');
  check('POST without auth returns 401', (await call('POST', '/api/capsules', { body: sample })).status === 401);
  check('PUT without auth returns 401', (await call('PUT', '/api/capsules/1', { body: sample })).status === 401);
  check('DELETE without auth returns 401', (await call('DELETE', '/api/capsules/1')).status === 401);

  console.log('\nCRUD as a signed-in user (Section A)');
  const created = await call('POST', '/api/capsules', { cookie: alice, body: { ...sample, user_id: '2002' } });
  check('CREATE returns 201', created.status === 201, `got ${created.status}`);
  check('Owner comes from the JWT, user_id in the body is ignored', created.data?.user_id === '1001',
    `stored user_id ${created.data?.user_id}`);
  const id = created.data?.id;

  const read = await call('GET', '/api/capsules', { cookie: alice });
  check('READ returns the new record', read.status === 200 && read.data?.some((c) => c.id === id));

  const updated = await call('PUT', `/api/capsules/${id}`, {
    cookie: alice, body: { ...sample, prompt_title: 'Debug cloud deployment v2', prompt_version: 'v2', improved: true },
  });
  check('UPDATE changes the record', updated.status === 200 && updated.data?.prompt_version === 'v2' && updated.data?.improved === 1);

  const invalid = await call('POST', '/api/capsules', { cookie: alice, body: { project_name: '', prompt_title: '', prompt_text: '' } });
  check('Missing required fields return 400', invalid.status === 400);

  console.log('\nUsers are restricted to their own records (Section D)');
  const bobList = await call('GET', '/api/capsules', { cookie: bob });
  check("Another user's list does not include the record", bobList.status === 200 && !bobList.data?.some((c) => c.id === id));
  check("Another user's UPDATE returns 404", (await call('PUT', `/api/capsules/${id}`, { cookie: bob, body: sample })).status === 404);
  check("Another user's DELETE returns 404", (await call('DELETE', `/api/capsules/${id}`, { cookie: bob })).status === 404);
  const still = await call('GET', '/api/capsules', { cookie: alice });
  check('The record is untouched afterwards',
    still.data?.find((c) => c.id === id)?.prompt_version === 'v2');

  console.log('\nDelete');
  check('DELETE returns 200', (await call('DELETE', `/api/capsules/${id}`, { cookie: alice })).status === 200);
  const after = await call('GET', '/api/capsules', { cookie: alice });
  check('Record is gone afterwards', !after.data?.some((c) => c.id === id));
  check('Deleting again returns 404', (await call('DELETE', `/api/capsules/${id}`, { cookie: alice })).status === 404);

  console.log('\nOAuth entry point');
  const login = await fetch(`${BASE}/auth/github`, { redirect: 'manual' });
  check('GET /auth/github redirects to GitHub',
    login.status === 302 && (login.headers.get('location') || '').startsWith('https://github.com/login/oauth/authorize'));
  const setCookie = login.headers.get('set-cookie') || '';
  check('OAuth state cookie is HttpOnly', /HttpOnly/i.test(setCookie));
  const forged = await fetch(`${BASE}/auth/github/callback?code=x&state=forged`, { redirect: 'manual' });
  check('Callback with a forged state is rejected with 400', forged.status === 400);
}

run()
  .catch((err) => { failed++; console.log('\n  FAIL  ' + err.message); })
  .finally(() => {
    server.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`\n${passed} passed, ${failed} failed\n`);
    process.exit(failed ? 1 : 0);
  });
