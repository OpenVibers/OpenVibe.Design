# OpenVibe.Design

> Make it yours, find the best AI designer.

**Status:** v2, the theme studio and the Design Arena (v0.1.0, see [STATUS.json](STATUS.json)).
**Domain:** `openvibe.design` · **Port:** 5090 · **Service id:** `design` · **Env prefix:** `DESIGN`
**License:** AGPL-3.0-only (the same as every OpenVibe service).

OpenVibe.Design is the Design room: the theme studio where a person browses OpenVibe's themes, tries them on
previews, edits one with contrast checks, uses it, submits it to the gallery, and rolls back to any earlier
setting, and the Design Arena where one prompt goes to three AI models, two outputs are judged blind at phone and
desktop sizes, and an Elo leaderboard per category ranks the designers with the cost and time of every generation.
Theme selection stays in OpenVibe.Network; this service signs the person in and proxies their calls to the
Network's theme API.

## What it is

- **Identity:** service id `design`, name OpenVibe.Design, port 5090, host 127.0.0.1. It stores no accounts and
  no tokens: the person's Network session lives in httpOnly cookies and their theme lives in OpenVibe.Network. The
  Arena's rounds, outputs, votes and Elo ratings live in this service's PostgreSQL database (PGlite in development).
- **Sign-in:** an OAuth 2 client of OpenVibe.Network (`design`), authorization code with PKCE S256, a state check
  and a server-side code exchange.
- **The theme API proxy:** every theme read and write goes to OpenVibe.Network's `/api/themes`, with the person's
  access token from the `design_at` cookie as a Bearer. The proxy never logs, renders or echoes the token.

## The studio

- **Gallery:** every theme in the catalogue, filtered by dark or light; picking one paints the previews.
- **Previews:** the theme is tried on three sites at once: a Live channel, a Chat room and a shop's grid. They read
  only theme tokens, so they look exactly as the sites will. *See it as* repaints them as people with protanopia,
  deuteranopia or tritanopia see them (SVG colour matrices).
- **Editor:** six colours (background, surface, text, muted text, accent, lines); [public/js/studio.js](public/js/studio.js)
  derives the full token set from them, the same tokens Network's validator accepts.
- **Checks:** WCAG contrast for text on the background and on cards, muted text, button text and links. Every
  required check must pass before *Use this theme* is enabled; *Lines against cards* is advisory.
- **Use, share, roll back:** *Use* is `PUT /api/me/theme` (source `studio`), *Share it in the gallery* submits the
  theme for review, and *History* lists the person's earlier looks with a one-tap *Restore*.

## The Design Arena

- **A round:** a signed-in person writes one prompt in one of six categories (landing, dashboard, mobile app, game
  UI, logo, slides). It is queued; the job loop reads the offers on OpenVibe.AI's `generate` routing and pins three
  distinct ones (`route: { provider, model }`), and each output stores the HTML (sanitized), the provider and model AI
  reports, its cost, its measured time and its tokens. When AI offers fewer than three, the remaining slots go to its
  pool and the round says so (`pool_fallback: true`).
- **Budgets:** `DESIGN_ARENA_PER_DAY` (default 3) rounds per person per UTC day and `DESIGN_ARENA_DAILY` (default 20)
  for the whole site. A refusal says which budget was reached and when to come back.
- **Safety:** the model's page is text until it is rendered, and then only inside `<iframe sandbox srcdoc>` with no
  `allow-scripts` and no `allow-same-origin`. A CSP meta in the srcdoc blocks every network fetch
  (`default-src 'none'; style-src 'unsafe-inline'; img-src data:`). Scripts, `on*` handlers and `javascript:` URLs
  are stripped before storage, and an output is capped at 200 KB.
- **Voting:** `/arena/vote` serves two successful outputs in random order with the model names hidden. One vote per
  person per round; the round's creator cannot vote. A vote reveals both models and updates the category's Elo
  ratings (K = 32, a tie is 0.5, `both_bad` is a game for neither).
- **Leaderboard:** per category: model, Elo, games, wins, losses, ties, win rate, median cost and median time.
- **Open dataset:** `GET /api/v1/arena/dataset.jsonl` is one JSON object per round with its prompt, every output
  (metadata and HTML) and every vote without a voter id.
