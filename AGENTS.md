# AGENTS.md — OpenVibe.Design

## Project overview

The Design room: the theme studio where a person browses OpenVibe's themes, tries them on previews, edits
one with WCAG contrast checks, uses it, submits it to the gallery and rolls back to an earlier setting;
**Design Studio v1** (`/create`) where one prompt becomes three model variants; and the **Design Arena**
where two outputs are judged blind at phone and desktop sizes and an Elo leaderboard per category ranks
the designers with cost and time. Node.js/Express, PostgreSQL (or PGlite in development), CommonJS, **no
build step**.

- Service id `design`, port `5090`, origin `https://openvibe.design`, unit `openvibe-design.service`,
  release root `/opt/openvibe.design`.
- It stores no accounts and no tokens: the person's Network session lives in httpOnly cookies and their
  theme lives in **OpenVibe.Network**; Arena rounds, entries, judgements and ratings live in
  **OpenVibe.Bench**. The legacy `arena_*` tables remain only for historical account events/migration.
- Sign-in is an OAuth 2 client of Network (`design`, authorization code + PKCE S256, state check, server-
  side exchange). Every theme read/write is proxied to Network's `/api/themes` with the person's token.

## What it owns

- The studio UI and its derived token set, the contrast checks, previews (Live channel, Chat room, shop
  grid), colour-vision views, gallery submission, history and restore.
- The token files (`/tokens/<theme>.<ext>`) every tool can read, the icon/font/typeface endpoints, the
  component registry, patterns and vectors, brand motion and the `changes` history.
- Design Studio (`/create`, `/d/:id`): three model variants through AI route pins, an HTML sanitizer,
  phone/tablet/desktop canvases, guest drafts (private cookie, max three) and per-day limits.
- The Design Arena surface, its sanitized HTML in sandboxed CSP-capped iframes, blind voting and the
  open JSONL dataset; Bench is the rating/storage authority.
- The design-owned rows: designs, components, gallery/element records, deep-dive proposals, account-data
  receipts and the migration's legacy tables.
- The pages (`/`, `/studio`, `/t/:slug`, `/arena/*`, `/create`, `/d/:id`, `/developers`, `/brand`), the
  MCP endpoint, the API and discovery files.

Not owned: theme selection/storage (Network), Arena ratings/rounds (Bench), model execution (AI), the
shared Frame/kit (`openvibe-shared`), identity.

## Who calls it, and whom it calls

- Callers: people in the browser; MCP clients; sites/tools reading `/tokens/*`, icons, fonts; services
  with a Network service token audience `openvibe.design` and the route's capability.
- Depends on: **Network** (SSO, `/api/themes`, projects/grants); **AI** (generate jobs, `ai.run.create`,
  Design's client credentials); **Bench** (Arena rounds/entries/judgements/ratings, including
  `bench.entry.create`); **Events** (account export/deletion); **Publishing** (SEO/SSR/index); PostgreSQL
  and `openvibe-shared` for the Frame/kit/legal/SEO. The Bench scope must include `bench.entry.create` in
  addition to the Arena capabilities.

## Repository map

- **Entry:** [server/index.js](server/index.js) — `createApp()`, listen, graceful stop.
- **App:** [server/app.js](server/app.js) — helmet/CSP, `/auth`, `/internal/events`, `/internal/config`,
  `/shared`, `/css`, `/js`, `/brand/motion`, `/changes`, `/api/v1/designs`, `/api/v1/gallery`, `/api`
  (themes proxy), `/api/create`, `/api/v1/arena`, `/api/v1/brand`, `/tokens`, icons/fonts.
- **Config/db:** [server/config.js](server/config.js), [server/db.js](server/db.js),
  [server/settings.js](server/settings.js).
- **Studio/tokens:** [server/themes.js](server/themes.js), [server/tokens.js](server/tokens.js),
  [server/tokens/](server/tokens/) (`kit.js`, `formats.js`, `exports.js`), [server/typefaces/](server/typefaces/),
  [server/vectors/svg.js](server/vectors/svg.js), [server/patterns/catalog.js](server/patterns/catalog.js),
  [server/kit/](server/kit/).
- **Arena/studio:** [server/arena/](server/arena/) (`ai.js`, `jobs.js`, `store.js`, `bench.js`,
  `sanitize.js`, `kinds.js`), [server/designs.js](server/designs.js),
  [server/create/](server/create/) (`api.js`, `options.js`, `billing.js`), [server/deepdive/](server/deepdive/).
- **Elements/components:** [server/elements/](server/elements/), [server/components/store.js](server/components/store.js),
  [server/publish.js](server/publish.js), [server/design-edit.js](server/design-edit.js).
- **HTTP:** [server/http/](server/http/) — `pages.js`, `api.js`, `arena-api.js`, `design-api.js`, `tokens.js`,
  `mcp.js`, `icons.js`, `fonts.js`, `brand-api.js`, `gallery-api.js`, `discovery.js`, `same-origin.js`.
