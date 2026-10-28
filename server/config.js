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

        // Arena budgets and jobs. Both limits are per UTC day; the drill flag keeps the worker from starting.
        arena: {
            perDay: Math.max(1, int(env.DESIGN_ARENA_PER_DAY, 3)),
            daily: Math.max(1, int(env.DESIGN_ARENA_DAILY, 20)),
            intervalMs: Math.max(250, int(env.DESIGN_ARENA_JOB_INTERVAL_MS, 1500)),
            pollMs: Math.max(250, int(env.DESIGN_ARENA_POLL_MS, 20_000)),
            maxPrompt: Math.max(20, int(env.DESIGN_ARENA_MAX_PROMPT, 4000)),
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
