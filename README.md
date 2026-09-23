# AI Capsule

A private prompt library. Sign in with GitHub, save the AI prompts that worked
for you, and find them again later. Each record stores the prompt with its
project, version, category, usefulness, review status, notes and an optional
screenshot URL.

## Deployed application

| | |
| --- | --- |
| Public URL | https://ai-capsule-22640875abhaya.onrender.com |
| Health check | https://ai-capsule-22640875abhaya.onrender.com/api/health |
| Cloud platform | Render — free web service, Node 22 |
| Deployment | Render builds and deploys automatically on every push to `main` |

The free plan sleeps after about 15 minutes without traffic, so the first
request after a pause can take up to a minute while it starts again.

## Technology

| Layer | Choice |
| --- | --- |
| Frontend | React 19, React Router 7, built with Vite 8; fonts bundled with the app |
| Backend | Node.js 22 with Express 4.19.2 |
| Database | SQLite via better-sqlite3 |
| Authentication | GitHub OAuth, then an application JWT issued by Express |
| Session | JWT in a Secure, HttpOnly cookie named `token` |
| Hosting | Render (free web service) |

## Project structure

```
ai-capsule/
├── package.json              root build/start scripts used by Render
├── client/                   React frontend (Vite)
│   ├── vite.config.js        dev proxy for /api and /auth
│   └── src/
│       ├── api.js            every request to Express goes through here
│       ├── App.jsx           routes: /, /login, /dashboard
│       ├── styles.css        the whole visual design
│       ├── components/       Brand (logo and name)
│       └── pages/            Home, Login, Dashboard
└── server/                   Express backend
    ├── .env.example          environment variable names (no values)
    ├── scripts/verify.js     automated security and CRUD checks
    └── src/
        ├── index.js          app setup, serves the React build
        ├── db.js             SQLite connection and schema
        ├── auth.js           JWT signing, cookie, requireAuth middleware
        └── routes/
            ├── auth.routes.js      GitHub OAuth login, callback, logout
            └── capsules.routes.js  the four protected CRUD routes
```

## Install and run locally

Requires Node.js 22.

```
cd server
npm install
cp .env.example .env
```

Fill in `JWT_SECRET`, `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in
`server/.env`. The GitHub OAuth app for local development needs the callback
URL `http://localhost:5000/auth/github/callback`.

```
cd ../client
npm install
```

Run the backend and frontend in two terminals:

```
cd server && npm run dev      # Express on http://localhost:5000
cd client && npm run dev      # Vite on http://localhost:5173
```

Open http://localhost:5173.

To run the production build locally, the same way Render runs it:

```
npm run build                 # from the project root
npm start                     # serves React and the API on port 5000
```

With the production build, set `CLIENT_URL=http://localhost:5000` in
`server/.env` so the login redirect returns to port 5000.

To run the automated checks:

```
cd server
npm run verify
```

This starts a separate copy of the server on port 5055 with a throwaway
database and a test-only secret, and checks every behaviour listed under
"Verification" below. It does not touch your real data.

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Landing page explaining AI Capsule |
| `/login` | Public | Starts GitHub OAuth |
| `/dashboard` | Protected | The signed-in user's records, with create, edit, delete and search |
| `GET /api/health` | Public | Returns `{ "status": "ok" }` |
| `GET /api/capsules` | JWT required | Read the signed-in user's records |
| `POST /api/capsules` | JWT required | Create a record owned by the signed-in user |
| `PUT /api/capsules/:id` | JWT required | Update one of the signed-in user's records |
| `DELETE /api/capsules/:id` | JWT required | Delete one of the signed-in user's records |
| `GET /auth/github` | Public | Redirects to GitHub to sign in |
| `GET /auth/github/callback` | Public | Completes OAuth and issues the application JWT |
| `POST /auth/logout` | Public | Clears the `token` cookie |
| `GET /api/me` | JWT required | Returns the identity from the verified JWT |

## How the React frontend communicates with Express

Every request goes through one helper in `client/src/api.js`, which calls
relative paths such as `/api/capsules` with `credentials: 'include'`.

In development, Vite runs on port 5173 and its proxy
(`client/vite.config.js`) forwards `/api` and `/auth` to Express on port 5000.
In production, Express serves the compiled React build from `client/dist` and
the API from the same process and the same public URL.

In both cases the browser sees one origin, so the `token` cookie is a
first-party cookie and is sent automatically. No CORS configuration is needed.

