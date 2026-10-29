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
  Arena rounds, entries, judgements and ratings live in OpenVibe.Bench. The legacy `arena_*` tables remain for historical account events and migration.
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

## Design Studio v1

`/create` takes one prompt and shows three model variants on `/d/:id`. The variants use the Arena's OpenVibe.AI route pins and HTML sanitizer. The canvas supports phone, tablet and desktop widths, and changing the token theme repaints all frames. A signed-in design belongs to its Network subject. A guest receives a secret link, kept among the last three drafts in a private cookie. Guests can create two designs per day per IP; signed-in people can create ten. Generation progress is polled, and completed frames appear individually.

Pick one frame with **Use this design**: it becomes the working frame, its HTML becomes version 1 and the pick is recorded as one Arena vote through OpenVibe.Bench (a signed-in person votes once; a guest's pick is saved without a vote). Edit it by chat (`POST /api/v1/designs/:id/edit`) or by clicking an element: the iframe reports `body > …:nth-of-type(n)`, and the floating panel changes its text, theme-token colour, padding or alignment. The server validates the path, tag and values, escapes the text, rebuilds only the inline style and saves a new version; the overlay script is injected at render time and is never stored with the model HTML. Versions are append-only in `design_versions`; undo/redo move the pointer (`design_picks.current_seq`), and an edit after undo appends a new version instead of deleting the old ones. Chat edits cost AI money, so each design has a small AI-edit budget (`DESIGN_CHAT_EDITS_PER_DESIGN`, default 5); a failed attempt spends budget but never replaces the last good version.

The API is under `/api/v1/designs`; `/developers` lists the routes. `migrations/0002_design_studio.sql` stores each design and its JSON variants in one row, and `0003_design_working_versions.sql` adds the pick, its Bench vote fields, the AI-edit counter and the version table, using the service's existing PostgreSQL or development PGlite setup. Production needs the existing `DATABASE_URL` and `DATABASE_DIRECT_URL` roles and working OpenVibe.AI and OpenVibe.Bench service credentials (the Bench scope now includes `bench.entry.create` so Design can submit the generated variants to the pick-vote round). Checks, HTML/zip export, preview publishing and MCP remain part C.

## The Design Arena

- **A round:** a signed-in person writes one prompt in one of six categories. Design creates a public Bench task of
  kind `design.page`, or `design.component` for logo, then creates a round. Bench queues and generates three entries
  through OpenVibe.AI, including their HTML, provider, model, cost, time and tokens.
- **Budgets:** Bench enforces its per-person and site daily round limits.
- **Safety:** the model's page is text until it is rendered, and then only inside `<iframe sandbox srcdoc>` with no
  `allow-scripts` and no `allow-same-origin`. A CSP meta in the srcdoc blocks every network fetch
  (`default-src 'none'; style-src 'unsafe-inline'; img-src data:`). Scripts, `on*` handlers and `javascript:` URLs
  are stripped before storage, and an output is capped at 200 KB.
- **Voting:** `/arena/vote` serves two successful outputs in random order with the model names hidden. One vote per
  person per round; the round's creator cannot vote. A vote reveals both models and updates the category's Elo
  ratings (K = 32, a tie is 0.5, `both_bad` is a game for neither).
- **Leaderboard:** Bench Elo boards for both kinds, including confidence intervals and provisional status, and
  Bench Cost boards with entries, usable entries, total cost and cost per solved entry.
- **Open dataset:** `GET /api/v1/arena/dataset.jsonl` redirects to Bench's `design.page` JSONL dataset.
- **Bench access:** Design uses a client-credentials token (audience `openvibe.bench`) to create tasks and read
  boards. It sends the creator's Network token to create each round so Bench records ownership and enforces the
  personal budget and creator vote rule. Blind pairs and votes also use the person's token.
- **Legacy import:** `scripts/arena-to-bench.js` previews a migration by default. `--apply` copies old rounds and
  outputs and records votes as anonymous `automatic_grader` judgements. Bench's Elo board does not count these
  historical judgements. The importer needs `bench.entry.create` and is subject to Bench's round limits.

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
| `POST /api/v1/designs` | none/cookie + same-origin | create three variants `{ prompt, kind, themeId? }`; a guest gets a secret edit key |
| `GET /api/v1/designs/:id` | owner key or cookie | frames, the working frame, the pick and the versions; guest key in `X-Design-Key` or `?key=` |
| `POST /api/v1/designs/:id/pick` | owner key or cookie + same-origin | `{ variantIndex }`; idempotent, one Arena vote |
| `POST /api/v1/designs/:id/edit` | owner key or cookie + same-origin | chat edit `{ instruction }`; one AI run from the picked variant's model, small per-design budget |
| `POST /api/v1/designs/:id/click` | owner key or cookie + same-origin | `{ path, text?, color?, spacing?, align? }`, validated, saves a version |
| `GET /api/v1/designs/:id/versions` | owner key or cookie | the version list with model/provider provenance |
| `POST /api/v1/designs/:id/undo`, `/redo` | owner key or cookie + same-origin | move the working-frame pointer; history stays |
| `POST /api/v1/arena/rounds` | cookie + same-origin | queue a round `{ category, prompt }` (subject to the two daily budgets) |
| `GET /api/v1/arena/rounds/:id` | none | one round; entries are blind until Bench reveals them to this viewer |
| `GET /api/v1/arena/vote[?category=logo]` | cookie | the next blind pair for this person (models hidden) |
| `POST /api/v1/arena/vote` | cookie + same-origin | `{ round_id, left_output, right_output, winner }`; reveals both models and updates Elo |
| `GET /api/v1/arena/leaderboard?category=…&type=elo\|cost` | none | Bench Elo or Cost board for the category's kind |
| `GET /api/v1/arena/dataset.jsonl` | none | 302 to Bench's `design.page` JSONL dataset |

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
`DESIGN_THEME_CACHE_MS`, `DESIGN_UPSTREAM_TIMEOUT_MS`, `DESIGN_RATE_LIMIT_PER_MIN`, `DESIGN_CHAT_EDITS_PER_DESIGN`
(default 5) and `COOKIE_SECURE`. The Bench scope must include `bench.entry.create` in addition to the Arena
capabilities, so Design can fill the pick-vote round with the variants it already generated.

## How to run

```bash
npm install
npm run dev            # http://localhost:5090
OV_ALLOW_SUITE=1 npm test
```

`npm test` runs every `test/*.test.js` in its own process with in-process OpenVibe.Network and OpenVibe.Bench
stand-ins (`test/helpers/network.js`, `test/helpers/bench.js`). Nothing calls the real internet. `OV_ALLOW_SUITE=1` is the suite opt-in the shared
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
- openvibe-contracts: v0.236.0
- openvibe-sdk: v0.70.0
- openvibe-shared: v4.43.0
<!-- versions:end -->