- **AI access:** Design is a first-party service and calls AI with a client-credentials token from Network:
  audience `openvibe.ai`, scope `ai.run.create` (and the `ai.generate` namespace in the grant). It pins one of that
  routing's listed offers per slot; AI refuses anything it does not offer in words, and a pin never bypasses its
  quotas or budgets. Generation is off under `DESIGN_DRILL=1`; the job loop starts with the process otherwise.

## Pages

| Route | What it is |
|---|---|
| `/` | the theme catalogue's front door |
| `/studio` | the theme studio; includes `/js/studio.js` and `/css/design.css` |
| `/t/:slug` | one public theme (Network 404 → the 404 page) |
| `/arena` | the Arena leaderboard per category and the way to start a round |
| `/arena/new` | the start-a-round form (works without JavaScript) |
| `/arena/vote` | the next blind pair, and the reveal after a vote |
| `/arena/r/:id` | one round: every output at 390 px and 1280 px, with cost and time |
| `/developers` | the API, for people and agents |
| anything else | the 404 page |

All of them are server-rendered through the OpenVibe Frame (`openvibe-shared/shell`) and readable without
JavaScript. A page rendered for a signed-in person is `private, no-store`; a public page is
`public, max-age=120` with `Vary: Cookie`.

## API

The theme surface is proxied to `config.networkUrl` (`OV_NETWORK_INTERNAL_URL`, default `http://127.0.0.1:4000`)
under `/api/themes`; the Arena's own data is under `/api/v1/arena`. Errors are RFC 9457
`application/problem+json`. Arena reads are public; writes need the session and a same-origin signal
(`Sec-Fetch-Site: same-origin`, else an `Origin` equal to the site). A missing signal is refused on a cookie write;
a Bearer write is not cookie-authenticated and is unaffected.

| Route | Auth | What it does |
|---|---|---|
| `GET /api/themes` | none | the public catalogue; cached in memory 5 minutes |
| `GET /api/themes/:idOrSlug` | none | one public theme |
| `GET /api/me/theme` | cookie | Network `GET /api/themes/me/active` → `{ theme_id, theme, custom_variables }`; 401 when signed out |
| `PUT /api/me/theme` | cookie + same-origin | Network `PUT /api/themes/me` with `{ theme_id, custom_variables, source: "studio" }` |
| `GET /api/me/theme/history` | cookie | Network `GET /api/themes/me/history` |
| `POST /api/me/theme/history/:id/restore` | cookie + same-origin | Network's restore; `id` must be a positive integer, else 400 |
| `POST /api/themes/submit` | cookie + same-origin | Network `POST /api/themes` with `{ name, slug, description, mode, variables, tags }` |
| `POST /api/v1/arena/rounds` | cookie + same-origin | queue a round `{ category, prompt }` (subject to the two daily budgets) |
| `GET /api/v1/arena/rounds/:id` | none | one round with its outputs, cost and time |
| `GET /api/v1/arena/vote` | cookie | the next blind pair for this person (models hidden) |
| `POST /api/v1/arena/vote` | cookie + same-origin | `{ round_id, left_output, right_output, winner }`; reveals both models and updates Elo |
| `GET /api/v1/arena/leaderboard?category=…` | none | Elo, games, win rate, median cost and median time |
| `GET /api/v1/arena/dataset.jsonl` | none | prompts, outputs (HTML included) and votes without voters |

- A Network **4xx** answer passes through with its status and body; a Network failure (no answer, timeout, 5xx)
  is a `502 network.unavailable` problem.
- A cookie-authenticated write (`PUT`, `POST`) without `Sec-Fetch-Site: same-origin` or this site's `Origin` is refused with `403 design.cross_site`; a Bearer write is unaffected.
- Everything under `/api/me/*` carries `Cache-Control: private, no-store`.

Plumbing: `GET /api/health`, `GET /api/ready` (the database is required; Network, JWKS and the OAuth client are
optional checks), `GET /release.json`, `POST /release-metrics`, `/shared/*` (the pinned Frame), `/css/*` and
`/js/*` (content-hashed `?v=` → immutable), `GET /robots.txt`, `GET /sitemap.xml` (the public themes),
`GET /llms.txt` and `GET /metrics` (loopback only).

