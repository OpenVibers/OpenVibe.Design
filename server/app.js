'use strict';

/**
 * OpenVibe.Design — Express app factory; server/index.js listens, tests build their own instance with a temporary
 * database and mock Network/AI.
 *
 *   /, /studio, /t/:slug, /arena/*, /developers   the pages (http/pages.js)
 *   /api/v1/arena/*                               the Arena API (http/arena-api.js)
 *   /tokens/<theme>.<ext>                         a theme as the file every tool can read (http/tokens.js)
 *   /api/themes/*, /api/me/theme*                 the theme API proxy to OpenVibe.Network (http/api.js)
 *   /auth/*                                       Network SSO with PKCE (auth/sso.js)
 *   /internal/events                              ADR-033 account export/deletion (identity/account-data.js)
 *   /api/health, /api/ready, /release.json        liveness, truthful readiness, release metadata
 *   /robots.txt, /sitemap.xml, /llms.txt          crawl artifacts (http/discovery.js)
 *
 * Bench generates Arena rounds asynchronously. The request that starts a round only queues it.
 */
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const contracts = require('openvibe-contracts');
const cache = require('openvibe-shared/cache-policy');
const releaseLib = require('openvibe-shared/release');
const metricsLib = require('openvibe-shared/metrics');
const serve = require('openvibe-shared/serve');
const { createNetworkSender } = require('openvibe-sdk/account-data');

const configLib = require('./config');
const { openStore } = require('./db');
const { createKeyStore } = require('./auth/keys');
const settingsLib = require('./settings');
const { verifyServiceToken } = require('openvibe-sdk/auth');
const { createSso } = require('./auth/sso');
const { createThemeCatalog } = require('./themes');
const { createSearchIndex } = require('./search-index');
const { createApi } = require('./http/api');
const { createMcpRoutes } = require('./http/mcp');
const { createArenaApi } = require('./http/arena-api');
const { createDesignApi } = require('./http/design-api');
const { createDesigns } = require('./designs');
const { createSharing, describeRef } = require('./sharing');
const { createPageRoutes } = require('./http/pages');
const { createTokenFileRoutes } = require('./http/tokens');
const { createDiscoveryRoutes } = require('./http/discovery');
const { createIconRoutes } = require('./http/icons');
const { createFontRoutes } = require('./http/fonts');
const { createFontCatalog } = require('./fonts/catalog');
const { createServiceReadiness } = require('./observability');
const { createArenaStore } = require('./arena/store');
const { createArenaAi } = require('./arena/ai');
const { createBenchClient } = require('./arena/bench');
const accountDataLib = require('./identity/account-data');
const { PUBLIC_DIR, assetVersion } = require('./assets');
const views = require('./views');

const VERSION = require('../package.json').version;

/**
 * opts: config, store, catalog, arena, arenaAi, accountSend, fetchImpl, log, now, release
 * A test passes a migrated store and can inject the Arena, the AI client and the account sender.
 */
