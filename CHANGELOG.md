# Changelog

What changed in OpenVibe.Design, newest first. Each site also publishes its patch notes at /updates.

## 0.1.0 — 2026-10-28

The service skeleton: sign-in and the theme API proxy.

- **Sign-in with OpenVibe.Network** (`server/auth/sso.js`, OAuth client `design`): authorization code with PKCE
  S256, a state check, a server-side code exchange, httpOnly `design_at` and `design_rt` cookies
  (SameSite=Lax, Secure in production), the `design_oauth` flow cookie, and `sanitizeNext` (this site's own origin
  only, no control characters or backslashes). `/auth/login`, `/auth/callback`, `/auth/logout`, `/auth/me`.
- **The theme API proxy** (`server/http/api.js`): all calls go to OpenVibe.Network's `/api/themes` with the
  person's access token from the cookie as a Bearer. `GET /api/themes` is the public catalogue, cached in memory
  for 5 minutes; `GET /api/themes/:idOrSlug` is one public theme; `GET`/`PUT /api/me/theme` read and save the
  person's theme (`source: 'studio'`); `GET /api/me/theme/history` and `POST /api/me/theme/history/:id/restore`
  read and roll back the history; `POST /api/themes/submit` submits a theme to the gallery. Writes need the
  request's Origin to be this site's own origin, otherwise 403 `design.cross_site`. Network 4xx answers pass
  through; a Network failure is 502; `/api/me/*` is `private, no-store`.
- **Pages** (`server/http/pages.js`, `server/views/index.js`): `/`, `/studio`, `/t/:slug` and `/developers`, all
  server-rendered through the OpenVibe Frame and complete without JavaScript, plus a 404. The views are plain
  placeholders here: the main session designs the pages and writes `public/js/studio.js`.
- **Plumbing** (`server/app.js`): helmet with the network's CSP, content-hashed `/css` and `/js`, `/api/health`,
  `/api/ready` (degraded when Network does not answer), `/release.json`, `/release-metrics`, `/shared/*`,
  `/robots.txt`, `/sitemap.xml` (the public themes), `/llms.txt`, a 120/min per-IP limit on `/api` and `/auth`,
  and a graceful stop.
- **Deploy:** `deploy/systemd/openvibe-design.service` (port 5090, `/etc/openvibe/design.env`) and
  `deploy/nginx/openvibe.design.conf` (TLS for openvibe.design, www → apex, GET/POST/PUT on `/api`, GET on
  `/auth`).
- **Tests:** `test/sso.test.js`, `test/proxy.test.js` and `test/pages.test.js`, each against an in-process
  OpenVibe.Network stand-in with a real RS256 key pair.
