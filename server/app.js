'use strict';

/**
 * OpenVibe.Design — Express app factory; server/index.js listens, tests build their own instance with a mock
 * Network.
 *
 *   /, /studio, /t/:slug, /developers        the pages (http/pages.js)
 *   /api/themes/*, /api/me/theme*            the theme API proxy to OpenVibe.Network (http/api.js)
 *   /auth/*                                  Network SSO with PKCE (auth/sso.js)
 *   /api/health, /api/ready, /release.json   liveness, truthful readiness, release metadata
 *   /robots.txt, /sitemap.xml, /llms.txt     crawl artifacts (http/discovery.js)
 *
 * Stateless: no database, no Valkey, no Events. The only dependency is OpenVibe.Network, for sign-in and the theme
 * API; the pages and the public catalogue degrade honestly without it.
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

const configLib = require('./config');
const { createKeyStore } = require('./auth/keys');
const { createSso } = require('./auth/sso');
const { createThemeCatalog } = require('./themes');
const { createApi } = require('./http/api');
const { createPageRoutes } = require('./http/pages');
const { createDiscoveryRoutes } = require('./http/discovery');
const { createServiceReadiness } = require('./observability');
const { PUBLIC_DIR, assetVersion } = require('./assets');
const views = require('./views');

const VERSION = require('../package.json').version;

/**
 * opts: config, catalog, fetchImpl, log, now, release
 * `catalog` is the public theme client; a test passes an object with the same methods, or a fetchImpl that talks to
 * an in-process Network.
 */
function createApp(opts = {}) {
    const config = opts.config || configLib.load();
    const log = opts.log || console;
    const fetchImpl = opts.fetchImpl || globalThis.fetch;
    const now = opts.now || (() => Date.now());

    const keys = createKeyStore({ config, fetchImpl, log });
    const sso = createSso({ config, keys, fetchImpl, log, now });
    const catalog = opts.catalog || createThemeCatalog({ config, fetchImpl, log, now });
    const ctx = { config, keys, sso, catalog, log };

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
    const readiness = createServiceReadiness({ config, catalog, keys, release: release.release });
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

    // ── Static assets (content-hashed ?v= → immutable) ──────
    app.use('/shared', serve.handler());
    const setAssetHeaders = (res, filePath) => {
        const rel = path.relative(PUBLIC_DIR, filePath).split(path.sep).join('/');
        const v = res.req && res.req.query && res.req.query.v;
        res.setHeader('Cache-Control', cache.assetHeaders(rel, { hashed: Boolean(v) && v === assetVersion(rel) }));
    };
    app.use('/css', express.static(path.join(PUBLIC_DIR, 'css'), { index: false, redirect: false, setHeaders: setAssetHeaders }));
    app.use('/js', express.static(path.join(PUBLIC_DIR, 'js'), { index: false, redirect: false, setHeaders: setAssetHeaders }));

    // ── API: the theme proxy ────────────────────────────────
    app.use('/api', express.json({ limit: '64kb' }));
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
        // Never log request bodies (a theme's variables can be large, a person's request can be personal).
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