## OAuth, JWT and route protection

GitHub OAuth is the provider.

1. `GET /auth/github` generates a random `state` value, stores it in a
   ten-minute HttpOnly cookie, and redirects to GitHub. The `state` check
   protects the callback against cross-site request forgery.
2. After the user approves, GitHub redirects to `/auth/github/callback` with a
   one-time code. Express checks that `state` matches, then exchanges the code
   for a GitHub access token server-to-server, so the client secret never
   reaches the browser.
3. Express calls the GitHub API once to read the user's id and login. The
   GitHub access token is then discarded — it is never stored and never sent
   to the browser.
4. Express signs its own application JWT with `JWT_SECRET`
   (`signAppToken` in `server/src/auth.js`). The GitHub user id is stored as
   the `sub` claim and the token expires after two hours.
5. The JWT is stored in a cookie named `token` with `httpOnly: true`,
   `sameSite: 'lax'`, and `secure: true` when `NODE_ENV=production`. It is not
   placed in localStorage and is not sent as an Authorization header.

`requireAuth` in `server/src/auth.js` protects every capsule route. It reads
the `token` cookie and calls `jwt.verify` with `JWT_SECRET`. A missing cookie,
an invalid signature, a malformed value or an expired token all return
`401 Unauthorized` with no capsule data. On success it sets `req.user` from
the verified token.

`requireAuth` is attached individually to each of the four routes in
`server/src/routes/capsules.routes.js`, so the protection is visible on every
route definition.

`app.set('trust proxy', 1)` is set because Render terminates HTTPS at its
proxy and forwards plain HTTP to the Node process.

## User ownership

The owner of every record is taken from the verified JWT (`req.user.id`),
never from the request body. A `user_id` sent by the browser is ignored.

- CREATE stores `req.user.id` as `user_id`.
- READ uses `WHERE user_id = ?`.
- UPDATE and DELETE use `WHERE id = ? AND user_id = ?`. If a user targets a
  record they do not own, the query matches no rows and the route returns 404,
  so the record is neither changed nor revealed.

All queries use `?` parameter placeholders, so request data cannot be
executed as SQL.

## Environment variables

Values are stored in Render → Environment for the deployed app and, locally,
in `server/.env`, which is gitignored. `server/.env.example` lists the names.
No secret values are committed.

| Name | Purpose |
| --- | --- |
| `PORT` | Port to listen on. Set automatically by Render; `5000` locally |
| `NODE_ENV` | `production` on Render, which turns on the Secure cookie flag |
| `JWT_SECRET` | Signs and verifies the application JWT |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `APP_BASE_URL` | Public base URL, used to build the OAuth callback URL |
| `CLIENT_URL` | Where to send the user after login |
| `DB_PATH` | Location of the SQLite file |

Development and production use separate GitHub OAuth apps, because each
OAuth app accepts a single callback URL.

## Database and storage

`server/src/db.js` opens the SQLite file at `DB_PATH` and creates the
`capsules` table on startup with `CREATE TABLE IF NOT EXISTS`, so no manual
setup or migration step is needed. It creates the folder first, because SQLite
will not create a missing directory. The schema follows the assignment brief,
with an index on `user_id`.

User ownership is stored in the `user_id` column as the GitHub user id taken
from the verified JWT.

On Render, `DB_PATH` is `./data/capsules.db`. **Deployed storage is
ephemeral.** Render's free web services have a temporary filesystem, so the
SQLite file is wiped whenever the service restarts: on every redeploy, and
when the free plan wakes up after sleeping. Records persist while the service
is running, which is enough to demonstrate full CRUD, but they do not survive
a restart. Moving to Render PostgreSQL, or a paid instance with a persistent
disk, would make storage permanent; the ownership rules and queries would stay
the same.

## Deployment

1. A Render web service created from the GitHub repository, branch `main`,
   on the free instance type. Render reads the Node version (22.x) from the
   root `package.json`.
2. Build command `npm run build`; start command `npm start`.
3. Environment variables above added under Environment. `PORT` is not set,
   because Render provides it.
4. A production GitHub OAuth app registered with the callback URL
   `https://ai-capsule-22640875abhaya.onrender.com/auth/github/callback`.

The root `package.json` defines both commands. `npm run build` installs and
builds the React client, then installs the server's dependencies. `npm start`
runs `node server/src/index.js`, which serves the React build and the API from
the same public URL.

## Required cURL tests

Run against the deployed application on 22 September 2026.

