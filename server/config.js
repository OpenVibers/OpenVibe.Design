'use strict';

/**
 * OpenVibe.Design configuration. Every value comes from the environment (production:
 * /etc/openvibe/design.env, see .env.example). Only environment variable NAMES appear in code and docs; secrets are
 * never logged.
 *
 * load(env) is pure so tests can build a config without touching process.env.
 */
require('dotenv').config();

const trim = (s) => String(s || '').replace(/\/+$/, '');
const int = (v, def) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : def);

function load(env = process.env) {
    const nodeEnv = env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';
    const port = int(env.PORT, 5090);
    const baseUrl = trim(env.BASE_URL || (isProduction ? 'https://openvibe.design' : `http://localhost:${port}`));
    // The Network's public origin is where a browser is sent to authorize. Its internal origin is where this
    // service exchanges the code, fetches the JWKS and proxies the theme API; neither a person's browser nor their
    // token ever talks to it directly.
    const networkPublicUrl = trim(env.OV_NETWORK_URL || 'https://openvibe.network');
    const networkInternalUrl = trim(env.OV_NETWORK_INTERNAL_URL || 'http://127.0.0.1:4000');
    const aiUrl = trim(env.OV_AI_INTERNAL_URL || 'http://127.0.0.1:4700');

    return {
        service: 'design',
        name: 'OpenVibe.Design',
        port,
        host: env.HOST || '127.0.0.1',
        nodeEnv,
        isProduction,
        baseUrl,
        trustProxy: env.TRUST_PROXY != null ? Number(env.TRUST_PROXY) : 2,
        drill: env.DESIGN_DRILL === '1' || env.DESIGN_DRILL === 'true',

        // The theme API proxy (server/http/api.js): every call goes to the Network's /api/themes. `networkUrl`
        // is the internal origin the proxy and the token exchange use; `networkPublicUrl` is the browser's.
        networkUrl: networkInternalUrl,
        networkPublicUrl,
        networkInternalUrl,
        networkIssuer: trim(env.OV_NETWORK_ISSUER || networkPublicUrl),
        themeCacheMs: Math.max(0, int(env.DESIGN_THEME_CACHE_MS, 5 * 60_000)),
        timeoutMs: Math.max(200, int(env.DESIGN_UPSTREAM_TIMEOUT_MS, 8000)),

        // PostgreSQL (ADR-035): DATABASE_URL serves (PgBouncer), DATABASE_DIRECT_URL migrates (owner role). In
        // development without DATABASE_URL an embedded PGlite database in data/pglite is used.
        db: { url: env.DATABASE_URL || '', directUrl: env.DATABASE_DIRECT_URL || '', pgliteDir: env.DESIGN_PGLITE_DIR || env.DESIGN_DATABASE_DIR || env.PGLITE_DIR || '' },

        // OpenVibe.AI: the generate operation. Design is a first-party service and asks for a client-credentials
        // token (audience openvibe.ai, scope ai.run.create; Network grants the ai.* namespace). Generation is
        // picked up by the job loop, never by the request that creates a round.
        ai: {
            url: aiUrl,
            audience: env.DESIGN_AI_AUDIENCE || 'openvibe.ai',
            scope: env.DESIGN_AI_SCOPE || 'ai.run.create',
            waitMs: Math.max(1000, int(env.DESIGN_AI_WAIT_MS, 55_000)),
            timeoutMs: Math.max(1000, int(env.DESIGN_AI_TIMEOUT_MS, 120_000)),
            pollMs: Math.max(100, int(env.DESIGN_AI_POLL_MS, 1500)),
            // Optional explicit slots, `provider:model,provider:model,provider:model`. Without it Design reads the
            // models the chat/generate route offers and asks the router for three of them.
            models: String(env.DESIGN_ARENA_MODELS || '').split(',').map((x) => x.trim()).filter(Boolean),
            maxHtmlBytes: 200 * 1024,
        },

        // Who alone may decide a rule a report proposes (the Network owner account). A username, as Network's own
        // owner guard uses, with the owner role as the other accepted claim.
        ownerUsername: String(env.DESIGN_OWNER_USERNAME || env.OWNER_USERNAME || 'goosely'),

        // OpenVibe.Exchange's icon reference search (the Exchange platform API at api.openvibe.exchange, served by
        // OpenVibe.AI): Design mints its own client-credentials token (audience openvibe.ai, scope
        // exchange.search.icons) and needs no Exchange key. EXCHANGE_SEARCH_KEY is the owner's override.
        exchange: {
            url: trim(env.EXCHANGE_API_URL || 'https://api.openvibe.exchange'),
            audience: env.DESIGN_EXCHANGE_AUDIENCE || 'openvibe.ai',
            scope: env.DESIGN_EXCHANGE_SCOPE || 'exchange.search.icons',
            key: String(env.EXCHANGE_SEARCH_KEY || ''),
            timeoutMs: Math.max(1000, int(env.DESIGN_EXCHANGE_TIMEOUT_MS, 5000)),
        },

        // A deep dive (contract ai.deep-dive@1): an AI run on the person's behalf, priced per depth before it starts.
        // The workflow and the prices are AI's; DESIGN_DEEP_DIVE_PRICES is only the fallback for a deployment whose
        // options endpoint does not answer yet (quick=0.2,thorough=0.5,expert=1.2).
        deepDive: {
            url: trim(env.DESIGN_DEEP_DIVE_URL || env.OV_AI_INTERNAL_URL || aiUrl),
            workflow: env.DESIGN_DEEP_DIVE_WORKFLOW || 'design.deep_dive',
            optionsPath: env.DESIGN_DEEP_DIVE_OPTIONS_PATH || '',
            startPath: env.DESIGN_DEEP_DIVE_START_PATH || '',
            deepDivesPath: env.DESIGN_DEEP_DIVE_START_PATH ? '' : '',
            prices: env.DESIGN_DEEP_DIVE_PRICES || 'quick=0.2,thorough=0.5,expert=1.2',
            reportPath: env.DESIGN_DEEP_DIVE_REPORT_PATH || '/deep-dive/:id',
            cropPath: env.DESIGN_DEEP_DIVE_CROP_PATH || '/api/v1/deep-dives/:runId/shots/:cropId',
            publicReportBase: trim(env.OV_EXCHANGE_URL || 'https://openvibe.exchange'),
            exchangeUrl: trim(env.OV_EXCHANGE_INTERNAL_URL || 'http://127.0.0.1:5150'),
            timeoutMs: Math.max(1000, int(env.DESIGN_DEEP_DIVE_TIMEOUT_MS, 30_000)),
            pollMs: Math.max(200, int(env.DESIGN_DEEP_DIVE_POLL_MS, 4000)),
            waitMs: Math.max(0, int(env.DESIGN_DEEP_DIVE_WAIT_MS, 0)),
            maxWaitMs: Math.max(30_000, int(env.DESIGN_DEEP_DIVE_MAX_WAIT_MS, 15 * 60_000)),
            // The owner approves a proposed rule on /rules; the approval opens a pull request on the register with
            // this token. Without one the approval is recorded and the page says a PR needs the token: nothing is
            // added to the register by itself.
            githubToken: env.DESIGN_RULES_GITHUB_TOKEN || '',
            repo: env.DESIGN_RULES_REPO || 'OpenVibers/OpenVibe.Design',
            registerPath: env.DESIGN_RULES_PATH || 'server/rules/register.js',
            branchPrefix: env.DESIGN_RULES_BRANCH_PREFIX || 'rules/research',
            ownerUsername: String(env.DESIGN_OWNER_USERNAME || env.OWNER_USERNAME || 'goosely'),

        },

        // OpenVibe.Media: a starting picture is uploaded there by the page and the create request carries its id;
        // Design names its public file address in the prompt and never takes raw image bytes.
        media: {
            publicOrigin: trim(env.OV_MEDIA_PUBLIC_ORIGIN || 'https://openvibe.media'),
        },

        // OpenVibe.Billing: the person's Balance, read with their own token for the create estimate. Off (null)
        // when the service is not on this host; the estimate then says the Balance is unknown, never zero.
        billing: {
            internalUrl: trim(env.OV_BILLING_INTERNAL_URL || 'http://127.0.0.1:4600'),
            timeoutMs: Math.max(500, int(env.DESIGN_BILLING_TIMEOUT_MS, 3000)),
        },

        // OpenVibe.Space (open item D8): a design is published as a static site, with Design's service token acting for
        // the person (X-OV-Subject); Network grants space.site.manage and space.deploy.create.
        space: {
            url: trim(env.OV_SPACE_INTERNAL_URL || 'http://127.0.0.1:4940'),
            audience: env.DESIGN_SPACE_AUDIENCE || 'openvibe.space',
            scope: env.DESIGN_SPACE_SCOPE || 'space.site.manage space.deploy.create',
            timeoutMs: 30_000,
        },

        // OpenVibe.Bench: Design creates tasks with its service token. A round uses its creator's Network token
        // so Bench can enforce personal budgets and prevent voting on one's own round.
        bench: {
            url: trim(env.OV_BENCH_INTERNAL_URL || 'http://127.0.0.1:5230'),
            publicUrl: trim(env.OV_BENCH_URL || 'https://bench.openvibe.services'),
            // Bench's cookie-less render origin: the arena frames each output from it (plan L51).
            renderOrigin: trim(env.OV_BENCH_RENDER_ORIGIN || 'https://bench-render.openvibe.services'),
            audience: env.DESIGN_BENCH_AUDIENCE || 'openvibe.bench',
            scope: env.DESIGN_BENCH_SCOPE || 'bench.task.create bench.round.create bench.round.read bench.judgement.cast bench.entry.create bench.board.read',
        },

        // Drawing an icon without signing in (plan L50 step 5): caps per guest, per address and for all guests a day,
        // and Cloudflare Turnstile when both of its keys are set (the guest form then carries its widget).
        glyphGuests: {
            perGuest: Math.max(0, int(env.DESIGN_GLYPH_GUEST_PER_DAY, 2)),
            perAddress: Math.max(0, int(env.DESIGN_GLYPH_GUEST_PER_ADDRESS, 4)),
            daily: Math.max(0, int(env.DESIGN_GLYPH_GUEST_DAILY, 25)),
            turnstileSiteKey: env.DESIGN_TURNSTILE_SITE_KEY || '',
            turnstileSecret: env.DESIGN_TURNSTILE_SECRET || '',
        },

        // Design Studio part B: a small per-design AI edit budget (click edits and undo do not spend AI).
        studio: {
            chatEditsPerDesign: Math.max(1, int(env.DESIGN_CHAT_EDITS_PER_DESIGN, 5)),
        },

        // OpenVibe.Live's element library (OpenVibe Elements stage 2): the person's own token adds the element
        // to their channel; Design never holds a Live token of its own for this.
        live: {
            url: trim(env.OV_LIVE_URL || 'https://openvibe.live'),
            elementsPath: env.OV_LIVE_ELEMENTS_PATH || '/api/me/elements',
            timeoutMs: Math.max(1000, int(env.DESIGN_LIVE_TIMEOUT_MS, 15_000)),
        },

        // The typefaces and vectors a person makes with the model (plan R1 item 8): how many model runs
        // one person may make a day. A typeface is several runs (the letters are drawn a batch at a time),
        // so the cap counts runs, not pages.
        aiMake: {
            perDay: Math.max(0, int(env.DESIGN_AI_MAKE_PER_DAY, 20)),
        },

        // Arena budgets and jobs. Both limits are per UTC day; the drill flag keeps the worker from starting.
        arena: {
            perDay: Math.max(1, int(env.DESIGN_ARENA_PER_DAY, 3)),
            daily: Math.max(1, int(env.DESIGN_ARENA_DAILY, 20)),
            intervalMs: Math.max(250, int(env.DESIGN_ARENA_JOB_INTERVAL_MS, 1500)),
            pollMs: Math.max(250, int(env.DESIGN_ARENA_POLL_MS, 20_000)),
            maxPrompt: Math.max(20, int(env.DESIGN_ARENA_MAX_PROMPT, 4000)),
            // Judging without signing in (plan L51): Bench caps each voter (30 a day) and Design's relay, but not the
            // address behind a relayed vote, so Design caps that itself. 0 turns signed-out voting off.
            guestVotesPerAddress: Math.max(0, int(env.DESIGN_ARENA_GUEST_VOTES_PER_ADDRESS, 60)),
        },

        // OpenVibe.Events → this service for ADR-033 account export/deletion. Off when the secret is unset.
        events: {
            secrets: String(env.DESIGN_EVENTS_SECRET || '').split(',').map((x) => x.trim()).filter(Boolean),
            url: trim(env.DESIGN_EVENTS_URL || env.EVENTS_URL || ''),
            endpoint: env.DESIGN_EVENTS_ENDPOINT || '',
        },

        // OpenVibe.Network: SSO (OAuth2 authorization server with PKCE) and its JWKS.
        oauth: {
            clientId: env.OV_OAUTH_CLIENT_ID || 'design',
            clientSecret: env.OV_OAUTH_CLIENT_SECRET || '',
            redirectUri: env.OV_OAUTH_REDIRECT_URI || `${baseUrl}/auth/callback`,
            scope: 'profile',
            sessionAudience: env.OV_SESSION_AUDIENCE || 'openvibe.network',
        },
        cookies: { secure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProduction },

        // One per-IP budget for /api and /auth (express-rate-limit, one 60 s window).
        rateLimitPerMinute: Math.max(1, int(env.DESIGN_RATE_LIMIT_PER_MIN, 120)),
    };
}

module.exports = { load };