## Sign-in

`server/auth/sso.js` is OpenVibe.Help's module with this site's names:

- `GET /auth/login?next=/studio[&silent=1]` mints a state and a PKCE S256 verifier/challenge, stores them (and the
  sanitized `next`) in the httpOnly `design_oauth` flow cookie scoped to `/auth`, and redirects to
  `${OV_NETWORK_URL}/oauth/authorize` with `client_id=design` and `redirect_uri=${BASE_URL}/auth/callback`.
- `GET /auth/callback` checks the state in constant time, exchanges the code at the Network's internal
  `/oauth/token` with the client secret and the code verifier, and sets `design_at` (24 h) and `design_rt` (30 d):
  httpOnly, SameSite=Lax, Secure in production, Path=/.
- `GET /auth/logout` clears them and revokes the refresh token (best effort); `GET /auth/me` answers `{ user }` or
  `{ user: null }` for the shared navbar. A FedCM assertion or an app/service token never becomes a session.
- `sanitizeNext` accepts same-site relative paths only. An absolute URL on this site's own origin counts as its
  path; another origin, `//evil`, a control character or a backslash goes to `/`.

The Network signs the access token (RS256); `server/auth/keys.js` fetches and refreshes its JWKS from
`${OV_NETWORK_INTERNAL_URL}/api/.well-known/jwks` through `openvibe-sdk/auth`.

## Configuration

See [.env.example](.env.example). Required in production: `BASE_URL` and `OV_OAUTH_CLIENT_SECRET` (the `design`
OAuth client on the Network). Optional: `OV_NETWORK_URL` (default `https://openvibe.network`),
`OV_NETWORK_INTERNAL_URL` (default `http://127.0.0.1:4000`), `OV_NETWORK_ISSUER`, `OV_OAUTH_REDIRECT_URI`,
`DESIGN_THEME_CACHE_MS`, `DESIGN_UPSTREAM_TIMEOUT_MS`, `DESIGN_RATE_LIMIT_PER_MIN` and `COOKIE_SECURE`.

## How to run

```bash
npm install
npm run dev            # http://localhost:5090
OV_ALLOW_SUITE=1 npm test
```

`npm test` runs every `test/*.test.js` in its own process with an in-process OpenVibe.Network stand-in
(`test/helpers/network.js`): a real RS256 key pair, the JWKS, the OAuth token endpoint, the theme catalogue and
the person's theme routes. Nothing calls the real internet. `OV_ALLOW_SUITE=1` is the suite opt-in the shared
test runner expects.

## Deploy (for the lead)

- **Deploy:** `sudo ovhost deploy design` on the host (checkout at `/opt/openvibe.design`, unit
  `openvibe-design.service` on 127.0.0.1:5090, env `/etc/openvibe/design.env`).
- **nginx:** [deploy/nginx/openvibe.design.conf](deploy/nginx/openvibe.design.conf), installed with
  `ov-vhost-install`. It allows GET/POST/PUT on `/api` and GET on `/auth`.
- **Readiness:** `/api/ready` reports `degraded` (HTTP 200) when OpenVibe.Network does not answer; the process
  still serves the pages and the crawl artifacts.

## Security (threat notes)

Reporting a vulnerability: [SECURITY.md](SECURITY.md).

- Session tokens are httpOnly cookies; no script can read them and nothing renders or logs them. The only place
  they go is the `Authorization` header of a request to the configured Network origin.
- A theme write must come from this site's own origin (the `Origin` header), so another site cannot make a
  signed-in visitor change their theme.
- `next` after sign-in is this site's own path only; control characters and backslashes are refused because
  browsers drop or rewrite them.
- Every dynamic value in the placeholder views goes through the shared `esc`; the views are plain and show model
  text escaped.
- Secrets live only in the environment file; only variable names appear in code and docs, and no secret or token
  is logged.

---

Part of the [OpenVibe network](https://openvibe.network). Built in the open by
[OpenVibers](https://github.com/OpenVibers).

<!-- versions:start -->
- openvibe-contracts: v0.227.0
- openvibe-sdk: v0.70.0
- openvibe-shared: v4.33.0
<!-- versions:end -->