async function createApp(opts = {}) {
    const config = opts.config || configLib.load();
    const log = opts.log || console;
    const fetchImpl = opts.fetchImpl || globalThis.fetch;
    const now = opts.now || (() => Date.now());

    const s = opts.store || await openStore(config, { now, log });
    const keys = createKeyStore({ config, fetchImpl, log });
    const sso = createSso({ config, keys, fetchImpl, log, now });
    // D11 owner settings (design.publishing): created before the app mounts /internal/config. A failure leaves
    // Design serving (the Figma token falls back to the environment) and says why in the log.
    let settings = null;
    if (opts.settings) settings = opts.settings;
    else {
        try {
            const made = settingsLib.createSettings({ db: s.db, env: opts.env || process.env, log });
            await made.ready;
            settings = settingsLib.activate(made);
        } catch (err) {
            log.warn('[OpenVibe.Design] owner settings unavailable, the publishing tokens fall back to the environment:', err && err.message);
        }
    }
    const catalog = opts.catalog || createThemeCatalog({ config, fetchImpl, log, now });
    // The icon and theme pages in OpenVibe.Search (started by server/index.js, never under DESIGN_DRILL).
    const searchIndex = opts.searchIndex || createSearchIndex({ config, s, catalog, log });
    const bench = opts.bench || createBenchClient({ config, fetchImpl, log });
    const arena = opts.arena || createArenaStore({ s, config, bench, log });
    const ai = opts.arenaAi || opts.ai || createArenaAi({ config, fetchImpl, log });
    // The Arena generation job now lives on Bench; Design keeps a no-op loop for test compatibility.
    const jobs = opts.jobs || { tick: async () => null, start: () => null, stop: () => null, get running() { return false; } };
    // Sharing (openvibe-sdk/share): the shares row next to each signed-in maker's design, the one access
    // check every read path asks, and the uniform API below. Guest designs keep their secret edit key.
    const sharing = opts.sharing || createSharing({ db: s.db, config, log, now });
    const designs = opts.designs || createDesigns({ s, ai, bench, catalog, config, log, now, sharing });
    // Publishing a design on openvibe.space (open item D8).
    const publisher = opts.publisher || require('./publish').createPublisher({ config, fetchImpl, log });
    const accountData = accountDataLib.create({ db: s.db, log });
    const picks = opts.picks || require('./brand-picks').createBrandPicks({ db: s.db, now });
    const fonts = opts.fonts || createFontCatalog({ db: s.db, fetchImpl, now, log });
    await fonts.seedMissing();
    // The typefaces and vectors a person makes with the model (plan R1 item 8): the store, the drawing
    // service and the routes that serve them.
    const aiStore = opts.aiStore || require('./typefaces/store').createStore({ db: s.db, log, now: () => new Date(now()) });
    const maker = opts.maker || require('./typefaces/service').createService({ db: s.db, ai, store: aiStore, config, log, s, sharing });
    const accountSend = opts.accountSend || (config.oauth.clientSecret
        ? createNetworkSender({ networkInternalUrl: config.networkInternalUrl, clientId: config.oauth.clientId, clientSecret: config.oauth.clientSecret, fetch: fetchImpl })
        : async () => { throw new Error('OV_OAUTH_CLIENT_SECRET is not set: Design cannot answer account events'); });

    const ctx = {
        config, s, store: s, keys, sso, settings, catalog, searchIndex, arena, bench, ai, jobs, designs, sharing, publisher, accountData, accountSend, log, picks, fonts, aiStore, maker,
        random: opts.random || Math.random,
    };

    const release = opts.release || releaseLib.createRelease({ service: 'design', root: path.join(__dirname, '..') });
    views.setRelease(release.release);
    views.configure({ baseUrl: config.baseUrl });

    const app = express();
    app.disable('x-powered-by');
    // Cloudflare Turnstile on the guest icon form (L50 step 5), only when both of its keys are set.
    // The arena draws each Bench output in a sandboxed frame from Bench's render origin (plan L51).
    const benchRender = config.bench && /^https?:\/\/[^/\s'";]+$/.test(String(config.bench.renderOrigin || '')) ? [config.bench.renderOrigin] : [];
    const turnstileSrc = config.glyphGuests && config.glyphGuests.turnstileSiteKey && config.glyphGuests.turnstileSecret ? ['https://challenges.cloudflare.com'] : [];
    app.set('trust proxy', config.trustProxy);
    app.locals.ctx = ctx;

    const metrics = metricsLib.instrument(app, { service: 'design', release: release.release });
    app.locals.metrics = metrics.registry;
    release.mount(app, { registry: metrics.registry });

    // ── Machine endpoints ───────────────────────────────────
    app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'openvibe-design', version: VERSION }));
    const readiness = createServiceReadiness({ s, config, catalog, keys, release: release.release, sso});
    app.get('/api/ready', readiness.handler);

    app.use(contracts.http.middleware());
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                // The OpenVibe Frame (theme-loader, navbar, footer) comes from the Network; the inline init is ours.
                scriptSrc: ["'self'", "'unsafe-inline'", 'https://openvibe.network', 'https://static.cloudflareinsights.com', ...turnstileSrc],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://openvibe.network', 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
                fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'],
                // Theme previews may carry inline data: images and any https image the catalogue references.
                imgSrc: ["'self'", 'data:', 'https:'],
                // The footer's release line hears OpenVibe.Events; Cloudflare's beacon reports page timings.
                connectSrc: ["'self'", 'https://openvibe.network', 'https://openvibe.chat', 'https://cloudflareinsights.com', 'https://openvibe.events'],
                // 'self' covers the Arena's about:srcdoc iframes; generated pages cannot navigate the top window.
                frameSrc: ["'self'", 'https://openvibe.network', ...turnstileSrc, ...benchRender],
                frameAncestors: ["'none'"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'", 'https://openvibe.network'],
            },
        },
        frameguard: { action: 'deny' },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: 'same-site' },
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }));
    app.use(cookieParser());
    const agentLayer = express();
    const agentDescriptor = {
        id: 'design', name: 'OpenVibe.Design', purpose: 'Public theme tokens and component specifications.',
        home: config.baseUrl, api: '/api/v1', docs: '/developers', mcp: { url: '/mcp' }, openapi: '/openapi.json',
        policy: { auth: ['none'] },
    };
    require('openvibe-shared/agent-layer').mount(agentLayer, { descriptor: agentDescriptor });
    app.use((req, res, next) => req.path === '/.well-known/agent.json' ? agentLayer(req, res, next) : next());

    // ── Per-IP budget for the API and sign-in (120 a minute) ─
    const limiter = rateLimit({
        windowMs: 60_000,
        limit: config.rateLimitPerMinute || 120,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => contracts.http.sendProblem(res, 429, 'rate_limited', {
            detail: 'too many requests from this address; retry shortly',
            ctx: req.ov,
        }),
    });
    app.use(['/api', '/auth'], limiter);

    // ── Who is signed in, then sign-in itself ───────────────
    app.use(sso.middleware());
    app.use('/auth', sso.routes());
    // The MCP endpoint, after the session middleware: the tools that make a typeface or a vector are charged to
    // the person who calls them, so they need to know who that is. The read-only tools answer as before.
    app.use(createMcpRoutes(ctx));

    // ── Account export/deletion from OpenVibe.Events (loopback only) ──
    // Raw body first: the SDK verifies the delivery signature over the exact bytes.
    app.use('/internal/events', accountData.consumer({ secrets: config.events.secrets, send: accountSend }));

    // ── D11 owner settings (openvibe-shared/config): Network's admin proxy, acting for the owner, reads and
    // writes design.publishing (the Figma token). Loopback only, guarded by design.config.manage; a secret
    // change needs X-OV-Fresh: 1, and the test route makes one cheap authenticated Figma read.
    if (settings) {
        const configGuard = async (req, res, next) => {
            if (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.headers['cf-connecting-ip']) {
                return res.status(404).json({ code: 'design.not_found', error: 'no such route' });
            }
            const header = String(req.headers.authorization || '');
            if (!header.startsWith('Bearer ')) return res.status(401).json({ code: 'token.missing', error: 'a service token is required' });
            const r = await verifyServiceToken(header.slice(7).trim(), {
                jwks: `${config.networkInternalUrl}/api/.well-known/jwks`, issuer: config.networkIssuer, audience: 'openvibe.design',
                contracts: require('openvibe-contracts'),
            });
            if (!r.ok) return res.status(r.code === 'token.unavailable' ? 503 : 401).json({ code: r.code, error: r.reason || 'the token does not verify' });
            const contracts = require('openvibe-contracts');
            const decision = contracts.capabilities.check(r.claims, 'design.config.manage');
            const granted = decision.allowed || contracts.capabilities.grants(r.claims.cap, 'design.config.manage');
            if (!granted) return res.status(403).json({ code: 'capability.denied', error: 'design.config.manage is not granted' });
            req.principal = { sub: r.claims.sub, cap: r.claims.cap, jti: r.claims.jti };
            return next();
        };
        app.use('/internal/config', express.json({ limit: '64kb' }));
        settings.mount(app, { guard: configGuard, log });
    }

    // ── Static assets (content-hashed ?v= → immutable) ──────
    app.use('/shared', serve.handler());
    // Terms, Privacy and DMCA in this site's own words (openvibe-shared/legal, profile 'service'; 11-03: the footer's
    // legal links answered 404 here). The facts must match the code: change both together.
    const legal = require('openvibe-shared/legal');
    app.get(legal.PATHS, legal.handler({
        "host": "openvibe.design",
        "name": "OpenVibe.Design",
        "id": "design",
        "service": "design",
        "profile": "service",
        "what": "Try any OpenVibe theme on a Live channel, a Chat room and a shop at once, change its colours with contrast checks that must pass, use it on every site, and step back to any earlier look.",
        "makes": [
                "your themes and designs, with each earlier version",
                "the designs you publish, which are public"
        ],
        "ai": true
    }));
    const setAssetHeaders = (res, filePath) => {
        const rel = path.relative(PUBLIC_DIR, filePath).split(path.sep).join('/');
        const v = res.req && res.req.query && res.req.query.v;
        res.setHeader('Cache-Control', cache.assetHeaders(rel, { hashed: Boolean(v) && v === assetVersion(rel) }));
    };
    app.use('/css', express.static(path.join(PUBLIC_DIR, 'css'), { index: false, redirect: false, setHeaders: setAssetHeaders }));
    app.use('/js', express.static(path.join(PUBLIC_DIR, 'js'), { index: false, redirect: false, setHeaders: setAssetHeaders }));
    // The mark's intro, as the files /brand offers to download.
    app.use('/brand/motion', express.static(path.join(PUBLIC_DIR, 'brand', 'motion'), { index: false, redirect: false, setHeaders: setAssetHeaders }));

    // ── /api/v1/<kind>/<id>/share — the uniform share API (openvibe-sdk/share) ────
    // GET/PUT /api/v1/design/:id/share, .../share/requests, .../share/transfer[/accept|decline|cancel],
    // GET /api/v1/share/people?name=, GET /api/v1/shared-with-me. Authentication is Design's own session;
    // a guest key is never a share owner. The router answers only its own paths, so the rest of /api/v1
    // keeps its own 404.
    {
        const routed = Object.create(sharing.shares);
        routed.getWithRevision = async (viewer, ref) => { await sharing.ensure(ref.id); return await sharing.shares.getWithRevision(viewer, ref); };
        routed.update = async (viewer, ref, body, extra) => { await sharing.ensure(ref.id); return await sharing.shares.update(viewer, ref, body, extra); };
        routed.requestAccess = async (viewer, ref) => { await sharing.ensure(ref.id); return await sharing.shares.requestAccess(viewer, ref); };
        const shareApi = express.Router();
        shareApi.use((req, res, next) => {
            req.shareViewer = req.viewer && req.viewer.kind === 'user' ? { subject: { type: 'user', id: req.viewer.subject }, staff: false } : null;
            next();
        });
        shareApi.use(sharing.shares.router({
            service: 'design',
            authenticate: (req) => req.shareViewer || null,
            describe: describeRef(s.db, config),
        }));
        const SHARE_PATH = /^\/api\/v1\/(?:shared-with-me$|share\/people$|design\/[^/]+\/share(?:\/|$))/;
        app.use((req, res, next) => (SHARE_PATH.test(req.path) ? shareApi(req, res, next) : next()));
        if (!opts.startSharingWorker) {
            const timer = setInterval(() => { sharing.work().catch(() => { /* logged inside */ }); }, 15_000);
            if (timer.unref) timer.unref();
            app.locals.sharingTimer = timer;
        }
    }
    // ── API: the Arena, the glyphs (with their pages), then the theme proxy ──
    app.use('/api/v1/designs', express.json({ limit: '256kb' }), createDesignApi(ctx));
    app.use('/api', express.json({ limit: '64kb' }));
    app.use('/api/v1/arena', createArenaApi(ctx));
    app.use('/api/v1/brand', require('./http/brand-api').createBrandApi(ctx));
    app.get('/api/v1/prompts', (req, res) => { res.set('Cache-Control', 'public, max-age=300'); res.json({ prompts: require('./views/prompts').list() }); });
    app.use(createIconRoutes(ctx));
    // The public page routers are built before they are mounted: the Markdown twins render through the same routers
    // (server/agent-twins.js), so a twin cannot drift from the page a browser gets.
    const { createTypefaceRoutes, createVectorRoutes } = require('./http/typefaces');
    const typefaceRoutes = createTypefaceRoutes(ctx);
    const vectorRoutes = createVectorRoutes(ctx);
    const fontRoutes = createFontRoutes(ctx);
    const pageRoutes = createPageRoutes(ctx);
    const twinRouter = express.Router();
    twinRouter.use(typefaceRoutes);
    twinRouter.use(vectorRoutes);
    twinRouter.use(fontRoutes);
    twinRouter.use(pageRoutes);
    // The Markdown twins of the public pages, and the head link and Link: header that name them (SEO-1,
    // server/agent-twins.js): a twin is the page rendered signed out. Mounted before every page router so a
    // page that answers 200 names its own twin.
    require('./agent-twins').mountTwins(app, { router: twinRouter, descriptor: agentDescriptor, baseUrl: ctx.config.baseUrl });
    // The typefaces and vectors a person makes with the model (plan R1 item 8): the makers, the
    // specimens and the API for agents. These come before the font library's /fonts/:family, so
    // /fonts/make is the maker and not a family called "make".
    app.use(typefaceRoutes);
    app.use(vectorRoutes);
    app.use(fontRoutes);
    app.use('/api', createApi(ctx));
    // GET /openapi.json (SEO-3): the API as OpenAPI 3.1. It is not in openvibe-contracts, so the document is read from
    // the routes this app mounts under /api/, with the summaries the API files' header comments give them
    // (server/http/openapi-routes.js).
    {
        const d = agentDescriptor;
        const site = String(config.baseUrl).replace(/\/+$/, '');
        app.get('/openapi.json', require('./http/openapi-routes').openapiRoute(app, {
            title: `${d.name} API`, description: d.purpose, version: require('../package.json').version, baseUrl: site,
            docs: `${site}/developers`,
            files: ['http/api.js', 'http/arena-api.js', 'http/brand-api.js', 'http/design-api.js', 'http/fonts.js'].map((f) => require('path').join(__dirname, f)),
        }));
    }
    app.use('/api', (req, res) => contracts.http.sendProblem(res, 404, 'route.not_found', {
        detail: 'No such API route.',
        ctx: req.ov,
    }));

    // ── Crawl artifacts ─────────────────────────────────────
    app.use(createDiscoveryRoutes(ctx));

    // ── The token files: /tokens/<theme>.<ext> (a theme as the file every tool can read) ──
    app.use('/tokens', createTokenFileRoutes(ctx));

    // ── Pages ───────────────────────────────────────────────
    app.use(pageRoutes);

    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, _next) => {
        // Never log request bodies (a prompt or a generated page can be large or personal).
        log.error('[OpenVibe.Design]', err && err.message ? err.message.slice(0, 300) : err);
        if (res.headersSent) return;
        res.set('Cache-Control', 'no-store');
        if (err && err.type === 'entity.parse.failed') return contracts.http.sendProblem(res, 400, 'request.malformed_json', { ctx: req.ov });
        if (err && err.type === 'entity.too.large') return req.path.startsWith('/api/') ? contracts.http.sendProblem(res, 413, 'request.too_large', { ctx: req.ov }) : res.status(413).type('text/plain').send('That request was too large.');
        if (req.path.startsWith('/api/')) return contracts.http.sendProblem(res, 500, 'internal.error', { detail: 'Internal error', ctx: req.ov });
        return res.status(500).type('text/plain').send('Something went wrong on our side. Try again in a moment.');
    });

    return { app, ctx };
}

module.exports = { createApp };
