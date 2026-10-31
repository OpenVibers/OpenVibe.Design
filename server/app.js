'use strict';

/**
 * OpenVibe.Design — Express app factory; server/index.js listens, tests build their own instance with a temporary
 * database and mock Network/AI.
 *
 *   /, /studio, /t/:slug, /arena/*, /developers   the pages (http/pages.js)
 *   /api/v1/arena/*                               the Arena API (http/arena-api.js)
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
const { createSso } = require('./auth/sso');
const { createThemeCatalog } = require('./themes');
const { createApi } = require('./http/api');
const { createMcpRoutes } = require('./http/mcp');
const { createArenaApi } = require('./http/arena-api');
const { createDesignApi } = require('./http/design-api');
const { createDesigns } = require('./designs');
const { createPageRoutes } = require('./http/pages');
const { createDiscoveryRoutes } = require('./http/discovery');
const { createIconRoutes } = require('./http/icons');
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
    const catalog = opts.catalog || createThemeCatalog({ config, fetchImpl, log, now });
    const bench = opts.bench || createBenchClient({ config, fetchImpl, log });
    const arena = opts.arena || createArenaStore({ s, config, bench, log });
    const ai = opts.arenaAi || opts.ai || createArenaAi({ config, fetchImpl, log });
    // The Arena generation job now lives on Bench; Design keeps a no-op loop for test compatibility.
    const jobs = opts.jobs || { tick: async () => null, start: () => null, stop: () => null, get running() { return false; } };
    const designs = opts.designs || createDesigns({ s, ai, bench, catalog, config, log, now });
    const accountData = accountDataLib.create({ db: s.db, log });
    const accountSend = opts.accountSend || (config.oauth.clientSecret
        ? createNetworkSender({ networkInternalUrl: config.networkInternalUrl, clientId: config.oauth.clientId, clientSecret: config.oauth.clientSecret, fetch: fetchImpl })
        : async () => { throw new Error('OV_OAUTH_CLIENT_SECRET is not set: Design cannot answer account events'); });

    const ctx = {
        config, s, store: s, keys, sso, catalog, arena, bench, ai, jobs, designs, accountData, accountSend, log,
        random: opts.random || Math.random,
    };

    const release = opts.release || releaseLib.createRelease({ service: 'design', root: path.join(__dirname, '..') });
    views.setRelease(release.release);
    views.configure({ baseUrl: config.baseUrl });

    const app = express();
    app.disable('x-powered-by');
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
                scriptSrc: ["'self'", "'unsafe-inline'", 'https://openvibe.network', 'https://static.cloudflareinsights.com'],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://openvibe.network', 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
                fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
                // Theme previews may carry inline data: images and any https image the catalogue references.
                imgSrc: ["'self'", 'data:', 'https:'],
                // The footer's release line hears OpenVibe.Events; Cloudflare's beacon reports page timings.
                connectSrc: ["'self'", 'https://openvibe.network', 'https://cloudflareinsights.com', 'https://openvibe.events'],
                // 'self' covers the Arena's about:srcdoc iframes; generated pages cannot navigate the top window.
                frameSrc: ["'self'", 'https://openvibe.network'],
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
    app.use(createMcpRoutes(ctx));
    const agentLayer = express();
    require('openvibe-shared/agent-layer').mount(agentLayer, { descriptor: {
        id: 'design', name: 'OpenVibe.Design', purpose: 'Public theme tokens and component specifications.',
        home: config.baseUrl, api: '/api/v1', docs: '/developers', mcp: { url: '/mcp' },
        policy: { auth: ['none'] },
    } });
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

    // ── Account export/deletion from OpenVibe.Events (loopback only) ──
    // Raw body first: the SDK verifies the delivery signature over the exact bytes.
    app.use('/internal/events', accountData.consumer({ secrets: config.events.secrets, send: accountSend }));

    // ── Static assets (content-hashed ?v= → immutable) ──────
    app.use('/shared', serve.handler());
    const setAssetHeaders = (res, filePath) => {
        const rel = path.relative(PUBLIC_DIR, filePath).split(path.sep).join('/');
        const v = res.req && res.req.query && res.req.query.v;
        res.setHeader('Cache-Control', cache.assetHeaders(rel, { hashed: Boolean(v) && v === assetVersion(rel) }));
    };
    app.use('/css', express.static(path.join(PUBLIC_DIR, 'css'), { index: false, redirect: false, setHeaders: setAssetHeaders }));
    app.use('/js', express.static(path.join(PUBLIC_DIR, 'js'), { index: false, redirect: false, setHeaders: setAssetHeaders }));

    // ── API: the Arena, the glyphs (with their pages), then the theme proxy ──
    app.use('/api/v1/designs', express.json({ limit: '256kb' }), createDesignApi(ctx));
    app.use('/api', express.json({ limit: '64kb' }));
    app.use('/api/v1/arena', createArenaApi(ctx));
    app.use(createIconRoutes(ctx));
    app.use('/api', createApi(ctx));
    app.use('/api', (req, res) => contracts.http.sendProblem(res, 404, 'route.not_found', {
        detail: 'No such API route.',
        ctx: req.ov,
    }));

    // ── Crawl artifacts ─────────────────────────────────────
    app.use(createDiscoveryRoutes(ctx));

    // ── Pages ───────────────────────────────────────────────
    app.use(createPageRoutes(ctx));

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