- **Browser:** [public/js/studio.js](public/js/studio.js) and the page scripts/CSS in [public/](public/).
- **Deploy:** [deploy/systemd/openvibe-design.service](deploy/systemd/openvibe-design.service),
  [deploy/nginx/openvibe.design.conf](deploy/nginx/openvibe.design.conf).

## Commands

```bash
npm ci
cp .env.example .env       # BASE_URL, OV_OAUTH_CLIENT_SECRET; Network URLs optional
npm run dev                # http://localhost:5090
npm test                   # test/run.js, PGlite, mock Network/AI/Bench
npm test -- studio         # filter by file name
ov test                    # the harness's sharded run of what the change reaches
node --check <file.js>
```

## Database and migrations

Design's own PostgreSQL database on the host's data role (ADR-035); embedded PGlite in development and
tests. Async through `openvibe-sdk/db`; migrations `migrations/NNNN_*.sql` (through `0024_element_gallery.sql`)
applied at boot; never edit an applied one, add a new number. Themes are not stored here — Network owns
them; rounds/ratings are Bench's. The `arena_*` tables are legacy and must not be written.

## Auth and security

- People sign in through Network SSO; session tokens are httpOnly cookies and are only ever sent as the
  `Authorization` header to the configured Network origin. Nothing renders or logs them.
- A **theme write must come from this site's own origin** (`Origin` check); another site cannot make a
  signed-in visitor change their theme.
- `next` after sign-in is a path on this site only; control characters and backslashes are refused.
- Model output is sanitized and rendered **only in sandboxed, CSP-capped iframes**; every dynamic value
  in the placeholder views goes through the shared `esc`.
- Service callers need a Network service token audience `openvibe.design` and the route's capability.
- Secrets are environment-only; only variable names appear in code and docs.

## Frontend loading model

Server-rendered pages plus no-build browser scripts ([public/js/studio.js](public/js/studio.js) derives the
token set from six colours); no SPA, bundler or transpiler. `openvibe-shared` supplies the Frame, kit and
`/shared/*` from the pinned node_modules; `/tokens/*`, icons and fonts are served by Design. Readiness is
truthful: `/api/ready` reports `degraded` (HTTP 200) when Network does not answer, and the pages and crawl
files still serve.

## Deploy

`sudo ovhost deploy design` (checkout at `/opt/openvibe.design`, unit `openvibe-design.service` on
`127.0.0.1:5090`, env `/etc/openvibe/design.env`). nginx
[deploy/nginx/openvibe.design.conf](deploy/nginx/openvibe.design.conf) is installed with `ov-vhost-install`
and allows GET/POST/PUT on `/api` and GET on `/auth`. Migrations run at boot; no secret in a command
line, file or log.

## Tests

`npm test` runs each `test/*.test.js` in its own process with PGlite and in-process Network/AI/Bench
mocks. It pins the theme proxy (token handling, 4xx pass-through, 502 on a Network failure), the Origin
check, the WCAG gate and token derivation, the studio/previews, the Arena sanitizer and sandboxed frames,
blind voting and Bench calls, designs/guest limits, account export/deletion and discovery. `ov test` runs
the same.

## Conventions

- CommonJS, 4-space indent, single quotes, semicolons; factories with injectable config/db/clock/fetch/log.
- Colours/tokens are data: derive them, never hard-code a token set in a page. WCAG contrast is a gate,
  not a warning, except "lines against cards", which is advisory.
- Errors are problem+json with stable codes; Network 4xx answers pass through, a Network failure is 502.
- Model output is untrusted: sanitize, sandbox, escape, cap.

## Pitfalls

- **Network owns the theme.** Do not add a local theme store or a direct browser write; the proxy is the
  only path, and the person's token never leaves the server header.
- **The Origin check protects writes.** A same-site-but-not-own-origin POST must fail.
- **The contrast checks gate "Use this theme".** Do not enable it when a required check fails; do not turn
  the advisory "lines against cards" into a blocker.
- **Arena output is untrusted HTML.** Keep the sanitizer and the sandboxed CSP iframe; never render model
  HTML in the page's own document.
- **Bench is the rating authority.** Do not add a local Elo table or count a vote twice; rounds/entries/
  judgements go to Bench, and the legacy `arena_*` tables stay read-only.
- **Guests are rate-limited and drafts are capped at three** in a private cookie; a signed-in design
  belongs to its subject, not the cookie.
- **Do not log, render or echo a token**, including in an error path.
- **`/api/ready` degraded is not a failure** when Network is down; do not turn it into a 503 that removes
  the studio from service.

## Documentation

- [README.md](README.md) — what the studio/Arena are, pages, token files, API/MCP, sign-in, config, deploy,
  security.
- [STATUS.json](STATUS.json) — the precise v2 summary.
- OpenVibe.Contracts holds `design.*`/`bench.*` shapes; Network owns `themes`, Bench owns ratings.