**Test 1 — no authentication**

```
curl -i https://ai-capsule-22640875abhaya.onrender.com/api/capsules
```

Result:

```
HTTP/2 401
content-type: application/json; charset=utf-8
x-powered-by: Express
x-render-origin-server: Render

{"error":"Unauthorized"}
```

**Test 2 — fake JWT**

```
curl -i -H "Cookie: token=fake-token-123" https://ai-capsule-22640875abhaya.onrender.com/api/capsules
```

Result:

```
HTTP/2 401
content-type: application/json; charset=utf-8
x-powered-by: Express
x-render-origin-server: Render

{"error":"Unauthorized"}
```

**Health check**

```
curl -i https://ai-capsule-22640875abhaya.onrender.com/api/health
```

Result: `HTTP/2 200` with body `{"status":"ok"}`.

Test 1 shows that the capsule API requires authentication. Test 2 shows that
the server verifies the JWT signature, rather than only checking that a
`token` cookie is present.

## Limitation

Deployed data is not permanent. Because the free Render service uses a
temporary filesystem, every capsule is lost when the service restarts — after a
redeploy, or when it wakes from sleeping after about 15 minutes idle. A user
who saves prompts and returns the next day will find an empty dashboard.
The fix would be a hosted database such as Render PostgreSQL in place of the
SQLite file.

## AI-assisted development

**AI tool used.** Claude (Anthropic) was used throughout: to plan the
architecture, generate the Express routes, SQLite queries, OAuth and JWT code,
React components and CSS, write the deployment configuration and the
`verify.js` test script, and help debug.

**Problem found and corrected in AI-generated configuration.** The generated
root build script installed the client with a plain `npm install`. The
deployment sets `NODE_ENV=production`, and the host makes environment
variables available during the build; when that variable is set, npm skips
devDependencies — and Vite, which performs the React build, is a
devDependency. The deployed build would have failed with `vite: not found`. Running the client install with
`NODE_ENV=production` locally reproduced the failure exactly. Changing the
script to `npm --prefix client install --include=dev` fixed it, and the same
test then built successfully.

**A problem I hit myself.** The generated configuration runs the backend on
port 5000. On my Mac the server crashed on startup with
`EADDRINUSE: address already in use :::5000`. Running `lsof -i :5000` showed
the port was held by macOS's AirPlay Receiver, which listens on 5000. Turning
off AirPlay Receiver in System Settings freed the port without changing any
code or the GitHub callback URL.

A further, smaller correction: the generated `package.json` listed older
versions of `better-sqlite3` and `dotenv` than npm actually installs. After a
real install and test run, the version ranges were updated to match the tested
versions (`better-sqlite3` 13.x, `dotenv` 18.x).

**How OAuth login, JWT verification and protected API behaviour were
verified.**
- Signed in through GitHub on the deployed site and reached the dashboard.
- Checked in Safari's Web Inspector that the `token` cookie is HttpOnly with
  SameSite Lax. Locally Secure is off, as intended for plain HTTP; in
  production the cookie is issued with Secure because `NODE_ENV=production`.
- Ran both required cURL tests against the deployed URL; both returned 401.
- `npm run verify` also confirms that an expired token, a token signed with a
  different secret, and an unsigned `alg: none` token are all rejected with
  401, that POST, PUT and DELETE reject unauthenticated requests, that
  `/auth/github` redirects to GitHub with an HttpOnly state cookie, and that
  the callback rejects a forged `state` value.

**How CRUD behaviour and user data ownership were verified.**
- Created, read, updated and deleted records in the deployed application,
  reloading after each change to confirm it was saved.
- `npm run verify` signs requests as two different users and confirms that
  each user sees only their own records, that the second user's PUT and DELETE
  on the first user's record return 404 and leave it unchanged, and that a
  `user_id` supplied in the request body is ignored in favour of the JWT
  identity.

**An implementation decision I can explain.** I served the React build and
the Express API from a single Render web service on one public URL, instead of
hosting the frontend separately. The assignment requires the JWT in an
HttpOnly cookie, which JavaScript cannot read, so the browser has to send it
automatically — and browsers only do that reliably for first-party requests.
With one origin the cookie is first-party both locally (through the Vite
proxy) and in production, so I avoided `SameSite=None`, CORS credential
settings and third-party cookie blocking. The trade-off is that the frontend
cannot be scaled or cached on a CDN independently of the API, which does not
matter at this size.
